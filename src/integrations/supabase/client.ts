import { createClient } from "@supabase/supabase-js";

// Backend existente do repositório (mapadoviajante_pro).
// A anon key é pública por design — protegida por RLS no servidor.
const SUPABASE_URL = "https://ddulmdacvcnkdkzwmsbz.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkdWxtZGFjdmNua2Rrendtc2J6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1NDEwMzIsImV4cCI6MjA5NTExNzAzMn0.vCyVOzsppbV-oiM9VcbOeUfRMpAG-UK4eq8US4b5x8s";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
