import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpLeft, MessageCircle, UserPlus } from "lucide-react";
import { Logo } from "@/components/brand";

export const Route = createFileRoute("/contact")({
  head: () => ({ meta: [{ title: "ارتباط با ما | کمپ نخبگان دانش‌آموزی" }, { name: "robots", content: "index, follow" }] }),
  component: ContactPage,
});

function ContactPage() {
  return (
    <main dir="rtl" className="min-h-screen bg-[#faf9f6] text-[#202747]">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <Logo /><Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#686d7e] hover:text-[#202747]"><ArrowLeft size={16} /> صفحهٔ اصلی</Link>
      </header>
      <section className="mx-auto max-w-5xl px-5 pb-16 pt-10 sm:px-8 sm:pt-16">
        <div className="max-w-2xl"><p className="text-xs font-extrabold text-[#a48449]">ارتباط با کمپ</p><h1 className="mt-3 text-3xl font-black leading-relaxed sm:text-4xl">برای آشنایی بیشتر،<br className="hidden sm:block" /> گفت‌وگو را شروع کنیم</h1><p className="mt-5 text-sm leading-8 text-[#717586] sm:text-base">اگر دربارهٔ برنامه‌های آموزشی، شرایط حضور یا سامانه پرسشی دارید، این بخش برای راهنمایی شماست. ایجاد حساب کاربری در کمپ به‌صورت عمومی انجام نمی‌شود و حساب‌ها را مدیر مجموعه ایجاد می‌کند.</p></div>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <article className="rounded-3xl border border-[#ebe7dc] bg-white p-7 shadow-sm sm:p-9"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#f2eddf] text-[#927544]"><MessageCircle size={21} /></span><h2 className="mt-5 text-xl font-extrabold">پرسش دربارهٔ کمپ</h2><p className="mt-3 text-sm leading-7 text-[#777b8a]">برای دریافت راهنمایی دربارهٔ کلاس‌ها و برنامه‌های آموزشی، با مسئول مجموعه در ارتباط باشید.</p><p className="mt-5 rounded-xl bg-[#f8f7f2] px-4 py-3 text-sm font-bold text-[#50556a]" dir="ltr">۰۹۰۰ ۰۰۰ ۰۰۰۰</p><p className="mt-2 text-xs leading-6 text-[#9a7c43]">شمارهٔ نمایشی است؛ پیش از انتشار باید با شمارهٔ واقعی مجموعه جایگزین شود.</p></article>
          <article className="rounded-3xl border border-[#ebe7dc] bg-white p-7 shadow-sm sm:p-9"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#e9eef4] text-[#4c5d82]"><UserPlus size={21} /></span><h2 className="mt-5 text-xl font-extrabold">درخواست آشنایی و ثبت‌نام</h2><p className="mt-3 text-sm leading-7 text-[#777b8a]">ثبت‌نام آنلاین عمومی فعال نیست. پس از گفت‌وگو و بررسی شرایط، حساب کاربری توسط مدیر مجموعه ساخته می‌شود.</p><Link to="/login" className="mt-5 inline-flex items-center gap-2 text-sm font-extrabold text-[#876d3e] hover:text-[#202747]">حساب دارید؟ وارد شوید <ArrowLeft size={16} /></Link></article>
        </div>
        <div className="mt-8 rounded-3xl bg-[#202747] p-7 text-white sm:flex sm:items-center sm:justify-between sm:p-9"><div><p className="text-xs font-bold text-[#d8c28e]">ویژهٔ کاربران کمپ</p><h2 className="mt-2 text-xl font-extrabold">به فضای یادگیری خود وارد شوید</h2><p className="mt-2 text-sm text-white/65">نام کاربری و گذرواژه را از مدیر مجموعه دریافت کنید.</p></div><Link to="/login" className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#e7d5aa] px-5 py-3 text-sm font-extrabold text-[#252b47] hover:bg-white sm:mt-0">ورود به سامانه <ArrowUpLeft size={16} /></Link></div>
      </section>
    </main>
  );
}
