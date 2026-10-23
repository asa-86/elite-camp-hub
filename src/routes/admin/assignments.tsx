import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Link2, Search, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { AppShell, type NavItem } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { assignMany, getUserDetail, listUsers, unassign } from "@/services/api";
import { guardRole } from "@/lib/auth";
import { GRADE_LABEL, GRADE_OPTIONS, type Grade } from "@/lib/types";

export const Route = createFileRoute("/admin/assignments")({
  ssr: false,
  beforeLoad: () => guardRole("admin"),
  head: () => ({ meta: [{ title: "ارتباط معلم و دانش‌آموز | آرما" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: AssignmentsPage,
});

function AssignmentsPage() {
  const [teacherId, setTeacherId] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [grade, setGrade] = useState<"all" | Grade>("all");
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
  const add = useMutation({ mutationFn: () => assignMany(teacherId, selectedStudentIds), onSuccess: () => { toast.success(`ارتباط ${selectedStudentIds.length} دانش‌آموز ثبت شد.`); setSelectedStudentIds([]); void client.invalidateQueries({ queryKey: ["admin", "assignments"] }); }, onError: e => toast.error(e instanceof Error ? e.message : "ثبت ارتباط انجام نشد.") });
  const remove = useMutation({ mutationFn: ({ teacher, student }: { teacher: string; student: string }) => unassign(teacher, student), onSuccess: () => { toast.success("ارتباط حذف شد."); void client.invalidateQueries({ queryKey: ["admin", "assignments"] }); }, onError: e => toast.error(e instanceof Error ? e.message : "حذف ارتباط انجام نشد.") });
  const nav: NavItem[] = [
    { to: "/admin/", label: "نمای کلی", icon: <Link2 size={18} /> },
    { to: "/admin/students", label: "دانش‌آموزان", icon: <Link2 size={18} /> },
    { to: "/admin/teachers", label: "معلمان", icon: <Link2 size={18} /> },
    { to: "/admin/assignments", label: "ارتباط‌ها", icon: <Link2 size={18} />, exact: true },
  ];
  const visible = query.data?.details.filter(row => !search || row.teacher.fullName.includes(search) || row.students.some(student => student.fullName.includes(search))) ?? [];
  const availableStudents = (query.data?.students ?? []).filter(student => student.active && (grade === "all" || student.grade === grade));
  const allVisibleSelected = availableStudents.length > 0 && availableStudents.every(student => selectedStudentIds.includes(student.id));

  return <AppShell role="admin" nav={nav}><div className="space-y-6">
    <header><p className="text-xs font-bold text-[#8c55a5]">مدیریت ارتباط‌ها</p><h1 className="mt-2 text-2xl font-black">اختصاص دانش‌آموز به معلم</h1><p className="mt-2 text-sm text-muted-foreground">هر دانش‌آموز می‌تواند با چند معلم در ارتباط باشد.</p></header>
    <form onSubmit={e => { e.preventDefault(); add.mutate(); }} className="space-y-4 rounded-2xl border border-[#eadfed] bg-white p-5 shadow-sm"><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">معلم<select required value={teacherId} onChange={e => setTeacherId(e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#eadfed] bg-white px-3 font-normal"><option value="">انتخاب معلم</option>{query.data?.teachers.filter(u => u.active).map(t => <option key={t.id} value={t.id}>{t.fullName}</option>)}</select></label><label className="text-sm font-bold">فیلتر پایه دانش‌آموزان<select value={grade} onChange={e => setGrade(e.target.value === "all" ? "all" : Number(e.target.value) as Grade)} className="mt-2 h-11 w-full rounded-xl border border-[#eadfed] bg-white px-3 font-normal"><option value="all">همهٔ پایه‌ها</option>{GRADE_OPTIONS.map(option => <option key={option} value={option}>{GRADE_LABEL[option]}</option>)}</select></label></div><div className="flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={allVisibleSelected} disabled={!availableStudents.length} onChange={e => setSelectedStudentIds(current => e.target.checked ? [...new Set([...current, ...availableStudents.map(s => s.id)])] : current.filter(id => !availableStudents.some(s => s.id === id)))} />انتخاب همهٔ دانش‌آموزان این فهرست</label><span className="text-xs text-muted-foreground">{selectedStudentIds.length} نفر انتخاب شده</span></div><div className="max-h-64 overflow-y-auto rounded-xl border border-[#eee5f1] p-2">{availableStudents.length ? <div className="grid gap-1 sm:grid-cols-2">{availableStudents.map(student => <label key={student.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-[#faf5fb]"><input type="checkbox" checked={selectedStudentIds.includes(student.id)} onChange={e => setSelectedStudentIds(current => e.target.checked ? [...current, student.id] : current.filter(id => id !== student.id))} /><span>{student.fullName}</span><span className="mr-auto text-xs text-muted-foreground">پایه {student.grade}</span></label>)}</div> : <p className="p-4 text-center text-sm text-muted-foreground">دانش‌آموز فعالی در این پایه پیدا نشد.</p>}</div><Button type="submit" disabled={add.isPending || !teacherId || !selectedStudentIds.length} className="h-11 rounded-xl bg-[#653b83]">{add.isPending ? "در حال ثبت…" : <><Link2 size={16} />تأیید و ایجاد ارتباط</>}</Button></form>
    <section className="overflow-hidden rounded-2xl border border-[#eadfed] bg-white shadow-sm"><div className="relative border-b border-[#eee5f1] p-4"><Search size={16} className="absolute right-7 top-7 text-[#91859c]" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="جست‌وجو بر اساس نام معلم یا دانش‌آموز" className="h-10 w-full rounded-xl border border-[#eadfed] pr-10 pl-3 text-sm outline-none focus:border-[#9b5cad]" /></div>{query.isPending ? <p className="p-6 text-sm text-[#74677f]">در حال بارگذاری…</p> : query.isError ? <p role="alert" className="p-6 text-sm text-destructive">فهرست ارتباط‌ها دریافت نشد.</p> : visible.length === 0 ? <p className="p-8 text-center text-sm text-[#74677f]">ارتباطی برای نمایش پیدا نشد.</p> : <div className="divide-y divide-[#eee5f1]">{visible.map(({ teacher, students }) => <article key={teacher.id} className="p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="font-extrabold">{teacher.fullName}</h2><p className="mt-1 text-xs text-[#80748c]">{students.length} دانش‌آموز</p></div><Link to="/admin/teachers" className="inline-flex items-center gap-1 text-xs font-bold text-[#98518b]">فهرست معلمان <ArrowLeft size={13} /></Link></div>{students.length ? <ul className="mt-4 flex flex-wrap gap-2">{students.map(student => <li key={student.id} className="inline-flex items-center gap-2 rounded-full bg-[#f8f1f8] py-1.5 pr-3 pl-1.5 text-xs"><span>{student.fullName}</span><button type="button" disabled={remove.isPending} onClick={() => remove.mutate({ teacher: teacher.id, student: student.id })} title="حذف ارتباط" aria-label={`حذف ارتباط ${teacher.fullName} و ${student.fullName}`} className="grid h-6 w-6 place-items-center rounded-full text-[#8e7770] hover:bg-white"><UserMinus size={13} /></button></li>)}</ul> : <p className="mt-3 text-xs text-[#91859c]">دانش‌آموزی اختصاص داده نشده است.</p>}</article>)}</div>}</section>
  </div></AppShell>;
}
