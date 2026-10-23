import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

function configuredKey(envName: string, legacyName: string): string | undefined {
  const raw = Deno.env.get(envName);
  if (raw) {
    try {
      const keys = JSON.parse(raw);
      if (typeof keys.default === "string") return keys.default;
    } catch {
      // Some Supabase runtimes expose the legacy single-key string here.
      return raw;
    }
  }
  return Deno.env.get(legacyName) ?? undefined;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = configuredKey("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
  const publicKey = configuredKey("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (!url || !serviceKey || !publicKey) {
    console.error("Missing required Supabase function configuration.", { hasUrl: Boolean(url), hasServiceKey: Boolean(serviceKey), hasPublicKey: Boolean(publicKey) });
    return json({ error: "Provisioning unavailable." }, 503);
  }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: admins, error: adminLookupError } = await admin.from("profiles").select("id").eq("role", "admin").limit(1);
    if (adminLookupError) {
      console.error("Unable to query profiles during provisioning.", { code: adminLookupError.code, message: adminLookupError.message });
      return json({ error: "Provisioning unavailable." }, 503);
    }
    const bootstrapMode = (admins?.length ?? 0) === 0;
    const body = await req.json();
    if (bootstrapMode) {
      if (!Deno.env.get("BOOTSTRAP_ADMIN_TOKEN") || body.bootstrapToken !== Deno.env.get("BOOTSTRAP_ADMIN_TOKEN")) return json({ error: "Not authorized." }, 403);
      body.role = "admin";
    } else {
      if (!token) return json({ error: "Not authorized." }, 401);
      const verifier = createClient(url, publicKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
      const { data: { user }, error } = await verifier.auth.getUser(token);
      if (error || !user) return json({ error: "Not authorized." }, 401);
      const { data: actor } = await admin.from("profiles").select("role,active").eq("id", user.id).maybeSingle();
      if (actor?.role !== "admin" || !actor.active) return json({ error: "Not authorized." }, 403);
    }

    const username = String(body.username ?? "").trim().toLowerCase();
    const fullName = String(body.fullName ?? "").trim();
    const role = body.role;
    const password = String(body.password ?? "");
    const grade = role === "student" ? Number(body.grade) : null;
    if (!/^[a-z0-9._]{3,32}$/.test(username) || !fullName || !["admin", "teacher", "student"].includes(role) || password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) return json({ error: "اطلاعات حساب معتبر نیست." }, 400);
    if (role === "student" && ![7, 8, 9, 10, 11, 12].includes(grade)) return json({ error: "پایهٔ دانش‌آموز معتبر نیست." }, 400);
    const { data: created, error: createError } = await admin.auth.admin.createUser({ email: `${username}@users.elitecamp.invalid`, password, email_confirm: true, user_metadata: { username } });
    if (createError || !created.user) return json({ error: "ایجاد حساب انجام نشد؛ نام کاربری ممکن است تکراری باشد." }, 409);
    const { data: profile, error: profileError } = await admin.from("profiles").insert({ id: created.user.id, username, full_name: fullName, role, grade, student_code: role === "student" ? (body.studentCode || null) : null, active: body.active !== false }).select("id,username,full_name,role,active,grade,student_code,created_at").single();
    if (profileError) {
      await admin.auth.admin.deleteUser(created.user.id);
      return json({ error: "ذخیرهٔ مشخصات حساب انجام نشد." }, 400);
    }
    return json({ profile, bootstrapped: bootstrapMode }, 201);
  } catch {
    return json({ error: "درخواست ایجاد حساب انجام نشد." }, 400);
  }
});
