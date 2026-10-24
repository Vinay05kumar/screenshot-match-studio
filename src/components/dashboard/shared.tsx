import { keepPreviousData, useQuery, type QueryKey } from "@tanstack/react-query";
import { AlertTriangle, ChevronLeft, ChevronRight, Inbox, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApiError } from "@/lib/api";
import type { EmailStatus, LeadStatus, OrderStatus, Source } from "@/lib/api/types";
import { LOW_STOCK_THRESHOLD } from "@/lib/api/types";
import { appConfig } from "@/lib/config";
import { cn } from "@/lib/utils";

/**
 * Polling query: refetches every pollIntervalMs only while the tab is visible
 * (react-query pauses intervals in background), refetches on focus, keeps the
 * previous page visible while filters change, and dedupes in-flight requests.
 */
export function usePolledQuery<T>(queryKey: QueryKey, queryFn: () => Promise<T>, enabled = true) {
  return useQuery({
    queryKey,
    queryFn,
    enabled,
    refetchInterval: appConfig.pollIntervalMs,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
    retry: (count, err) => !(err instanceof ApiError && [401, 404, 422].includes(err.status)) && count < 1,
  });
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.status) {
      case 401:
        return "Your session has expired. Please sign in again.";
      case 403:
        return "Security check failed. Please retry.";
      case 404:
        return err.message || "Not found.";
      case 409:
        return err.message || "That status change isn't allowed.";
      case 422:
        return err.message || "Please fix the highlighted fields.";
      case 429:
        return "Too many requests. Please wait a moment and try again.";
      default:
        return err.message || "Something went wrong.";
    }
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}

export function fieldError(err: unknown, field: string): string | undefined {
  return err instanceof ApiError ? err.fieldErrors?.[field]?.[0] : undefined;
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("animate-rise rounded-xl border bg-card shadow-card", className)}>
      {title && (
        <header className="flex items-center justify-between gap-2 border-b px-4 py-3 sm:px-5">
          <h2 className="text-sm font-semibold">{title}</h2>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function StatCard({ label, value, icon, hint, loading }: { label: string; value: ReactNode; icon: ReactNode; hint?: string; loading?: boolean }) {
  return (
    <div className="animate-rise group rounded-xl border bg-card p-4 shadow-card transition-shadow hover:shadow-elevated sm:p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</span>
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-24" />
      ) : (
        <div className="mt-3 font-display text-2xl font-semibold tabular sm:text-3xl">{value}</div>
      )}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function EmptyState({ title = "Nothing here yet", description }: { title?: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Inbox className="size-5" />
      </span>
      <p className="font-medium">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="size-5" />
      </span>
      <p className="font-medium">Couldn't load this data</p>
      <p className="max-w-sm text-sm text-muted-foreground">{errorMessage(error)}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="size-4" /> Try again
        </Button>
      )}
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-5 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function Pager({ page, pageSize, count, onPage, onPageSize }: { page: number; pageSize: number; count: number; onPage: (p: number) => void; onPageSize: (s: number) => void }) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  const from = count === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(count, page * pageSize);
  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t px-4 py-3 text-sm sm:flex-row">
      <span className="text-muted-foreground tabular">
        {from}–{to} of {count}
      </span>
      <div className="flex items-center gap-2">
        <Select value={String(pageSize)} onValueChange={(v) => onPageSize(Number(v))}>
          <SelectTrigger className="h-8 w-[110px]" aria-label="Rows per page">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[10, 20, 50, 100].map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n} / page
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" className="size-8" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
          <ChevronLeft className="size-4" />
        </Button>
        <span className="tabular min-w-16 text-center">
          {page} / {pages}
        </span>
        <Button variant="outline" size="icon" className="size-8" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export function FilterSelect<T extends string>({ value, onChange, options, label, allLabel = "All", format = (v: string) => v }: { value: T | "all"; onChange: (v: T | "all") => void; options: readonly T[]; label: string; allLabel?: string; format?: (v: string) => string }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as T | "all")}>
      <SelectTrigger className="h-9 w-full sm:w-[150px]" aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {format(o)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function DateRange({ from, to, onChange }: { from: string; to: string; onChange: (from: string, to: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Input type="date" aria-label="From date" value={from} max={to || undefined} onChange={(e) => onChange(e.target.value, to)} className="h-9 w-full sm:w-[150px]" />
      <span className="text-muted-foreground">–</span>
      <Input type="date" aria-label="To date" value={to} min={from || undefined} onChange={(e) => onChange(from, e.target.value)} className="h-9 w-full sm:w-[150px]" />
    </div>
  );
}

export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-2 border-b p-3 sm:flex-row sm:flex-wrap sm:items-center sm:p-4">{children}</div>;
}

// ---------- Badges ----------

export const SOURCE_LABEL: Record<Source, string> = {
  instagram: "Instagram",
  telegram: "Telegram",
  google_ads: "Google Ads",
  direct: "Direct",
  other: "Other",
};
export const sourceLabel = (s: string) => SOURCE_LABEL[s as Source] ?? s;
export const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const ORDER_VARIANT: Record<OrderStatus, "info" | "warning" | "accent" | "success" | "danger"> = {
  confirmed: "info",
  processing: "warning",
  shipped: "accent",
  delivered: "success",
  cancelled: "danger",
};
export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={ORDER_VARIANT[status]}>{titleCase(status)}</Badge>;
}

const LEAD_VARIANT: Record<LeadStatus, "info" | "warning" | "success" | "neutral"> = {
  new: "info",
  contacted: "warning",
  lost: "neutral",
  converted: "success",
};
export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return <Badge variant={LEAD_VARIANT[status]}>{titleCase(status)}</Badge>;
}

const EMAIL_VARIANT: Record<EmailStatus, "neutral" | "success" | "danger"> = { pending: "neutral", sent: "success", failed: "danger" };
export function EmailStatusBadge({ status }: { status: EmailStatus }) {
  return <Badge variant={EMAIL_VARIANT[status]}>Email {status}</Badge>;
}

export function ActiveBadge({ active, on = "Active", off = "Inactive" }: { active: boolean; on?: string; off?: string }) {
  return <Badge variant={active ? "success" : "neutral"}>{active ? on : off}</Badge>;
}

export function SourceBadge({ source }: { source: string }) {
  return <Badge variant="outline">{sourceLabel(source)}</Badge>;
}

export function StockBadge({ stock }: { stock: number }) {
  if (stock === 0) return <Badge variant="danger">Out of stock</Badge>;
  if (stock <= LOW_STOCK_THRESHOLD) return <Badge variant="warning">Low · {stock}</Badge>;
  return <span className="tabular">{stock}</span>;
}

export function MockBanner() {
  if (!appConfig.useMockApi) return null;
  return (
    <div className="border-b bg-accent px-4 py-1.5 text-center text-xs font-medium text-accent-foreground">
      Mock data mode — no real backend connected
    </div>
  );
}
