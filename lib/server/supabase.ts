import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./env";

let client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (client) return client;
  const { url, secretKey } = supabaseConfig();
  client = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}
