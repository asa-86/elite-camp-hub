import { useEffect, useState, type FormEvent } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Eye, EyeOff, LockKeyhole, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { useMe } from "@/lib/auth";
import { HOME_BY_ROLE } from "@/lib/auth";
import { login } from "@/services/api";
import { config } from "@/services/config";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "ورود به سامانه | کمپ نخبگان دانش‌آموزی" }, { name: "robots", content: "noindex, nofollow" }] }),
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
    <main dir="rtl" className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f8f7f2] px-4 py-10 text-[#202747]">
      <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#eee5d1] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-[#e8ebf1] blur-3xl" />
      <section className="relative w-full max-w-md rounded-[2rem] border border-white bg-white/90 p-7 shadow-[0_24px_80px_-36px_rgba(32,39,71,.35)] backdrop-blur sm:p-10">
        <div className="flex justify-center"><Logo /></div>
        <div className="mt-9 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#f2eddf] text-[#927544]"><LockKeyhole size={21} /></span><h1 className="mt-4 text-2xl font-black">خوش آمدید</h1><p className="mt-2 text-sm leading-6 text-[#777b8a]">برای ورود، نام کاربری و گذرواژه‌تان را وارد کنید.</p></div>
        {config.dataMode === "demo" && <div role="status" className="mt-6 rounded-xl border border-[#eadfca] bg-[#fbf7ed] px-4 py-3 text-xs leading-6 text-[#766441]">حالت پیش‌نمایش فعال است. اطلاعات ورود نمونه فقط برای بررسی محلی هستند و احراز هویت امن سروری هنوز متصل نشده است.</div>}
        <form className="mt-7 space-y-4" onSubmit={submit}>
          <label className="block text-sm font-bold" htmlFor="username">نام کاربری</label>
          <div className="relative -mt-2"><UserRound className="absolute right-3.5 top-3.5 text-[#999cab]" size={17} /><input id="username" autoComplete="username" required value={username} onChange={e => setUsername(e.target.value)} className="h-12 w-full rounded-xl border border-[#e8e6df] bg-white pr-11 pl-4 text-sm outline-none transition focus:border-[#9b814c] focus:ring-2 focus:ring-[#c4ae7b]/20" placeholder="نام کاربری" /></div>
          <label className="block text-sm font-bold" htmlFor="password">گذرواژه</label>
          <div className="relative -mt-2"><LockKeyhole className="absolute right-3.5 top-3.5 text-[#999cab]" size={17} /><input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} className="h-12 w-full rounded-xl border border-[#e8e6df] bg-white px-11 text-sm outline-none transition focus:border-[#9b814c] focus:ring-2 focus:ring-[#c4ae7b]/20" placeholder="گذرواژه" /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "پنهان کردن گذرواژه" : "نمایش گذرواژه"} className="absolute left-3.5 top-3.5 text-[#999cab] hover:text-[#343b5a]">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
          <Button type="submit" disabled={busy} className="mt-3 h-12 w-full rounded-xl bg-[#202747] font-bold hover:bg-[#30395e]">{busy ? "در حال ورود…" : "ورود به سامانه"}<ArrowRight size={16} /></Button>
        </form>
        <Link to="/" className="mt-6 flex items-center justify-center gap-2 text-xs font-semibold text-[#85899a] hover:text-[#202747]">بازگشت به صفحهٔ اصلی</Link>
      </section>
    </main>
  );
}
