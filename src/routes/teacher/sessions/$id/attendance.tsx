import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, ClipboardCheck, LayoutDashboard, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { AppShell, type NavItem } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { guardRole } from "@/lib/auth";
import { ATTENDANCE_LABEL, type AttendanceStatus } from "@/lib/types";
import { formatJalali } from "@/lib/jalali";
import { getSessionAttendance, saveAttendance } from "@/services/api";

export const Route = createFileRoute("/teacher/sessions/$id/attendance")({
  ssr: false,
  beforeLoad: () => guardRole("teacher"),
  head: () => ({ meta: [{ title: "ثبت حضور و غیاب | کمپ نخبگان" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: AttendancePage,
});

const nav: NavItem[] = [
  { to: "/teacher/", label: "داشبورد من", icon: <LayoutDashboard size={18} /> },
  { to: "/teacher/classes/", label: "کلاس‌های من", icon: <UsersRound size={18} /> },
];
const statuses: AttendanceStatus[] = ["present", "absent", "excused"];

function AttendancePage() {
  const { id } = Route.useParams();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["teacher", "attendance", id], queryFn: () => getSessionAttendance(id) });
  const [entries, setEntries] = useState<Record<string, AttendanceStatus>>({});
  useEffect(() => { if (query.data) setEntries(Object.fromEntries(query.data.members.map(student => [student.id, query.data.records[student.id]?.status ?? "present"]))); }, [query.data]);
  const save = useMutation({ mutationFn: () => saveAttendance(id, entries), onSuccess: async () => { toast.success("حضور و غیاب ذخیره شد."); await client.invalidateQueries({ queryKey: ["teacher", "attendance", id] }); }, onError: e => toast.error(e instanceof Error ? e.message : "ذخیره حضور و غیاب انجام نشد.") });

  return <AppShell role="teacher" nav={nav}><div className="mx-auto max-w-4xl space-y-6">{query.isError ? <section className="rounded-2xl border bg-white p-8 text-center"><h1 className="text-xl font-extrabold">جلسه در دسترس نیست</h1><p className="mt-2 text-sm text-[#777b8a]">این جلسه وجود ندارد یا به کلاس شما تعلق ندارد.</p><Link to="/teacher/classes/" className="mt-4 inline-block text-sm font-bold text-[#806b3e]">بازگشت به کلاس‌ها</Link></section> : query.isPending ? <p className="rounded-xl border bg-white p-5 text-sm text-[#777b8a]">در حال بارگذاری فهرست…</p> : query.data && <><header><p className="text-xs font-bold text-[#9a7c43]">حضور و غیاب</p><h1 className="mt-2 text-2xl font-black">{query.data.cls.title}</h1><p className="mt-2 text-sm text-muted-foreground">{query.data.session.title || `جلسه ${formatJalali(query.data.session.date)}`} · {formatJalali(query.data.session.date)}</p></header><form onSubmit={e => { e.preventDefault(); save.mutate(); }} className="overflow-hidden rounded-2xl border border-[#eae7de] bg-white shadow-sm"><div className="flex items-center justify-between gap-3 border-b border-[#efede7] p-4 sm:p-5"><div><h2 className="font-extrabold">فهرست دانش‌آموزان</h2><p className="mt-1 text-xs text-[#85899a]">{query.data.members.length} نفر · وضعیت‌های قبلی قابل اصلاح هستند.</p></div><ClipboardCheck className="text-[#927544]" size={22} /></div>{query.data.members.length ? <div className="divide-y divide-[#efede7]">{query.data.members.map(student => <div key={student.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5"><span className="font-bold">{student.fullName}</span><div className="flex flex-wrap gap-2">{statuses.map(status => <label key={status} className={`cursor-pointer rounded-full border px-3 py-2 text-xs font-semibold transition ${entries[student.id] === status ? "border-[#202747] bg-[#202747] text-white" : "border-[#e7e5de] text-[#777b8a] hover:bg-[#faf9f6]"}`}><input type="radio" name={`attendance-${student.id}`} value={status} checked={entries[student.id] === status} onChange={() => setEntries(current => ({ ...current, [student.id]: status }))} className="sr-only" />{ATTENDANCE_LABEL[status]}</label>)}</div></div>)}</div> : <p className="p-8 text-center text-sm text-[#777b8a]">برای این کلاس دانش‌آموزی ثبت نشده است.</p>}<div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#efede7] p-4 sm:p-5"><Link to="/teacher/classes/$id" params={{ id: query.data.cls.id }} className="inline-flex items-center gap-2 text-sm font-semibold text-[#777b8a]"><ArrowRight size={16} />بازگشت به کلاس</Link><Button disabled={save.isPending || !query.data.members.length} className="rounded-xl bg-[#202747]">{save.isPending ? "در حال ذخیره…" : "ذخیره حضور و غیاب"}</Button></div></form>{query.data.logs.length > 0 && <section className="rounded-2xl border border-[#eae7de] bg-white p-5"><h2 className="font-extrabold">تغییرات اخیر</h2><ul className="mt-3 space-y-2">{query.data.logs.slice(0, 6).map(log => <li key={log.id} className="flex flex-wrap justify-between gap-2 text-xs text-[#777b8a]"><span>{log.studentName}: {log.from ? ATTENDANCE_LABEL[log.from] : "ثبت اولیه"} ← {ATTENDANCE_LABEL[log.to]}</span><span>{log.byName}</span></li>)}</ul></section>}</>}</div></AppShell>;
}
