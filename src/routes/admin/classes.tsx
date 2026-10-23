import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, LayoutDashboard, Plus, School, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { AppShell, type NavItem } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { guardRole } from "@/lib/auth";
import { adminClasses, createClass, listAllOfRole } from "@/services/api";

export const Route = createFileRoute("/admin/classes")({
  ssr: false,
  beforeLoad: () => guardRole("admin"),
  head: () => ({ meta: [{ title: "مدیریت کلاس‌ها | آرما" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: AdminClassesPage,
});

const nav: NavItem[] = [
  { to: "/admin", label: "نمای کلی", icon: <LayoutDashboard size={18} /> },
  { to: "/admin/classes", label: "کلاس‌ها", icon: <School size={18} />, exact: true },
];

function AdminClassesPage() {
  const client = useQueryClient();
  const [teacherId, setTeacherId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const teachers = useQuery({ queryKey: ["admin", "class-teachers"], queryFn: () => listAllOfRole("teacher") });
  const studentsQuery = useQuery({ queryKey: ["admin", "class-students"], queryFn: () => listAllOfRole("student") });
  const classes = useQuery({ queryKey: ["admin", "classes"], queryFn: adminClasses });
  const create = useMutation({
    mutationFn: () => createClass(teacherId, { title, description, active: true, memberIds }),
    onSuccess: async () => {
      toast.success("کلاس و اعضای آن ثبت شد.");
      setTitle(""); setDescription(""); setMemberIds([]);
      await client.invalidateQueries({ queryKey: ["admin", "classes"] });
      await client.invalidateQueries({ queryKey: ["teacher", "classes"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "ساخت کلاس انجام نشد."),
  });
  const students = studentsQuery.data?.filter((user) => user.active) ?? [];
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); create.mutate(); }
  function selectTeacher(id: string) { setTeacherId(id); setMemberIds([]); }

  return <AppShell role="admin" nav={nav}><div className="space-y-6">
    <header><p className="text-xs font-bold text-[#8c55a5]">مدیریت کلاس‌ها</p><h1 className="mt-2 text-2xl font-black">ساخت کلاس و تعیین اعضا</h1><p className="mt-2 text-sm text-muted-foreground">کلاس را برای یک معلم بسازید و دانش‌آموزان مرتبط با همان معلم را انتخاب کنید.</p></header>
    <form onSubmit={submit} className="space-y-5 rounded-2xl border border-[#eadfed] bg-white p-5 shadow-sm sm:p-7">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-bold">معلم کلاس<select required value={teacherId} onChange={(event) => selectTeacher(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#eadfed] bg-white px-3 font-normal"><option value="">انتخاب معلم</option>{teachers.data?.filter((teacher) => teacher.active).map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.fullName}</option>)}</select></label>
        <label className="text-sm font-bold">عنوان کلاس<input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="برای نمونه: کلاس علوم" className="mt-2 h-11 w-full rounded-xl border border-[#eadfed] px-3 font-normal" /></label>
      </div>
      <label className="block text-sm font-bold">توضیحات <span className="font-normal text-[#91859c]">(اختیاری)</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} className="mt-2 w-full rounded-xl border border-[#eadfed] p-3 font-normal" /></label>
      <fieldset disabled={!teacherId || studentsQuery.isPending}>
        <legend className="text-sm font-bold">دانش‌آموزان کلاس</legend>
        {!teacherId ? <p className="mt-3 text-sm text-muted-foreground">ابتدا معلم کلاس را انتخاب کنید.</p> : studentsQuery.isPending ? <p className="mt-3 text-sm text-muted-foreground">در حال دریافت دانش‌آموزان…</p> : studentsQuery.isError ? <p role="alert" className="mt-3 text-sm text-destructive">فهرست دانش‌آموزان دریافت نشد.</p> : students.length ? <div className="mt-3 grid gap-2 sm:grid-cols-2">{students.map((student) => <label key={student.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#eee5f1] p-3 text-sm"><input type="checkbox" checked={memberIds.includes(student.id)} onChange={() => setMemberIds((current) => current.includes(student.id) ? current.filter((id) => id !== student.id) : [...current, student.id])} className="h-4 w-4 accent-[#653b83]" /><span className="font-semibold">{student.fullName}</span></label>)}</div> : <p className="mt-3 rounded-xl bg-[#fcf8fc] p-4 text-sm text-[#74677f]">دانش‌آموز فعالی برای انتخاب وجود ندارد.</p>}
      </fieldset>
      <Button type="submit" disabled={create.isPending || teachers.isPending || studentsQuery.isPending || !teacherId} className="rounded-xl bg-[#653b83]">{create.isPending ? "در حال ثبت…" : <><Plus size={16} />ساخت کلاس</>}</Button>
    </form>
    <section className="space-y-3"><h2 className="font-extrabold">کلاس‌های ساخته‌شده</h2>{classes.isPending ? <p className="rounded-xl border bg-white p-5 text-sm text-muted-foreground">در حال دریافت کلاس‌ها…</p> : classes.isError ? <p role="alert" className="rounded-xl bg-destructive/5 p-4 text-sm text-destructive">کلاس‌ها دریافت نشدند.</p> : classes.data?.length ? <div className="grid gap-4 md:grid-cols-2">{classes.data.map((cls) => <article key={cls.id} className="rounded-2xl border border-[#eadfed] bg-white p-5"><h3 className="font-extrabold">{cls.title}</h3><p className="mt-1 text-sm text-muted-foreground">معلم: {teachers.data?.find((teacher) => teacher.id === cls.teacherId)?.fullName || "—"}</p><div className="mt-4 flex gap-4 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><UsersRound size={14} />{cls.memberCount} دانش‌آموز</span><span className="inline-flex items-center gap-1"><CalendarDays size={14} />{cls.held + cls.upcoming} جلسه</span></div></article>)}</div> : <p className="rounded-xl border border-dashed bg-white p-6 text-center text-sm text-muted-foreground">هنوز کلاسی ساخته نشده است.</p>}</section>
  </div></AppShell>;
}
