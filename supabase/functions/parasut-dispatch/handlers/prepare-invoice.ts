import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireRole } from "../core/auth.ts";
import { ParasutInProgressError, ParasutValidationError } from "../core/errors.ts";
import { acquireIdempotency, finishIdempotency, invoiceKey } from "../core/idempotency.ts";
import { financialTxToSalesInvoicePayload, type InvoiceLineItem } from "../core/mappers.ts";
import { parasutRequest } from "../core/parasut-client.ts";

async function loadTransaction(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase
    .from("financial_transactions")
    .select("*, customers(*)")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as Record<string, unknown> & { customers?: Record<string, unknown> };
}

// USD-sourced lines have no TRY unit_price stored per-row on older data —
// fall back to unit_price_usd * tx.exchange_rate (the same document-level
// rate already used to compute financial_transactions.amount_try, so this
// stays internally consistent with the invoice total).
function lineUnitPriceTry(
  unitPriceTry: unknown,
  unitPriceUsd: unknown,
  exchangeRate: number | null,
): number {
  if (unitPriceTry != null) return Number(unitPriceTry);
  if (exchangeRate) return Number(unitPriceUsd ?? 0) * exchangeRate;
  return 0;
}

async function loadLineItems(
  supabase: SupabaseClient,
  tx: Record<string, unknown>,
): Promise<InvoiceLineItem[]> {
  const exchangeRate = tx.exchange_rate != null ? Number(tx.exchange_rate) : null;
  const fallbackLine: InvoiceLineItem[] = [
    { description: String(tx.description || "Hizmet Bedeli"), quantity: 1, unitPrice: Number(tx.amount_try ?? 0) },
  ];

  if (tx.proposal_id) {
    const { data, error } = await supabase
      .from("proposal_items")
      .select("description, quantity, unit_price, unit_price_usd")
      .eq("proposal_id", tx.proposal_id)
      .order("sort_order");
    if (error) throw error;

    const rows = (data ?? []) as Array<{
      description: string | null;
      quantity: number | null;
      unit_price: number | null;
      unit_price_usd: number | null;
    }>;
    const lines = rows.map((item): InvoiceLineItem => ({
      description: item.description || "Kalem",
      quantity: Number(item.quantity ?? 1),
      unitPrice: lineUnitPriceTry(item.unit_price, item.unit_price_usd, exchangeRate),
    }));
    return lines.length > 0 ? lines : fallbackLine;
  }

  if (tx.work_order_id) {
    const { data, error } = await supabase
      .from("work_order_materials")
      .select("description, quantity, unit_price, unit_price_usd, materials(name)")
      .eq("work_order_id", tx.work_order_id)
      .order("sort_order");
    if (error) throw error;

    const rows = (data ?? []) as Array<{
      description: string | null;
      quantity: number | null;
      unit_price: number | null;
      unit_price_usd: number | null;
      materials: { name: string | null } | null;
    }>;
    const lines = rows.map((item): InvoiceLineItem => ({
      description: item.description || item.materials?.name || "Malzeme/Hizmet",
      quantity: Number(item.quantity ?? 1),
      unitPrice: lineUnitPriceTry(item.unit_price, item.unit_price_usd, exchangeRate),
    }));
    return lines.length > 0 ? lines : fallbackLine;
  }

  if (tx.subscription_payment_id) {
    const { data: payment, error } = await supabase
      .from("subscription_payments")
      .select("amount, subscriptions(base_price, sms_fee, line_fee)")
      .eq("id", tx.subscription_payment_id)
      .single();
    if (error) throw error;

    const subPayment = payment as {
      amount: number | null;
      subscriptions: { base_price: number | null; sms_fee: number | null; line_fee: number | null } | null;
    } | null;
    const sub = subPayment?.subscriptions ?? { base_price: 0, sms_fee: 0, line_fee: 0 };
    const basePrice = Number(sub.base_price ?? 0);
    const smsFee = Number(sub.sms_fee ?? 0);
    const lineFee = Number(sub.line_fee ?? 0);
    const currentSum = basePrice + smsFee + lineFee;
    const frozenAmount = Number(subPayment?.amount ?? tx.amount_try ?? 0);

    // Safety net: subscription_payments only stores one frozen total, not a
    // frozen per-component breakdown. Only itemize if today's
    // base_price/sms_fee/line_fee still sum to what was actually billed on
    // this specific payment — if a price revision happened since, current
    // values no longer reflect history, so fall through to one line using
    // the frozen total instead of showing a wrong breakdown.
    if (Math.abs(currentSum - frozenAmount) <= 0.01) {
      const lines: InvoiceLineItem[] = [
        { description: "Abonelik Hizmet Bedeli", quantity: 1, unitPrice: basePrice },
      ];
      if (smsFee > 0) lines.push({ description: "SMS Ücreti", quantity: 1, unitPrice: smsFee });
      if (lineFee > 0) lines.push({ description: "Hat Ücreti", quantity: 1, unitPrice: lineFee });
      return lines;
    }
  }

  return fallbackLine;
}

function validateForDraft(tx: Record<string, unknown>, customer: Record<string, unknown>) {
  if (tx.deleted_at) throw new ParasutValidationError("Deleted transactions cannot be invoiced", 400);
  if (tx.direction !== "income") throw new ParasutValidationError("Only income rows can be invoiced", 400);
  if (tx.parasut_sync_status === "confirmed") throw new ParasutValidationError("Invoice is already confirmed", 409);
  if (tx.parasut_invoice_id) throw new ParasutValidationError("Draft already exists for this transaction", 409);
  // parasut_sync_status is the single source of truth for eligibility —
  // trg_set_subscription_parasut_ready (migration 00217) already computes
  // "ready" vs "not_required" from should_invoice + (for subscription rows)
  // subscriptions.official_invoice. This same trigger logic is why the
  // ~550 historically-imported legacy rows (no proposal_id/work_order_id/
  // subscription_payment_id) should already read "not_required" — their
  // 00217 backfill fell through to the same ELSE branch a normal
  // ineligible row would. Verify this against real data before go-live
  // (spot-check a sample of the legacy rows' parasut_sync_status) rather
  // than trusting this reasoning alone — see docs/active/
  // parasut-implementation-plan.md Phase 3.1.
  if (tx.parasut_sync_status !== "ready") {
    throw new ParasutValidationError(
      `Transaction is not eligible for Paraşüt invoicing (parasut_sync_status=${tx.parasut_sync_status ?? "null"})`,
      400,
    );
  }
  if (!customer?.parasut_contact_id) throw new ParasutValidationError("Customer is not matched with Paraşüt", 400);
  if (!customer?.tax_number || !customer?.identity_type) {
    throw new ParasutValidationError("Customer tax identity is incomplete", 400);
  }
  if (Number(tx.amount_try ?? 0) <= 0) throw new ParasutValidationError("Invoice amount must be positive", 400);
}

export async function prepareInvoice(params: {
  supabase: SupabaseClient;
  correlationId: string;
  actorId: string | null;
  payload?: Record<string, unknown>;
}): Promise<unknown> {
  await requireRole(params.supabase, params.actorId, ["admin", "accountant"]);

  const id = String(params.payload?.financial_transaction_id ?? "");
  if (!id) throw new ParasutValidationError("financial_transaction_id is required", 400);

  const key = invoiceKey(id);
  const idem = await acquireIdempotency(params.supabase, key, "prepare_invoice", id);
  if (!idem.acquired) {
    if (idem.outcome === "replay") {
      // The Paraşüt call already succeeded on a previous attempt. If that
      // attempt then failed to update financial_transactions (network
      // blip, etc.), the row would otherwise be stuck showing no
      // parasut_invoice_id forever even though the draft really exists —
      // repair it here rather than just replaying the cached response.
      // Confirmed bug, independent audit 2026-07-23.
      const cached = idem.response as { data?: { id?: string } } | null;
      const invoiceId = cached?.data?.id;
      if (invoiceId) {
        await params.supabase
          .from("financial_transactions")
          .update({ parasut_invoice_id: invoiceId, parasut_sync_status: "draft", parasut_error: null })
          .eq("id", id);
      }
      return idem.response;
    }
    // "in_progress": a concurrent prepare-invoice call for the same
    // transaction is live right now — surface a distinct, retryable error
    // instead of returning null as if it were a successful draft (the bug
    // this replaces: a "failed" row's null response_snapshot used to be
    // returned here as a fake success, permanently, with no way back in).
    throw new ParasutInProgressError(`Invoice preparation for ${id} is already in progress`);
  }

  // Tracks whether the Paraşüt call itself succeeded, so the catch block
  // below knows whether it's safe to mark this key "failed" (only if
  // Paraşüt was never actually called/created anything) or must leave the
  // "succeeded" status (already written) alone.
  let remoteSucceeded = false;

  try {
    const tx = await loadTransaction(params.supabase, id);
    const customer = tx.customers ?? {};
    validateForDraft(tx, customer);

    const lineItems = await loadLineItems(params.supabase, tx);
    const body = financialTxToSalesInvoicePayload(tx, customer, lineItems);
    const result = await parasutRequest(params.supabase, {
      path: "/sales_invoices",
      method: "POST",
      body,
      operation: "prepare_invoice",
      correlationId: params.correlationId,
      actorId: params.actorId,
      erpRecordId: id,
      idempotencyKey: key,
    }) as { data?: { id?: string; attributes?: { net_total?: number } } };

    const invoiceId = result.data?.id;
    if (!invoiceId) throw new ParasutValidationError("Paraşüt invoice response did not include an id", 502, result);

    // From this point on, Paraşüt has created a real draft — mark the
    // idempotency key succeeded immediately, before attempting the local
    // DB update. If that update fails below, a retry replays this cached
    // response (and repairs the local row, see the replay branch above)
    // instead of re-POSTing to Paraşüt and creating a second draft.
    // Confirmed bug, independent audit 2026-07-23.
    remoteSucceeded = true;
    await finishIdempotency(params.supabase, key, "succeeded", result);

    // Defensive check: we no longer send total_vat/total_amount (not part of
    // Paraşüt's schema — see mappers.ts), so Paraşüt computes the net total
    // itself from quantity*unit_price. Confirm it matches what Ornet expected
    // rather than trusting it silently.
    const expectedNet = Number(tx.amount_try ?? 0);
    const parasutNet = Number(result.data?.attributes?.net_total ?? NaN);
    if (Number.isFinite(parasutNet) && Math.abs(parasutNet - expectedNet) > 0.01) {
      console.warn("[parasut] net_total mismatch after prepare-invoice", {
        financial_transaction_id: id,
        parasut_invoice_id: invoiceId,
        expected_net: expectedNet,
        parasut_net_total: parasutNet,
      });
    }

    const { error } = await params.supabase
      .from("financial_transactions")
      .update({
        parasut_invoice_id: invoiceId,
        parasut_sync_status: "draft",
        parasut_error: null,
      })
      .eq("id", id);
    if (error) {
      throw new ParasutValidationError(
        `Paraşüt draft ${invoiceId} was created but the local record update failed — retrying this call is safe, ` +
          `it will repair the record without creating a duplicate. Original error: ${error.message}`,
        500,
      );
    }

    return result;
  } catch (error) {
    if (!remoteSucceeded) {
      await finishIdempotency(
        params.supabase,
        key,
        "failed",
        null,
        error instanceof Error ? error.message : String(error),
      );
    }
    throw error;
  }
}
