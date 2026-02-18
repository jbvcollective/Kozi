import { createClient } from "@supabase/supabase-js";

/**
 * Frontend Supabase client. Uses ANON KEY only.
 * Never use the service role key in the frontend — it bypasses RLS and must stay on the backend.
 * Access pattern: Frontend → Supabase (anon key). Backend → Supabase (service role key).
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

export const supabase = url && anonKey ? createClient(url, anonKey) : null;

// #region agent log
if (typeof fetch !== "undefined") {
  fetch('http://127.0.0.1:7243/ingest/44e6888a-4d84-49e4-8550-759d2db8073e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'aec536'},body:JSON.stringify({sessionId:'aec536',location:'supabase.js:init',message:'Supabase init',data:{hasSupabase:!!supabase,urlSet:!!(url&&url.trim()),anonKeySet:!!(anonKey&&anonKey.trim())},timestamp:Date.now(),hypothesisId:'H1-H2'})}).catch(()=>{});
}
// #endregion

export function hasSupabase() {
  return !!supabase;
}
