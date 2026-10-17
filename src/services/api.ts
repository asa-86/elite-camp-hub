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
import { autoSessionTitle } from "@/lib/jalali";

export class ApiError extends Error {}
const delay = () => new Promise((r) => setTimeout(r, 120));

// ---------------------------------------------------------------- session
const SESSION_KEY = "sec-session";
const SESSION_TTL = 1000 * 60 * 60 * 8;
interface StoredSession { userId: string; role: Role; exp: number }

export function readSession(): StoredSession | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null") as StoredSession | null;
    if (!s || s.exp < Date.now()) return null;
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

export function logout() {
  localStorage.removeItem(SESSION_KEY);
}

export async function getMe(): Promise<User | null> {
  const s = readSession();
  if (!s) return null;
  const d = await db();
  const me = d.users.find((u) => u.id === s.userId);
  if (!me || !me.active) { logout(); return null; }
  return me;
}

export async function changePassword(current: string, next: string) {
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
  // Production: server function using the service role (admin-only, role verified server-side).
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
  const { d } = await requireUser("admin");
  return d.users.filter((u) => u.role === role).map(publicUser);
}

export async function assign(teacherId: string, studentId: string) {
  const { d } = await requireUser("admin");
  const t = d.users.find((u) => u.id === teacherId && u.role === "teacher");
  const s = d.users.find((u) => u.id === studentId && u.role === "student");
  if (!t || !s) throw new ApiError("معلم یا دانش‌آموز نامعتبر است.");
  if (!teacherHasStudent(d, teacherId, studentId)) d.teacherStudents.push({ teacherId, studentId, createdAt: now() });
  persist();
}
export async function unassign(teacherId: string, studentId: string) {
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
  const { d } = await requireUser("admin");
  const q = filter.q?.trim();
  return d.users
    .filter((u) => u.role === "student" && (!q || u.fullName.includes(q)) && (!filter.grade || filter.grade === "all" || u.grade === filter.grade))
    .map((u) => ({ user: u, ...summarize(d.attendance.filter((a) => a.studentId === u.id).map((a) => a.status)) }));
}

// ---------------------------------------------------------------- teacher
export async function myStudents() {
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
  const { d, me } = await requireUser("teacher");
  return d.classes.filter((c) => c.teacherId === me.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((c) => classSummary(d, c));
}

export async function teacherStats() {
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
export async function createClass(input: ClassInput) {
  const { d, me } = await requireUser("teacher");
  if (!input.title.trim()) throw new ApiError("عنوان کلاس الزامی است.");
  checkMembers(d, me.id, input.memberIds);
  const c: ClassRoom = { id: uid(), title: input.title.trim(), description: input.description?.trim() || undefined, active: input.active, teacherId: me.id, createdAt: now() };
  d.classes.push(c);
  d.classMembers.push(...[...new Set(input.memberIds)].map((studentId) => ({ classId: c.id, studentId })));
  persist();
  return c;
}
export async function updateClass(id: string, input: ClassInput) {
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
  const { d } = await ownClass(classId);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new ApiError("تاریخ جلسه نامعتبر است.");
  const s: Session = { id: uid(), classId, date: input.date, title: input.title?.trim() || autoSessionTitle(input.date), description: input.description?.trim() || undefined, files: input.files, createdAt: now() };
  d.sessions.push(s);
  persist();
  return s;
}
export async function updateSession(id: string, input: SessionInput) {
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
  const { d, me } = await requireUser("student");
  return d.assessments.filter((a) => a.status === "published" && isTargeted(a, me)).map((a) => {
    const used = d.attempts.filter((x) => x.assessmentId === a.id && x.studentId === me.id && x.submittedAt).length;
    return { id: a.id, title: a.title, description: a.description, durationMin: a.durationMin, questionCount: a.questions.length,
      maxAttempts: a.maxAttempts, used, open: isOpen(a), endAt: a.endAt };
  });
}

/** Teachers see only the active assessment titles offered to their assigned students; never scores or answers. */
export async function teacherAssessments() {
  const { d, me } = await requireUser("teacher");
  const studentIds = new Set(d.teacherStudents.filter((r) => r.teacherId === me.id).map((r) => r.studentId));
  return d.assessments.filter((a) => a.status === "published" && a.active && d.users.some((u) => studentIds.has(u.id) && u.active && isTargeted(a, u)))
    .map((a) => ({ id: a.id, title: a.title, description: a.description, questionCount: a.questions.length, endAt: a.endAt }));
}

/** Start or resume an attempt. Questions are returned WITHOUT scores. */
export async function startAttempt(assessmentId: string) {
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
  const { d } = await requireUser("admin");
  return d.materials.filter((m) => !q || m.title.includes(q) || (m.category ?? "").includes(q)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function saveMaterial(input: Omit<Material, "id" | "createdAt"> & { id?: string }) {
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
  const { d } = await requireUser("admin");
  const m = d.materials.find((x) => x.id === id);
  if (m) m.published = published;
  persist();
}
export async function deleteMaterial(id: string) {
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
  const { d } = await requireUser("admin");
  return d.assessments.map((a) => ({ ...a, attemptCount: d.attempts.filter((x) => x.assessmentId === a.id && x.submittedAt).length }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function saveAssessment(input: Omit<Assessment, "id" | "createdAt"> & { id?: string }) {
  const { d } = await requireUser("admin");
  if (!input.title.trim()) throw new ApiError("عنوان آزمون الزامی است.");
  if (input.maxAttempts < 1) throw new ApiError("تعداد تلاش مجاز باید حداقل ۱ باشد.");
  if (input.startAt && input.endAt && input.startAt > input.endAt) throw new ApiError("زمان پایان باید بعد از زمان شروع باشد.");
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
  const { d } = await requireUser("admin");
  if (d.attempts.some((a) => a.assessmentId === id)) throw new ApiError("این آزمون شرکت‌کننده دارد؛ به‌جای حذف، آن را غیرفعال کنید.");
  d.assessments = d.assessments.filter((a) => a.id !== id);
  persist();
}

export async function listResults(f: { assessmentId?: string; q?: string; from?: string; to?: string }) {
  const { d } = await requireUser("admin");
  return d.attempts.filter((a) => a.submittedAt).map((a) => ({
    ...a, student: d.users.find((u) => u.id === a.studentId)!, assessment: d.assessments.find((x) => x.id === a.assessmentId)!,
  })).filter((r) =>
    (!f.assessmentId || f.assessmentId === "all" || r.assessmentId === f.assessmentId) &&
    (!f.q || r.student.fullName.includes(f.q)) &&
    (!f.from || r.submittedAt!.slice(0, 10) >= f.from) && (!f.to || r.submittedAt!.slice(0, 10) <= f.to),
  ).sort((a, b) => b.submittedAt!.localeCompare(a.submittedAt!));
}
