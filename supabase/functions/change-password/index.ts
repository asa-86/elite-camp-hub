import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const publicKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Not authorized." }, 401);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const userClient = createClient(url, publicKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const { data: { user }, error: userError } = await userClient.auth.getUser(token);
    if (userError || !user) return json({ error: "Not authorized." }, 401);
    const { data: profile } = await admin.from("profiles").select("username,active").eq("id", user.id).maybeSingle();
    const body = await req.json();
    const next = String(body.newPassword ?? "");
    if (!profile?.active || next.length < 8 || !/[A-Za-z]/.test(next) || !/\d/.test(next)) return json({ error: "اطلاعات تغییر رمز معتبر نیست." }, 400);
    const verifier = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error: passwordError } = await verifier.auth.signInWithPassword({ email: `${profile.username}@users.elitecamp.invalid`, password: String(body.currentPassword ?? "") });
    if (passwordError) return json({ error: "رمز عبور فعلی نادرست است." }, 400);
    const { error } = await admin.auth.admin.updateUserById(user.id, { password: next });
    if (error) return json({ error: "تغییر رمز عبور انجام نشد." }, 400);
    return json({ ok: true });
  } catch {
    return json({ error: "درخواست تغییر رمز انجام نشد." }, 400);
  }
});
