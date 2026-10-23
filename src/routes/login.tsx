import { useEffect, useState, type FormEvent } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, BookOpenCheck, Eye, EyeOff, GraduationCap, LockKeyhole, Sparkles, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { useMe } from "@/lib/auth";
import { HOME_BY_ROLE } from "@/lib/auth";
import { login } from "@/services/api";
import { config } from "@/services/config";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "ورود به سامانه | آرما" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { data: currentUser } = useMe();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (currentUser) void navigate({ to: HOME_BY_ROLE[currentUser.role] as "/admin" });
  }, [currentUser, navigate]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const user = await login(username, password);
      await navigate({ to: HOME_BY_ROLE[user.role] as "/admin" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ورود انجام نشد. دوباره تلاش کنید.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main dir="rtl" className="login-theme relative flex min-h-screen items-center justify-center overflow-hidden bg-[#faf5fb] px-4 py-8 text-[#653b83] sm:py-12">
      <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#e8c4e6]/55 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-[#f4d8eb]/70 blur-3xl" />
      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/80 bg-white/90 shadow-[0_30px_100px_-42px_rgba(78,43,96,.38)] backdrop-blur lg:grid-cols-[1fr_1.05fr]">
      <section className="p-7 sm:p-10 lg:p-12">
        <div className="flex justify-center"><Logo /></div>
        <div className="mt-8 text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-[#f1d9ed] to-[#eadcf6] text-[#8d4d9b] shadow-inner"><LockKeyhole size={23} /></span><h1 className="mt-4 text-2xl font-black">خوش آمدید</h1><p className="mt-2 text-sm leading-6 text-[#74677f]">برای ورود، نام کاربری و گذرواژه‌تان را وارد کنید.</p></div>
        {config.dataMode === "demo" && <div role="status" className="mt-6 rounded-xl border border-[#eadfed] bg-[#f8eff8] px-4 py-3 text-xs leading-6 text-[#744f80]">حالت پیش‌نمایش فعال است. اطلاعات ورود نمونه فقط برای بررسی محلی هستند و احراز هویت امن سروری هنوز متصل نشده است.</div>}
        <form className="mt-7 space-y-4" onSubmit={submit}>
          <label className="block text-sm font-bold" htmlFor="username">نام کاربری</label>
          <div className="relative -mt-2"><UserRound className="absolute right-3.5 top-3.5 text-[#91859c]" size={17} /><input id="username" autoComplete="username" required value={username} onChange={e => setUsername(e.target.value)} className="h-12 w-full rounded-xl border border-[#eadfed] bg-white pr-11 pl-4 text-sm outline-none transition focus:border-[#9b5cad] focus:ring-2 focus:ring-[#bd80c8]/25" placeholder="نام کاربری" /></div>
          <label className="block text-sm font-bold" htmlFor="password">گذرواژه</label>
          <div className="relative -mt-2"><LockKeyhole className="absolute right-3.5 top-3.5 text-[#91859c]" size={17} /><input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} className="h-12 w-full rounded-xl border border-[#eadfed] bg-white px-11 text-sm outline-none transition focus:border-[#9b5cad] focus:ring-2 focus:ring-[#bd80c8]/25" placeholder="گذرواژه" /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "پنهان کردن گذرواژه" : "نمایش گذرواژه"} className="absolute left-3.5 top-3.5 text-[#91859c] hover:text-[#563769]">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
          <Button type="submit" disabled={busy} className="mt-3 h-12 w-full rounded-xl bg-[#653b83] font-bold hover:bg-[#512d70]">{busy ? "در حال ورود…" : "ورود به سامانه"}<ArrowRight size={16} /></Button>
        </form>
        <Link to="/" className="mt-6 flex items-center justify-center gap-2 text-xs font-semibold text-[#80748c] hover:text-[#653b83]">بازگشت به صفحهٔ اصلی</Link>
      </section>
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-[#75449a] via-[#643a83] to-[#432954] px-10 py-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden="true" className="absolute -left-20 -top-20 h-72 w-72 rounded-full border border-white/10 bg-white/5" />
        <div aria-hidden="true" className="absolute -bottom-28 -right-16 h-80 w-80 rounded-full border border-white/10 bg-[#e8a4d0]/10" />
        <div className="relative flex items-center justify-between"><span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white/90"><Sparkles size={15} /> مسیر رشد و یادگیری</span><span className="grid h-10 w-10 place-items-center rounded-xl border border-white/20 bg-white/10 text-[#f4c6e3]"><Sparkles size={19} /></span></div>
        <div className="relative py-12"><div className="mb-7 grid h-20 w-20 place-items-center rounded-[1.7rem] border border-white/20 bg-white/10 shadow-xl backdrop-blur"><BookOpenCheck size={39} className="text-[#f2c8e5]" /></div><h2 className="max-w-sm text-3xl font-black leading-[1.6]">یادگیری،<br /><span className="text-[#f4c6e3]">یک قدم تازه</span></h2><p className="mt-5 max-w-sm text-sm leading-8 text-white/75">به فضای آموزشی آرما وارد شوید و کلاس‌ها، برنامه‌ها و مسیر پیشرفت خود را دنبال کنید.</p></div>
        <div className="relative flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[#f0c6e2]/15 text-[#f4c6e3]"><GraduationCap size={23} /></span><div><p className="text-sm font-bold">همراهِ مسیر رشد</p><p className="mt-1 text-xs text-white/65">یک فضای متمرکز برای یادگیری و پیشرفت</p></div></div>
      </aside>
      </div>
    </main>
  );
}
