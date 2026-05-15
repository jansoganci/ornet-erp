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
  return {
    data: {
      type: "contacts",
      attributes: {
        name: customer.company_name,
        contact_type: "company",
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

export function financialTxToSalesInvoicePayload(
  tx: Record<string, unknown>,
  customer: Record<string, unknown>,
): Record<string, unknown> {
  const amount = asNumber(tx.amount_original ?? tx.amount_try);
  const vatRate = asNumber(tx.vat_rate);
  const outputVat = asNumber(tx.output_vat);
  const grossTotal = amount + outputVat;

  return {
    data: {
      type: "sales_invoices",
      attributes: {
        item_type: "invoice",
        description: tx.description || "Ornet ERP abonelik faturası",
        issue_date: tx.transaction_date,
        currency: tx.original_currency || "TRY",
        exchange_rate: tx.exchange_rate || undefined,
      },
      relationships: {
        contact: {
          data: {
            id: customer.parasut_contact_id,
            type: "contacts",
          },
        },
        details: {
          data: [
            {
              type: "sales_invoice_details",
              attributes: {
                description: tx.description || "Abonelik hizmet bedeli",
                quantity: 1,
                unit_price: amount,
                vat_rate,
                total_vat: outputVat,
                total_amount: grossTotal,
              },
            },
          ],
        },
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
