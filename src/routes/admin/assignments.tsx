import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Link2, Search, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { AppShell, type NavItem } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { assign, getUserDetail, listUsers, unassign } from "@/services/api";
import { guardRole } from "@/lib/auth";

export const Route = createFileRoute("/admin/assignments")({
  ssr: false,
  beforeLoad: () => guardRole("admin"),
  head: () => ({ meta: [{ title: "ارتباط معلم و دانش‌آموز | کمپ نخبگان" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: AssignmentsPage,
});

function AssignmentsPage() {
  const [teacherId, setTeacherId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [search, setSearch] = useState("");
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["admin", "assignments"],
    queryFn: async () => {
      const [teachers, students] = await Promise.all([
        listUsers({ role: "teacher", page: 1, pageSize: 100 }),
        listUsers({ role: "student", page: 1, pageSize: 100 }),
      ]);
      const details = await Promise.all(teachers.items.map(async teacher => ({ teacher, students: (await getUserDetail(teacher.id)).related })));
      return { teachers: teachers.items, students: students.items, details };
    },
  });
  const add = useMutation({ mutationFn: () => assign(teacherId, studentId), onSuccess: () => { toast.success("ارتباط ثبت شد."); setStudentId(""); void client.invalidateQueries({ queryKey: ["admin", "assignments"] }); }, onError: e => toast.error(e instanceof Error ? e.message : "ثبت ارتباط انجام نشد.") });
  const remove = useMutation({ mutationFn: ({ teacher, student }: { teacher: string; student: string }) => unassign(teacher, student), onSuccess: () => { toast.success("ارتباط حذف شد."); void client.invalidateQueries({ queryKey: ["admin", "assignments"] }); }, onError: e => toast.error(e instanceof Error ? e.message : "حذف ارتباط انجام نشد.") });
  const nav: NavItem[] = [
    { to: "/admin/", label: "نمای کلی", icon: <Link2 size={18} /> },
    { to: "/admin/students", label: "دانش‌آموزان", icon: <Link2 size={18} /> },
    { to: "/admin/teachers", label: "معلمان", icon: <Link2 size={18} /> },
    { to: "/admin/assignments", label: "ارتباط‌ها", icon: <Link2 size={18} />, exact: true },
  ];
  const visible = query.data?.details.filter(row => !search || row.teacher.fullName.includes(search) || row.students.some(student => student.fullName.includes(search))) ?? [];

  return <AppShell role="admin" nav={nav}><div className="space-y-6">
    <header><p className="text-xs font-bold text-[#9a7c43]">مدیریت ارتباط‌ها</p><h1 className="mt-2 text-2xl font-black">اختصاص دانش‌آموز به معلم</h1><p className="mt-2 text-sm text-muted-foreground">هر دانش‌آموز می‌تواند با چند معلم در ارتباط باشد.</p></header>
    <form onSubmit={e => { e.preventDefault(); add.mutate(); }} className="grid gap-4 rounded-2xl border border-[#eae7de] bg-white p-5 shadow-sm md:grid-cols-[1fr_1fr_auto] md:items-end"><label className="text-sm font-bold">معلم<select required value={teacherId} onChange={e => setTeacherId(e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#e7e5de] bg-white px-3 font-normal"><option value="">انتخاب معلم</option>{query.data?.teachers.filter(u => u.active).map(t => <option key={t.id} value={t.id}>{t.fullName}</option>)}</select></label><label className="text-sm font-bold">دانش‌آموز<select required value={studentId} onChange={e => setStudentId(e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#e7e5de] bg-white px-3 font-normal"><option value="">انتخاب دانش‌آموز</option>{query.data?.students.filter(u => u.active).map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}</select></label><Button type="submit" disabled={add.isPending || !teacherId || !studentId} className="h-11 rounded-xl bg-[#202747]"><Link2 size={16} />ایجاد ارتباط</Button></form>
    <section className="overflow-hidden rounded-2xl border border-[#eae7de] bg-white shadow-sm"><div className="relative border-b border-[#efede7] p-4"><Search size={16} className="absolute right-7 top-7 text-[#999cab]" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="جست‌وجو بر اساس نام معلم یا دانش‌آموز" className="h-10 w-full rounded-xl border border-[#e7e5de] pr-10 pl-3 text-sm outline-none focus:border-[#9b814c]" /></div>{query.isPending ? <p className="p-6 text-sm text-[#777b8a]">در حال بارگذاری…</p> : query.isError ? <p role="alert" className="p-6 text-sm text-destructive">فهرست ارتباط‌ها دریافت نشد.</p> : visible.length === 0 ? <p className="p-8 text-center text-sm text-[#777b8a]">ارتباطی برای نمایش پیدا نشد.</p> : <div className="divide-y divide-[#efede7]">{visible.map(({ teacher, students }) => <article key={teacher.id} className="p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="font-extrabold">{teacher.fullName}</h2><p className="mt-1 text-xs text-[#85899a]">{students.length} دانش‌آموز</p></div><Link to="/admin/teachers" className="inline-flex items-center gap-1 text-xs font-bold text-[#876d3e]">فهرست معلمان <ArrowLeft size={13} /></Link></div>{students.length ? <ul className="mt-4 flex flex-wrap gap-2">{students.map(student => <li key={student.id} className="inline-flex items-center gap-2 rounded-full bg-[#f5f3ee] py-1.5 pr-3 pl-1.5 text-xs"><span>{student.fullName}</span><button type="button" disabled={remove.isPending} onClick={() => remove.mutate({ teacher: teacher.id, student: student.id })} title="حذف ارتباط" aria-label={`حذف ارتباط ${teacher.fullName} و ${student.fullName}`} className="grid h-6 w-6 place-items-center rounded-full text-[#8e7770] hover:bg-white"><UserMinus size={13} /></button></li>)}</ul> : <p className="mt-3 text-xs text-[#9295a1]">دانش‌آموزی اختصاص داده نشده است.</p>}</article>)}</div>}</section>
  </div></AppShell>;
}
