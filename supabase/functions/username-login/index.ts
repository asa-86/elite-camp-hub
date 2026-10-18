import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const generic = () => new Response(JSON.stringify({ error: "نام کاربری یا گذرواژه نادرست است." }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });
  try {
    const { username, password } = await req.json();
    const normalized = String(username ?? "").trim().toLowerCase();
    if (!/^[a-z0-9._]{3,32}$/.test(normalized) || typeof password !== "string" || !password) return generic();
    const url = Deno.env.get("SUPABASE_URL")!;
    const publicKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const auth = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await auth.auth.signInWithPassword({ email: `${normalized}@users.elitecamp.invalid`, password });
    if (error || !data.user || !data.session) return generic();
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: profile } = await admin.from("profiles").select("active").eq("id", data.user.id).maybeSingle();
    if (!profile?.active) return generic();
    return new Response(JSON.stringify({ access_token: data.session.access_token, refresh_token: data.session.refresh_token }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  } catch {
    return generic();
  }
});
