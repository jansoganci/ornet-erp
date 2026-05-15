import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireRole } from "../core/auth.ts";
import { ParasutValidationError } from "../core/errors.ts";
import { parasutRequest } from "../core/parasut-client.ts";

export async function fetchHistory(params: {
  supabase: SupabaseClient;
  correlationId: string;
  actorId: string | null;
  payload?: Record<string, unknown>;
}): Promise<unknown> {
  await requireRole(params.supabase, params.actorId, ["admin", "accountant"]);

  const customerId = String(params.payload?.customer_id ?? "");
  if (!customerId) throw new ParasutValidationError("customer_id is required", 400);

  const { data: customer, error } = await params.supabase
    .from("customers")
    .select("parasut_contact_id")
    .eq("id", customerId)
    .single();

  if (error) throw error;
  if (!customer.parasut_contact_id) return { data: [] };

  const dateFrom = new Date();
  dateFrom.setMonth(dateFrom.getMonth() - 12);
  const issueDate = dateFrom.toISOString().slice(0, 10);

  return parasutRequest(params.supabase, {
    path: `/sales_invoices?filter[contact_id]=${encodeURIComponent(customer.parasut_contact_id)}&filter[issue_date][gteq]=${issueDate}&include=payments,active_e_document`,
    operation: "fetch_history",
    correlationId: params.correlationId,
    actorId: params.actorId,
    erpRecordId: customerId,
  });
}
