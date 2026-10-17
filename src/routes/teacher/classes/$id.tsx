import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, LayoutDashboard, Save, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { AppShell, type NavItem } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { JalaliDateInput } from "@/components/jalali-date-input";
import { guardRole } from "@/lib/auth";
import { formatJalali, todayIso } from "@/lib/jalali";
import { createSession, getTeacherClass, myStudents, updateClass } from "@/services/api";

export const Route = createFileRoute("/teacher/classes/$id")({
  ssr: false,
  beforeLoad: () => guardRole("teacher"),
  head: () => ({ meta: [{ title: "جزئیات کلاس | کمپ نخبگان" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: TeacherClassDetail,
});

const nav: NavItem[] = [
  { to: "/teacher/", label: "داشبورد من", icon: <LayoutDashboard size={18} /> },
  { to: "/teacher/classes/", label: "کلاس‌های من", icon: <UsersRound size={18} /> },
];

function TeacherClassDetail() {
  const { id } = Route.useParams();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["teacher", "class", id], queryFn: () => getTeacherClass(id) });
  const studentQuery = useQuery({ queryKey: ["teacher", "students"], queryFn: myStudents });
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [sessionDate, setSessionDate] = useState(todayIso());
  const [sessionTitle, setSessionTitle] = useState("");
  const [sessionDescription, setSessionDescription] = useState("");
  useEffect(() => { if (query.data) { setTitle(query.data.cls.title); setDescription(query.data.cls.description ?? ""); setActive(query.data.cls.active); setMemberIds(query.data.memberIds); } }, [query.data]);

  const save = useMutation({ mutationFn: () => updateClass(id, { title, description, active, memberIds }), onSuccess: async () => { toast.success("تغییرات کلاس ذخیره شد."); await Promise.all([client.invalidateQueries({ queryKey: ["teacher", "class", id] }), client.invalidateQueries({ queryKey: ["teacher", "classes"] })]); }, onError: e => toast.error(e instanceof Error ? e.message : "ذخیره تغییرات انجام نشد.") });
  const addSession = useMutation({ mutationFn: () => createSession(id, { date: sessionDate, title: sessionTitle, description: sessionDescription, files: [] }), onSuccess: async () => { toast.success("جلسه ثبت شد."); setSessionTitle(""); setSessionDescription(""); await Promise.all([client.invalidateQueries({ queryKey: ["teacher", "class", id] }), client.invalidateQueries({ queryKey: ["teacher", "stats"] })]); }, onError: e => toast.error(e instanceof Error ? e.message : "ثبت جلسه انجام نشد.") });
  const toggle = (studentId: string) => setMemberIds(ids => ids.includes(studentId) ? ids.filter(id => id !== studentId) : [...ids, studentId]);
  const submitClass = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); save.mutate(); };
  const submitSession = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); addSession.mutate(); };

  return <AppShell role="teacher" nav={nav}><div className="space-y-6">{query.isError ? <div role="alert" className="rounded-2xl border bg-white p-8 text-center"><h1 className="text-xl font-extrabold">کلاس پیدا نشد</h1><p className="mt-2 text-sm text-[#777b8a]">این کلاس به حساب شما تعلق ندارد یا حذف شده است.</p><Link to="/teacher/classes/" className="mt-4 inline-block text-sm font-bold text-[#806b3e]">بازگشت به کلاس‌ها</Link></div> : query.isPending ? <p className="rounded-xl border bg-white p-5 text-sm text-[#777b8a]">در حال بارگذاری کلاس…</p> : query.data && <><header><p className="text-xs font-bold text-[#9a7c43]">جزئیات کلاس</p><h1 className="mt-2 text-2xl font-black">{query.data.cls.title}</h1><p className="mt-2 text-sm text-muted-foreground">{query.data.members.length} دانش‌آموز · {query.data.sessions.length} جلسه</p></header>
    <form onSubmit={submitClass} className="grid gap-5 rounded-2xl border border-[#eae7de] bg-white p-5 shadow-sm sm:grid-cols-2 sm:p-6"><div className="sm:col-span-2"><h2 className="font-extrabold">تنظیمات کلاس</h2></div><label className="text-sm font-bold">عنوان<input required value={title} onChange={e => setTitle(e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#e7e5de] px-3 font-normal" /></label><label className="text-sm font-bold">توضیحات<textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="mt-2 w-full rounded-xl border border-[#e7e5de] p-3 font-normal" /></label><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} className="h-4 w-4 accent-[#202747]" />کلاس فعال باشد</label><div className="sm:col-span-2"><p className="text-sm font-bold">اعضای کلاس</p>{studentQuery.data?.length ? <div className="mt-3 grid gap-2 sm:grid-cols-2">{studentQuery.data.map(student => <label key={student.id} className="flex items-center gap-3 rounded-xl border border-[#efede7] p-3 text-sm"><input type="checkbox" checked={memberIds.includes(student.id)} onChange={() => toggle(student.id)} className="h-4 w-4 accent-[#202747]" />{student.fullName}</label>)}</div> : <p className="mt-2 text-sm text-[#777b8a]">دانش‌آموزی به شما اختصاص داده نشده است.</p>}</div><div className="sm:col-span-2"><Button disabled={save.isPending} className="rounded-xl bg-[#202747]"><Save size={16} />{save.isPending ? "در حال ذخیره…" : "ذخیره تغییرات"}</Button></div></form>
    <section className="rounded-2xl border border-[#eae7de] bg-white p-5 shadow-sm sm:p-6"><h2 className="font-extrabold">افزودن جلسه</h2><form onSubmit={submitSession} className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">تاریخ جلسه (شمسی)<div className="mt-2"><JalaliDateInput value={sessionDate} onChange={setSessionDate} /></div></label><label className="text-sm font-bold">عنوان <span className="font-normal text-[#9295a1]">(اختیاری)</span><input value={sessionTitle} onChange={e => setSessionTitle(e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#e7e5de] px-3 font-normal" placeholder="در صورت خالی‌بودن، از تاریخ ساخته می‌شود" /></label><label className="text-sm font-bold sm:col-span-2">توضیحات <span className="font-normal text-[#9295a1]">(اختیاری)</span><textarea value={sessionDescription} onChange={e => setSessionDescription(e.target.value)} rows={2} className="mt-2 w-full rounded-xl border border-[#e7e5de] p-3 font-normal" /></label><div><Button disabled={addSession.isPending} className="rounded-xl bg-[#202747]"><CalendarDays size={16} />{addSession.isPending ? "در حال ثبت…" : "ثبت جلسه"}</Button></div></form></section>
    <section className="rounded-2xl border border-[#eae7de] bg-white p-5 shadow-sm sm:p-6"><h2 className="font-extrabold">جلسه‌ها</h2>{query.data.sessions.length ? <ul className="mt-3 divide-y divide-[#efede7]">{query.data.sessions.map(session => <li key={session.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-bold">{session.title || `جلسه ${formatJalali(session.date)}`}</p><p className="mt-1 text-xs text-[#85899a]">{formatJalali(session.date)}{session.description ? ` · ${session.description}` : ""}</p></div><Link to="/teacher/sessions/$id/attendance" params={{ id: session.id }} className="rounded-lg border border-[#e7e5de] px-3 py-2 text-xs font-bold hover:bg-[#faf9f6]">ثبت حضور و غیاب</Link></li>)}</ul> : <p className="mt-3 rounded-xl bg-[#faf9f6] p-4 text-sm text-[#777b8a]">هنوز جلسه‌ای ثبت نشده است.</p>}</section></>}</div></AppShell>;
}
