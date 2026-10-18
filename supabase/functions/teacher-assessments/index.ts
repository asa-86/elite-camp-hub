import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "GET, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "GET" && req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const publicKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const auth = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error } = await auth.auth.getUser(token);
  if (error || !user) return json({ error: "Not authorized." }, 401);
  const { data: teacher } = await admin.from("profiles").select("role,active").eq("id", user.id).maybeSingle();
  if (teacher?.role !== "teacher" || !teacher.active) return json({ error: "Not authorized." }, 403);
  const { data: links } = await admin.from("teacher_students").select("student_id").eq("teacher_id", user.id);
  const studentIds = (links ?? []).map((r) => r.student_id);
  if (!studentIds.length) return json({ assessments: [] });
  const { data: students } = await admin.from("profiles").select("id,grade").in("id", studentIds).eq("active", true);
  const grades = new Set((students ?? []).map((s) => s.grade));
  const ids = (students ?? []).map((s) => s.id);
  if (!ids.length) return json({ assessments: [] });
  const now = new Date().toISOString();
  const { data: assessments, error: assessmentError } = await admin.from("assessments").select("id,title,description,target,target_grades,ends_at")
    .eq("status", "published").eq("active", true).or(`starts_at.is.null,starts_at.lte.${now}`).or(`ends_at.is.null,ends_at.gte.${now}`);
  if (assessmentError) return json({ error: "Assessment lookup failed." }, 400);
  const { data: assignments } = await admin.from("assessment_assignments").select("assessment_id,student_id").in("student_id", ids);
  const visible = (assessments ?? []).filter((a) => {
    if (a.target === "all_active_students") return true;
    if (a.target === "grades") return (a.target_grades ?? []).some((grade: number) => grades.has(grade));
    return (assignments ?? []).some((r) => r.assessment_id === a.id);
  });
  const assessmentIds = visible.map((a) => a.id);
  const { data: questions } = assessmentIds.length ? await admin.from("assessment_questions").select("id,assessment_id").in("assessment_id", assessmentIds) : { data: [] };
  return json({ assessments: visible.map((a) => ({ id: a.id, title: a.title, description: a.description, endAt: a.ends_at ?? undefined,
    questionCount: (questions ?? []).filter((q) => q.assessment_id === a.id).length })) });
});
