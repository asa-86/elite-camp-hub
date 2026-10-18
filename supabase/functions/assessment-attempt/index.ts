import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const denied = () => json({ error: "این عملیات برای حساب شما مجاز نیست." }, 403);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const publicKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return denied();
  const auth = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const { data: { user }, error: authError } = await auth.auth.getUser(token);
    if (authError || !user) return denied();
    const { data: profile } = await admin.from("profiles").select("role,active,grade").eq("id", user.id).maybeSingle();
    if (profile?.role !== "student" || !profile.active) return denied();
    const body = await req.json();
    const answerMap = (value: unknown): Record<string, string> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, string> : {};
    const save = async (attemptId: string, answers: Record<string, string>) => {
      const { data: attempt } = await admin.from("assessment_attempts").select("id,assessment_id,student_id,status,started_at").eq("id", attemptId).eq("student_id", user.id).maybeSingle();
      if (!attempt || attempt.status !== "in_progress") throw new Error("نوبت آزمون معتبر نیست.");
      const { data: assessment } = await admin.from("assessments").select("duration_minutes").eq("id", attempt.assessment_id).single();
      if (assessment.duration_minutes && Date.now() > Date.parse(attempt.started_at) + assessment.duration_minutes * 60_000 + 15000) throw new Error("زمان آزمون به پایان رسیده است.");
      const { data: questions } = await admin.from("assessment_questions").select("id").eq("assessment_id", attempt.assessment_id);
      const qids = new Set((questions ?? []).map((q) => q.id));
      const requested = Object.entries(answers).filter(([qid, oid]) => qids.has(qid) && typeof oid === "string");
      let valid: Array<{ attempt_id: string; question_id: string; option_id: string }> = [];
      if (requested.length) {
        const { data: options } = await admin.from("assessment_options").select("id,question_id").in("question_id", requested.map(([qid]) => qid));
        const optionByQuestion = new Map((options ?? []).map((o) => [`${o.question_id}:${o.id}`, true]));
        valid = requested.filter(([qid, oid]) => optionByQuestion.has(`${qid}:${oid}`)).map(([question_id, option_id]) => ({ attempt_id: attemptId, question_id, option_id }));
      }
      const { error: clearError } = await admin.from("assessment_answers").delete().eq("attempt_id", attemptId);
      if (clearError) throw clearError;
      if (valid.length) {
        const { error } = await admin.from("assessment_answers").insert(valid);
        if (error) throw error;
      }
      return attempt;
    };

    if (body.action === "start") {
      const { data: a } = await admin.from("assessments").select("id,title,instructions,status,active,target,target_grades,starts_at,ends_at,duration_minutes,max_attempts").eq("id", body.assessmentId).maybeSingle();
      if (!a || a.status !== "published" || !a.active || (a.starts_at && Date.parse(a.starts_at) > Date.now()) || (a.ends_at && Date.parse(a.ends_at) < Date.now())) return json({ error: "این آزمون در دسترس نیست." }, 404);
      let targeted = a.target === "all_active_students" || (a.target === "grades" && a.target_grades.includes(profile.grade));
      if (a.target === "selected_students") {
        const { data: assignment } = await admin.from("assessment_assignments").select("student_id").eq("assessment_id", a.id).eq("student_id", user.id).maybeSingle();
        targeted = !!assignment;
      }
      if (!targeted) return json({ error: "این آزمون در دسترس نیست." }, 404);
      let { data: attempt } = await admin.from("assessment_attempts").select("*").eq("assessment_id", a.id).eq("student_id", user.id).eq("status", "in_progress").maybeSingle();
      if (!attempt) {
        const { count } = await admin.from("assessment_attempts").select("id", { count: "exact", head: true }).eq("assessment_id", a.id).eq("student_id", user.id).in("status", ["submitted", "expired"]);
        if ((count ?? 0) >= a.max_attempts) return json({ error: "تعداد دفعات مجاز به پایان رسیده است." }, 409);
        const { data, error } = await admin.from("assessment_attempts").insert({ assessment_id: a.id, student_id: user.id }).select("*").single();
        if (error || !data) return json({ error: "شروع آزمون انجام نشد." }, 400);
        attempt = data;
      }
      const [{ data: questions }, { data: answers }] = await Promise.all([
        admin.from("assessment_questions").select("id,position,question_type,body").eq("assessment_id", a.id).order("position"),
        admin.from("assessment_answers").select("question_id,option_id").eq("attempt_id", attempt.id),
      ]);
      const questionIds = (questions ?? []).map((q) => q.id);
      const { data: options } = questionIds.length ? await admin.from("assessment_options").select("id,question_id,position,body").in("question_id", questionIds).order("position") : { data: [] };
      return json({ attemptId: attempt.id, title: a.title, instructions: a.instructions, deadline: a.duration_minutes ? Date.parse(attempt.started_at) + a.duration_minutes * 60_000 : null,
        answers: Object.fromEntries((answers ?? []).map((x) => [x.question_id, x.option_id])),
        questions: (questions ?? []).map((q) => ({ id: q.id, type: q.question_type, text: q.body, options: (options ?? []).filter((o) => o.question_id === q.id).map((o) => ({ id: o.id, text: o.body })) })) });
    }
    if (body.action === "save" || body.action === "submit") {
      const attempt = await save(String(body.attemptId ?? ""), answerMap(body.answers));
      if (body.action === "save") return json({ ok: true });
      const { data: rows } = await admin.from("assessment_answers").select("option_id").eq("attempt_id", attempt.id);
      const optionIds = (rows ?? []).map((r) => r.option_id);
      const { data: qRows } = await admin.from("assessment_questions").select("id").eq("assessment_id", attempt.assessment_id);
      const qids = (qRows ?? []).map((q) => q.id);
      const [{ data: allOptions }, { data: scores }] = await Promise.all([
        qids.length ? admin.from("assessment_options").select("id,question_id").in("question_id", qids) : Promise.resolve({ data: [] }),
        optionIds.length ? admin.from("assessment_option_scores").select("option_id,score").in("option_id", optionIds) : Promise.resolve({ data: [] }),
      ]);
      const { data: scoreRowsAll } = allOptions?.length ? await admin.from("assessment_option_scores").select("option_id,score").in("option_id", allOptions.map((o) => o.id)) : { data: [] };
      const scoreMap = new Map((scoreRowsAll ?? []).map((x) => [x.option_id, Number(x.score)]));
      const maxScore = qids.reduce((sum, qid) => sum + Math.max(0, ...(allOptions ?? []).filter((o) => o.question_id === qid).map((option) => scoreMap.get(option.id) ?? 0)), 0);
      const score = (scores ?? []).reduce((sum, row) => sum + Number(row.score), 0);
      const { data: assessment } = await admin.from("assessments").select("duration_minutes").eq("id", attempt.assessment_id).single();
      const expired = !!assessment?.duration_minutes && Date.now() > Date.parse(attempt.started_at) + assessment.duration_minutes * 60_000;
      const status = expired ? "expired" : "submitted";
      const { error: attemptError } = await admin.from("assessment_attempts").update({ status, submitted_at: new Date().toISOString() }).eq("id", attempt.id).eq("status", "in_progress");
      if (attemptError) return json({ error: "ارسال نهایی آزمون انجام نشد." }, 400);
      const { error: resultError } = await admin.from("assessment_results").upsert({ attempt_id: attempt.id, score, max_score: maxScore });
      if (resultError) return json({ error: "ذخیرهٔ نتیجه انجام نشد." }, 400);
      return json({ ok: true, questionCount: (qRows ?? []).length });
    }
    return json({ error: "درخواست نامعتبر است." }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "درخواست آزمون انجام نشد." }, 400);
  }
});
