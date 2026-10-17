import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { changePassword } from "@/services/api";
export function AccountSettings() {
 const [current, setCurrent] = useState(""); const [next, setNext] = useState(""); const [confirm, setConfirm] = useState("");
 const update = useMutation({ mutationFn: () => { if (next !== confirm) throw new Error("تکرار رمز عبور جدید یکسان نیست."); return changePassword(current, next); }, onSuccess: () => { toast.success("رمز عبور تغییر کرد."); setCurrent(""); setNext(""); setConfirm(""); }, onError: e => toast.error(e instanceof Error ? e.message : "تغییر رمز عبور انجام نشد.") });
 function submit(e: FormEvent) { e.preventDefault(); update.mutate(); }
 return <form onSubmit={submit} className="max-w-xl space-y-4 rounded-2xl border border-[#eae7de] bg-white p-5 shadow-sm sm:p-7"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#f2eddf] text-[#927544]"><KeyRound size={18} /></span><div><h2 className="font-extrabold">تغییر رمز عبور</h2><p className="mt-1 text-xs text-[#85899a]">حداقل ۸ نویسه، شامل حرف انگلیسی و عدد</p></div></div><label className="block text-sm font-bold">رمز عبور فعلی<input required type="password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} className="mt-2 h-11 w-full rounded-xl border px-3 font-normal" /></label><label className="block text-sm font-bold">رمز عبور جدید<input required minLength={8} type="password" autoComplete="new-password" value={next} onChange={e => setNext(e.target.value)} className="mt-2 h-11 w-full rounded-xl border px-3 font-normal" /></label><label className="block text-sm font-bold">تکرار رمز عبور جدید<input required minLength={8} type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} className="mt-2 h-11 w-full rounded-xl border px-3 font-normal" /></label><Button disabled={update.isPending} className="rounded-xl bg-[#202747]">{update.isPending ? "در حال ذخیره…" : "ثبت رمز جدید"}</Button></form>;
}
