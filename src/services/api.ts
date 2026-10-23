// Application data API. Every function enforces the same rules the database RLS
// policies will enforce (see supabase/migrations). In demo mode they run against
// the browser mock store; when Supabase is connected, swap the bodies for
// supabase queries / server functions while keeping the signatures.
import { db, hashPassword, now, persist, uid, type DB } from "./mock-db";
import { files } from "./files";
import type {
  Assessment, Attempt, AttendanceStatus, ClassRoom, Grade, Material, Page, Question,
  Role, Session, User,
} from "@/lib/types";
import { GRADE_OPTIONS } from "@/lib/types";
import { autoSessionTitle } from "@/lib/jalali";
import { config } from "@/services/config";
import { getSupabase, profileToUser, type ProfileRow } from "@/services/supabase";

export class ApiError extends Error {}
const delay = () => new Promise((r) => setTimeout(r, 120));

// ---------------------------------------------------------------- session
const SESSION_KEY = "sec-session";
const SESSION_TTL = 1000 * 60 * 60 * 8;
interface StoredSession { userId: string; role: Role; exp: number }

async function currentUserId(): Promise<string> {
  const { data: { user }, error } = await getSupabase().auth.getUser();
  if (error || !user) throw new ApiError("نشست معتبر نیست. دوباره وارد شوید.");
  return user.id;
}

export function readSession(): StoredSession | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null") as StoredSession | null;
    if (!s || (config.dataMode !== "supabase" && s.exp < Date.now())) return null;
    return s;
  } catch {
    return null;
  }
}

async function requireUser(...roles: Role[]): Promise<{ d: DB; me: User }> {
  await delay();
  const d = await db();
  const s = readSession();
  const me = s && d.users.find((u) => u.id === s.userId);
  if (!me || !me.active) throw new ApiError("نشست شما منقضی شده است. دوباره وارد شوید.");
  if (roles.length && !roles.includes(me.role)) throw new ApiError("اجازه انجام این عملیات را ندارید.");
  return { d, me };
}

// ---------------------------------------------------------------- auth
const RL_KEY = "sec-login-attempts";
const MAX_ATTEMPTS = 5;
const LOCK_MS = 5 * 60 * 1000;
const GENERIC_LOGIN_ERROR = "نام کاربری یا رمز عبور نادرست است.";

export function normalizeUsername(u: string) {
  return u.trim().toLowerCase();
}

export async function login(username: string, password: string): Promise<User> {
  await delay();
  const name = normalizeUsername(username);
  if (config.dataMode === "supabase") {
    const supabase = getSupabase();
    const { data, error } = await supabase.functions.invoke("username-login", { body: { username: name, password } });
    if (error || !data?.access_token || !data?.refresh_token) throw new ApiError(GENERIC_LOGIN_ERROR);
    const { data: sessionData, error: sessionError } = await supabase.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token });
    if (sessionError || !sessionData.user || !sessionData.session) throw new ApiError(GENERIC_LOGIN_ERROR);
    const { data: profile, error: profileError } = await supabase.from("profiles").select("*").eq("id", sessionData.user.id).maybeSingle();
    if (profileError || !profile?.active) { await supabase.auth.signOut(); throw new ApiError(GENERIC_LOGIN_ERROR); }
    const user = profileToUser(profile as ProfileRow);
    localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: user.id, role: user.role, exp: sessionData.session.expires_at ? sessionData.session.expires_at * 1000 : Date.now() + SESSION_TTL }));
    return user;
  }
  const rl = JSON.parse(localStorage.getItem(RL_KEY) ?? "{}") as Record<string, { n: number; until?: number }>;
  const entry = rl[name] ?? { n: 0 };
  if (entry.until && entry.until > Date.now()) {
    throw new ApiError("تلاش‌های ناموفق زیاد بود. چند دقیقه دیگر دوباره امتحان کنید.");
  }
  const d = await db();
  const user = d.users.find((u) => u.username === name);
  const cred = user && d.credentials.find((c) => c.userId === user.id);
  const ok = !!cred && (await hashPassword(password, cred.salt)) === cred.hash;
  // Inactive accounts receive the SAME generic error — no account enumeration.
  if (!ok || !user || !user.active) {
    entry.n += 1;
    if (entry.n >= MAX_ATTEMPTS) { entry.until = Date.now() + LOCK_MS; entry.n = 0; }
    rl[name] = entry;
    localStorage.setItem(RL_KEY, JSON.stringify(rl));
    throw new ApiError(GENERIC_LOGIN_ERROR);
  }
  delete rl[name];
  localStorage.setItem(RL_KEY, JSON.stringify(rl));
  localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: user.id, role: user.role, exp: Date.now() + SESSION_TTL }));
  return user;
}

export function logout(): void | Promise<void> {
  localStorage.removeItem(SESSION_KEY);
  if (config.dataMode === "supabase") return getSupabase().auth.signOut().then(() => undefined);
}

export async function getMe(): Promise<User | null> {
  if (config.dataMode === "supabase") {
    const supabase = getSupabase();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) { localStorage.removeItem(SESSION_KEY); return null; }
    const { data: profile, error: profileError } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (profileError || !profile?.active) { logout(); return null; }
    const current = profileToUser(profile as ProfileRow);
    const { data: { session } } = await supabase.auth.getSession();
    localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: current.id, role: current.role, exp: (session?.expires_at ?? 0) * 1000 }));
    return current;
  }
  const s = readSession();
  if (!s) return null;
  const d = await db();
  const me = d.users.find((u) => u.id === s.userId);
  if (!me || !me.active) { logout(); return null; }
  return me;
}

export async function changePassword(current: string, next: string) {
  if (config.dataMode === "supabase") {
    validatePassword(next);
    const { error } = await getSupabase().functions.invoke("change-password", { body: { currentPassword: current, newPassword: next } });
    if (error) throw new ApiError("تغییر رمز عبور انجام نشد. رمز فعلی را بررسی کنید.");
    return;
  }
  const { d, me } = await requireUser();
  const cred = d.credentials.find((c) => c.userId === me.id)!;
  if ((await hashPassword(current, cred.salt)) !== cred.hash) throw new ApiError("رمز عبور فعلی نادرست است.");
  validatePassword(next);
  cred.salt = uid();
  cred.hash = await hashPassword(next, cred.salt);
  persist();
}

export function validatePassword(p: string) {
  if (p.length < 8) throw new ApiError("رمز عبور باید حداقل ۸ کاراکتر باشد.");
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) throw new ApiError("رمز عبور باید شامل حرف و عدد باشد.");
}

// ---------------------------------------------------------------- helpers
function paginate<T>(arr: T[], page = 1, pageSize = 10): Page<T> {
  const p = Math.max(1, page);
  return { items: arr.slice((p - 1) * pageSize, p * pageSize), total: arr.length, page: p, pageSize };
}
const teacherHasStudent = (d: DB, teacherId: string, studentId: string) =>
  d.teacherStudents.some((r) => r.teacherId === teacherId && r.studentId === studentId);
const publicUser = (u: User): User => ({ ...u });

// ---------------------------------------------------------------- admin: users
export interface UserFilter {
  role: Role; q?: string; grade?: Grade | "all"; status?: "all" | "active" | "inactive"; page?: number; pageSize?: number;
}
export async function listUsers(f: UserFilter): Promise<Page<User>> {
  if (config.dataMode === "supabase") {
    const page = Math.max(1, f.page ?? 1), pageSize = Math.min(100, Math.max(1, f.pageSize ?? 10));
    let query = getSupabase().from("profiles").select("*", { count: "exact" }).eq("role", f.role);
    if (f.grade && f.grade !== "all") query = query.eq("grade", f.grade);
    if (f.status === "active") query = query.eq("active", true);
    if (f.status === "inactive") query = query.eq("active", false);
    const q = f.q?.trim().replace(/[,%()\\]/g, " ");
    if (q) query = query.or(`full_name.ilike.%${q}%,username.ilike.%${q}%,student_code.ilike.%${q}%`);
    const { data, error, count } = await query.order("full_name").range((page - 1) * pageSize, page * pageSize - 1);
    if (error) throw new ApiError("دریافت فهرست کاربران انجام نشد.");
    return { items: (data ?? []).map((p) => profileToUser(p as ProfileRow)), total: count ?? 0, page, pageSize };
  }
  const { d } = await requireUser("admin");
  const q = f.q?.trim().toLowerCase();
  const rows = d.users.filter((u) =>
    u.role === f.role &&
    (!q || u.fullName.toLowerCase().includes(q) || u.username.includes(q) || (u.studentCode ?? "").includes(q)) &&
    (!f.grade || f.grade === "all" || u.grade === f.grade) &&
    (!f.status || f.status === "all" || (f.status === "active" ? u.active : !u.active)),
  );
  return paginate(rows.map(publicUser), f.page, f.pageSize);
}

export interface UserInput {
  fullName: string; username: string; role: Role; password?: string; active: boolean; grade?: Grade; studentCode?: string;
}
export async function createUser(input: UserInput): Promise<User> {
  if (input.role === "student" && (!input.grade || !GRADE_OPTIONS.includes(input.grade))) throw new ApiError("پایهٔ دانش‌آموز را انتخاب کنید.");
  // Production: server function using the service role (admin-only, role verified server-side).
  if (config.dataMode === "supabase") {
    validatePassword(input.password ?? "");
    const { data, error } = await getSupabase().functions.invoke("provision-user", { body: {
      username: input.username, fullName: input.fullName, role: input.role, password: input.password,
      active: input.active, grade: input.grade, studentCode: input.studentCode,
    } });
    if (error || !data?.profile) throw new ApiError(data?.error ?? "ایجاد حساب انجام نشد.");
    return profileToUser(data.profile as ProfileRow);
  }
  const { d } = await requireUser("admin");
  const username = normalizeUsername(input.username);
  if (!/^[a-z0-9._]{3,32}$/.test(username)) throw new ApiError("نام کاربری فقط حروف انگلیسی، عدد، نقطه و زیرخط (۳ تا ۳۲ کاراکتر).");
  if (d.users.some((u) => u.username === username)) throw new ApiError("این نام کاربری قبلاً ثبت شده است.");
  if (!input.fullName.trim()) throw new ApiError("نام و نام خانوادگی الزامی است.");
  if (input.role === "student" && !input.grade) throw new ApiError("پایه دانش‌آموز را انتخاب کنید.");
  validatePassword(input.password ?? "");
  const user: User = {
    id: uid(), username, fullName: input.fullName.trim(), role: input.role, active: input.active,
    grade: input.role === "student" ? input.grade : undefined,
    studentCode: input.role === "student" ? input.studentCode?.trim() || undefined : undefined,
    createdAt: now(),
  };
  const salt = uid();
  d.users.push(user);
  d.credentials.push({ userId: user.id, salt, hash: await hashPassword(input.password!, salt) });
  persist();
  return user;
}

export async function updateUser(id: string, patch: Partial<Omit<UserInput, "role" | "username">>) {
  if (patch.grade !== undefined && !GRADE_OPTIONS.includes(patch.grade)) throw new ApiError("پایهٔ دانش‌آموز معتبر نیست.");
  if (config.dataMode === "supabase") {
    if (patch.password) {
      const { error } = await getSupabase().functions.invoke("admin-update-user", { body: { id, ...patch } });
      if (error) throw new ApiError("ویرایش حساب انجام نشد.");
      const { data, error: readError } = await getSupabase().from("profiles").select("*").eq("id", id).single();
      if (readError) throw new ApiError("حساب ویرایش شد، اما دریافت اطلاعات آن انجام نشد.");
      return profileToUser(data as ProfileRow);
    }
    const fields: Record<string, unknown> = {};
    if (patch.fullName !== undefined) fields["full_name"] = patch.fullName.trim();
    if (patch.active !== undefined) fields["active"] = patch.active;
    if (patch.grade !== undefined) fields["grade"] = patch.grade;
    if (patch.studentCode !== undefined) fields["student_code"] = patch.studentCode.trim() || null;
    const { data, error } = await getSupabase().from("profiles").update(fields).eq("id", id).select("*").single();
    if (error) throw new ApiError("ویرایش حساب انجام نشد.");
    return profileToUser(data as ProfileRow);
  }
  const { d, me } = await requireUser("admin");
  const u = d.users.find((x) => x.id === id);
  if (!u) throw new ApiError("کاربر یافت نشد.");
  if (u.id === me.id && patch.active === false) throw new ApiError("نمی‌توانید حساب خودتان را غیرفعال کنید.");
  if (patch.fullName !== undefined) u.fullName = patch.fullName.trim();
  if (patch.active !== undefined) u.active = patch.active;
  if (u.role === "student") {
    if (patch.grade) u.grade = patch.grade;
    if (patch.studentCode !== undefined) u.studentCode = patch.studentCode.trim() || undefined;
  }
  if (patch.password) {
    validatePassword(patch.password);
    const c = d.credentials.find((x) => x.userId === id)!;
    c.salt = uid();
    c.hash = await hashPassword(patch.password, c.salt);
  }
  persist();
  return u;
}

export async function getUserDetail(id: string) {
  if (config.dataMode === "supabase") {
    const db = getSupabase();
    const { data: profile, error } = await db.from("profiles").select("*").eq("id", id).maybeSingle();
    if (error || !profile) throw new ApiError("کاربر پیدا نشد.");
    let linksQuery = db.from("teacher_students").select("teacher_id,student_id");
    linksQuery = profile.role === "teacher" ? linksQuery.eq("teacher_id", id) : linksQuery.eq("student_id", id);
    const { data: links } = await linksQuery;
    const relatedIds = (links ?? []).map((r) => profile.role === "teacher" ? r.student_id : r.teacher_id);
    const { data: relatedRows } = relatedIds.length ? await db.from("profiles").select("*").in("id", relatedIds) : { data: [] };
    const { data: classes } = profile.role === "teacher"
      ? await db.from("classes").select("*").eq("teacher_id", id)
      : await db.from("class_students").select("class_id,classes(*)").eq("student_id", id);
    const classRows = profile.role === "teacher" ? (classes ?? []) : (classes ?? []).map((row: any) => row.classes).filter(Boolean);
    const classIds = classRows.map((c: any) => c.id);
    const { count: sessionsCount } = classIds.length ? await db.from("sessions").select("id", { count: "exact", head: true }).in("class_id", classIds) : { count: 0 };
    let attendance = null;
    if (profile.role === "student") {
      const { data: rows } = await db.from("attendance").select("status").eq("student_id", id);
      attendance = summarize((rows ?? []).map((r) => r.status as AttendanceStatus));
    }
    let attempts: Array<Attempt & { title: string }> = [];
    if (profile.role === "student") {
      const { data: rows } = await db.from("assessment_attempts").select("*").eq("student_id", id).eq("status", "submitted").order("submitted_at", { ascending: false });
      const assessmentIds = [...new Set((rows ?? []).map((r) => r.assessment_id))];
      const { data: assessmentRows } = assessmentIds.length ? await db.from("assessments").select("id,title").in("id", assessmentIds) : { data: [] };
      attempts = (rows ?? []).map((r) => ({ id: r.id, assessmentId: r.assessment_id, studentId: r.student_id, startedAt: r.started_at, submittedAt: r.submitted_at ?? undefined, answers: {}, score: undefined, maxScore: undefined, title: (assessmentRows ?? []).find((a) => a.id === r.assessment_id)?.title ?? "" }));
    }
    return { user: profileToUser(profile as ProfileRow), related: (relatedRows ?? []).map((p) => profileToUser(p as ProfileRow)), classes: classRows, sessionsCount: sessionsCount ?? 0, attendance, attempts };
  }
  const { d } = await requireUser("admin");
  const u = d.users.find((x) => x.id === id);
  if (!u) throw new ApiError("کاربر یافت نشد.");
  const links = d.teacherStudents.filter((r) => (u.role === "teacher" ? r.teacherId === id : r.studentId === id));
  const related = links.map((r) => d.users.find((x) => x.id === (u.role === "teacher" ? r.studentId : r.teacherId))!).filter(Boolean);
  const classes = u.role === "teacher"
    ? d.classes.filter((c) => c.teacherId === id)
    : d.classes.filter((c) => d.classMembers.some((m) => m.classId === c.id && m.studentId === id));
  const sessionsCount = d.sessions.filter((s) => classes.some((c) => c.id === s.classId)).length;
  const attendance = u.role === "student" ? summarize(d.attendance.filter((a) => a.studentId === id).map((a) => a.status)) : null;
  const attempts = u.role === "student"
    ? d.attempts.filter((a) => a.studentId === id && a.submittedAt).map((a) => ({ ...a, title: d.assessments.find((x) => x.id === a.assessmentId)?.title ?? "" }))
    : [];
  return { user: u, related, classes, sessionsCount, attendance, attempts };
}

export async function listAllOfRole(role: Role) {
  if (config.dataMode === "supabase") {
    const { data, error } = await getSupabase().from("profiles").select("*").eq("role", role).order("full_name").limit(500);
    if (error) throw new ApiError("دریافت کاربران انجام نشد.");
    return (data ?? []).map((p) => profileToUser(p as ProfileRow));
  }
  const { d } = await requireUser("admin");
  return d.users.filter((u) => u.role === role).map(publicUser);
}

export async function assign(teacherId: string, studentId: string) {
  if (config.dataMode === "supabase") {
    const { error } = await getSupabase().from("teacher_students").upsert({ teacher_id: teacherId, student_id: studentId }, { onConflict: "teacher_id,student_id", ignoreDuplicates: true });
    if (error) throw new ApiError("اختصاص دانش‌آموز انجام نشد.");
    return;
  }
  const { d } = await requireUser("admin");
  const t = d.users.find((u) => u.id === teacherId && u.role === "teacher");
  const s = d.users.find((u) => u.id === studentId && u.role === "student");
  if (!t || !s) throw new ApiError("معلم یا دانش‌آموز نامعتبر است.");
  if (!teacherHasStudent(d, teacherId, studentId)) d.teacherStudents.push({ teacherId, studentId, createdAt: now() });
  persist();
}
export async function assignMany(teacherId: string, studentIds: string[]) {
  const ids = [...new Set(studentIds)];
  if (!ids.length) return;
  if (config.dataMode === "supabase") {
    const { error } = await getSupabase().from("teacher_students").upsert(ids.map(student_id => ({ teacher_id: teacherId, student_id })), { onConflict: "teacher_id,student_id", ignoreDuplicates: true });
    if (error) throw new ApiError("اختصاص دانش‌آموزان انجام نشد.");
    return;
  }
  const { d } = await requireUser("admin");
  if (!d.users.some(u => u.id === teacherId && u.role === "teacher")) throw new ApiError("معلم نامعتبر است.");
  if (ids.some(id => !d.users.some(u => u.id === id && u.role === "student"))) throw new ApiError("یک یا چند دانش‌آموز نامعتبر هستند.");
  for (const studentId of ids) if (!teacherHasStudent(d, teacherId, studentId)) d.teacherStudents.push({ teacherId, studentId, createdAt: now() });
  persist();
}
export async function unassign(teacherId: string, studentId: string) {
  if (config.dataMode === "supabase") {
    const { error } = await getSupabase().from("teacher_students").delete().eq("teacher_id", teacherId).eq("student_id", studentId);
    if (error) throw new ApiError("حذف ارتباط انجام نشد.");
    return;
  }
  const { d } = await requireUser("admin");
  d.teacherStudents = d.teacherStudents.filter((r) => !(r.teacherId === teacherId && r.studentId === studentId));
  // Revoked link: remove student from that teacher's classes so no further access remains.
  const tClasses = d.classes.filter((c) => c.teacherId === teacherId).map((c) => c.id);
  d.classMembers = d.classMembers.filter((m) => !(m.studentId === studentId && tClasses.includes(m.classId)));
  persist();
}

// ---------------------------------------------------------------- stats
function summarize(statuses: AttendanceStatus[]) {
  const present = statuses.filter((s) => s === "present").length;
  const absent = statuses.filter((s) => s === "absent").length;
  const excused = statuses.filter((s) => s === "excused").length;
  const total = statuses.length;
  return { present, absent, excused, total, rate: total ? Math.round((present / total) * 100) : 0 };
}

export async function adminStats() {
  if (config.dataMode === "supabase") {
    const db = getSupabase();
    const count = async (table: string, configure?: (q: any) => any) => {
      let query = db.from(table).select("*", { count: "exact", head: true });
      if (configure) query = configure(query);
      const { count: n, error } = await query;
      if (error) throw new ApiError("دریافت آمار داشبورد انجام نشد.");
      return n ?? 0;
    };
    const today = new Date().toISOString().slice(0, 10);
    const [students, teachers, admins, classes, heldSessions, activeAssessments, attendancePresent, attendanceAbsent, attendanceExcused, sessions, attendedSessionRows, participantRows, inactiveUsers] = await Promise.all([
      count("profiles", (q) => q.eq("role", "student")), count("profiles", (q) => q.eq("role", "teacher")), count("profiles", (q) => q.eq("role", "admin")),
      count("classes"), count("sessions", (q) => q.lte("session_date", today)),
      count("assessments", (q) => q.eq("status", "published").eq("active", true)),
      count("attendance", (q) => q.eq("status", "present")), count("attendance", (q) => q.eq("status", "absent")), count("attendance", (q) => q.eq("status", "excused")),
      db.from("sessions").select("id").lte("session_date", today).limit(2000), db.from("attendance").select("session_id").limit(5000),
      db.from("assessment_attempts").select("student_id").eq("status", "submitted").limit(5000), count("profiles", (q) => q.eq("active", false)),
    ]);
    for (const result of [sessions, attendedSessionRows, participantRows]) if (result.error) throw new ApiError("دریافت آمار داشبورد انجام نشد.");
    const attendedIds = new Set((attendedSessionRows.data ?? []).map((row: { session_id: string }) => row.session_id));
    const participants = new Set((participantRows.data ?? []).map((row: { student_id: string }) => row.student_id));
    return { students, teachers, admins, classes, heldSessions, attendance: { present: attendancePresent, absent: attendanceAbsent, excused: attendanceExcused, total: attendancePresent + attendanceAbsent + attendanceExcused, rate: attendancePresent + attendanceAbsent + attendanceExcused ? Math.round(attendancePresent / (attendancePresent + attendanceAbsent + attendanceExcused) * 100) : 0 }, activeAssessments, participants: participants.size, inactiveUsers, sessionsMissingAttendance: (sessions.data ?? []).filter((row: { id: string }) => !attendedIds.has(row.id)).length };
  }
  const { d } = await requireUser("admin");
  const today = new Date().toISOString().slice(0, 10);
  const published = d.assessments.filter((a) => a.status === "published" && a.active);
  return {
    students: d.users.filter((u) => u.role === "student").length,
    teachers: d.users.filter((u) => u.role === "teacher").length,
    admins: d.users.filter((u) => u.role === "admin").length,
    classes: d.classes.length,
    heldSessions: d.sessions.filter((s) => s.date <= today).length,
    attendance: summarize(d.attendance.map((a) => a.status)),
    activeAssessments: published.length,
    participants: new Set(d.attempts.filter((a) => a.submittedAt).map((a) => a.studentId)).size,
    inactiveUsers: d.users.filter((u) => !u.active).length,
    sessionsMissingAttendance: d.sessions.filter((s) => s.date <= today && !d.attendance.some((a) => a.sessionId === s.id)).length,
  };
}

export async function attendanceReport(filter: { q?: string; grade?: Grade | "all" }) {
  if (config.dataMode === "supabase") {
    const db = getSupabase();
    let studentsQuery = db.from("profiles").select("*").eq("role", "student").order("full_name").limit(1000);
    if (filter.grade && filter.grade !== "all") studentsQuery = studentsQuery.eq("grade", filter.grade);
    if (filter.q?.trim()) studentsQuery = studentsQuery.ilike("full_name", `%${filter.q.trim().replace(/[%_,]/g, " ")}%`);
    const { data: students, error } = await studentsQuery;
    if (error) throw new ApiError("گزارش حضور و غیاب دریافت نشد.");
    const ids = (students ?? []).map((u) => u.id);
    if (!ids.length) return [];
    const { data: rows, error: attendanceError } = await db.from("attendance").select("student_id,status").in("student_id", ids).limit(10000);
    if (attendanceError) throw new ApiError("گزارش حضور و غیاب دریافت نشد.");
    return (students ?? []).map((p) => ({ user: profileToUser(p as ProfileRow), ...summarize((rows ?? []).filter((a) => a.student_id === p.id).map((a) => a.status as AttendanceStatus)) }));
  }
  const { d } = await requireUser("admin");
  const q = filter.q?.trim();
  return d.users
    .filter((u) => u.role === "student" && (!q || u.fullName.includes(q)) && (!filter.grade || filter.grade === "all" || u.grade === filter.grade))
    .map((u) => ({ user: u, ...summarize(d.attendance.filter((a) => a.studentId === u.id).map((a) => a.status)) }));
}

// ---------------------------------------------------------------- teacher
export async function myStudents() {
  if (config.dataMode === "supabase") {
    const db = getSupabase(); const id = await currentUserId();
    const { data: links, error } = await db.from("teacher_students").select("student_id").eq("teacher_id", id);
    if (error) throw new ApiError("دانش‌آموزان مرتبط دریافت نشدند.");
    const ids = (links ?? []).map((r) => r.student_id); if (!ids.length) return [];
    const { data, error: profilesError } = await db.from("profiles").select("*").in("id", ids).order("full_name");
    if (profilesError) throw new ApiError("دانش‌آموزان مرتبط دریافت نشدند.");
    return (data ?? []).map((p) => profileToUser(p as ProfileRow));
  }
  const { d, me } = await requireUser("teacher");
  return d.teacherStudents.filter((r) => r.teacherId === me.id).map((r) => d.users.find((u) => u.id === r.studentId)!).filter(Boolean);
}

export type ClassSummary = ClassRoom & { memberCount: number; upcoming: number; held: number };
function classSummary(d: DB, c: ClassRoom): ClassSummary {
  const today = new Date().toISOString().slice(0, 10);
  const ss = d.sessions.filter((s) => s.classId === c.id);
  return { ...c, memberCount: d.classMembers.filter((m) => m.classId === c.id).length,
    upcoming: ss.filter((s) => s.date > today).length, held: ss.filter((s) => s.date <= today).length };
}

export async function teacherClasses(): Promise<ClassSummary[]> {
  if (config.dataMode === "supabase") {
    const db = getSupabase(); const id = await currentUserId();
    const { data: classes, error } = await db.from("classes").select("*").eq("teacher_id", id).order("created_at", { ascending: false });
    if (error) throw new ApiError("کلاس‌ها دریافت نشدند.");
    const ids = (classes ?? []).map((c) => c.id); if (!ids.length) return [];
    const [{ data: members }, { data: sessions }] = await Promise.all([
      db.from("class_students").select("class_id").in("class_id", ids),
      db.from("sessions").select("class_id,session_date").in("class_id", ids),
    ]);
    const today = new Date().toISOString().slice(0, 10);
    return (classes ?? []).map((c) => {
      const ss = (sessions ?? []).filter((s) => s.class_id === c.id);
      return { id: c.id, title: c.title, description: c.description ?? undefined, active: c.active, teacherId: c.teacher_id, createdAt: c.created_at,
        memberCount: (members ?? []).filter((m) => m.class_id === c.id).length, upcoming: ss.filter((s) => s.session_date > today).length, held: ss.filter((s) => s.session_date <= today).length };
    });
  }
  const { d, me } = await requireUser("teacher");
  return d.classes.filter((c) => c.teacherId === me.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((c) => classSummary(d, c));
}

export async function teacherStats() {
  if (config.dataMode === "supabase") {
    const [students, classes] = await Promise.all([myStudents(), teacherClasses()]);
    const ids = classes.map((c) => c.id); const today = new Date().toISOString().slice(0, 10);
    const { data, error } = ids.length ? await getSupabase().from("sessions").select("*").in("class_id", ids) : { data: [], error: null };
    if (error) throw new ApiError("آمار معلم دریافت نشد.");
    const classMap = new Map(classes.map((c) => [c.id, c.title]));
    const sessions = (data ?? []).map((s) => ({ id: s.id, classId: s.class_id, date: s.session_date, title: s.title ?? undefined, description: s.description ?? undefined, files: [], createdAt: s.created_at }));
    return { students: students.length, classes: classes.length,
      upcoming: sessions.filter((s) => s.date > today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5).map((s) => ({ ...s, classTitle: classMap.get(s.classId) ?? "" })),
      held: sessions.filter((s) => s.date <= today).length };
  }
  const { d, me } = await requireUser("teacher");
  const today = new Date().toISOString().slice(0, 10);
  const classes = d.classes.filter((c) => c.teacherId === me.id);
  const sessions = d.sessions.filter((s) => classes.some((c) => c.id === s.classId));
  return {
    students: d.teacherStudents.filter((r) => r.teacherId === me.id).length,
    classes: classes.length,
    upcoming: sessions.filter((s) => s.date > today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5)
      .map((s) => ({ ...s, classTitle: classes.find((c) => c.id === s.classId)!.title })),
    held: sessions.filter((s) => s.date <= today).length,
  };
}

async function ownClass(id: string) {
  const ctx = await requireUser("teacher");
  const c = ctx.d.classes.find((x) => x.id === id && x.teacherId === ctx.me.id);
  if (!c) throw new ApiError("کلاس یافت نشد یا متعلق به شما نیست.");
  return { ...ctx, c };
}

export async function getTeacherClass(id: string) {
  if (config.dataMode === "supabase") {
    const db = getSupabase(); const teacherId = await currentUserId();
    const { data: c, error } = await db.from("classes").select("*").eq("id", id).eq("teacher_id", teacherId).maybeSingle();
    if (error || !c) throw new ApiError("کلاس یافت نشد یا متعلق به شما نیست.");
    const [{ data: memberRows }, { data: sessionRows }] = await Promise.all([
      db.from("class_students").select("student_id").eq("class_id", id), db.from("sessions").select("*").eq("class_id", id).order("session_date"),
    ]);
    const memberIds = (memberRows ?? []).map((r) => r.student_id); const sessionIds = (sessionRows ?? []).map((s) => s.id);
    const [{ data: profiles }, { data: attendanceRows }] = await Promise.all([
      memberIds.length ? db.from("profiles").select("*").in("id", memberIds) : Promise.resolve({ data: [], error: null }),
      sessionIds.length ? db.from("attendance").select("student_id,status,session_id").in("session_id", sessionIds) : Promise.resolve({ data: [], error: null }),
    ]);
    const members = memberIds.map((sid) => {
      const p = (profiles ?? []).find((x) => x.id === sid);
      const statuses = (attendanceRows ?? []).filter((a) => a.student_id === sid).map((a) => a.status as AttendanceStatus);
      return { user: p ? profileToUser(p as ProfileRow) : null, ...summarize(statuses) };
    }).filter((x): x is typeof x & { user: User } => !!x.user);
    const sessions = (sessionRows ?? []).map((s) => ({ id: s.id, classId: s.class_id, date: s.session_date, title: s.title ?? undefined, description: s.description ?? undefined, files: [], createdAt: s.created_at }));
    return { cls: { id: c.id, title: c.title, description: c.description ?? undefined, active: c.active, teacherId: c.teacher_id, createdAt: c.created_at }, members, memberIds, sessions };
  }
  const { d, c } = await ownClass(id);
  const memberIds = d.classMembers.filter((m) => m.classId === id).map((m) => m.studentId);
  const sessions = d.sessions.filter((s) => s.classId === id).sort((a, b) => a.date.localeCompare(b.date));
  const members = memberIds.map((sid) => {
    const u = d.users.find((x) => x.id === sid)!;
    const st = summarize(d.attendance.filter((a) => a.studentId === sid && sessions.some((s) => s.id === a.sessionId)).map((a) => a.status));
    return { user: u, ...st };
  });
  return { cls: c, members, memberIds, sessions };
}

export interface ClassInput { title: string; description?: string; active: boolean; memberIds: string[] }
function checkMembers(d: DB, teacherId: string, ids: string[]) {
  for (const sid of ids) if (!teacherHasStudent(d, teacherId, sid)) throw new ApiError("فقط دانش‌آموزان اختصاص‌یافته به شما قابل افزودن هستند.");
}
export async function createClass(teacherId: string, input: ClassInput) {
  if (config.dataMode === "supabase") {
    if (!input.title.trim()) throw new ApiError("عنوان کلاس الزامی است.");
    const { data: c, error } = await getSupabase().rpc("admin_create_class", {
      p_teacher_id: teacherId,
      p_title: input.title.trim(),
      p_description: input.description?.trim() || null,
      p_active: input.active,
      p_student_ids: [...new Set(input.memberIds)],
    });
    if (error || !c) throw new ApiError(error?.message || "ایجاد کلاس انجام نشد.");
    return { id: c.id, title: c.title, description: c.description ?? undefined, active: c.active, teacherId: c.teacher_id, createdAt: c.created_at } as ClassRoom;
  }
  const { d } = await requireUser("admin");
  if (!input.title.trim()) throw new ApiError("عنوان کلاس الزامی است.");
  if (!d.users.some((user) => user.id === teacherId && user.role === "teacher" && user.active)) throw new ApiError("معلم انتخاب‌شده معتبر یا فعال نیست.");
  const selectedStudents = [...new Set(input.memberIds)];
  if (selectedStudents.some((id) => !d.users.some((user) => user.id === id && user.role === "student" && user.active))) {
    throw new ApiError("یک یا چند دانش‌آموز انتخاب‌شده نامعتبر یا غیرفعال هستند.");
  }
  for (const studentId of selectedStudents) {
    if (!teacherHasStudent(d, teacherId, studentId)) d.teacherStudents.push({ teacherId, studentId, createdAt: now() });
  }
  const c: ClassRoom = { id: uid(), title: input.title.trim(), description: input.description?.trim() || undefined, active: input.active, teacherId, createdAt: now() };
  d.classes.push(c);
  d.classMembers.push(...selectedStudents.map((studentId) => ({ classId: c.id, studentId })));
  persist();
  return c;
}

export async function adminClasses(): Promise<ClassSummary[]> {
  if (config.dataMode === "supabase") {
    const db = getSupabase();
    const { data: classes, error } = await db.from("classes").select("*").order("created_at", { ascending: false });
    if (error) throw new ApiError("کلاس‌ها دریافت نشدند.");
    const ids = (classes ?? []).map((c) => c.id);
    const [{ data: members }, { data: sessions }] = await Promise.all([
      ids.length ? db.from("class_students").select("class_id").in("class_id", ids) : Promise.resolve({ data: [], error: null }),
      ids.length ? db.from("sessions").select("class_id,session_date").in("class_id", ids) : Promise.resolve({ data: [], error: null }),
    ]);
    const today = new Date().toISOString().slice(0, 10);
    return (classes ?? []).map((c) => {
      const classSessions = (sessions ?? []).filter((session) => session.class_id === c.id);
      return {
        id: c.id, title: c.title, description: c.description ?? undefined, active: c.active,
        teacherId: c.teacher_id, createdAt: c.created_at,
        memberCount: (members ?? []).filter((member) => member.class_id === c.id).length,
        upcoming: classSessions.filter((session) => session.session_date > today).length,
        held: classSessions.filter((session) => session.session_date <= today).length,
      };
    });
  }
  const { d } = await requireUser("admin");
  return d.classes.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((c) => ({
    ...classSummary(d, c), teacherName: d.users.find((user) => user.id === c.teacherId)?.fullName ?? "",
  }));
}
export async function updateClass(id: string, input: ClassInput) {
  if (config.dataMode === "supabase") {
    if (!input.title.trim()) throw new ApiError("عنوان کلاس الزامی است.");
    const db = getSupabase(); const teacherId = await currentUserId(); const allowed = new Set((await myStudents()).map((u) => u.id));
    if (input.memberIds.some((sid) => !allowed.has(sid))) throw new ApiError("فقط دانش‌آموزان اختصاص‌یافته به شما قابل افزودن هستند.");
    const { error } = await db.from("classes").update({ title: input.title.trim(), description: input.description?.trim() || null, active: input.active }).eq("id", id).eq("teacher_id", teacherId);
    if (error) throw new ApiError("ویرایش کلاس انجام نشد.");
    const { data: oldRows } = await db.from("class_students").select("student_id").eq("class_id", id);
    const next = [...new Set(input.memberIds)];
    const additions = next.filter((sid) => !(oldRows ?? []).some((r) => r.student_id === sid));
    if (additions.length) {
      const { error: addError } = await db.from("class_students").insert(additions.map((student_id) => ({ class_id: id, student_id })));
      if (addError) throw new ApiError("به‌روزرسانی اعضای کلاس انجام نشد.");
    }
    const removals = (oldRows ?? []).map((r) => r.student_id).filter((sid) => !next.includes(sid));
    if (removals.length) { const { error: removeError } = await db.from("class_students").delete().eq("class_id", id).in("student_id", removals); if (removeError) throw new ApiError("به‌روزرسانی اعضای کلاس انجام نشد."); }
    return;
  }
  const { d, me, c } = await ownClass(id);
  if (!input.title.trim()) throw new ApiError("عنوان کلاس الزامی است.");
  checkMembers(d, me.id, input.memberIds);
  c.title = input.title.trim();
  c.description = input.description?.trim() || undefined;
  c.active = input.active;
  d.classMembers = d.classMembers.filter((m) => m.classId !== id).concat([...new Set(input.memberIds)].map((studentId) => ({ classId: id, studentId })));
  persist();
}

export interface SessionInput { date: string; title?: string; description?: string; files: Session["files"] }
export async function createSession(classId: string, input: SessionInput) {
  if (config.dataMode === "supabase") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new ApiError("تاریخ جلسه نامعتبر است.");
    const { data, error } = await getSupabase().from("sessions").insert({ class_id: classId, session_date: input.date, title: input.title?.trim() || autoSessionTitle(input.date), description: input.description?.trim() || null }).select("*").single();
    if (error || !data) throw new ApiError("ثبت جلسه انجام نشد.");
    return { id: data.id, classId: data.class_id, date: data.session_date, title: data.title ?? undefined, description: data.description ?? undefined, files: [], createdAt: data.created_at } as Session;
  }
  const { d } = await ownClass(classId);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new ApiError("تاریخ جلسه نامعتبر است.");
  const s: Session = { id: uid(), classId, date: input.date, title: input.title?.trim() || autoSessionTitle(input.date), description: input.description?.trim() || undefined, files: input.files, createdAt: now() };
  d.sessions.push(s);
  persist();
  return s;
}
export async function updateSession(id: string, input: SessionInput) {
  if (config.dataMode === "supabase") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new ApiError("تاریخ جلسه نامعتبر است.");
    const { data, error } = await getSupabase().from("sessions").update({ session_date: input.date, title: input.title?.trim() || autoSessionTitle(input.date), description: input.description?.trim() || null }).eq("id", id).select("id").maybeSingle();
    if (error || !data) throw new ApiError("ویرایش جلسه انجام نشد.");
    return;
  }
  const ctx = await requireUser("teacher");
  const s = ctx.d.sessions.find((x) => x.id === id);
  if (!s) throw new ApiError("جلسه یافت نشد.");
  await ownClass(s.classId);
  const removed = s.files.filter((f) => !input.files.some((n) => n.key === f.key));
  for (const f of removed) await files.remove(f.key).catch(() => undefined);
  Object.assign(s, { date: input.date, title: input.title?.trim() || autoSessionTitle(input.date), description: input.description?.trim() || undefined, files: input.files });
  persist();
}
export async function deleteSession(id: string) {
  if (config.dataMode === "supabase") {
    const { error } = await getSupabase().from("sessions").delete().eq("id", id);
    if (error) throw new ApiError("حذف جلسه انجام نشد.");
    return;
  }
  const ctx = await requireUser("teacher");
  const s = ctx.d.sessions.find((x) => x.id === id);
  if (!s) return;
  await ownClass(s.classId);
  for (const f of s.files) await files.remove(f.key);
  ctx.d.sessions = ctx.d.sessions.filter((x) => x.id !== id);
  ctx.d.attendance = ctx.d.attendance.filter((a) => a.sessionId !== id);
  persist();
}

export async function getSessionAttendance(sessionId: string) {
  if (config.dataMode === "supabase") {
    const db = getSupabase();
    const { data: s, error } = await db.from("sessions").select("*").eq("id", sessionId).maybeSingle();
    if (error || !s) throw new ApiError("جلسه پیدا نشد.");
    const { data: c, error: classError } = await db.from("classes").select("*").eq("id", s.class_id).maybeSingle();
    if (classError || !c) throw new ApiError("کلاس پیدا نشد.");
    const [{ data: roster }, { data: rows }, { data: audit }] = await Promise.all([
      db.from("class_students").select("student_id").eq("class_id", c.id),
      db.from("attendance").select("*").eq("session_id", sessionId),
      db.from("attendance_audit").select("*").eq("session_id", sessionId).order("changed_at", { ascending: false }).limit(20),
    ]);
    const ids = [...new Set([...(roster ?? []).map((r) => r.student_id), ...(audit ?? []).flatMap((a) => [a.student_id, a.changed_by].filter(Boolean))])];
    const { data: profiles } = ids.length ? await db.from("profiles").select("*").in("id", ids) : { data: [] };
    const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
    const members = (roster ?? []).map((r) => (profiles ?? []).find((p) => p.id === r.student_id)).filter(Boolean).map((p) => profileToUser(p as ProfileRow));
    const records = Object.fromEntries((rows ?? []).map((r) => [r.student_id, { sessionId, studentId: r.student_id, status: r.status as AttendanceStatus, updatedAt: r.updated_at, updatedBy: r.updated_by }]));
    const logs = (audit ?? []).map((r) => ({ id: String(r.id), sessionId: r.session_id, studentId: r.student_id, from: r.old_status as AttendanceStatus | null, to: r.new_status as AttendanceStatus, changedBy: r.changed_by ?? "", changedAt: r.changed_at, studentName: names.get(r.student_id) ?? "", byName: names.get(r.changed_by) ?? "" }));
    return { session: { id: s.id, classId: s.class_id, date: s.session_date, title: s.title ?? undefined, description: s.description ?? undefined, files: [], createdAt: s.created_at }, cls: { id: c.id, title: c.title, description: c.description ?? undefined, active: c.active, teacherId: c.teacher_id, createdAt: c.created_at }, members, records, logs };
  }
  const ctx = await requireUser("teacher");
  const s = ctx.d.sessions.find((x) => x.id === sessionId);
  if (!s) throw new ApiError("جلسه یافت نشد.");
  const { d, c } = await ownClass(s.classId);
  const members = d.classMembers.filter((m) => m.classId === c.id).map((m) => d.users.find((u) => u.id === m.studentId)!);
  const records = Object.fromEntries(d.attendance.filter((a) => a.sessionId === sessionId).map((a) => [a.studentId, a]));
  const logs = d.attendanceLogs.filter((l) => l.sessionId === sessionId).sort((a, b) => b.changedAt.localeCompare(a.changedAt)).slice(0, 20)
    .map((l) => ({ ...l, studentName: d.users.find((u) => u.id === l.studentId)?.fullName ?? "", byName: d.users.find((u) => u.id === l.changedBy)?.fullName ?? "" }));
  return { session: s, cls: c, members, records, logs };
}

export async function saveAttendance(sessionId: string, entries: Record<string, AttendanceStatus>) {
  if (config.dataMode === "supabase") {
    const allowed = new Set<AttendanceStatus>(["present", "absent", "excused"]);
    if (Object.values(entries).some((status) => !allowed.has(status))) throw new ApiError("وضعیت حضور و غیاب معتبر نیست.");
    const rows = Object.entries(entries).map(([student_id, status]) => ({ session_id: sessionId, student_id, status }));
    if (!rows.length) return;
    const { error } = await getSupabase().from("attendance").upsert(rows, { onConflict: "session_id,student_id" });
    if (error) throw new ApiError("ذخیرهٔ حضور و غیاب انجام نشد.");
    return;
  }
  const ctx = await requireUser("teacher");
  const s = ctx.d.sessions.find((x) => x.id === sessionId);
  if (!s) throw new ApiError("جلسه یافت نشد.");
  const { d, me } = await ownClass(s.classId);
  const memberIds = d.classMembers.filter((m) => m.classId === s.classId).map((m) => m.studentId);
  for (const [studentId, status] of Object.entries(entries)) {
    if (!memberIds.includes(studentId)) throw new ApiError("دانش‌آموز عضو این کلاس نیست.");
    // Upsert on (session_id, student_id) — unique constraint prevents duplicates.
    const existing = d.attendance.find((a) => a.sessionId === sessionId && a.studentId === studentId);
    if (existing && existing.status === status) continue;
    d.attendanceLogs.push({ id: uid(), sessionId, studentId, from: existing?.status ?? null, to: status, changedBy: me.id, changedAt: now() });
    if (existing) Object.assign(existing, { status, updatedAt: now(), updatedBy: me.id });
    else d.attendance.push({ sessionId, studentId, status, updatedAt: now(), updatedBy: me.id });
  }
  persist();
}

// ---------------------------------------------------------------- student
export async function studentClasses() {
  if (config.dataMode === "supabase") {
    const db = getSupabase(); const studentId = await currentUserId();
    const { data: memberships, error } = await db.from("class_students").select("class_id").eq("student_id", studentId);
    if (error) throw new ApiError("کلاس‌های شما دریافت نشدند.");
    const ids = (memberships ?? []).map((m) => m.class_id); if (!ids.length) return [];
    const [{ data: classes }, { data: sessions }] = await Promise.all([
      db.from("classes").select("*").in("id", ids).eq("active", true), db.from("sessions").select("*").in("class_id", ids).order("session_date", { ascending: false }),
    ]);
    const sessionIds = (sessions ?? []).map((s) => s.id);
    const [{ data: attendance }, { data: teachers }] = await Promise.all([
      sessionIds.length ? db.from("attendance").select("session_id,status").in("session_id", sessionIds).eq("student_id", studentId) : Promise.resolve({ data: [], error: null }),
      classes?.length ? db.from("profiles").select("*").in("id", classes.map((c) => c.teacher_id)) : Promise.resolve({ data: [], error: null }),
    ]);
    const teacherMap = new Map((teachers ?? []).map((p) => [p.id, p.full_name]));
    return (classes ?? []).map((c) => ({ id: c.id, title: c.title, description: c.description ?? undefined, active: c.active, teacherId: c.teacher_id, createdAt: c.created_at, teacherName: teacherMap.get(c.teacher_id) ?? "",
      sessions: (sessions ?? []).filter((s) => s.class_id === c.id).map((s) => ({ id: s.id, classId: s.class_id, date: s.session_date, title: s.title ?? undefined, description: s.description ?? undefined, files: [], createdAt: s.created_at,
        myStatus: (attendance ?? []).find((a) => a.session_id === s.id)?.status as AttendanceStatus | undefined })) }));
  }
  const { d, me } = await requireUser("student");
  const classes = d.classes.filter((c) => c.active && d.classMembers.some((m) => m.classId === c.id && m.studentId === me.id));
  return classes.map((c) => ({
    ...c,
    teacherName: d.users.find((u) => u.id === c.teacherId)?.fullName ?? "",
    sessions: d.sessions.filter((s) => s.classId === c.id).sort((a, b) => b.date.localeCompare(a.date))
      .map((s) => ({ ...s, myStatus: d.attendance.find((a) => a.sessionId === s.id && a.studentId === me.id)?.status })),
  }));
}

export interface MaterialItem { id: string; title: string; description?: string; category?: string; source: string; date: string; file: Material["file"] }
export async function studentMaterials(): Promise<MaterialItem[]> {
  if (config.dataMode === "supabase") {
    const db = getSupabase(); const studentId = await currentUserId();
    const [{ data: materials, error }, { data: memberships }] = await Promise.all([
      db.from("materials").select("*").eq("published", true).order("created_at", { ascending: false }).limit(500),
      db.from("class_students").select("class_id").eq("student_id", studentId),
    ]);
    if (error) throw new ApiError("جزوه‌ها دریافت نشدند.");
    const classIds = (memberships ?? []).map((m) => m.class_id);
    const { data: sessions } = classIds.length ? await db.from("sessions").select("id,class_id,session_date,title").in("class_id", classIds) : { data: [] };
    const sessionIds = (sessions ?? []).map((s) => s.id);
    const [{ data: sessionFiles }, { data: classes }] = await Promise.all([
      sessionIds.length ? db.from("session_files").select("*").in("session_id", sessionIds) : Promise.resolve({ data: [], error: null }),
      classIds.length ? db.from("classes").select("id,title").in("id", classIds) : Promise.resolve({ data: [], error: null }),
    ]);
    const classNames = new Map((classes ?? []).map((c) => [c.id, c.title]));
    const general: MaterialItem[] = (materials ?? []).map((m) => ({ id: m.id, title: m.title, description: m.description ?? undefined, category: m.category ?? "عمومی", source: "جزوه عمومی", date: m.created_at.slice(0, 10), file: { key: m.storage_key, originalName: m.original_name, mime: m.mime_type, size: Number(m.byte_size) } }));
    const lessons: MaterialItem[] = (sessionFiles ?? []).map((f) => {
      const session = (sessions ?? []).find((s) => s.id === f.session_id)!;
      return { id: `${session.id}:${f.storage_key}`, title: f.original_name, category: classNames.get(session.class_id), source: session.title ?? "جزوهٔ جلسه", date: session.session_date, file: { key: f.storage_key, originalName: f.original_name, mime: f.mime_type, size: Number(f.byte_size) } };
    });
    return [...general, ...lessons].sort((a, b) => b.date.localeCompare(a.date));
  }
  const { d, me } = await requireUser("student");
  const general = d.materials.filter((m) => m.published).map((m) => ({ id: m.id, title: m.title, description: m.description, category: m.category ?? "عمومی", source: "جزوه عمومی", date: m.createdAt.slice(0, 10), file: m.file }));
  const myClassIds = d.classMembers.filter((m) => m.studentId === me.id).map((m) => m.classId);
  const sessionFiles = d.sessions.filter((s) => myClassIds.includes(s.classId)).flatMap((s) => {
    const c = d.classes.find((x) => x.id === s.classId)!;
    return s.files.map((f) => ({ id: `${s.id}:${f.key}`, title: f.originalName, category: c.title, source: s.title ?? "جلسه", date: s.date, file: f }));
  });
  return [...general, ...sessionFiles].sort((a, b) => b.date.localeCompare(a.date));
}

export async function studentStats() {
  if (config.dataMode === "supabase") {
    const { data: { user }, error: userError } = await getSupabase().auth.getUser();
    if (userError || !user) throw new ApiError("نشست معتبر نیست.");
    const { data, error } = await getSupabase().from("attendance").select("status").eq("student_id", user.id);
    if (error) throw new ApiError("خلاصهٔ حضور و غیاب دریافت نشد.");
    return { attendance: summarize((data ?? []).map((r) => r.status as AttendanceStatus)) };
  }
  const { d, me } = await requireUser("student");
  return {
    attendance: summarize(d.attendance.filter((a) => a.studentId === me.id).map((a) => a.status)),
  };
}

function isTargeted(a: Assessment, u: User) {
  if (a.target.type === "all") return true;
  if (a.target.type === "grades") return !!u.grade && a.target.grades.includes(u.grade);
  return a.target.studentIds.includes(u.id);
}
function isOpen(a: Assessment) {
  const t = Date.now();
  return a.status === "published" && a.active && (!a.startAt || Date.parse(a.startAt) <= t) && (!a.endAt || Date.parse(a.endAt) >= t);
}

export async function studentAssessments() {
  if (config.dataMode === "supabase") {
    const db = getSupabase(); const studentId = await currentUserId();
    const { data: rows, error } = await db.from("assessments").select("*").eq("status", "published");
    if (error) throw new ApiError("آزمون‌ها دریافت نشدند.");
    const ids = (rows ?? []).map((a) => a.id);
    const [{ data: questions }, { data: attempts }] = await Promise.all([
      ids.length ? db.from("assessment_questions").select("id,assessment_id").in("assessment_id", ids) : Promise.resolve({ data: [], error: null }),
      db.from("assessment_attempts").select("assessment_id,status").eq("student_id", studentId),
    ]);
    const nowMs = Date.now();
    return (rows ?? []).map((a) => {
      const ownAttempts = (attempts ?? []).filter((at) => at.assessment_id === a.id);
      const used = ownAttempts.filter((at) => at.status === "submitted" || at.status === "expired").length;
      return { id: a.id, title: a.title, description: a.description ?? undefined, durationMin: a.duration_minutes ?? undefined,
        questionCount: (questions ?? []).filter((q) => q.assessment_id === a.id).length, maxAttempts: a.max_attempts, used,
        open: a.active && (!a.starts_at || Date.parse(a.starts_at) <= nowMs) && (!a.ends_at || Date.parse(a.ends_at) >= nowMs), endAt: a.ends_at ?? undefined };
    }).filter((a) => a.open || a.used > 0 || a.questionCount > 0);
  }
  const { d, me } = await requireUser("student");
  return d.assessments.filter((a) => a.status === "published" && isTargeted(a, me)).map((a) => {
    const used = d.attempts.filter((x) => x.assessmentId === a.id && x.studentId === me.id && x.submittedAt).length;
    return { id: a.id, title: a.title, description: a.description, durationMin: a.durationMin, questionCount: a.questions.length,
      maxAttempts: a.maxAttempts, used, open: isOpen(a), endAt: a.endAt };
  });
}

/** Teachers see only the active assessment titles offered to their assigned students; never scores or answers. */
export async function teacherAssessments() {
  if (config.dataMode === "supabase") {
    const { data, error } = await getSupabase().functions.invoke("teacher-assessments");
    if (error) throw new ApiError("دریافت فهرست آزمون‌ها انجام نشد.");
    return (data?.assessments ?? []) as Array<{ id: string; title: string; description?: string; questionCount: number; endAt?: string }>;
  }
  const { d, me } = await requireUser("teacher");
  const studentIds = new Set(d.teacherStudents.filter((r) => r.teacherId === me.id).map((r) => r.studentId));
  return d.assessments.filter((a) => a.status === "published" && a.active && d.users.some((u) => studentIds.has(u.id) && u.active && isTargeted(a, u)))
    .map((a) => ({ id: a.id, title: a.title, description: a.description, questionCount: a.questions.length, endAt: a.endAt }));
}

export interface StartedAttempt { attemptId: string; title: string; instructions?: string | undefined; deadline: number | null; answers: Record<string, string>; questions: Array<{ id: string; type: "single_choice"; text: string; options: Array<{ id: string; text: string }> }> }

/** Start or resume an attempt. Questions are returned WITHOUT scores. */
export async function startAttempt(assessmentId: string): Promise<StartedAttempt> {
  if (config.dataMode === "supabase") {
    const { data, error } = await getSupabase().functions.invoke("assessment-attempt", { body: { action: "start", assessmentId } });
    if (error || !data?.attemptId) throw new ApiError(data?.error ?? "شروع آزمون انجام نشد.");
    return data as StartedAttempt;
  }
  const { d, me } = await requireUser("student");
  const a = d.assessments.find((x) => x.id === assessmentId);
  if (!a || !isTargeted(a, me) || !isOpen(a)) throw new ApiError("این آزمون در دسترس شما نیست.");
  let attempt = d.attempts.find((x) => x.assessmentId === a.id && x.studentId === me.id && !x.submittedAt);
  if (!attempt) {
    const used = d.attempts.filter((x) => x.assessmentId === a.id && x.studentId === me.id && x.submittedAt).length;
    if (used >= a.maxAttempts) throw new ApiError("تعداد دفعات مجاز شرکت در این آزمون به پایان رسیده است.");
    attempt = { id: uid(), assessmentId: a.id, studentId: me.id, startedAt: now(), answers: {} };
    d.attempts.push(attempt);
    persist();
  }
  const deadline = a.durationMin ? Date.parse(attempt.startedAt) + a.durationMin * 60_000 : null;
  return {
    attemptId: attempt.id, title: a.title, instructions: a.instructions, deadline, answers: attempt.answers,
    questions: a.questions.map((q) => ({ id: q.id, type: q.type, text: q.text, options: q.options.map((o) => ({ id: o.id, text: o.text })) })),
  };
}

export async function saveAnswers(attemptId: string, answers: Record<string, string>) {
  if (config.dataMode === "supabase") {
    const { data, error } = await getSupabase().functions.invoke("assessment-attempt", { body: { action: "save", attemptId, answers } });
    if (error || !data?.ok) throw new ApiError(data?.error ?? "ذخیرهٔ پاسخ انجام نشد.");
    return;
  }
  const { d, me } = await requireUser("student");
  const at = d.attempts.find((x) => x.id === attemptId && x.studentId === me.id && !x.submittedAt);
  if (!at) throw new ApiError("نوبت آزمون معتبر نیست.");
  at.answers = answers;
  persist();
}

export function scoreAttempt(questions: Question[], answers: Record<string, string>) {
  let score = 0;
  let max = 0;
  for (const q of questions) {
    max += Math.max(0, ...q.options.map((o) => o.score));
    score += q.options.find((o) => o.id === answers[q.id])?.score ?? 0;
  }
  return { score, max };
}

export async function submitAttempt(attemptId: string, answers: Record<string, string>) {
  if (config.dataMode === "supabase") {
    const { data, error } = await getSupabase().functions.invoke("assessment-attempt", { body: { action: "submit", attemptId, answers } });
    if (error || !data?.ok) throw new ApiError(data?.error ?? "ارسال نهایی آزمون انجام نشد.");
    return;
  }
  const { d, me } = await requireUser("student");
  const at = d.attempts.find((x) => x.id === attemptId && x.studentId === me.id && !x.submittedAt);
  if (!at) throw new ApiError("این نوبت قبلاً ارسال شده یا معتبر نیست.");
  const a = d.assessments.find((x) => x.id === at.assessmentId)!;
  const valid = Object.fromEntries(Object.entries(answers).filter(([qid, oid]) => a.questions.find((q) => q.id === qid)?.options.some((o) => o.id === oid)));
  const { score, max } = scoreAttempt(a.questions, valid);
  Object.assign(at, { answers: valid, submittedAt: now(), score, maxScore: max });
  persist();
}

// ---------------------------------------------------------------- admin: materials
export async function listMaterials(q?: string) {
  if (config.dataMode === "supabase") {
    let query = getSupabase().from("materials").select("*").order("created_at", { ascending: false }).limit(1000);
    const term = q?.trim().replace(/[,%()\\]/g, " ");
    if (term) query = query.or(`title.ilike.%${term}%,category.ilike.%${term}%`);
    const { data, error } = await query;
    if (error) throw new ApiError("جزوه‌ها دریافت نشدند.");
    return (data ?? []).map((m) => ({ id: m.id, title: m.title, description: m.description ?? undefined, category: m.category ?? undefined,
      file: { key: m.storage_key, originalName: m.original_name, mime: m.mime_type, size: Number(m.byte_size) }, published: m.published, createdAt: m.created_at }));
  }
  const { d } = await requireUser("admin");
  return d.materials.filter((m) => !q || m.title.includes(q) || (m.category ?? "").includes(q)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function saveMaterial(input: Omit<Material, "id" | "createdAt"> & { id?: string }) {
  if (config.dataMode === "supabase") {
    if (files.mode !== "remote") throw new ApiError("برای ثبت جزوهٔ پایدار، ابتدا سرویس فایل بیرونی را پیکربندی کنید.");
    if (!input.title.trim()) throw new ApiError("عنوان جزوه الزامی است.");
    const values = { title: input.title.trim(), description: input.description?.trim() || null, category: input.category?.trim() || null,
      storage_key: input.file.key, original_name: input.file.originalName, mime_type: input.file.mime, byte_size: input.file.size, published: input.published };
    const query = input.id
      ? getSupabase().from("materials").update(values).eq("id", input.id)
      : getSupabase().from("materials").insert({ ...values, created_by: await currentUserId() });
    const { error } = await query;
    if (error) throw new ApiError("ذخیرهٔ جزوه انجام نشد.");
    return;
  }
  const { d } = await requireUser("admin");
  if (!input.title.trim()) throw new ApiError("عنوان جزوه الزامی است.");
  if (input.id) {
    const m = d.materials.find((x) => x.id === input.id);
    if (!m) throw new ApiError("جزوه یافت نشد.");
    if (m.file.key !== input.file.key) await files.remove(m.file.key).catch(() => undefined);
    Object.assign(m, { ...input, title: input.title.trim() });
  } else {
    d.materials.push({ ...input, title: input.title.trim(), id: uid(), createdAt: now() });
  }
  persist();
}
export async function setMaterialPublished(id: string, published: boolean) {
  if (config.dataMode === "supabase") {
    const { error } = await getSupabase().from("materials").update({ published }).eq("id", id);
    if (error) throw new ApiError("تغییر وضعیت انتشار انجام نشد.");
    return;
  }
  const { d } = await requireUser("admin");
  const m = d.materials.find((x) => x.id === id);
  if (m) m.published = published;
  persist();
}
export async function deleteMaterial(id: string) {
  if (config.dataMode === "supabase") {
    if (files.mode !== "remote") throw new ApiError("سرویس فایل بیرونی هنوز تنظیم نشده است؛ رکورد حفظ شد.");
    const { data: material, error: readError } = await getSupabase().from("materials").select("storage_key").eq("id", id).maybeSingle();
    if (readError || !material) throw new ApiError("جزوه پیدا نشد.");
    await files.remove(material.storage_key);
    const { error } = await getSupabase().from("materials").delete().eq("id", id);
    if (error) throw new ApiError("فایل حذف شد، اما حذف رکورد انجام نشد. با پشتیبانی تماس بگیرید.");
    return;
  }
  const { d } = await requireUser("admin");
  const m = d.materials.find((x) => x.id === id);
  if (!m) return;
  // File first: if the host fails, keep the record so nothing is orphaned silently.
  await files.remove(m.file.key);
  d.materials = d.materials.filter((x) => x.id !== id);
  persist();
}

/** Download permission check, then a URL from the file service. */
export async function getDownloadUrl(key: string) {
  if (config.dataMode === "supabase") {
    const supabase = getSupabase();
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) throw new ApiError("نشست معتبر نیست.");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError("نشست معتبر نیست.");
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    let allowed = false;
    if (profile?.role === "admin") allowed = true;
    else if (profile?.role === "student") {
      const { data: material } = await supabase.from("materials").select("id").eq("storage_key", key).eq("published", true).maybeSingle();
      const { data: sessionFile } = await supabase.from("session_files").select("id").eq("storage_key", key).maybeSingle();
      allowed = !!material || !!sessionFile;
    } else if (profile?.role === "teacher") {
      const { data } = await supabase.from("session_files").select("id").eq("storage_key", key).maybeSingle();
      allowed = !!data;
    }
    if (!allowed) throw new ApiError("اجازهٔ دریافت این فایل را ندارید.");
    return files.getUrl(key, session.access_token);
  }
  const { d, me } = await requireUser();
  if (me.role === "student") {
    const allowed = (await studentMaterials()).some((m) => m.file.key === key);
    if (!allowed) throw new ApiError("اجازه دانلود این فایل را ندارید.");
  } else if (me.role === "teacher") {
    const mine = d.sessions.some((s) => s.files.some((f) => f.key === key) && d.classes.some((c) => c.id === s.classId && c.teacherId === me.id));
    if (!mine) throw new ApiError("اجازه دانلود این فایل را ندارید.");
  }
  return files.getUrl(key);
}

// ---------------------------------------------------------------- admin: assessments
export async function listAssessments() {
  if (config.dataMode === "supabase") {
    const db = getSupabase();
    const [{ data: rows, error }, { data: attempts, error: attemptsError }] = await Promise.all([
      db.from("assessments").select("*").order("created_at", { ascending: false }),
      db.from("assessment_attempts").select("assessment_id,status").in("status", ["submitted", "expired"]),
    ]);
    if (error || attemptsError) throw new ApiError("آزمون‌ها دریافت نشدند.");
    const ids = (rows ?? []).map((a) => a.id);
    const [{ data: questions }, { data: assignments }] = await Promise.all([
      ids.length ? db.from("assessment_questions").select("*").in("assessment_id", ids).order("position") : Promise.resolve({ data: [], error: null }),
      ids.length ? db.from("assessment_assignments").select("*").in("assessment_id", ids) : Promise.resolve({ data: [], error: null }),
    ]);
    const questionIds = (questions ?? []).map((q) => q.id);
    const { data: options } = await db.from("assessment_options").select("*").in("question_id", questionIds).order("position");
    const optionIds = (options ?? []).map((o) => o.id);
    const { data: scoreRows } = optionIds.length ? await db.from("assessment_option_scores").select("*").in("option_id", optionIds) : { data: [] };
    const scoreMap = new Map((scoreRows ?? []).map((r) => [r.option_id, Number(r.score)]));
    return (rows ?? []).map((a) => {
      const qs: Question[] = (questions ?? []).filter((q) => q.assessment_id === a.id).map((q) => ({ id: q.id, type: "single_choice", text: q.body,
        options: (options ?? []).filter((o) => o.question_id === q.id).map((o) => ({ id: o.id, text: o.body, score: scoreMap.get(o.id) ?? 0 })) }));
      const target: Assessment["target"] = a.target === "all_active_students" ? { type: "all" } : a.target === "grades" ? { type: "grades", grades: (a.target_grades ?? []) as Grade[] } : { type: "selected", studentIds: (assignments ?? []).filter((r) => r.assessment_id === a.id).map((r) => r.student_id) };
      return { id: a.id, title: a.title, description: a.description ?? undefined, instructions: a.instructions ?? undefined, status: a.status, active: a.active,
        startAt: a.starts_at ?? undefined, endAt: a.ends_at ?? undefined, durationMin: a.duration_minutes ?? undefined, maxAttempts: a.max_attempts, target, questions: qs, createdAt: a.created_at,
        attemptCount: (attempts ?? []).filter((at) => at.assessment_id === a.id).length };
    });
  }
  const { d } = await requireUser("admin");
  return d.assessments.map((a) => ({ ...a, attemptCount: d.attempts.filter((x) => x.assessmentId === a.id && x.submittedAt).length }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function saveAssessment(input: Omit<Assessment, "id" | "createdAt"> & { id?: string }) {
  if (config.dataMode === "supabase") {
    if (!input.title.trim()) throw new ApiError("عنوان آزمون الزامی است.");
    if (input.maxAttempts < 1) throw new ApiError("تعداد تلاش مجاز باید حداقل ۱ باشد.");
    if (input.startAt && input.endAt && input.startAt > input.endAt) throw new ApiError("زمان پایان باید بعد از زمان شروع باشد.");
    if (input.target.type === "grades" && input.target.grades.length === 0) throw new ApiError("حداقل یک پایه را برای آزمون انتخاب کنید.");
    if (input.status === "published" && (!input.questions.length || input.questions.some((q) => !q.text.trim() || q.options.length < 2 || q.options.some((o) => !o.text.trim())))) throw new ApiError("برای انتشار، حداقل یک پرسش کامل با دو گزینه لازم است.");
    const db = getSupabase(); const actorId = await currentUserId();
    if (input.id) {
      const { count } = await db.from("assessment_attempts").select("id", { count: "exact", head: true }).eq("assessment_id", input.id);
      if ((count ?? 0) > 0) throw new ApiError("این آزمون سابقهٔ شرکت دارد و ویرایش پرسش‌ها برای حفظ نتایج قفل شده است.");
    }
    const target = input.target.type === "all" ? "all_active_students" : input.target.type === "grades" ? "grades" : "selected_students";
    const values = { title: input.title.trim(), description: input.description?.trim() || null, instructions: input.instructions?.trim() || null,
      status: input.status, active: input.active, target, target_grades: input.target.type === "grades" ? input.target.grades : [],
      starts_at: input.startAt ?? null, ends_at: input.endAt ?? null, duration_minutes: input.durationMin ?? null, max_attempts: input.maxAttempts, created_by: actorId };
    let id = input.id;
    if (id) {
      const { error } = await db.from("assessments").update(values).eq("id", id);
      if (error) throw new ApiError("ویرایش آزمون انجام نشد.");
      await db.from("assessment_questions").delete().eq("assessment_id", id);
      await db.from("assessment_assignments").delete().eq("assessment_id", id);
    } else {
      const { data, error } = await db.from("assessments").insert(values).select("id").single();
      if (error || !data) throw new ApiError("ساخت آزمون انجام نشد.");
      id = data.id;
    }
    if (input.target.type === "selected" && input.target.studentIds.length) {
      const { error } = await db.from("assessment_assignments").insert([...new Set(input.target.studentIds)].map((student_id) => ({ assessment_id: id, student_id })));
      if (error) throw new ApiError("تخصیص آزمون به دانش‌آموزان انجام نشد.");
    }
    for (const [index, question] of input.questions.entries()) {
      const { data: q, error: qError } = await db.from("assessment_questions").insert({ assessment_id: id, position: index + 1, question_type: question.type, body: question.text.trim() }).select("id").single();
      if (qError || !q) throw new ApiError("ذخیرهٔ پرسش انجام نشد.");
      const optionRows = question.options.map((option, position) => ({ question_id: q.id, position: position + 1, body: option.text.trim() }));
      const { data: insertedOptions, error: optionError } = await db.from("assessment_options").insert(optionRows).select("id,position");
      if (optionError || !insertedOptions) throw new ApiError("ذخیرهٔ گزینه‌ها انجام نشد.");
      const scoreRows = insertedOptions.map((option) => ({ option_id: option.id, score: question.options[option.position - 1]?.score ?? 0 }));
      const { error: scoreError } = await db.from("assessment_option_scores").insert(scoreRows);
      if (scoreError) throw new ApiError("ذخیرهٔ امتیاز گزینه‌ها انجام نشد.");
    }
    return;
  }
  const { d } = await requireUser("admin");
  if (!input.title.trim()) throw new ApiError("عنوان آزمون الزامی است.");
  if (input.maxAttempts < 1) throw new ApiError("تعداد تلاش مجاز باید حداقل ۱ باشد.");
  if (input.startAt && input.endAt && input.startAt > input.endAt) throw new ApiError("زمان پایان باید بعد از زمان شروع باشد.");
  if (input.target.type === "grades" && input.target.grades.length === 0) throw new ApiError("حداقل یک پایه را برای آزمون انتخاب کنید.");
  if (input.status === "published") {
    if (!input.questions.length) throw new ApiError("برای انتشار، حداقل یک سؤال لازم است.");
    for (const q of input.questions) {
      if (!q.text.trim()) throw new ApiError("متن همه سؤال‌ها را وارد کنید.");
      if (q.options.length < 2 || q.options.some((o) => !o.text.trim())) throw new ApiError("هر سؤال حداقل دو گزینه کامل نیاز دارد.");
    }
  }
  if (input.id) {
    const a = d.assessments.find((x) => x.id === input.id);
    if (!a) throw new ApiError("آزمون یافت نشد.");
    Object.assign(a, input);
  } else d.assessments.push({ ...input, id: uid(), createdAt: now() });
  persist();
}
export async function deleteAssessment(id: string) {
  if (config.dataMode === "supabase") {
    const { error } = await getSupabase().from("assessments").delete().eq("id", id);
    if (error) throw new ApiError("این آزمون شرکت‌کننده دارد یا حذف آن مجاز نیست؛ آن را غیرفعال کنید.");
    return;
  }
  const { d } = await requireUser("admin");
  if (d.attempts.some((a) => a.assessmentId === id)) throw new ApiError("این آزمون شرکت‌کننده دارد؛ به‌جای حذف، آن را غیرفعال کنید.");
  d.assessments = d.assessments.filter((a) => a.id !== id);
  persist();
}

export async function listResults(f: { assessmentId?: string; q?: string; from?: string; to?: string }): Promise<Array<Attempt & { student: User; assessment: Assessment }>> {
  if (config.dataMode === "supabase") {
    const db = getSupabase();
    let query = db.from("assessment_attempts").select("*").in("status", ["submitted", "expired"]).order("submitted_at", { ascending: false }).limit(1000);
    if (f.assessmentId && f.assessmentId !== "all") query = query.eq("assessment_id", f.assessmentId);
    if (f.from) query = query.gte("submitted_at", `${f.from}T00:00:00`);
    if (f.to) query = query.lte("submitted_at", `${f.to}T23:59:59`);
    const { data: attempts, error } = await query;
    if (error) throw new ApiError("نتایج آزمون دریافت نشدند.");
    const attemptIds = (attempts ?? []).map((a) => a.id); const studentIds = [...new Set((attempts ?? []).map((a) => a.student_id))]; const assessmentIds = [...new Set((attempts ?? []).map((a) => a.assessment_id))];
    const [{ data: profiles }, { data: assessments }, { data: results }, { data: answers }] = await Promise.all([
      studentIds.length ? db.from("profiles").select("*").in("id", studentIds) : Promise.resolve({ data: [], error: null }),
      assessmentIds.length ? db.from("assessments").select("*").in("id", assessmentIds) : Promise.resolve({ data: [], error: null }),
      attemptIds.length ? db.from("assessment_results").select("*").in("attempt_id", attemptIds) : Promise.resolve({ data: [], error: null }),
      attemptIds.length ? db.from("assessment_answers").select("*").in("attempt_id", attemptIds) : Promise.resolve({ data: [], error: null }),
    ]);
    const { data: questions } = assessmentIds.length ? await db.from("assessment_questions").select("*").in("assessment_id", assessmentIds) : { data: [] };
    const questionIds = (questions ?? []).map((q) => q.id);
    const { data: options } = questionIds.length ? await db.from("assessment_options").select("*").in("question_id", questionIds) : { data: [] };
    const { data: scores } = options?.length ? await db.from("assessment_option_scores").select("*").in("option_id", options.map((o) => o.id)) : { data: [] };
    const scoreMap = new Map((scores ?? []).map((s) => [s.option_id, Number(s.score)]));
    const rows = (attempts ?? []).map((a) => {
      const rawAssessment = (assessments ?? []).find((x) => x.id === a.assessment_id);
      const assessmentQuestions = (questions ?? []).filter((q) => q.assessment_id === a.assessment_id).map((q) => ({ id: q.id, type: "single_choice" as const, text: q.body,
        options: (options ?? []).filter((o) => o.question_id === q.id).map((o) => ({ id: o.id, text: o.body, score: scoreMap.get(o.id) ?? 0 })) }));
      const target: Assessment["target"] = rawAssessment?.target === "all_active_students" ? { type: "all" } : rawAssessment?.target === "grades" ? { type: "grades", grades: (rawAssessment.target_grades ?? []) as Grade[] } : { type: "selected", studentIds: [] };
      const result = (results ?? []).find((r) => r.attempt_id === a.id);
      return { id: a.id, assessmentId: a.assessment_id, studentId: a.student_id, startedAt: a.started_at, submittedAt: a.submitted_at, answers: Object.fromEntries((answers ?? []).filter((x) => x.attempt_id === a.id).map((x) => [x.question_id, x.option_id])), score: result?.score, maxScore: result?.max_score,
        student: profileToUser((profiles ?? []).find((p) => p.id === a.student_id) as ProfileRow),
        assessment: rawAssessment ? { id: rawAssessment.id, title: rawAssessment.title, description: rawAssessment.description ?? undefined, instructions: rawAssessment.instructions ?? undefined, status: rawAssessment.status, active: rawAssessment.active, startAt: rawAssessment.starts_at ?? undefined, endAt: rawAssessment.ends_at ?? undefined, durationMin: rawAssessment.duration_minutes ?? undefined, maxAttempts: rawAssessment.max_attempts, target, questions: assessmentQuestions, createdAt: rawAssessment.created_at } : null };
    }).filter((r) => !!r.student && !!r.assessment && (!f.q || r.student.fullName.includes(f.q)));
    return rows as Array<Attempt & { student: User; assessment: Assessment }>;
  }
  const { d } = await requireUser("admin");
  return d.attempts.filter((a) => a.submittedAt).map((a) => ({
    ...a, student: d.users.find((u) => u.id === a.studentId)!, assessment: d.assessments.find((x) => x.id === a.assessmentId)!,
  })).filter((r) =>
    (!f.assessmentId || f.assessmentId === "all" || r.assessmentId === f.assessmentId) &&
    (!f.q || r.student.fullName.includes(f.q)) &&
    (!f.from || r.submittedAt!.slice(0, 10) >= f.from) && (!f.to || r.submittedAt!.slice(0, 10) <= f.to),
  ).sort((a, b) => b.submittedAt!.localeCompare(a.submittedAt!));
}
