import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ParasutAuthError } from "./errors.ts";

export async function requireRole(
  supabase: SupabaseClient,
  actorId: string | null,
  allowedRoles: string[],
): Promise<void> {
  if (!actorId) throw new ParasutAuthError("Authentication required", 401);

  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", actorId)
    .single();

  if (error) throw new ParasutAuthError(error.message, 403, error);
  if (!allowedRoles.includes(data.role)) {
    throw new ParasutAuthError("Not authorized for this Paraşüt action", 403);
  }
}
