import { useState, type ReactNode } from "react";
import { Link, Outlet, useNavigate, type LinkProps } from "@tanstack/react-router";
import { LogOut, Menu, X, FlaskConical } from "lucide-react";
import { LogoMark } from "@/components/brand";
import { useMe, useSignOut } from "@/lib/auth";
import { ROLE_LABEL, type Role } from "@/lib/types";
import { config } from "@/services/config";
import { cn } from "@/lib/utils";

export interface NavItem { to: NonNullable<LinkProps["to"]>; label: string; icon: ReactNode; exact?: boolean | undefined }

export function AppShell({ role, nav, children }: { role: Role; nav: NavItem[]; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { data: me } = useMe();
  const signOut = useSignOut();
  const navigate = useNavigate();
  const doSignOut = async () => {
    await signOut();
    navigate({ to: "/login" as "/", replace: true });
  };

  const sidebar = (
    <div className="flex h-full flex-col bg-sidebar bg-stars text-sidebar-foreground">
      <div className="flex items-center gap-3 px-5 py-5">
        <LogoMark />
        <div className="leading-tight">
          <div className="font-extrabold">کمپ نخبگان</div>
          <div className="text-xs text-sidebar-foreground/60">پنل {ROLE_LABEL[role]}</div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3" aria-label="منوی اصلی">
        {nav.map((n) => (
          <Link
            key={String(n.to)}
            to={n.to}
            onClick={() => setOpen(false)}
            activeOptions={{ exact: !!n.exact }}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            activeProps={{ className: "bg-sidebar-primary! text-sidebar-primary-foreground! font-bold shadow-glow" }}
          >
            <span className="[&>svg]:h-[18px] [&>svg]:w-[18px]">{n.icon}</span>
            {n.label}
          </Link>
        ))}
      </nav>
      <div className="m-3 rounded-2xl border border-sidebar-border bg-sidebar-accent/60 p-3">
        <div className="text-sm font-bold">{me?.fullName ?? "…"}</div>
        <div className="text-xs text-sidebar-foreground/60" dir="ltr">@{me?.username}</div>
        <button onClick={doSignOut} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-sidebar px-3 py-2 text-sm transition-colors hover:bg-destructive hover:text-destructive-foreground">
          <LogOut className="h-4 w-4" /> خروج از حساب
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background bg-dots">
      <aside className="fixed inset-y-0 right-0 hidden w-64 lg:block">{sidebar}</aside>
      <div className={cn("fixed inset-0 z-50 lg:hidden", open ? "pointer-events-auto" : "pointer-events-none")}>
        <div className={cn("absolute inset-0 bg-ink/50 transition-opacity", open ? "opacity-100" : "opacity-0")} onClick={() => setOpen(false)} />
        <aside className={cn("absolute inset-y-0 right-0 w-72 transition-transform duration-300", open ? "translate-x-0" : "translate-x-full")}>
          <button onClick={() => setOpen(false)} className="absolute left-3 top-5 z-10 text-sidebar-foreground" aria-label="بستن منو"><X className="h-5 w-5" /></button>
          {sidebar}
        </aside>
      </div>
      <div className="lg:pr-64">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/85 px-4 py-3 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="باز کردن منو" className="rounded-lg border p-2"><Menu className="h-5 w-5" /></button>
          <span className="font-extrabold">کمپ نخبگان</span>
          <LogoMark className="h-8 w-8" />
        </header>
        {config.dataMode === "demo" && (
          <div className="flex items-center gap-2 border-b bg-accent/20 px-4 py-2 text-xs text-accent-foreground">
            <FlaskConical className="h-3.5 w-3.5" /> حالت آزمایشی: اطلاعات فقط در همین مرورگر ذخیره می‌شود و هنوز به پایگاه داده متصل نیست.
          </div>
        )}
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-10">
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  );
}

export const privateHead = (title: string) => ({
  meta: [{ title: `${title} | کمپ نخبگان دانش‌آموزی` }, { name: "robots", content: "noindex, nofollow" }],
});
