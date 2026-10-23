// DEMO-ONLY browser store that mirrors the planned database tables.
// Replace with Supabase queries (same function signatures in api.ts) when the backend is connected.
import type {
  Assessment, Attempt, Attendance, AttendanceLog, ClassMember, ClassRoom, Credential,
  Material, Session, TeacherStudent, User,
} from "@/lib/types";

export interface DB {
  users: User[];
  credentials: Credential[];
  teacherStudents: TeacherStudent[];
  classes: ClassRoom[];
  classMembers: ClassMember[];
  sessions: Session[];
  attendance: Attendance[];
  attendanceLogs: AttendanceLog[];
  materials: Material[];
  assessments: Assessment[];
  attempts: Attempt[];
}

const KEY = "sec-demo-db-v1";

export async function hashPassword(password: string, salt: string) {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
export const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

async function seed(): Promise<DB> {
  const t = now();
  const users: User[] = [
    { id: "u-admin", username: "admin", fullName: "مریم احمدی", role: "admin", active: true, createdAt: t },
    { id: "u-t1", username: "teacher", fullName: "علی رضایی", role: "teacher", active: true, createdAt: t },
    { id: "u-t2", username: "teacher2", fullName: "زهرا کریمی", role: "teacher", active: true, createdAt: t },
    { id: "u-s1", username: "student", fullName: "آرین محمدی", role: "student", grade: 8, studentCode: "۱۴۰۱", active: true, createdAt: t },
    { id: "u-s2", username: "student2", fullName: "نیکا حسینی", role: "student", grade: 8, studentCode: "۱۴۰۲", active: true, createdAt: t },
    { id: "u-s3", username: "student3", fullName: "پارسا جعفری", role: "student", grade: 9, studentCode: "۱۴۰۳", active: true, createdAt: t },
    { id: "u-s4", username: "student4", fullName: "هلیا موسوی", role: "student", grade: 7, studentCode: "۱۴۰۴", active: true, createdAt: t },
    { id: "u-s5", username: "student5", fullName: "کیان نوری", role: "student", grade: 9, studentCode: "۱۴۰۵", active: false, createdAt: t },
    { id: "u-s6", username: "student6", fullName: "رها کریمی", role: "student", grade: 10, studentCode: "۱۴۰۶", active: true, createdAt: t },
    { id: "u-s7", username: "student7", fullName: "پارسا شریفی", role: "student", grade: 11, studentCode: "۱۴۰۷", active: true, createdAt: t },
    { id: "u-s8", username: "student8", fullName: "هستی رضایی", role: "student", grade: 12, studentCode: "۱۴۰۸", active: true, createdAt: t },
  ];
  const passwords: Record<string, string> = {
    "u-admin": "Admin@1405", "u-t1": "Teacher@1405", "u-t2": "Teacher@1405",
  };
  const credentials: Credential[] = [];
  for (const u of users) {
    const salt = uid();
    credentials.push({ userId: u.id, salt, hash: await hashPassword(passwords[u.id] ?? "Student@1405", salt) });
  }
  const teacherStudents: TeacherStudent[] = ([
    ["u-t1", "u-s1"], ["u-t1", "u-s2"], ["u-t1", "u-s3"], ["u-t2", "u-s1"], ["u-t2", "u-s4"],
  ] as const).map(([teacherId, studentId]) => ({ teacherId, studentId, createdAt: t }));
  const classes: ClassRoom[] = [
    { id: "c-1", title: "کلاس علوم", description: "آزمایش‌های علمی و تفکر نقادانه", active: true, teacherId: "u-t1", createdAt: t },
    { id: "c-2", title: "کلاس ریاضی پیشرفته", description: "حل مسئله و المپیاد", active: true, teacherId: "u-t1", createdAt: t },
    { id: "c-3", title: "کلاس ادبیات خلاق", active: true, teacherId: "u-t2", createdAt: t },
  ];
  const classMembers: ClassMember[] = ([
    ["c-1", "u-s1"], ["c-1", "u-s2"], ["c-1", "u-s3"], ["c-2", "u-s1"], ["c-2", "u-s3"], ["c-3", "u-s1"], ["c-3", "u-s4"],
  ] as const).map(([classId, studentId]) => ({ classId, studentId }));
  const sessions: Session[] = [
    { id: "se-1", classId: "c-1", date: daysAgo(14), title: "آشنایی با روش علمی", files: [], createdAt: t },
    { id: "se-2", classId: "c-1", date: daysAgo(7), description: "آزمایش چگالی مایعات", files: [], createdAt: t },
    { id: "se-3", classId: "c-1", date: daysAgo(-3), files: [], createdAt: t },
    { id: "se-4", classId: "c-2", date: daysAgo(5), title: "الگوها و دنباله‌ها", files: [], createdAt: t },
    { id: "se-5", classId: "c-3", date: daysAgo(2), title: "داستان کوتاه", files: [], createdAt: t },
  ];
  const att = (sessionId: string, studentId: string, status: Attendance["status"]): Attendance => ({
    sessionId, studentId, status, updatedAt: t, updatedBy: "u-t1",
  });
  const attendance: Attendance[] = [
    att("se-1", "u-s1", "present"), att("se-1", "u-s2", "present"), att("se-1", "u-s3", "absent"),
    att("se-2", "u-s1", "present"), att("se-2", "u-s2", "excused"), att("se-2", "u-s3", "present"),
    att("se-4", "u-s1", "present"), att("se-4", "u-s3", "present"),
  ];
  const materials: Material[] = [
    { id: "m-1", title: "راهنمای مطالعه مؤثر", description: "تکنیک‌های یادگیری عمیق", category: "مهارت‌های یادگیری",
      file: { key: "demo/guide.pdf", originalName: "study-guide.pdf", mime: "application/pdf", size: 1_240_000 }, published: true, createdAt: t },
    { id: "m-2", title: "برنامه زمانی کمپ", category: "عمومی",
      file: { key: "demo/schedule.pdf", originalName: "schedule.pdf", mime: "application/pdf", size: 320_000 }, published: false, createdAt: t },
  ];
  const assessments: Assessment[] = [
    {
      id: "a-1", title: "پرسشنامه سبک یادگیری", description: "شناخت ترجیح‌های یادگیری شما",
      instructions: "به هر سؤال با دقت و صادقانه پاسخ دهید. پاسخ درست یا غلط وجود ندارد.",
      status: "published", active: true, durationMin: 10, maxAttempts: 1, target: { type: "all" }, createdAt: t,
      questions: [
        { id: "q1", type: "single_choice", text: "وقتی مطلب جدیدی یاد می‌گیرم، ترجیح می‌دهم…", options: [
          { id: "o1", text: "تصویر یا نمودار ببینم", score: 3 }, { id: "o2", text: "توضیح بشنوم", score: 2 }, { id: "o3", text: "خودم امتحانش کنم", score: 1 } ] },
        { id: "q2", type: "single_choice", text: "هنگام کار گروهی معمولاً…", options: [
          { id: "o1", text: "رهبری را بر عهده می‌گیرم", score: 3 }, { id: "o2", text: "ایده می‌دهم", score: 2 }, { id: "o3", text: "اجرا می‌کنم", score: 1 } ] },
        { id: "q3", type: "single_choice", text: "میزان تمرکز من در مطالعه طولانی…", options: [
          { id: "o1", text: "زیاد است", score: 3 }, { id: "o2", text: "متوسط است", score: 2 }, { id: "o3", text: "کم است", score: 1 } ] },
      ],
    },
    { id: "a-2", title: "ارزیابی مهارت‌های اجتماعی", status: "draft", active: false, maxAttempts: 1,
      target: { type: "grades", grades: [9] }, createdAt: t, questions: [] },
  ];
  return { users, credentials, teacherStudents, classes, classMembers, sessions, attendance,
    attendanceLogs: [], materials, assessments, attempts: [] };
}

let cache: DB | null = null;
let loading: Promise<DB> | null = null;

export async function db(): Promise<DB> {
  if (cache) return cache;
  if (!loading) {
    loading = (async () => {
      const raw = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
      cache = raw ? (JSON.parse(raw) as DB) : await seed();
      persist();
      return cache;
    })();
  }
  return loading;
}
export function persist() {
  if (cache && typeof localStorage !== "undefined") localStorage.setItem(KEY, JSON.stringify(cache));
}
export async function resetDemo() {
  localStorage.removeItem(KEY);
  cache = null;
  loading = null;
  await db();
}
export { now };
