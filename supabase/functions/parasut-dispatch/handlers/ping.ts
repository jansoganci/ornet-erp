import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parasutRequest } from "../core/parasut-client.ts";

export async function ping(params: {
  supabase: SupabaseClient;
  correlationId: string;
  actorId?: string | null;
}): Promise<unknown> {
  return parasutRequest(params.supabase, {
    path: "/me",
    operation: "ping",
    correlationId: params.correlationId,
    actorId: params.actorId,
  });
}
