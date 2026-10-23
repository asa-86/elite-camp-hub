import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpLeft, BookOpen, Brain, CalendarDays, Check, ChevronDown, Compass, GraduationCap, Layers3, Sparkles, UsersRound } from "lucide-react";
import { Logo } from "@/components/brand";
import heroCamp from "@/assets/hero-camp.jpg";
import { config } from "@/services/config";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "آرما | مسیر رشد و یادگیری" },
      { name: "description", content: "آرما؛ محیطی برای یادگیری عمیق، پرورش توانایی‌ها و همراهی دانش‌آموزان در مسیر رشد." },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "آرما" },
      { property: "og:description", content: "جایی برای کنجکاوی، یادگیری و رشد توانایی‌های دانش‌آموزان." },
      { property: "og:type", content: "website" },
      ...(config.siteUrl
        ? [
            { property: "og:url", content: `${config.siteUrl}/` },
            { property: "og:image", content: new URL(heroCamp, config.siteUrl).toString() },
            { property: "og:image:alt", content: "کتابی گشوده زیر آسمانی پرستاره؛ نمادی از سفر یادگیری و کشف" },
            { name: "twitter:image", content: new URL(heroCamp, config.siteUrl).toString() },
          ]
        : []),
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "آرما" },
      { name: "twitter:description", content: "جایی برای کنجکاوی، یادگیری و رشد توانایی‌های دانش‌آموزان." },
    ],
    links: config.siteUrl ? [{ rel: "canonical", href: `${config.siteUrl}/` }] : [],
    scripts: config.siteUrl
      ? [
          {
            attrs: { type: "application/ld+json" },
            children: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "EducationalOrganization",
              name: "آرما",
              url: `${config.siteUrl}/`,
              description: "محیطی برای یادگیری عمیق، پرورش توانایی‌ها و همراهی دانش‌آموزان در مسیر رشد.",
            }).replace(/</g, "\\u003c"),
          },
        ]
      : [],
  }),
  component: HomePage,
});

const programs = [
  { icon: Compass, number: "۰۱", title: "یادگیری با کنجکاوی", text: "مفاهیم را با پرسش، تجربه و حل مسئله کشف می‌کنیم؛ یادگیری وقتی ماندگار است که دانش‌آموز خودش به پاسخ برسد." },
  { icon: UsersRound, number: "۰۲", title: "رشد در کنار هم", text: "کلاس‌های هدفمند و همراهی معلم، فضایی امن برای گفت‌وگو، همکاری و شکوفایی استعدادهای متفاوت می‌سازند." },
  { icon: Sparkles, number: "۰۳", title: "شناخت توانایی‌ها", text: "با بازخورد و ارزیابی‌های متناسب، مسیر پیشرفت هر دانش‌آموز را بهتر می‌شناسیم و برای قدم بعدی برنامه می‌ریزیم." },
];

const faqs = [
  ["چه کسانی می‌توانند در کمپ شرکت کنند؟", "دانش‌آموزان پایه‌های هفتم تا دوازدهم می‌توانند برای آشنایی و بررسی شرایط با مجموعه در ارتباط باشند."],
  ["چطور برای ثبت‌نام اقدام کنیم؟", "ثبت‌نام عمومی آنلاین نداریم. برای دریافت اطلاعات و بررسی شرایط، از صفحهٔ ارتباط با ما با مجموعه تماس بگیرید."],
  ["آیا جزوه‌ها و برنامه‌ها در سامانه در دسترس هستند؟", "کاربران پس از دریافت حساب کاربری از مجموعه، کلاس‌ها، جلسات و جزوه‌های مرتبط را در پنل خود می‌بینند."],
] as const;

function HomePage() {
  return (
    <main dir="rtl" className="home-page overflow-hidden bg-[#f7faf3] text-[#183a2a]">
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <Logo />
        <nav className="flex items-center gap-3 sm:gap-7" aria-label="ناوبری اصلی">
          <a className="hidden text-sm font-semibold text-[#62677b] transition hover:text-[#23613b] sm:inline" href="#about">دربارهٔ کمپ</a>
          <Link className="text-sm font-semibold text-[#62677b] transition hover:text-[#23613b]" to="/contact">ارتباط با ما</Link>
          <Link className="inline-flex items-center gap-2 rounded-full bg-[#23613b] px-5 py-2.5 text-sm font-bold text-white shadow-[0_8px_20px_-8px_rgba(35,97,59,.55)] transition hover:bg-[#19492d]" to="/login">ورود <ArrowLeft size={15} /></Link>
        </nav>
      </header>

      <section className="relative mx-auto grid min-h-[620px] max-w-7xl items-center gap-8 px-5 pb-16 pt-7 sm:px-8 lg:min-h-[690px] lg:grid-cols-[1fr_1.05fr] lg:px-12 lg:pb-24 lg:pt-8">
        <div aria-hidden="true" className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-[#f0df62]/20 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute right-[42%] top-24 h-56 w-56 rounded-full bg-[#8dbb6b]/15 blur-3xl" />
        <div className="relative z-[1] max-w-xl py-6 lg:py-12">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#dce8c7] bg-white/85 px-4 py-2 text-xs font-bold text-[#55752e] shadow-sm"><Sparkles size={15} /> جایی برای یادگیری متفاوت</div>
          <h1 className="text-[2.5rem] font-black leading-[1.45] tracking-tight sm:text-5xl lg:text-[3.65rem]">هر استعداد،<br /><span className="text-[#4d8b39]">یک مسیر درخشان</span></h1>
          <p className="mt-6 max-w-lg text-base leading-8 text-[#686d7e] sm:text-lg sm:leading-9">در آرما، یادگیری با پرسش شروع می‌شود و با تجربه جان می‌گیرد. کنار هم فضایی می‌سازیم تا دانش‌آموزان توانایی‌هایشان را کشف کنند و با اطمینان رشد کنند.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/contact" className="inline-flex items-center gap-2 rounded-full bg-[#23613b] px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#23613b]/20 transition hover:-translate-y-0.5 hover:bg-[#19492d]">آشنایی با کمپ <ArrowUpLeft size={17} /></Link>
            <a href="#about" className="inline-flex items-center gap-2 rounded-full border border-[#dce5d4] bg-white px-6 py-3.5 text-sm font-bold text-[#31553b] transition hover:border-[#e5c94d] hover:bg-[#fffdf3]">بیشتر بدانید <ArrowLeft size={16} /></a>
          </div>
          <div className="mt-10 flex items-center gap-4 border-t border-[#dce7d7] pt-6">
            <div className="flex -space-x-2 space-x-reverse">{["م", "ع", "ن"].map((n, i) => <span key={n} className={`grid h-9 w-9 place-items-center rounded-full border-2 border-[#f7faf3] text-xs font-extrabold text-white ${["bg-[#4e813e]", "bg-[#c6a92e]", "bg-[#80a76a]"][i]}`}>{n}</span>)}</div>
            <p className="text-xs leading-6 text-[#737789]">با همراهی معلمان دلسوز<br /><strong className="text-[#303650]">در مسیر رشد و یادگیری</strong></p>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-[650px] lg:justify-self-end">
          <div className="absolute -inset-5 rounded-[2.5rem] bg-[#dcebc8]/70 blur-2xl" />
          <div className="relative overflow-hidden rounded-[2rem] border-[7px] border-white shadow-[0_28px_80px_-30px_rgba(34,83,49,.38)] sm:rounded-[2.5rem]">
            <img src={heroCamp} alt="کتابی گشوده زیر آسمانی پرستاره؛ نمادی از سفر یادگیری و کشف" className="aspect-[1.16/1] w-full object-cover sm:aspect-[1.25/1]" fetchPriority="high" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#183a2a]/80 via-transparent to-[#183a2a]/5" />
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-5 text-white sm:p-7">
              <div><p className="text-xs font-medium text-white/70">با پرسش آغاز کن</p><p className="mt-1 text-lg font-extrabold sm:text-2xl">جهان تازه‌ای کشف کن</p></div>
              <span className="grid h-11 w-11 place-items-center rounded-full border border-white/30 bg-white/10 backdrop-blur"><BookOpen size={20} /></span>
            </div>
          </div>
          <div className="absolute -right-3 top-8 hidden items-center gap-3 rounded-2xl border border-white/70 bg-white/90 p-3.5 shadow-xl backdrop-blur sm:flex lg:-right-8">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#f7f0c8] text-[#8a7620]"><Brain size={20} /></span><span className="text-xs font-bold leading-5">شناخت توانایی‌ها<br /><span className="font-medium text-[#85899a]">شروع یک مسیر شخصی</span></span>
          </div>
          <div className="absolute -bottom-5 left-4 hidden items-center gap-3 rounded-2xl border border-white/70 bg-white/90 p-3.5 shadow-xl backdrop-blur sm:flex lg:-left-7">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e5f0dd] text-[#477344]"><GraduationCap size={21} /></span><span className="text-xs font-bold leading-5">یادگیری همراه با تجربه<br /><span className="font-medium text-[#85899a]">قدم‌به‌قدم تا پیشرفت</span></span>
          </div>
        </div>
        <a href="#about" aria-label="رفتن به بخش درباره کمپ" className="absolute bottom-5 left-1/2 hidden -translate-x-1/2 animate-bounce text-[#9899a2] lg:block"><ChevronDown size={20} /></a>
      </section>

      <section id="about" className="relative border-y border-[#e1eadb] bg-[#fbfdf8] px-5 py-16 sm:px-8 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[.75fr_1.25fr] lg:items-end">
            <div><p className="text-xs font-extrabold tracking-wide text-[#638640]">نگاه ما</p><h2 className="mt-3 text-3xl font-black leading-[1.6] sm:text-4xl">فراتر از کلاس؛<br />همراهِ مسیر رشد</h2></div>
            <p className="max-w-2xl text-sm leading-8 text-[#717586] sm:text-base sm:leading-9">باور داریم هر دانش‌آموز راه یادگیری خودش را دارد. آرما فضایی فراهم می‌کند تا دانش، تجربه و همراهی در کنار هم قرار بگیرند؛ تا نوجوانان نه‌فقط پاسخ‌ها، که شیوهٔ پرسیدن و اندیشیدن را هم بیاموزند.</p>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {programs.map(({ icon: Icon, number, title, text }) => <article key={number} className="group rounded-3xl border border-[#e1eadb] bg-white p-6 transition duration-300 hover:-translate-y-1 hover:border-[#d9ca62] hover:shadow-[0_16px_40px_-28px_rgba(45,91,50,.35)] sm:p-7"><div className="flex items-center justify-between"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#edf4df] text-[#588344] transition group-hover:bg-[#23613b] group-hover:text-white"><Icon size={22} /></span><span className="text-xs font-bold tracking-widest text-[#c8c4b9]">{number}</span></div><h3 className="mt-6 text-lg font-extrabold">{title}</h3><p className="mt-3 text-sm leading-7 text-[#777b8a]">{text}</p></article>)}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 lg:grid-cols-2 lg:items-center lg:px-12 lg:py-24">
        <div className="order-2 grid grid-cols-2 gap-3 lg:order-1">
          <div className="rounded-3xl bg-[#23613b] p-5 text-white shadow-[0_18px_35px_-24px_rgba(35,97,59,.7)] sm:p-7"><CalendarDays className="text-[#f0db65]" size={24} /><h3 className="mt-8 text-base font-extrabold">کلاس و جلسه</h3><p className="mt-2 text-xs leading-6 text-white/65">برنامه‌ای روشن برای مسیر یادگیری</p></div>
          <div className="mt-8 rounded-3xl border border-[#e1eadb] bg-white p-5 shadow-sm sm:p-7"><Layers3 className="text-[#8b7624]" size={24} /><h3 className="mt-8 text-base font-extrabold">جزوه‌های همراه</h3><p className="mt-2 text-xs leading-6 text-[#777b8a]">دسترسی ساده به منابع کلاس</p></div>
          <div className="rounded-3xl border border-[#e1eadb] bg-white p-5 shadow-sm sm:p-7"><Brain className="text-[#5b8a52]" size={24} /><h3 className="mt-8 text-base font-extrabold">ارزیابی و شناخت</h3><p className="mt-2 text-xs leading-6 text-[#777b8a]">بازخورد برای شناخت بهتر توانایی‌ها</p></div>
          <div className="mt-8 rounded-3xl bg-[#f7f1cf] p-5 sm:p-7"><BookOpen className="text-[#917442]" size={24} /><h3 className="mt-8 text-base font-extrabold">یادگیری پیوسته</h3><p className="mt-2 text-xs leading-6 text-[#777b8a]">همراهی در کلاس و بیرون از آن</p></div>
        </div>
        <div className="order-1 lg:order-2"><p className="text-xs font-extrabold tracking-wide text-[#638640]">یک تجربهٔ یکپارچه</p><h2 className="mt-3 text-3xl font-black leading-[1.6] sm:text-4xl">همهٔ مسیر یادگیری<br />در یک جا</h2><p className="mt-5 text-sm leading-8 text-[#717586] sm:text-base sm:leading-9">سامانهٔ کمپ کمک می‌کند کلاس‌ها، جلسه‌ها و منابع آموزشی منظم و در دسترس باشند. دانش‌آموز می‌تواند برنامهٔ خود را دنبال کند و معلم نیز با تمرکز بیشتر، همراه یادگیری او باشد.</p><ul className="mt-6 space-y-3 text-sm font-semibold text-[#50556a]">{["دسترسی به برنامه و محتوای کلاس", "پیگیری جلسه‌ها و حضور و غیاب", "ارزیابی برای شناخت بهتر مسیر رشد"].map(x => <li key={x} className="flex items-center gap-3"><span className="grid h-6 w-6 place-items-center rounded-full bg-[#e8f2dd] text-[#477344]"><Check size={14} /></span>{x}</li>)}</ul><Link to="/contact" className="mt-8 inline-flex items-center gap-2 text-sm font-extrabold text-[#537a36] hover:text-[#23613b]">با ما بیشتر آشنا شوید <ArrowLeft size={16} /></Link></div>
      </section>

      <section className="border-y border-[#e1eadb] bg-[#fbfdf8] px-5 py-16 sm:px-8 lg:py-20">
        <div className="mx-auto max-w-3xl"><div className="text-center"><p className="text-xs font-extrabold tracking-wide text-[#638640]">پرسش‌های پرتکرار</p><h2 className="mt-3 text-3xl font-black">پاسخ چند پرسش</h2></div><div className="mt-9 divide-y divide-[#e1eadb]">{faqs.map(([q, a]) => <details key={q} className="group py-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold"><span>{q}</span><ChevronDown className="shrink-0 text-[#638640] transition group-open:rotate-180" size={19} /></summary><p className="max-w-2xl pt-4 text-sm leading-7 text-[#777b8a]">{a}</p></details>)}</div></div>
      </section>

      <section className="px-5 py-16 sm:px-8 lg:py-20"><div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-[#23613b] px-6 py-11 text-center text-white sm:px-12 sm:py-14"><div className="absolute inset-0 bg-stars opacity-40" /><div className="relative"><p className="text-xs font-bold text-[#d8c28e]">قدم بعدی از یک گفت‌وگو شروع می‌شود</p><h2 className="mx-auto mt-3 max-w-2xl text-2xl font-black leading-relaxed sm:text-3xl">دوست دارید بیشتر دربارهٔ کمپ بدانید؟</h2><p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-white/65">برای آشنایی با برنامه‌ها و شرایط حضور در کمپ، با ما در ارتباط باشید.</p><Link to="/contact" className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#f1dc62] px-6 py-3 text-sm font-extrabold text-[#273d24] transition hover:bg-[#fff3a8]">ارتباط با ما <ArrowLeft size={16} /></Link></div></div></section>

      <footer className="border-t border-[#e1eadb] bg-white px-5 py-8 sm:px-8"><div className="mx-auto flex max-w-7xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><Logo /><div className="flex flex-wrap gap-x-6 gap-y-3 text-xs font-semibold text-[#777b8a]"><Link to="/contact" className="hover:text-[#23613b]">ارتباط با ما</Link><Link to="/login" className="hover:text-[#23613b]">ورود کاربران</Link><a href="#about" className="hover:text-[#23613b]">دربارهٔ کمپ</a></div><p className="text-xs text-[#9a9daa]">© آرما</p></div></footer>
    </main>
  );
}
