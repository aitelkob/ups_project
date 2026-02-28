import { createClient } from "@supabase/supabase-js";

let client: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (client) return client;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase public environment variables.");
  }

  client = createClient(supabaseUrl, supabaseAnonKey);
  return client;
}
