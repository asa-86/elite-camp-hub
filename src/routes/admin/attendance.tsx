import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck, LayoutDashboard, Search, UserRound } from "lucide-react";
import { AppShell, type NavItem } from "@/components/app-shell";
import { guardRole } from "@/lib/auth";
import { formatNumberFa } from "@/lib/jalali";
import { attendanceReport } from "@/services/api";
import { GRADE_LABEL, GRADE_OPTIONS, type Grade } from "@/lib/types";

export const Route = createFileRoute("/admin/attendance")({
  ssr: false,
  beforeLoad: () => guardRole("admin"),
  head: () => ({ meta: [{ title: "گزارش حضور و غیاب | آرما" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: AttendanceReportPage,
});

const nav: NavItem[] = [
  { to: "/admin/", label: "نمای کلی", icon: <LayoutDashboard size={18} /> },
  { to: "/admin/students", label: "دانش‌آموزان", icon: <UserRound size={18} /> },
  { to: "/admin/attendance", label: "حضور و غیاب", icon: <ClipboardCheck size={18} />, exact: true },
];

function AttendanceReportPage() {
  const [q, setQ] = useState("");
  const [grade, setGrade] = useState<Grade | "all">("all");
  const query = useQuery({ queryKey: ["admin", "attendance", q, grade], queryFn: () => attendanceReport({ q, grade }) });
  return <AppShell role="admin" nav={nav}><div className="space-y-6"><header><p className="text-xs font-bold text-[#8c55a5]">گزارش‌ها</p><h1 className="mt-2 text-2xl font-black">گزارش حضور و غیاب</h1><p className="mt-2 text-sm text-muted-foreground">خلاصهٔ وضعیت ثبت‌شده برای هر دانش‌آموز</p></header><section className="overflow-hidden rounded-2xl border border-[#eadfed] bg-white shadow-sm"><div className="flex flex-col gap-3 border-b border-[#eee5f1] p-4 sm:flex-row"><div className="relative flex-1"><Search size={16} className="absolute right-3 top-3 text-[#91859c]" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="جست‌وجو بر اساس نام دانش‌آموز" className="h-10 w-full rounded-xl border border-[#eadfed] pr-10 pl-3 text-sm outline-none focus:border-[#9b5cad]" /></div><select value={grade} onChange={e => setGrade(e.target.value === "all" ? "all" : Number(e.target.value) as Grade)} className="h-10 rounded-xl border border-[#eadfed] bg-white px-3 text-sm"><option value="all">همهٔ پایه‌ها</option>{GRADE_OPTIONS.map(option => <option key={option} value={option}>{GRADE_LABEL[option]}</option>)}</select></div>{query.isError ? <p role="alert" className="p-6 text-sm text-destructive">گزارش دریافت نشد.</p> : query.isPending ? <p className="p-6 text-sm text-[#74677f]">در حال محاسبه…</p> : query.data?.length ? <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-right text-sm"><thead className="bg-[#fcf8fc] text-xs text-[#74677f]"><tr><th className="px-5 py-3">دانش‌آموز</th><th className="px-5 py-3">حاضر</th><th className="px-5 py-3">غایب</th><th className="px-5 py-3">غیبت مجاز</th><th className="px-5 py-3">درصد حضور</th></tr></thead><tbody className="divide-y divide-[#eee5f1]">{query.data.map(row => <tr key={row.user.id}><td className="px-5 py-4 font-bold">{row.user.fullName}<span className="mr-2 text-xs font-normal text-[#80748c]">پایه {row.user.grade}</span></td><td className="px-5 py-4 text-[#55745c]">{formatNumberFa(row.present)}</td><td className="px-5 py-4 text-[#9a5d50]">{formatNumberFa(row.absent)}</td><td className="px-5 py-4 text-[#8c55a5]">{formatNumberFa(row.excused)}</td><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="h-2 w-24 overflow-hidden rounded-full bg-[#eee5f1]"><span className="block h-full rounded-full bg-[#658b6b]" style={{ width: `${row.rate}%` }} /></span><strong>{formatNumberFa(row.rate)}٪</strong></div></td></tr>)}</tbody></table></div> : <p className="p-8 text-center text-sm text-[#74677f]">داده‌ای برای این فیلتر وجود ندارد.</p>}</section></div></AppShell>;
}
