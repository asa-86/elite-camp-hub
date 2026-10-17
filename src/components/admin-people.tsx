import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GraduationCap, LayoutDashboard, Search, UserPlus, UserRound, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AppShell, type NavItem } from "@/components/app-shell";
import { GRADE_LABEL } from "@/lib/types";
import { createUser, listUsers, updateUser } from "@/services/api";

export function AdminPeoplePage({ role }: { role: "student" | "teacher" }) {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [grade, setGrade] = useState<"7" | "8" | "9">("7");
  const queryClient = useQueryClient();
  const title = role === "student" ? "مدیریت دانش‌آموزان" : "مدیریت معلمان";
  const nav: NavItem[] = [
    { to: "/admin/", label: "نمای کلی", icon: <LayoutDashboard size={18} /> },
    { to: "/admin/students", label: "دانش‌آموزان", icon: <GraduationCap size={18} /> },
    { to: "/admin/teachers", label: "معلمان", icon: <UserRound size={18} /> },
  ];
  const query = useQuery({ queryKey: ["admin", "people", role, search], queryFn: () => listUsers({ role, q: search, page: 1, pageSize: 100 }) });
  const rows = useMemo(() => query.data?.items ?? [], [query.data]);

  const create = useMutation({
    mutationFn: () => createUser({ fullName, username, role, password, active: true, ...(role === "student" ? { grade: Number(grade) as 7 | 8 | 9 } : {}) }),
    onSuccess: () => { toast.success("حساب کاربری ساخته شد."); setFullName(""); setUsername(""); setPassword(""); setShowForm(false); void queryClient.invalidateQueries({ queryKey: ["admin", "people", role] }); },
    onError: error => toast.error(error instanceof Error ? error.message : "ساخت حساب انجام نشد."),
  });
  const toggle = useMutation({
    mutationFn: (user: (typeof rows)[number]) => updateUser(user.id, { active: !user.active }),
    onSuccess: () => { toast.success("وضعیت حساب تغییر کرد."); void queryClient.invalidateQueries({ queryKey: ["admin", "people", role] }); },
    onError: error => toast.error(error instanceof Error ? error.message : "تغییر وضعیت انجام نشد."),
  });

  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); create.mutate(); }

  return <AppShell role="admin" nav={nav}><div className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold text-[#9a7c43]">مدیریت کاربران</p><h1 className="mt-2 text-2xl font-black">{title}</h1><p className="mt-2 text-sm text-muted-foreground">جست‌وجو، ساخت حساب و تغییر وضعیت دسترسی</p></div><Button onClick={() => setShowForm(v => !v)} className="rounded-xl bg-[#202747] font-bold hover:bg-[#30395e]"><UserPlus size={16} />حساب جدید</Button></header>
    {showForm && <form onSubmit={submit} className="grid gap-4 rounded-2xl border border-[#eae7de] bg-white p-5 shadow-sm sm:grid-cols-2 sm:p-6"><div className="sm:col-span-2"><h2 className="font-extrabold">ساخت حساب {role === "student" ? "دانش‌آموز" : "معلم"}</h2><p className="mt-1 text-xs text-[#85899a]">این حساب در حالت فعلی فقط در مرورگر ذخیره می‌شود.</p></div><label className="text-sm font-bold">نام و نام خانوادگی<input required value={fullName} onChange={e => setFullName(e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#e7e5de] px-3 font-normal outline-none focus:border-[#9b814c]" /></label><label className="text-sm font-bold">نام کاربری<input required minLength={3} value={username} onChange={e => setUsername(e.target.value)} dir="ltr" className="mt-2 h-11 w-full rounded-xl border border-[#e7e5de] px-3 text-left font-normal outline-none focus:border-[#9b814c]" /></label>{role === "student" && <label className="text-sm font-bold">پایه<select value={grade} onChange={e => setGrade(e.target.value as "7" | "8" | "9")} className="mt-2 h-11 w-full rounded-xl border border-[#e7e5de] bg-white px-3 font-normal"><option value="7">پایه هفتم</option><option value="8">پایه هشتم</option><option value="9">پایه نهم</option></select></label>}<label className="text-sm font-bold">گذرواژهٔ اولیه<input required minLength={8} value={password} onChange={e => setPassword(e.target.value)} dir="ltr" type="password" autoComplete="new-password" className="mt-2 h-11 w-full rounded-xl border border-[#e7e5de] px-3 text-left font-normal outline-none focus:border-[#9b814c]" /></label><div className="flex items-center gap-2 sm:col-span-2"><Button disabled={create.isPending} type="submit" className="rounded-xl">{create.isPending ? "در حال ساخت…" : "ساخت حساب"}</Button><Button type="button" variant="ghost" onClick={() => setShowForm(false)}>انصراف</Button></div></form>}
    <section className="overflow-hidden rounded-2xl border border-[#eae7de] bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#efede7] p-4 sm:p-5"><div className="relative min-w-[220px] flex-1"><Search size={17} className="absolute right-3 top-3 text-[#999cab]" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="جست‌وجو بر اساس نام، نام کاربری یا شناسه" className="h-10 w-full rounded-xl border border-[#e7e5de] pr-10 pl-3 text-sm outline-none focus:border-[#9b814c]" /></div><span className="inline-flex items-center gap-2 text-xs text-[#85899a]"><UsersRound size={15} />{query.data?.total ?? "…"} حساب</span></div>
      {query.isError ? <p role="alert" className="p-6 text-sm text-destructive">دریافت فهرست انجام نشد. فقط مدیر می‌تواند این بخش را ببیند.</p> : query.isPending ? <p className="p-6 text-sm text-[#777b8a]">در حال بارگذاری فهرست…</p> : rows.length === 0 ? <div className="p-10 text-center"><UserRound className="mx-auto text-[#b4b5bd]" size={26} /><p className="mt-3 text-sm text-[#777b8a]">حسابی مطابق جست‌وجو پیدا نشد.</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-right text-sm"><thead className="bg-[#faf9f6] text-xs text-[#777b8a]"><tr><th className="px-5 py-3 font-semibold">نام</th><th className="px-5 py-3 font-semibold">نام کاربری</th>{role === "student" && <th className="px-5 py-3 font-semibold">پایه</th>}<th className="px-5 py-3 font-semibold">وضعیت</th><th className="px-5 py-3 font-semibold">دسترسی</th></tr></thead><tbody className="divide-y divide-[#efede7]">{rows.map(user => <tr key={user.id}><td className="px-5 py-4 font-bold">{user.fullName}</td><td className="px-5 py-4 text-[#777b8a]" dir="ltr">{user.username}</td>{role === "student" && <td className="px-5 py-4 text-[#777b8a]">{user.grade ? GRADE_LABEL[user.grade] : "—"}</td>}<td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${user.active ? "bg-[#e8f1e9] text-[#55745c]" : "bg-[#f1eeee] text-[#858080]"}`}>{user.active ? "فعال" : "غیرفعال"}</span></td><td className="px-5 py-4"><button disabled={toggle.isPending} onClick={() => toggle.mutate(user)} className="text-xs font-bold text-[#76613c] hover:underline">{user.active ? "غیرفعال‌کردن" : "فعال‌کردن"}</button></td></tr>)}</tbody></table></div>}
    </section>
  </div></AppShell>;
}
