import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, LayoutDashboard, LibraryBig, UsersRound } from "lucide-react";
import { AppShell, type NavItem } from "@/components/app-shell";
import { guardRole } from "@/lib/auth";
import { ATTENDANCE_LABEL } from "@/lib/types";
import { formatJalali } from "@/lib/jalali";
import { studentClasses } from "@/services/api";

export const Route = createFileRoute("/student/classes")({
  ssr: false,
  beforeLoad: () => guardRole("student"),
  head: () => ({ meta: [{ title: "کلاس‌های من | آرما" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: StudentClassesPage,
});

const nav: NavItem[] = [
  { to: "/student/", label: "داشبورد من", icon: <LayoutDashboard size={18} /> },
  { to: "/student/classes", label: "کلاس‌های من", icon: <UsersRound size={18} />, exact: true },
  { to: "/student/assessments", label: "آزمون‌ها", icon: <LibraryBig size={18} /> },
];

function StudentClassesPage() {
  const query = useQuery({ queryKey: ["student", "classes"], queryFn: studentClasses });
  return <AppShell role="student" nav={nav}><div className="space-y-6"><header><p className="text-xs font-bold text-[#8c55a5]">برنامهٔ یادگیری</p><h1 className="mt-2 text-2xl font-black">کلاس‌های من</h1><p className="mt-2 text-sm text-muted-foreground">کلاس‌ها، جلسه‌ها و وضعیت حضور خود را دنبال کنید.</p></header>{query.isError && <p role="alert" className="rounded-xl bg-destructive/5 p-4 text-sm text-destructive">دریافت کلاس‌ها انجام نشد.</p>}{query.isPending ? <p className="rounded-xl border bg-white p-5 text-sm text-[#74677f]">در حال بارگذاری…</p> : query.data?.length ? <div className="space-y-5">{query.data.map(cls => <section key={cls.id} className="overflow-hidden rounded-2xl border border-[#eadfed] bg-white shadow-sm"><header className="flex flex-wrap items-start justify-between gap-4 border-b border-[#eee5f1] p-5"><div><h2 className="text-lg font-extrabold">{cls.title}</h2><p className="mt-1 text-sm text-[#74677f]">معلم: {cls.teacherName}</p>{cls.description && <p className="mt-3 text-sm leading-6 text-[#74677f]">{cls.description}</p>}</div><span className="inline-flex items-center gap-2 rounded-full bg-[#f6edf7] px-3 py-1.5 text-xs font-bold text-[#8c55a5]"><CalendarDays size={14} />{cls.sessions.length} جلسه</span></header><div className="p-5">{cls.sessions.length ? <ul className="space-y-3">{cls.sessions.map(session => <li key={session.id} className="rounded-xl border border-[#eee5f1] bg-[#fdf9fd] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-bold">{session.title || `جلسه ${formatJalali(session.date)}`}</h3><p className="mt-1 text-xs text-[#80748c]">{formatJalali(session.date)}</p></div>{session.myStatus ? <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${session.myStatus === "present" ? "bg-[#f3e8f5] text-[#55745c]" : session.myStatus === "absent" ? "bg-[#f4e6f2] text-[#9a5d50]" : "bg-[#f6edf7] text-[#8c55a5]"}`}>حضور: {ATTENDANCE_LABEL[session.myStatus]}</span> : <span className="rounded-full bg-[#f7f1f8] px-3 py-1.5 text-xs text-[#80748c]">حضور ثبت نشده</span>}</div>{session.description && <p className="mt-3 text-sm leading-6 text-[#74677f]">{session.description}</p>}{session.files.length > 0 && <ul className="mt-3 flex flex-wrap gap-2">{session.files.map(file => <li key={file.key} className="inline-flex items-center gap-2 rounded-lg bg-[#f6eff7] px-3 py-2 text-xs"><LibraryBig size={14} className="text-[#a24c82]" />{file.originalName}</li>)}</ul>}</li>)}</ul> : <p className="rounded-xl bg-[#fcf8fc] p-4 text-sm text-[#74677f]">جلسه‌ای برای این کلاس ثبت نشده است.</p>}</div></section>)}</div> : <div className="rounded-2xl border border-dashed border-[#d8c9dd] bg-white p-10 text-center"><UsersRound className="mx-auto text-[#a59aab]" size={28} /><h2 className="mt-3 font-extrabold">هنوز در کلاسی عضو نیستید</h2><p className="mt-2 text-sm text-[#74677f]">پس از اختصاص کلاس از طرف معلم، برنامهٔ شما در این بخش نمایش داده می‌شود.</p></div>}</div></AppShell>;
}
