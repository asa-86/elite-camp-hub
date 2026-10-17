import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, LayoutDashboard, Plus, UsersRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import type { NavItem } from "@/components/app-shell";
import { guardRole } from "@/lib/auth";
import { formatJalali } from "@/lib/jalali";
import { teacherClasses } from "@/services/api";

export const Route = createFileRoute("/teacher/classes/")({
  ssr: false,
  beforeLoad: () => guardRole("teacher"),
  head: () => ({ meta: [{ title: "کلاس‌های من | کمپ نخبگان" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: TeacherClassesPage,
});

const nav: NavItem[] = [
  { to: "/teacher/", label: "داشبورد من", icon: <LayoutDashboard size={18} /> },
  { to: "/teacher/classes/", label: "کلاس‌های من", icon: <UsersRound size={18} />, exact: true },
];

function TeacherClassesPage() {
  const query = useQuery({ queryKey: ["teacher", "classes"], queryFn: teacherClasses });
  return <AppShell role="teacher" nav={nav}><div className="space-y-6"><header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold text-[#9a7c43]">فضای آموزشی</p><h1 className="mt-2 text-2xl font-black">کلاس‌های من</h1><p className="mt-2 text-sm text-muted-foreground">کلاس‌ها و برنامهٔ جلسه‌های خود را مدیریت کنید.</p></div><Link to="/teacher/classes/new" className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#202747] px-4 text-sm font-bold text-white hover:bg-[#30395e]"><Plus size={17} />ایجاد کلاس</Link></header>{query.isError && <p role="alert" className="rounded-xl bg-destructive/5 p-4 text-sm text-destructive">دریافت کلاس‌ها انجام نشد.</p>}{query.isPending ? <p className="rounded-2xl border bg-white p-6 text-sm text-muted-foreground">در حال بارگذاری کلاس‌ها…</p> : query.data?.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{query.data.map(cls => <Link key={cls.id} to="/teacher/classes/$id" params={{ id: cls.id }} className="group rounded-2xl border border-[#eae7de] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#d8c79f] hover:shadow-md"><div className="flex items-start justify-between gap-4"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[#f2eddf] text-[#927544]"><UsersRound size={19} /></span><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${cls.active ? "bg-[#e8f1e9] text-[#55745c]" : "bg-[#f1eeee] text-[#858080]"}`}>{cls.active ? "فعال" : "غیرفعال"}</span></div><h2 className="mt-5 text-lg font-extrabold group-hover:text-[#806b3e]">{cls.title}</h2><p className="mt-2 line-clamp-2 min-h-10 text-sm leading-6 text-[#777b8a]">{cls.description || "بدون توضیحات"}</p><div className="mt-5 flex flex-wrap gap-4 border-t border-[#efede7] pt-4 text-xs text-[#85899a]"><span className="inline-flex items-center gap-1.5"><UsersRound size={14} />{cls.memberCount} دانش‌آموز</span><span className="inline-flex items-center gap-1.5"><CalendarDays size={14} />{cls.upcoming} جلسهٔ آینده</span><span>{cls.held} جلسه برگزارشده</span></div></Link>)}</div> : <div className="rounded-2xl border border-dashed border-[#d8d5cc] bg-white p-10 text-center"><UsersRound size={28} className="mx-auto text-[#a9a9b2]" /><h2 className="mt-3 font-extrabold">هنوز کلاسی نساخته‌اید</h2><p className="mt-2 text-sm text-[#777b8a]">برای شروع، کلاس اولتان را بسازید و دانش‌آموزان اختصاص‌یافته را اضافه کنید.</p><Link to="/teacher/classes/new" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#202747] px-4 py-2.5 text-sm font-bold text-white"><Plus size={16} />ایجاد کلاس</Link></div>}</div></AppShell>;
}
