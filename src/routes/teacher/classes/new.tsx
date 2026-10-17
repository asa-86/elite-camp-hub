import { useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { AppShell, type NavItem } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { guardRole } from "@/lib/auth";
import { createClass, myStudents } from "@/services/api";

export const Route = createFileRoute("/teacher/classes/new")({
  ssr: false,
  beforeLoad: () => guardRole("teacher"),
  head: () => ({ meta: [{ title: "ایجاد کلاس | کمپ نخبگان" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: NewClassPage,
});

const nav: NavItem[] = [
  { to: "/teacher/", label: "داشبورد من", icon: <LayoutDashboard size={18} /> },
  { to: "/teacher/classes/", label: "کلاس‌های من", icon: <UsersRound size={18} /> },
];

function NewClassPage() {
  const navigate = useNavigate();
  const client = useQueryClient();
  const students = useQuery({ queryKey: ["teacher", "students"], queryFn: myStudents });
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const create = useMutation({ mutationFn: () => createClass({ title, description, active: true, memberIds }), onSuccess: async cls => { toast.success("کلاس ساخته شد."); await client.invalidateQueries({ queryKey: ["teacher", "classes"] }); await navigate({ to: "/teacher/classes/$id", params: { id: cls.id } }); }, onError: e => toast.error(e instanceof Error ? e.message : "ساخت کلاس انجام نشد.") });
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); create.mutate(); }
  const toggleMember = (id: string) => setMemberIds(current => current.includes(id) ? current.filter(x => x !== id) : [...current, id]);

  return <AppShell role="teacher" nav={nav}><div className="mx-auto max-w-3xl space-y-6"><header><p className="text-xs font-bold text-[#9a7c43]">مدیریت کلاس‌ها</p><h1 className="mt-2 text-2xl font-black">ساخت کلاس جدید</h1><p className="mt-2 text-sm text-muted-foreground">دانش‌آموزان فقط از میان افرادی انتخاب می‌شوند که مدیر به شما اختصاص داده است.</p></header><form onSubmit={submit} className="space-y-6 rounded-2xl border border-[#eae7de] bg-white p-5 shadow-sm sm:p-7"><label className="block text-sm font-bold">عنوان کلاس<input required value={title} onChange={e => setTitle(e.target.value)} placeholder="برای نمونه: کلاس علوم" className="mt-2 h-11 w-full rounded-xl border border-[#e7e5de] px-3 font-normal outline-none focus:border-[#9b814c]" /></label><label className="block text-sm font-bold">توضیحات <span className="font-normal text-[#9295a1]">(اختیاری)</span><textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-[#e7e5de] p-3 font-normal outline-none focus:border-[#9b814c]" /></label><fieldset><legend className="text-sm font-bold">دانش‌آموزان کلاس</legend>{students.isPending ? <p className="mt-3 text-sm text-[#777b8a]">در حال دریافت فهرست…</p> : students.isError ? <p role="alert" className="mt-3 text-sm text-destructive">فهرست دانش‌آموزان دریافت نشد.</p> : students.data?.length ? <div className="mt-3 grid gap-2 sm:grid-cols-2">{students.data.map(student => <label key={student.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#efede7] p-3 text-sm hover:bg-[#faf9f6]"><input type="checkbox" checked={memberIds.includes(student.id)} onChange={() => toggleMember(student.id)} className="h-4 w-4 accent-[#202747]" /><span className="font-semibold">{student.fullName}</span></label>)}</div> : <p className="mt-3 rounded-xl bg-[#faf9f6] p-4 text-sm text-[#777b8a]">هنوز دانش‌آموزی به شما اختصاص داده نشده است. از مدیر بخواهید ابتدا ارتباط را ایجاد کند.</p>}</fieldset><div className="flex gap-2"><Button type="submit" disabled={create.isPending || students.isPending} className="rounded-xl bg-[#202747]">{create.isPending ? "در حال ساخت…" : "ساخت کلاس"}</Button><Button type="button" variant="outline" onClick={() => void navigate({ to: "/teacher/classes/" })}>انصراف</Button></div></form></div></AppShell>;
}
