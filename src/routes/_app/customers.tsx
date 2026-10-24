import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { SOURCES, type Source } from "@/lib/api/types";
import { formatDate, formatDateTime, formatINR } from "@/lib/format";
import { ActiveBadge, EmptyState, ErrorState, FilterBar, FilterSelect, LeadStatusBadge, OrderStatusBadge, PageHeader, Pager, Panel, SourceBadge, TableSkeleton, sourceLabel, usePolledQuery } from "@/components/dashboard/shared";
import { OrderDetailSheet } from "@/components/dashboard/OrderDetailSheet";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useDebounced } from "@/hooks/use-debounced";

export const Route = createFileRoute("/_app/customers")({
  head: () => ({
    meta: [
      { title: "Customers — ConnectSphere Admin" },
      { name: "description", content: "Customer profiles, order history and lead attribution." },
      { property: "og:title", content: "Customers — ConnectSphere Admin" },
      { property: "og:description", content: "Customer profiles, order history and lead attribution." },
    ],
  }),
  component: Customers,
});

function Customers() {
  const [search, setSearch] = useState("");
  const [source, setSource] = useState<Source | "all">("all");
  const [active, setActive] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [open, setOpen] = useState<number | null>(null);
  const [order, setOrder] = useState<string | null>(null);
  const s = useDebounced(search);
  const params = { page, page_size: pageSize, search: s || undefined, source: source === "all" ? undefined : source, is_active: active === "all" ? undefined : active === "active" };
  const list = usePolledQuery(["customers", "list", params], () => api.listCustomers(params));

  return (
    <>
      <PageHeader title="Customers" description="Read-only. Totals exclude cancelled orders." />
      <Panel>
        <FilterBar>
          <div className="relative flex-1 sm:min-w-[220px]">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Name, email or phone" className="h-9 pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <FilterSelect label="First source" allLabel="All sources" value={source} onChange={(v) => { setSource(v); setPage(1); }} options={SOURCES} format={sourceLabel} />
          <Select value={active} onValueChange={(v) => { setActive(v as typeof active); setPage(1); }}>
            <SelectTrigger className="h-9 sm:w-[150px]" aria-label="Account status"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All accounts</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
          </Select>
        </FilterBar>
        {list.isError && !list.data ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : !list.data ? <TableSkeleton /> : list.data.results.length === 0 ? <EmptyState title="No customers match" /> : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr className="border-b"><th className="px-4 py-2.5">Customer</th><th className="hidden px-4 py-2.5 md:table-cell">Phone</th><th className="px-4 py-2.5">Source</th><th className="px-4 py-2.5 text-right">Orders</th><th className="px-4 py-2.5 text-right">Spent</th><th className="hidden px-4 py-2.5 lg:table-cell">Last order</th><th className="hidden px-4 py-2.5 lg:table-cell">Joined</th><th className="hidden px-4 py-2.5 sm:table-cell">Account</th></tr>
                </thead>
                <tbody>
                  {list.data.results.map((c) => (
                    <tr key={c.id} onClick={() => setOpen(c.id)} className="cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/60">
                      <td className="px-4 py-3"><p className="font-medium">{c.name} <span className="font-mono text-xs text-muted-foreground">#{c.id}</span></p><p className="text-xs text-muted-foreground">{c.email}</p></td>
                      <td className="hidden px-4 py-3 md:table-cell">{c.phone}</td>
                      <td className="px-4 py-3"><SourceBadge source={c.first_source} /></td>
                      <td className="px-4 py-3 text-right tabular">{c.order_count}</td>
                      <td className="px-4 py-3 text-right tabular">{formatINR(c.total_spent)}</td>
                      <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">{formatDate(c.last_order_at)}</td>
                      <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">{formatDate(c.created_at)}</td>
                      <td className="hidden px-4 py-3 sm:table-cell"><ActiveBadge active={c.is_active} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={page} pageSize={pageSize} count={list.data.count} onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1); }} />
          </>
        )}
      </Panel>
      <CustomerSheet id={open} onClose={() => setOpen(null)} onOrder={setOrder} />
      <OrderDetailSheet orderRef={order} onClose={() => setOrder(null)} />
    </>
  );
}

function CustomerSheet({ id, onClose, onOrder }: { id: number | null; onClose: () => void; onOrder: (ref: string) => void }) {
  const q = useQuery({ queryKey: ["customers", "detail", id], queryFn: () => api.getCustomer(id!), enabled: id !== null });
  const c = q.data;
  return (
    <Sheet open={id !== null} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{c?.name ?? "Customer"}</SheetTitle>
          <SheetDescription>{c ? `${c.email} · ${c.phone}` : "Loading…"}</SheetDescription>
        </SheetHeader>
        {q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !c ? <div className="space-y-3 py-6"><Skeleton className="h-20" /><Skeleton className="h-40" /></div> : (
          <div className="space-y-6 py-4 text-sm">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Orders</p><p className="font-display text-xl font-semibold tabular">{c.order_count}</p></div>
              <div className="col-span-2 rounded-lg border p-3"><p className="text-xs text-muted-foreground">Total spent</p><p className="font-display text-xl font-semibold tabular">{formatINR(c.total_spent)}</p></div>
            </div>
            <div className="flex flex-wrap gap-2"><ActiveBadge active={c.is_active} /><SourceBadge source={c.first_source} /><span className="text-muted-foreground">Joined {formatDate(c.created_at)}</span></div>
            <section>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Orders</h3>
              {c.orders.length === 0 ? <p className="text-muted-foreground">No orders.</p> : (
                <ul className="divide-y rounded-lg border">
                  {c.orders.map((o) => (
                    <li key={o.ref}>
                      <button className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted" onClick={() => onOrder(o.ref)}>
                        <span><span className="font-mono text-xs font-medium">{o.ref}</span><span className="block text-xs text-muted-foreground">{formatDateTime(o.created_at)}</span></span>
                        <span className="flex items-center gap-2"><span className="tabular">{formatINR(o.total)}</span><OrderStatusBadge status={o.status} /></span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Lead record</h3>
              {!c.lead ? <p className="text-muted-foreground">No lead record.</p> : (
                <div className="space-y-1 rounded-lg border p-3">
                  <div className="flex items-center gap-2"><LeadStatusBadge status={c.lead.status} /><SourceBadge source={c.lead.source} /></div>
                  <p className="text-muted-foreground">{[c.lead.medium, c.lead.campaign].filter(Boolean).join(" · ") || "No campaign"}</p>
                  <p className="text-xs text-muted-foreground">First touch {formatDateTime(c.lead.first_touch_at)} · Converted {formatDateTime(c.lead.converted_at)}</p>
                  {c.lead.note && <p>{c.lead.note}</p>}
                </div>
              )}
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
