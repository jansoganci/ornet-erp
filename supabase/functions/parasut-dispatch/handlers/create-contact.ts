import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireRole } from "../core/auth.ts";
import { customerToContactPayload } from "../core/mappers.ts";
import { parasutRequest } from "../core/parasut-client.ts";
import { ParasutValidationError } from "../core/errors.ts";

export async function createContact(params: {
  supabase: SupabaseClient;
  correlationId: string;
  actorId: string | null;
  payload?: Record<string, unknown>;
}): Promise<unknown> {
  await requireRole(params.supabase, params.actorId, ["admin", "accountant"]);

  const customerId = String(params.payload?.customer_id ?? "");
  const confirmed = params.payload?.confirmed === true;
  if (!customerId || !confirmed) {
    throw new ParasutValidationError("Customer contact creation requires explicit confirmation", 400);
  }

  const { data: customer, error } = await params.supabase
    .from("customers")
    .select("id, company_name, tax_number, tax_office, identity_type, parasut_contact_id")
    .eq("id", customerId)
    .single();

  if (error) throw error;
  if (customer.parasut_contact_id) return { contact_id: customer.parasut_contact_id, already_exists: true };

  // Required, not just recommended: without identity_type, mappers.ts's
  // contact_type mapping (tckn→person, else→company) silently defaults to
  // "company" for a customer whose identity is simply unknown, rather than
  // stopping to ask for the missing data. Confirmed bug, independent audit
  // 2026-07-23.
  if (customer.identity_type !== "vkn" && customer.identity_type !== "tckn") {
    throw new ParasutValidationError(
      "Customer identity_type (vkn/tckn) must be set before creating a Paraşüt contact",
      400,
    );
  }

  const body = customerToContactPayload(customer);
  const result = await parasutRequest(params.supabase, {
    path: "/contacts",
    method: "POST",
    body,
    operation: "create_contact",
    correlationId: params.correlationId,
    actorId: params.actorId,
    erpRecordId: customerId,
  }) as { data?: { id?: string } };

  const contactId = result.data?.id;
  if (!contactId) throw new ParasutValidationError("Paraşüt contact response did not include an id", 502, result);

  const { error: updateError } = await params.supabase
    .from("customers")
    .update({ parasut_contact_id: contactId })
    .eq("id", customerId);

  if (updateError) throw updateError;
  return { contact_id: contactId };
}
