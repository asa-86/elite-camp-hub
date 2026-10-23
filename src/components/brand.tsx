import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("h-9 w-9", className)} aria-hidden="true">
      <defs>
        <linearGradient id="lg-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--accent)" />
          <stop offset="1" stopColor="var(--gold)" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="12" fill="var(--ink)" />
      <path d="M20 7l2.6 6.2 6.7.5-5.1 4.4 1.6 6.5L20 21.1l-5.8 3.5 1.6-6.5-5.1-4.4 6.7-.5z" fill="url(#lg-gold)" />
      <path d="M9 28c4-2 7.5-2 11 0 3.5-2 7-2 11 0v4c-4-2-7.5-2-11 0-3.5-2-7-2-11 0z" fill="var(--ink-foreground)" opacity=".9" />
    </svg>
  );
}

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label="آرما - خانه">
      <LogoMark />
      <span className={cn("leading-tight", light ? "text-ink-foreground" : "text-foreground")}>
        <span className="block text-[15px] font-extrabold">آرما</span>
        <span className={cn("block text-[11px] font-medium", light ? "text-ink-foreground/70" : "text-muted-foreground")}>
          کمپ نخبگان
        </span>
      </span>
    </Link>
  );
}
