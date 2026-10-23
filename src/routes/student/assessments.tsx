import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, CheckCircle2, ClipboardList, Clock3, LayoutDashboard, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { AppShell, type NavItem } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { guardRole } from "@/lib/auth";
import { formatJalali } from "@/lib/jalali";
import { saveAnswers, startAttempt, studentAssessments, submitAttempt } from "@/services/api";

export const Route = createFileRoute("/student/assessments")({
  ssr: false,
  beforeLoad: () => guardRole("student"),
  head: () => ({ meta: [{ title: "آزمون‌ها | آرما" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: StudentAssessmentsPage,
});

const nav: NavItem[] = [
  { to: "/student/", label: "داشبورد من", icon: <LayoutDashboard size={18} /> },
  { to: "/student/classes", label: "کلاس‌های من", icon: <UsersRound size={18} /> },
  { to: "/student/assessments", label: "آزمون‌ها", icon: <ClipboardList size={18} />, exact: true },
];
type ActiveAttempt = Awaited<ReturnType<typeof startAttempt>>;

function StudentAssessmentsPage() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["student", "assessments"], queryFn: studentAssessments });
  const [active, setActive] = useState<ActiveAttempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [questionIndex, setQuestionIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const submittedAfterTimeout = useRef(false);
  const start = useMutation({ mutationFn: (id: string) => startAttempt(id), onSuccess: attempt => { setActive(attempt); setAnswers(attempt.answers); setQuestionIndex(0); submittedAfterTimeout.current = false; }, onError: error => toast.error(error instanceof Error ? error.message : "شروع آزمون انجام نشد.") });
  const submit = useMutation({ mutationFn: async () => { if (!active) return; await saveQueue.current.catch(() => undefined); await saveAnswers(active.attemptId, answers); await submitAttempt(active.attemptId, answers); }, onSuccess: async () => { toast.success("پاسخ‌ها ثبت شد. نتیجه برای بررسی در پنل مدیر قرار گرفت."); setActive(null); setConfirmSubmit(false); await client.invalidateQueries({ queryKey: ["student", "assessments"] }); }, onError: error => toast.error(error instanceof Error ? error.message : "ارسال پاسخ‌ها انجام نشد.") });
  const question = active?.questions[questionIndex];
  const answered = active ? active.questions.filter(q => !!answers[q.id]).length : 0;

  useEffect(() => {
    if (!active?.deadline) { setSecondsLeft(null); return; }
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((active.deadline! - Date.now()) / 1000)));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [active]);

  useEffect(() => {
    if (secondsLeft === 0 && active && !submittedAfterTimeout.current) {
      submittedAfterTimeout.current = true;
      submit.mutate();
    }
  }, [secondsLeft, active]);

  function choose(questionId: string, optionId: string) {
    if (!active) return;
    const next = { ...answers, [questionId]: optionId };
    setAnswers(next);
    saveQueue.current = saveQueue.current.catch(() => undefined).then(() => saveAnswers(active.attemptId, next)).catch(() => { toast.error("ذخیرهٔ خودکار پاسخ انجام نشد؛ اتصال اینترنت را بررسی کنید."); });
  }
  const timeLabel = secondsLeft === null ? null : `${Math.floor(secondsLeft / 60).toString().padStart(2, "0")}:${(secondsLeft % 60).toString().padStart(2, "0")}`;

  return <AppShell role="student" nav={nav}><div className="space-y-6"><header><p className="text-xs font-bold text-[#8c55a5]">ارزیابی و شناخت</p><h1 className="mt-2 text-2xl font-black">آزمون‌های من</h1><p className="mt-2 text-sm text-muted-foreground">آزمون‌ها را با آرامش پاسخ دهید؛ نتیجهٔ ارزیابی فقط در اختیار مدیر است.</p></header>{query.isError && <p role="alert" className="rounded-xl bg-destructive/5 p-4 text-sm text-destructive">دریافت آزمون‌ها انجام نشد.</p>}
    {!active && <>{query.isPending ? <p className="rounded-xl border bg-white p-5 text-sm text-[#74677f]">در حال بارگذاری آزمون‌ها…</p> : query.data?.length ? <div className="grid gap-4 md:grid-cols-2">{query.data.map(assessment => <article key={assessment.id} className="rounded-2xl border border-[#eadfed] bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[#f5eaf5] text-[#a24c82]"><ClipboardList size={19} /></span><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${assessment.open ? "bg-[#f3e8f5] text-[#55745c]" : "bg-[#f7f1f8] text-[#80748c]"}`}>{assessment.open ? "آمادهٔ شرکت" : "فعلاً بسته"}</span></div><h2 className="mt-4 text-lg font-extrabold">{assessment.title}</h2><p className="mt-2 min-h-12 text-sm leading-6 text-[#74677f]">{assessment.description || "برای شناخت بهتر مسیر یادگیری شما"}</p><div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[#80748c]"><span>{assessment.questionCount} پرسش</span>{assessment.durationMin && <span>حدود {assessment.durationMin} دقیقه</span>}<span>{assessment.used} از {assessment.maxAttempts} نوبت</span>{assessment.endAt && <span>پایان: {formatJalali(assessment.endAt)}</span>}</div><Button disabled={!assessment.open || assessment.used >= assessment.maxAttempts || !assessment.questionCount || start.isPending} onClick={() => start.mutate(assessment.id)} className="mt-5 w-full rounded-xl bg-[#653b83]">{assessment.used >= assessment.maxAttempts ? "نوبت مجاز به پایان رسیده" : start.isPending ? "در حال آماده‌سازی…" : "شروع یا ادامهٔ آزمون"}<ArrowLeft size={15} /></Button></article>)}</div> : <div className="rounded-2xl border border-dashed border-[#d8c9dd] bg-white p-10 text-center"><ClipboardList className="mx-auto text-[#a59aab]" size={28} /><h2 className="mt-3 font-extrabold">آزمونی برای شما فعال نیست</h2><p className="mt-2 text-sm text-[#74677f]">اگر قرار است در آزمونی شرکت کنید، مدیر مجموعه آن را برای شما فعال می‌کند.</p></div>}</>}
    {active && question && <section className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-[#eadfed] bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eee5f1] p-5"><div><p className="text-xs text-[#80748c]">{active.title}</p><h2 className="mt-1 font-extrabold">پرسش {questionIndex + 1} از {active.questions.length}</h2></div>{timeLabel && <span className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-extrabold tabular-nums ${secondsLeft !== null && secondsLeft < 60 ? "bg-[#f4e6f2] text-[#9a5d50]" : "bg-[#f6edf7] text-[#8c55a5]"}`}><Clock3 size={16} />{timeLabel}</span>}</div>{active.instructions && <p className="border-b border-[#eee5f1] bg-[#fcf8fc] px-5 py-3 text-sm leading-6 text-[#74677f]">{active.instructions}</p>}<div className="p-5 sm:p-8"><div className="mb-5 h-2 overflow-hidden rounded-full bg-[#eee5f1]"><div className="h-full rounded-full bg-[#b44f8e] transition-all" style={{ width: `${Math.round((answered / active.questions.length) * 100)}%` }} /></div><p className="text-lg font-extrabold leading-8">{question.text}</p><fieldset className="mt-5 space-y-3"><legend className="sr-only">گزینه‌های پرسش</legend>{question.options.map((option, i) => <label key={option.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 text-sm transition ${answers[question.id] === option.id ? "border-[#653b83] bg-[#f4f5f8]" : "border-[#eadfed] hover:bg-[#fcf8fc]"}`}><input type="radio" name={question.id} checked={answers[question.id] === option.id} onChange={() => choose(question.id, option.id)} className="h-4 w-4 accent-[#653b83]" /><span className="leading-6">{option.text}</span></label>)}</fieldset></div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eee5f1] p-4 sm:px-6"><Button type="button" variant="outline" disabled={questionIndex === 0} onClick={() => setQuestionIndex(i => i - 1)}><ArrowRight size={15} />پرسش قبلی</Button><p className="text-xs text-[#80748c]">{answered} پاسخ ذخیره‌شده</p><div className="flex gap-2">{questionIndex < active.questions.length - 1 ? <Button type="button" onClick={() => setQuestionIndex(i => i + 1)} className="rounded-xl bg-[#653b83]">پرسش بعدی<ArrowLeft size={15} /></Button> : <Button type="button" onClick={() => setConfirmSubmit(true)} disabled={submit.isPending} className="rounded-xl bg-[#653b83]">بررسی و ارسال<CheckCircle2 size={15} /></Button>}</div></div></section>}
    {confirmSubmit && <div className="fixed inset-0 z-50 grid place-items-center bg-[#2d1e38]/50 p-4" role="presentation"><div role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><h2 id="confirm-title" className="text-lg font-extrabold">ارسال نهایی پاسخ‌ها؟</h2><p className="mt-2 text-sm leading-7 text-[#74677f]">پس از ارسال، امکان تغییر پاسخ‌ها وجود ندارد. {active && active.questions.length - answered > 0 ? `${active.questions.length - answered} پرسش بی‌پاسخ دارید.` : "همهٔ پرسش‌ها پاسخ داده شده‌اند."}</p><div className="mt-5 flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setConfirmSubmit(false)}>بازگشت</Button><Button type="button" disabled={submit.isPending} onClick={() => submit.mutate()} className="rounded-xl bg-[#653b83]">{submit.isPending ? "در حال ارسال…" : "ارسال پاسخ‌ها"}</Button></div></div></div>}
    <p className="text-xs leading-6 text-[#91859c]">این پرسش‌نامه جایگزین ارزیابی تخصصی نیست و به‌تنهایی تشخیص پزشکی یا روان‌شناختی محسوب نمی‌شود.</p>
  </div></AppShell>;
}
