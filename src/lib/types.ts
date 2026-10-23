// Domain types — mirror the planned database tables (see docs/DATABASE.md).

export type Role = "admin" | "teacher" | "student";
export type Grade = 7 | 8 | 9 | 10 | 11 | 12;
export const GRADE_OPTIONS: Grade[] = [7, 8, 9, 10, 11, 12];
export type AttendanceStatus = "present" | "absent" | "excused";

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  active: boolean;
  grade?: Grade | undefined;
  studentCode?: string | undefined;
  createdAt: string;
}

/** Stored only in the demo store; in production passwords live in Supabase Auth (bcrypt). */
export interface Credential {
  userId: string;
  salt: string;
  hash: string;
}

export interface TeacherStudent {
  teacherId: string;
  studentId: string;
  createdAt: string;
}

export interface FileRef {
  key: string;
  originalName: string;
  mime: string;
  size: number;
}

export interface ClassRoom {
  id: string;
  title: string;
  description?: string | undefined;
  active: boolean;
  teacherId: string;
  createdAt: string;
}
export interface ClassMember {
  classId: string;
  studentId: string;
}

export interface Session {
  id: string;
  classId: string;
  date: string; // ISO YYYY-MM-DD
  title?: string | undefined;
  description?: string | undefined;
  files: FileRef[];
  createdAt: string;
}

export interface Attendance {
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
  updatedAt: string;
  updatedBy: string;
}
export interface AttendanceLog {
  id: string;
  sessionId: string;
  studentId: string;
  from: AttendanceStatus | null;
  to: AttendanceStatus;
  changedBy: string;
  changedAt: string;
}

export interface Material {
  id: string;
  title: string;
  description?: string | undefined;
  category?: string | undefined;
  file: FileRef;
  published: boolean;
  createdAt: string;
}

export type QuestionType = "single_choice"; // extensible: "likert" | "text" ...
export interface QuestionOption {
  id: string;
  text: string;
  score: number;
}
export interface Question {
  id: string;
  type: QuestionType;
  text: string;
  options: QuestionOption[];
}
export type AssessmentTarget =
  | { type: "all" }
  | { type: "grades"; grades: Grade[] }
  | { type: "selected"; studentIds: string[] };

export interface Assessment {
  id: string;
  title: string;
  description?: string | undefined;
  instructions?: string | undefined;
  status: "draft" | "published";
  active: boolean;
  startAt?: string | undefined;
  endAt?: string | undefined;
  durationMin?: number | undefined;
  maxAttempts: number;
  target: AssessmentTarget;
  questions: Question[];
  createdAt: string;
}

export interface Attempt {
  id: string;
  assessmentId: string;
  studentId: string;
  startedAt: string;
  submittedAt?: string | undefined;
  answers: Record<string, string>;
  score?: number | undefined;
  maxScore?: number | undefined;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: "مدیر",
  teacher: "معلم",
  student: "دانش‌آموز",
};
export const GRADE_LABEL: Record<Grade, string> = {
  7: "پایه هفتم",
  8: "پایه هشتم",
  9: "پایه نهم",
  10: "پایه دهم",
  11: "پایه یازدهم",
  12: "پایه دوازدهم",
};
export const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
  present: "حاضر",
  absent: "غایب",
  excused: "غیبت مجاز",
};
