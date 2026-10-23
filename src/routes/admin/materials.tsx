import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, LayoutDashboard, LibraryBig, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { AppShell, type NavItem } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { guardRole } from "@/lib/auth";
import { formatBytesFa, formatJalali } from "@/lib/jalali";
import { files, validateFile } from "@/services/files";
import { deleteMaterial, listMaterials, saveMaterial, setMaterialPublished } from "@/services/api";

export const Route = createFileRoute("/admin/materials")({
  ssr: false,
  beforeLoad: () => guardRole("admin"),
  head: () => ({ meta: [{ title: "مدیریت جزوه‌ها | آرما" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: MaterialsPage,
});

const nav: NavItem[] = [
  { to: "/admin/", label: "نمای کلی", icon: <LayoutDashboard size={18} /> },
  { to: "/admin/materials", label: "جزوه‌ها", icon: <LibraryBig size={18} />, exact: true },
];

function MaterialsPage() {
  const [q, setQ] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["admin", "materials", q], queryFn: () => listMaterials(q) });
  const refresh = () => client.invalidateQueries({ queryKey: ["admin", "materials"] });
  const create = useMutation({ mutationFn: async () => {
    if (!file) throw new Error("فایل جزوه را انتخاب کنید.");
    validateFile(file);
    const uploaded = await files.upload(file, "materials");
    try {
      await saveMaterial({ title, description, category, file: uploaded, published: false });
    } catch (error) {
      await files.remove(uploaded.key).catch(() => undefined);
      throw error;
    }
  }, onSuccess: async () => { toast.success("جزوه بارگذاری و به‌صورت پیش‌نویس ذخیره شد."); setTitle(""); setDescription(""); setCategory(""); setFile(null); const input = document.getElementById("material-file") as HTMLInputElement | null; if (input) input.value = ""; await refresh(); }, onError: e => toast.error(e instanceof Error ? e.message : "بارگذاری جزوه انجام نشد.") });
  const publish = useMutation({ mutationFn: ({ id, value }: { id: string; value: boolean }) => setMaterialPublished(id, value), onSuccess: async () => { toast.success("وضعیت انتشار تغییر کرد."); await refresh(); }, onError: e => toast.error(e instanceof Error ? e.message : "تغییر وضعیت انجام نشد.") });
  const remove = useMutation({ mutationFn: deleteMaterial, onSuccess: async () => { toast.success("جزوه و فایل آن حذف شد."); await refresh(); }, onError: e => toast.error(e instanceof Error ? e.message : "حذف فایل انجام نشد؛ رکورد حفظ شد.") });
  function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); create.mutate(); }

  return <AppShell role="admin" nav={nav}><div className="space-y-6"><header><p className="text-xs font-bold text-[#8c55a5]">منابع آموزشی</p><h1 className="mt-2 text-2xl font-black">مدیریت جزوه‌ها</h1><p className="mt-2 text-sm text-muted-foreground">فایل‌های مجاز را بارگذاری و برای دانش‌آموزان منتشر کنید.</p></header><form onSubmit={submit} className="grid gap-4 rounded-2xl border border-[#eadfed] bg-white p-5 shadow-sm sm:grid-cols-2 sm:p-6"><h2 className="font-extrabold sm:col-span-2">افزودن جزوه</h2><label className="text-sm font-bold">عنوان<input required value={title} onChange={e => setTitle(e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#eadfed] px-3 font-normal" /></label><label className="text-sm font-bold">دسته‌بندی<input value={category} onChange={e => setCategory(e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#eadfed] px-3 font-normal" placeholder="اختیاری" /></label><label className="text-sm font-bold sm:col-span-2">توضیحات<textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="mt-2 w-full rounded-xl border border-[#eadfed] p-3 font-normal" placeholder="اختیاری" /></label><label className="text-sm font-bold sm:col-span-2">فایل (حداکثر ۲۰ مگابایت)<input id="material-file" type="file" required accept=".pdf,.doc,.docx,.pptx,.zip,.png,.jpg,.jpeg" onChange={e => setFile(e.target.files?.[0] ?? null)} className="mt-2 block w-full rounded-xl border border-[#eadfed] p-2 text-sm file:ml-3 file:rounded-lg file:border-0 file:bg-[#f5eaf5] file:px-3 file:py-2" /></label><p className="text-xs leading-6 text-[#80748c] sm:col-span-2">حالت فعلی فایل نمونه را فقط در حافظهٔ مرورگر نگه می‌دارد؛ برای ماندگاری باید سرویس فایل پیکربندی شود. جزوه پس از بارگذاری پیش‌نویس می‌ماند.</p><div className="sm:col-span-2"><Button disabled={create.isPending} className="rounded-xl bg-[#653b83]"><Upload size={16} />{create.isPending ? "در حال بارگذاری…" : "بارگذاری جزوه"}</Button></div></form>
    <section className="overflow-hidden rounded-2xl border border-[#eadfed] bg-white shadow-sm"><div className="relative border-b border-[#eee5f1] p-4"><Search size={16} className="absolute right-7 top-7 text-[#91859c]" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="جست‌وجو در عنوان یا دسته‌بندی" className="h-10 w-full rounded-xl border border-[#eadfed] pr-10 pl-3 text-sm outline-none focus:border-[#9b5cad]" /></div>{query.isError ? <p role="alert" className="p-6 text-sm text-destructive">جزوه‌ها دریافت نشدند.</p> : query.isPending ? <p className="p-6 text-sm text-[#74677f]">در حال بارگذاری…</p> : query.data?.length ? <div className="divide-y divide-[#eee5f1]">{query.data.map(material => <article key={material.id} className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5"><div className="flex min-w-[240px] flex-1 items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#f5eaf5] text-[#a24c82]"><BookOpen size={18} /></span><div><h2 className="text-sm font-extrabold">{material.title}</h2><p className="mt-1 text-xs text-[#80748c]">{material.category || "بدون دسته‌بندی"} · {formatJalali(material.createdAt)} · {formatBytesFa(material.file.size)}</p></div></div><div className="flex items-center gap-2"><button type="button" disabled={publish.isPending} onClick={() => publish.mutate({ id: material.id, value: !material.published })} className={`rounded-full px-3 py-2 text-xs font-bold ${material.published ? "bg-[#f3e8f5] text-[#55745c]" : "bg-[#f7f1f8] text-[#74677f]"}`}>{material.published ? "منتشرشده" : "پیش‌نویس · انتشار"}</button><button type="button" disabled={remove.isPending} onClick={() => { if (window.confirm("جزوه و فایل مرتبط حذف شوند؟")) remove.mutate(material.id); }} aria-label={`حذف ${material.title}`} className="grid h-9 w-9 place-items-center rounded-lg text-[#9a5d50] hover:bg-[#f8eaf2]"><Trash2 size={16} /></button></div></article>)}</div> : <div className="p-8 text-center text-sm text-[#74677f]">جزوه‌ای پیدا نشد.</div>}</section></div></AppShell>;
}
