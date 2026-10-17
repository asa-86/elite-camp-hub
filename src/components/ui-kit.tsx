import type { ReactNode } from "react";
import { AlertTriangle, Inbox, Loader2, ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatNumberFa } from "@/lib/jalali";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between animate-rise">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ children, className, title, action }: { children: ReactNode; className?: string; title?: string; action?: ReactNode }) {
  return (
    <section className={cn("rounded-2xl border bg-card p-5 shadow-soft animate-rise", className)}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-2">
          {title && <h2 className="text-base font-bold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatCard({ label, value, icon, tone = "primary", hint }: {
  label: string; value: number | string; icon: ReactNode; tone?: "primary" | "gold" | "success" | "danger"; hint?: string;
}) {
  const tones = {
    primary: "bg-primary/10 text-primary",
    gold: "bg-accent/25 text-accent-foreground",
    success: "bg-success/15 text-success",
    danger: "bg-destructive/10 text-destructive",
  };
  return (
    <div className="group relative overflow-hidden rounded-2xl border bg-card p-4 shadow-soft transition-transform hover:-translate-y-0.5 animate-rise">
      <div className="absolute -left-6 -top-6 h-20 w-20 rounded-full bg-accent/10 transition-transform group-hover:scale-125" />
      <div className={cn("mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl", tones[tone])}>{icon}</div>
      <div className="text-2xl font-extrabold">{typeof value === "number" ? formatNumberFa(value) : value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function Loading({ label = "در حال بارگذاری…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground" role="status">
      <Loader2 className="h-4 w-4 animate-spin" /> {label}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center" role="alert">
      <AlertTriangle className="h-6 w-6 text-destructive" />
      <p className="text-sm">{error instanceof Error ? error.message : "خطایی رخ داد."}</p>
      {onRetry && <Button variant="outline" size="sm" onClick={onRetry}>تلاش دوباره</Button>}
    </div>
  );
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed bg-muted/40 p-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/20 text-accent-foreground"><Inbox className="h-5 w-5" /></div>
      <p className="font-bold">{title}</p>
      {text && <p className="max-w-sm text-sm text-muted-foreground">{text}</p>}
      {action}
    </div>
  );
}

export function Pill({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "success" | "danger" | "warning" | "primary" | "gold" }) {
  const tones = {
    muted: "bg-muted text-muted-foreground",
    success: "bg-success/15 text-success",
    danger: "bg-destructive/10 text-destructive",
    warning: "bg-warning/25 text-warning-foreground",
    primary: "bg-primary/10 text-primary",
    gold: "bg-accent/30 text-accent-foreground",
  };
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone])}>{children}</span>;
}

export function Pager({ page, total, pageSize, onChange }: { page: number; total: number; pageSize: number; onChange: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-center gap-2 text-sm">
      <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="صفحه قبل"><ChevronRight className="h-4 w-4" /></Button>
      <span>صفحه {formatNumberFa(page)} از {formatNumberFa(pages)}</span>
      <Button variant="outline" size="icon" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="صفحه بعد"><ChevronLeft className="h-4 w-4" /></Button>
    </div>
  );
}

/** Table on desktop, stacked cards on mobile. */
export function DataList<T>({ rows, columns, rowKey, empty }: {
  rows: T[]; rowKey: (r: T) => string; empty?: ReactNode;
  columns: { header: string; cell: (r: T) => ReactNode; className?: string; primary?: boolean }[];
}) {
  if (!rows.length) return <>{empty ?? <EmptyState title="موردی یافت نشد" />}</>;
  return (
    <>
      <div className="hidden overflow-x-auto rounded-xl border md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-muted-foreground">
            <tr>{columns.map((c) => <th key={c.header} className="px-4 py-3 text-right font-semibold">{c.header}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={rowKey(r)} className="border-t transition-colors hover:bg-muted/30">
                {columns.map((c) => <td key={c.header} className={cn("px-4 py-3", c.className)}>{c.cell(r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-3 md:hidden">
        {rows.map((r) => (
          <li key={rowKey(r)} className="rounded-xl border bg-card p-4">
            {columns.map((c) => (
              <div key={c.header} className={cn("flex items-center justify-between gap-3 py-1 text-sm", c.primary && "mb-1 text-base font-bold")}>
                {!c.primary && <span className="text-muted-foreground">{c.header}</span>}
                <span className={cn(c.primary && "w-full")}>{c.cell(r)}</span>
              </div>
            ))}
          </li>
        ))}
      </ul>
    </>
  );
}

export function Field({ label, children, error, hint }: { label: string; children: ReactNode; error?: string; hint?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold">{label}</span>
      {children}
      {hint && !error && <span className="block text-xs text-muted-foreground">{hint}</span>}
      {error && <span className="block text-xs text-destructive">{error}</span>}
    </label>
  );
}

export const selectCls =
  "h-9 w-full rounded-md border border-input bg-card px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
