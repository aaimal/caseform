import { createClient } from "@supabase/supabase-js";
import { assertLatin1Header } from "@/lib/exemplars/helpers";

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase service role env vars are missing");
  }
  return createClient(
    assertLatin1Header(url, "NEXT_PUBLIC_SUPABASE_URL"),
    assertLatin1Header(key, "SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
