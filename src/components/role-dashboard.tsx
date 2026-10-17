import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays, ClipboardCheck, GraduationCap, LayoutDashboard, LibraryBig, UserRound, UsersRound, Link2, ClipboardList } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { AppShell, type NavItem } from "@/components/app-shell";
import { useMe } from "@/lib/auth";
import { adminStats, studentAssessments, studentClasses, studentMaterials, studentStats, teacherStats } from "@/services/api";
import type { Role } from "@/lib/types";

function Frame({ role, title, children }: { role: Role; title: string; children: ReactNode }) {
  const me = useMe();
  const nav: NavItem[] = role === "admin" ? [
    { to: "/admin/", label: "نمای کلی", icon: <LayoutDashboard size={18} />, exact: true },
    { to: "/admin/students", label: "دانش‌آموزان", icon: <GraduationCap size={18} /> },
    { to: "/admin/teachers", label: "معلمان", icon: <UserRound size={18} /> },
    { to: "/admin/assignments", label: "ارتباط‌ها", icon: <Link2 size={18} /> },
    { to: "/admin/materials", label: "جزوه‌ها", icon: <LibraryBig size={18} /> },
    { to: "/admin/assessments", label: "آزمون‌ها", icon: <ClipboardList size={18} /> },
    { to: "/admin/assessment-results", label: "نتایج آزمون", icon: <ClipboardCheck size={18} /> },
    { to: "/admin/attendance", label: "حضور و غیاب", icon: <ClipboardCheck size={18} /> },
    { to: "/admin/settings", label: "تنظیمات حساب", icon: <UserRound size={18} /> },
  ] : role === "teacher" ? [
    { to: "/teacher/", label: "داشبورد من", icon: <LayoutDashboard size={18} />, exact: true },
    { to: "/teacher/classes/", label: "کلاس‌های من", icon: <UsersRound size={18} /> },
    { to: "/teacher/assessments", label: "آزمون‌ها", icon: <ClipboardList size={18} /> },
    { to: "/teacher/settings", label: "تنظیمات حساب", icon: <UserRound size={18} /> },
  ] : [
    { to: "/student/", label: "داشبورد من", icon: <LayoutDashboard size={18} />, exact: true },
    { to: "/student/classes", label: "کلاس‌های من", icon: <UsersRound size={18} /> },
    { to: "/student/assessments", label: "آزمون‌ها", icon: <ClipboardList size={18} /> },
    { to: "/student/settings", label: "تنظیمات حساب", icon: <UserRound size={18} /> },
  ];
  return <AppShell role={role} nav={nav}><div className="space-y-7"><div><p className="text-xs font-bold text-[#9a7c43]">پنل {role === "admin" ? "مدیریت" : role === "teacher" ? "معلم" : "دانش‌آموز"}</p><h1 className="mt-2 text-2xl font-black">{title}</h1><p className="mt-2 text-sm text-muted-foreground">خوش آمدید{me.data?.fullName ? `، ${me.data.fullName}` : ""}</p></div>{children}</div></AppShell>;
}

function Metric({ icon, label, value, hint }: { icon: ReactNode; label: string; value?: number; hint?: string }) {
  return <article className="rounded-2xl border border-[#eae7de] bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><span className="text-sm font-semibold text-[#707587]">{label}</span><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#f2eddf] text-[#927544]">{icon}</span></div><p className="mt-4 text-3xl font-black">{value === undefined ? "…" : new Intl.NumberFormat("fa-IR").format(value)}</p>{hint && <p className="mt-1 text-xs text-[#9295a1]">{hint}</p>}</article>;
}

function ErrorNote() { return <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">گرفتن اطلاعات ممکن نشد. دوباره صفحه را بارگذاری کنید.</p>; }

export function AdminDashboard() {
  const q = useQuery({ queryKey: ["admin", "stats"], queryFn: adminStats });
  return <Frame role="admin" title="نمای کلی سامانه">{q.isError && <ErrorNote />}<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={<GraduationCap size={19} />} label="دانش‌آموزان" value={q.data?.students} /><Metric icon={<UsersRound size={19} />} label="معلمان" value={q.data?.teachers} /><Metric icon={<CalendarDays size={19} />} label="کلاس‌ها" value={q.data?.classes} /><Metric icon={<ClipboardCheck size={19} />} label="آزمون‌های فعال" value={q.data?.activeAssessments} /></div><section className="rounded-2xl border border-[#eae7de] bg-white p-5 sm:p-7"><h2 className="font-extrabold">وضعیت فعالیت</h2><div className="mt-5 grid gap-4 sm:grid-cols-3"><div className="rounded-xl bg-[#f8f7f2] p-4"><p className="text-xs text-[#777b8a]">جلسه‌های برگزارشده</p><p className="mt-2 text-xl font-black">{q.data ? new Intl.NumberFormat("fa-IR").format(q.data.heldSessions) : "…"}</p></div><div className="rounded-xl bg-[#f8f7f2] p-4"><p className="text-xs text-[#777b8a]">شرکت‌کنندگان آزمون</p><p className="mt-2 text-xl font-black">{q.data ? new Intl.NumberFormat("fa-IR").format(q.data.participants) : "…"}</p></div><div className="rounded-xl bg-[#f8f7f2] p-4"><p className="text-xs text-[#777b8a]">جلسه‌های نیازمند ثبت حضور</p><p className="mt-2 text-xl font-black">{q.data ? new Intl.NumberFormat("fa-IR").format(q.data.sessionsMissingAttendance) : "…"}</p></div></div></section></Frame>;
}

const persianDate = (date: string) => new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "numeric", month: "long" }).format(new Date(`${date}T12:00:00`));

export function TeacherDashboard() {
  const q = useQuery({ queryKey: ["teacher", "stats"], queryFn: teacherStats });
  return <Frame role="teacher" title="داشبورد من">{q.isError && <ErrorNote />}<div className="grid gap-4 sm:grid-cols-2"><Metric icon={<GraduationCap size={19} />} label="دانش‌آموزان همراه" value={q.data?.students} /><Metric icon={<LibraryBig size={19} />} label="کلاس‌های من" value={q.data?.classes} /><Metric icon={<CalendarDays size={19} />} label="جلسه‌های برگزارشده" value={q.data?.held} /></div><section className="rounded-2xl border border-[#eae7de] bg-white p-5 sm:p-7"><h2 className="font-extrabold">جلسه‌های پیش رو</h2>{q.data?.upcoming.length ? <ul className="mt-4 divide-y divide-[#efede7]">{q.data.upcoming.map(s => <li key={s.id} className="flex items-center justify-between gap-3 py-4"><div><p className="font-bold">{s.title || s.classTitle}</p><p className="mt-1 text-xs text-[#85899a]">{s.classTitle}</p></div><span className="rounded-full bg-[#f5f0e4] px-3 py-1.5 text-xs font-bold text-[#846b3e]">{persianDate(s.date)}</span></li>)}</ul> : <p className="mt-4 rounded-xl bg-[#f8f7f2] p-4 text-sm text-[#777b8a]">جلسهٔ آینده‌ای ثبت نشده است.</p>}</section></Frame>;
}

export function StudentDashboard() {
  const stats = useQuery({ queryKey: ["student", "stats"], queryFn: studentStats });
  const classes = useQuery({ queryKey: ["student", "classes"], queryFn: studentClasses });
  const materials = useQuery({ queryKey: ["student", "materials"], queryFn: studentMaterials });
  const assessments = useQuery({ queryKey: ["student", "assessments"], queryFn: studentAssessments });
  return <Frame role="student" title="داشبورد من">{[stats, classes, materials, assessments].some(q => q.isError) && <ErrorNote />}<div className="grid gap-4 sm:grid-cols-2"><Metric icon={<LibraryBig size={19} />} label="کلاس‌های فعال" value={classes.data?.length} /><Metric icon={<ClipboardCheck size={19} />} label="آزمون‌های در دسترس" value={assessments.data?.filter(a => a.open).length} /><Metric icon={<GraduationCap size={19} />} label="میزان حضور" value={stats.data?.attendance.rate} hint="درصد حضور ثبت‌شده" /><Metric icon={<UsersRound size={19} />} label="جزوه‌های در دسترس" value={materials.data?.length} /></div><div className="grid gap-5 lg:grid-cols-2"><section className="rounded-2xl border border-[#eae7de] bg-white p-5 sm:p-7"><div className="flex items-center justify-between"><h2 className="font-extrabold">کلاس‌های من</h2><span className="text-xs text-[#9295a1]">{classes.data?.length ?? "…"} کلاس</span></div>{classes.data?.length ? <ul className="mt-4 divide-y divide-[#efede7]">{classes.data.slice(0, 4).map(c => <li key={c.id} className="flex items-center justify-between gap-3 py-3"><div><p className="text-sm font-bold">{c.title}</p><p className="mt-1 text-xs text-[#85899a]">معلم: {c.teacherName}</p></div><span className="text-xs text-[#85899a]">{c.sessions.length} جلسه</span></li>)}</ul> : <p className="mt-4 rounded-xl bg-[#f8f7f2] p-4 text-sm text-[#777b8a]">هنوز کلاسی برای شما ثبت نشده است.</p>}</section><section className="rounded-2xl border border-[#eae7de] bg-white p-5 sm:p-7"><div className="flex items-center justify-between"><h2 className="font-extrabold">آخرین جزوه‌ها</h2><span className="inline-flex items-center gap-1 text-xs text-[#9295a1]"><ArrowLeft size={13} /> منابع آموزشی</span></div>{materials.data?.length ? <ul className="mt-4 divide-y divide-[#efede7]">{materials.data.slice(0, 4).map(m => <li key={m.id} className="flex items-center gap-3 py-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[#f2eddf] text-[#927544]"><LibraryBig size={16} /></span><div><p className="text-sm font-bold">{m.title}</p><p className="mt-1 text-xs text-[#85899a]">{m.category}</p></div></li>)}</ul> : <p className="mt-4 rounded-xl bg-[#f8f7f2] p-4 text-sm text-[#777b8a]">جزوه‌ای برای نمایش وجود ندارد.</p>}</section></div><div className="text-xs leading-6 text-[#9295a1]">نتایج ارزیابی‌ها برای حفظ حریم خصوصی در این پنل نمایش داده نمی‌شوند.</div></Frame>;
}
