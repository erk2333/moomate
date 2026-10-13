import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { demoClient } from "@/lib/demo-db";

let cached: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return demoClient as unknown as SupabaseClient;
  }
  cached = createClient(url, key, {
    auth: { persistSession: false },
  });
  return cached;
}
