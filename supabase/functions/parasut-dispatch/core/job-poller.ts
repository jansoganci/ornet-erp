import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ParasutJobError } from "./errors.ts";
import { parasutRequest } from "./parasut-client.ts";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function pollTrackableJob(params: {
  supabase: SupabaseClient;
  jobId: string;
  correlationId: string;
  actorId?: string | null;
  erpRecordId?: string | null;
}): Promise<unknown> {
  const waits = [2000, 5000, 10000, 20000, 23000];

  for (const waitMs of waits) {
    await sleep(waitMs);
    const result = await parasutRequest(params.supabase, {
      path: `/trackable_jobs/${params.jobId}`,
      operation: "poll_trackable_job",
      correlationId: params.correlationId,
      actorId: params.actorId,
      erpRecordId: params.erpRecordId,
    }) as { data?: { attributes?: { status?: string; errors?: unknown } } };

    const status = result.data?.attributes?.status;
    if (status === "done") return result;
    if (status === "error") {
      throw new ParasutJobError("Paraşüt e-document job failed", 422, result.data?.attributes?.errors ?? result);
    }
  }

  throw new ParasutJobError("Paraşüt e-document job timed out", 504);
}
