import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, LayoutDashboard, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell, type NavItem } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { guardRole } from "@/lib/auth";
import { GRADE_LABEL, GRADE_OPTIONS, type Assessment, type Grade, type Question } from "@/lib/types";
import { listAssessments, saveAssessment, deleteAssessment } from "@/services/api";

export const Route = createFileRoute("/admin/assessments")({ ssr: false, beforeLoad: () => guardRole("admin"), head: () => ({ meta: [{ title: "مدیریت آزمون‌ها | آرما" }, { name: "robots", content: "noindex, nofollow" }] }), component: Page });
const nav: NavItem[] = [{ to: "/admin/", label: "نمای کلی", icon: <LayoutDashboard size={18} /> }, { to: "/admin/assessments", label: "آزمون‌ها", icon: <ClipboardList size={18} />, exact: true }];
type AssessmentForm = Omit<Assessment, "createdAt" | "id"> & { id?: string };
const availableGrades: Grade[] = GRADE_OPTIONS;
const blank = (): AssessmentForm => ({ title: "", description: "", instructions: "", status: "draft", active: true, maxAttempts: 1, target: { type: "all" }, questions: [] });
function Page() {
  const qc = useQueryClient(); const query = useQuery({ queryKey: ["admin", "assessments"], queryFn: listAssessments });
  const [form, setForm] = useState<AssessmentForm | null>(null);
  const save = useMutation({ mutationFn: () => saveAssessment(form!), onSuccess: async () => { toast.success("آزمون ذخیره شد."); setForm(null); await qc.invalidateQueries({ queryKey: ["admin", "assessments"] }); }, onError: e => toast.error(e instanceof Error ? e.message : "ذخیره انجام نشد.") });
  const remove = useMutation({ mutationFn: deleteAssessment, onSuccess: async () => { toast.success("آزمون حذف شد."); await qc.invalidateQueries({ queryKey: ["admin", "assessments"] }); }, onError: e => toast.error(e instanceof Error ? e.message : "حذف انجام نشد.") });
  const set = (patch: Partial<Assessment>) => setForm(f => f ? { ...f, ...patch } : f);
  const addQuestion = () => { const q: Question = { id: crypto.randomUUID(), type: "single_choice", text: "", options: [{ id: crypto.randomUUID(), text: "", score: 0 }, { id: crypto.randomUUID(), text: "", score: 1 }] }; set({ questions: [...(form?.questions ?? []), q] }); };
  const updateQuestion = (index: number, q: Question) => set({ questions: (form?.questions ?? []).map((old, i) => i === index ? q : old) });
  const addOption = (questionIndex: number) => {
    const question = form?.questions[questionIndex];
    if (!question) return;
    updateQuestion(questionIndex, { ...question, options: [...question.options, { id: crypto.randomUUID(), text: "", score: 0 }] });
  };
  const removeOption = (questionIndex: number, optionIndex: number) => {
    const question = form?.questions[questionIndex];
    if (!question || question.options.length <= 2) return;
    const removed = question.options[optionIndex];
    const options = question.options.filter((_, index) => index !== optionIndex);
    if (removed.score > 0 && !options.some(option => option.score > 0)) options[0] = { ...options[0], score: 1 };
    updateQuestion(questionIndex, { ...question, options });
  };
  return <AppShell role="admin" nav={nav}><div className="space-y-6"><header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold text-[#8c55a5]">ارزیابی و شناخت</p><h1 className="mt-2 text-2xl font-black">مدیریت آزمون‌ها</h1><p className="mt-2 text-sm text-muted-foreground">پرسش‌های چندگزینه‌ای را بسازید و برای دانش‌آموزان منتشر کنید.</p></div><Button onClick={() => setForm(blank())} className="rounded-xl bg-[#653b83]"><Plus size={16} />آزمون تازه</Button></header>
    {form && <form onSubmit={e => { e.preventDefault(); if (form.target.type === "grades" && form.target.grades.length === 0) { toast.error("حداقل یک پایه را برای آزمون انتخاب کنید."); return; } save.mutate(); }} className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm"><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">عنوان<input required value={form.title} onChange={e => set({ title: e.target.value })} className="mt-2 h-11 w-full rounded-xl border px-3 font-normal" /></label><label className="text-sm font-bold">تعداد دفعات مجاز<input type="number" min="1" value={form.maxAttempts} onChange={e => set({ maxAttempts: Number(e.target.value) })} className="mt-2 h-11 w-full rounded-xl border px-3 font-normal" /></label><label className="text-sm font-bold sm:col-span-2">توضیحات<textarea value={form.description ?? ""} onChange={e => set({ description: e.target.value })} className="mt-2 w-full rounded-xl border p-3 font-normal" rows={2} /></label><label className="text-sm font-bold sm:col-span-2">دستورالعمل<textarea value={form.instructions ?? ""} onChange={e => set({ instructions: e.target.value })} className="mt-2 w-full rounded-xl border p-3 font-normal" rows={2} /></label><label className="text-sm font-bold">مدت آزمون (دقیقه، اختیاری)<input type="number" min="1" value={form.durationMin ?? ""} onChange={e => set({ durationMin: e.target.value ? Number(e.target.value) : undefined })} className="mt-2 h-11 w-full rounded-xl border px-3 font-normal" /></label>
      <div className="text-sm font-bold">مخاطب<select value={form.target.type === "grades" ? "grades" : form.target.type === "selected" ? "selected" : "all"} onChange={e => set({ target: e.target.value === "grades" ? { type: "grades", grades: form.target.type === "grades" ? form.target.grades : [] } : e.target.value === "selected" && form.target.type === "selected" ? form.target : { type: "all" } })} className="mt-2 h-11 w-full rounded-xl border px-3 font-normal"><option value="all">همهٔ دانش‌آموزان</option><option value="grades">انتخاب بر اساس پایه</option>{form.target.type === "selected" && <option value="selected">دانش‌آموزان انتخاب‌شده</option>}</select></div>
      {form.target.type === "grades" && <fieldset className="rounded-xl border border-[#eadfed] bg-[#fcf8fc] p-4 sm:col-span-2"><legend className="px-1 text-sm font-bold">پایه‌های مجاز برای شرکت</legend><p className="mb-3 text-xs text-muted-foreground">دانش‌آموزان پایه‌های انتخاب‌شده این آزمون را در پنل خود می‌بینند.</p><div className="flex flex-wrap gap-3">{availableGrades.map(grade => <label key={grade} className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#eadfed] bg-white px-3 py-2 text-sm font-semibold transition hover:border-[#bd80c8]"><input type="checkbox" checked={form.target.type === "grades" && form.target.grades.includes(grade)} onChange={e => { if (form.target.type !== "grades") return; const grades = e.target.checked ? [...form.target.grades, grade] : form.target.grades.filter(item => item !== grade); set({ target: { type: "grades", grades: availableGrades.filter(item => grades.includes(item)) } }); }} className="h-4 w-4 accent-[#8c55a5]" />{GRADE_LABEL[grade]}</label>)}</div></fieldset>}
      <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={form.active} onChange={e => set({ active: e.target.checked })} />فعال باشد</label><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={form.status === "published"} onChange={e => set({ status: e.target.checked ? "published" : "draft" })} />منتشر شود</label></div>
    <div className="space-y-3">
      <div className="flex items-center justify-between"><h2 className="font-extrabold">پرسش‌ها ({form.questions.length})</h2><Button type="button" variant="outline" onClick={addQuestion}><Plus size={15} />افزودن پرسش</Button></div>
      {form.questions.map((q, qi) => <article key={q.id} className="space-y-3 rounded-xl bg-[#fcf8fc] p-4">
        <div className="flex justify-between gap-2"><label className="flex-1 text-sm font-bold">متن پرسش<input value={q.text} onChange={e => updateQuestion(qi, { ...q, text: e.target.value })} className="mt-2 h-10 w-full rounded-lg border bg-white px-3 font-normal" /></label><button type="button" aria-label={`حذف پرسش ${qi + 1}`} onClick={() => set({ questions: form.questions.filter((_, i) => i !== qi) })} className="mt-6 text-[#9a5d50]"><Trash2 size={17} /></button></div>
        {q.options.map((o, oi) => <div key={o.id} className="flex flex-wrap items-center gap-2">
          <input aria-label={`گزینه ${oi + 1}`} value={o.text} onChange={e => updateQuestion(qi, { ...q, options: q.options.map((x, i) => i === oi ? { ...x, text: e.target.value } : x) })} placeholder={`متن گزینهٔ ${oi + 1}`} className="h-10 min-w-0 flex-1 rounded-lg border bg-white px-3 text-sm" />
          <label className="flex items-center gap-2 whitespace-nowrap text-xs"><input type="radio" name={`score-${q.id}`} checked={o.score > 0} onChange={() => updateQuestion(qi, { ...q, options: q.options.map((x, i) => ({ ...x, score: i === oi ? 1 : 0 })) })} />امتیاز مثبت</label>
          <button type="button" disabled={q.options.length <= 2} onClick={() => removeOption(qi, oi)} aria-label={`حذف گزینه ${oi + 1} از پرسش ${qi + 1}`} title={q.options.length <= 2 ? "حداقل دو گزینه لازم است" : "حذف گزینه"} className="grid h-9 w-9 place-items-center rounded-lg text-[#9a5d50] hover:bg-[#f8eaf2] disabled:cursor-not-allowed disabled:opacity-35"><Trash2 size={16} /></button>
        </div>)}
        <Button type="button" variant="outline" onClick={() => addOption(qi)} className="h-9 rounded-lg"><Plus size={15} />افزودن گزینه</Button>
      </article>)}
    </div><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setForm(null)}>انصراف</Button><Button disabled={save.isPending} className="rounded-xl bg-[#653b83]">{save.isPending ? "در حال ذخیره…" : "ذخیرهٔ آزمون"}</Button></div><p className="text-xs leading-6 text-[#91859c]">امتیازها برای دانش‌آموز نمایش داده نمی‌شوند. ارزیابی جایگزین تشخیص تخصصی نیست.</p></form>}
    <section className="divide-y rounded-2xl border bg-white">{query.isPending ? <p className="p-5 text-sm">در حال بارگذاری…</p> : query.data?.map(a => <article key={a.id} className="flex flex-wrap items-center justify-between gap-4 p-5"><div><h2 className="font-extrabold">{a.title}</h2><p className="mt-1 text-xs text-[#80748c]">{a.questions.length} پرسش · {a.attemptCount} شرکت‌کننده · {a.status === "published" && a.active ? "منتشر و فعال" : "پیش‌نویس یا غیرفعال"}</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => setForm({ ...a })}>ویرایش</Button><button onClick={() => { if (window.confirm("این آزمون حذف شود؟")) remove.mutate(a.id); }} className="rounded-lg p-2 text-[#9a5d50]" aria-label="حذف آزمون"><Trash2 size={16} /></button></div></article>) ?? <p className="p-6 text-sm text-[#74677f]">هنوز آزمونی ساخته نشده است.</p>}</section></div></AppShell>;
}
