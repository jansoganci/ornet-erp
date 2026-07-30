export function normalizeName(value: string | null | undefined): string {
  return (value ?? "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/\s+/g, " ")
    .trim();
}

export function customerToContactPayload(customer: Record<string, unknown>): Record<string, unknown> {
  // Paraşüt has no vkn-vs-tckn field of its own; contact_type is the closest
  // equivalent (tckn holders are natural persons, vkn holders are companies).
  const contactType = customer.identity_type === "tckn" ? "person" : "company";

  return {
    data: {
      type: "contacts",
      attributes: {
        name: customer.company_name,
        account_type: "customer",
        contact_type: contactType,
        tax_number: customer.tax_number || undefined,
        tax_office: customer.tax_office || undefined,
      },
    },
  };
}

function asNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export type InvoiceLineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
};

export function financialTxToSalesInvoicePayload(
  tx: Record<string, unknown>,
  customer: Record<string, unknown>,
  lineItems: InvoiceLineItem[],
): Record<string, unknown> {
  // Always invoice in TRY: Paraşüt's `currency` enum doesn't accept "TRY"
  // (valid values are TRL/USD/EUR/GBP — TRL is Paraşüt's own TRY code), and
  // amount_try/output_vat are already correctly pre-converted to TRY on
  // every posting path (subscription, proposal, work order — see
  // docs/active/parasut-integration-roadmap.md Appendix A.4/§10.4).
  const vatRate = asNumber(tx.vat_rate);

  // VAT is applied at the document level in this project (one vat_rate per
  // proposal/work_order/subscription, not per line) — every detail line
  // gets the same tx.vat_rate, matching CLAUDE.md's finance model.
  const details = (lineItems.length > 0 ? lineItems : [
    { description: String(tx.description || "Hizmet Bedeli"), quantity: 1, unitPrice: asNumber(tx.amount_try) },
  ]).map((item) => ({
    type: "sales_invoice_details",
    attributes: {
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      vat_rate: vatRate,
      // total_vat/total_amount deliberately omitted: not part of
      // Paraşüt's SalesInvoiceDetailAttributes schema — Paraşüt computes
      // them server-side from quantity*unit_price*vat_rate.
      // prepare-invoice.ts verifies the aggregate result after creation.
    },
  }));

  return {
    data: {
      type: "sales_invoices",
      attributes: {
        item_type: "invoice",
        description: tx.description || "Ornet ERP faturası",
        issue_date: tx.transaction_date,
        currency: "TRL",
      },
      relationships: {
        contact: {
          data: {
            id: customer.parasut_contact_id,
            type: "contacts",
          },
        },
        details: { data: details },
      },
    },
  };
}

export function eDocumentPayload(type: "e_invoices" | "e_archives", invoiceId: string): Record<string, unknown> {
  return {
    data: {
      type,
      relationships: {
        sales_invoice: {
          data: {
            id: invoiceId,
            type: "sales_invoices",
          },
        },
      },
    },
  };
}
