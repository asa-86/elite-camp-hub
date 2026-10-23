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
  const verifier = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const { data: { user }, error: authError } = await verifier.auth.getUser(token);
    if (authError || !user) return json({ error: "Not authorized." }, 401);
    const { data: actor } = await admin.from("profiles").select("role,active").eq("id", user.id).maybeSingle();
    if (actor?.role !== "admin" || !actor.active) return json({ error: "Not authorized." }, 403);
    const body = await req.json();
    const { data: target, error: targetError } = await admin.from("profiles").select("role").eq("id", body.id).maybeSingle();
    if (targetError || !target) return json({ error: "کاربر پیدا نشد." }, 404);
    const patch: Record<string, unknown> = {};
    if (typeof body.fullName === "string") patch.full_name = body.fullName.trim();
    if (typeof body.active === "boolean") patch.active = body.active;
    if (target.role === "student" && body.grade !== undefined) {
      const grade = Number(body.grade);
      if (![7, 8, 9, 10, 11, 12].includes(grade)) return json({ error: "پایهٔ دانش‌آموز معتبر نیست." }, 400);
      patch.grade = grade;
    }
    if (target.role === "student" && typeof body.studentCode === "string") patch.student_code = body.studentCode.trim() || null;
    if (body.password) {
      const password = String(body.password);
      if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) return json({ error: "گذرواژه باید حداقل ۸ نویسه و شامل حرف و عدد باشد." }, 400);
      const { error } = await admin.auth.admin.updateUserById(body.id, { password });
      if (error) return json({ error: "تغییر گذرواژه انجام نشد." }, 400);
    }
    if (Object.keys(patch).length) {
      const { error } = await admin.from("profiles").update(patch).eq("id", body.id);
      if (error) return json({ error: "ذخیرهٔ مشخصات کاربر انجام نشد." }, 400);
    }
    return json({ ok: true });
  } catch {
    return json({ error: "درخواست ویرایش انجام نشد." }, 400);
  }
});
