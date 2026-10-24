import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { ORDER_STATUSES, SOURCES, type OrderStatus, type Source } from "@/lib/api/types";
import { formatDateTime, formatINR } from "@/lib/format";
import { DateRange, EmailStatusBadge, EmptyState, ErrorState, FilterBar, FilterSelect, OrderStatusBadge, PageHeader, Pager, Panel, SourceBadge, TableSkeleton, sourceLabel, titleCase, usePolledQuery } from "@/components/dashboard/shared";
import { OrderDetailSheet } from "@/components/dashboard/OrderDetailSheet";
import { Input } from "@/components/ui/input";
import { useDebounced } from "@/hooks/use-debounced";

export const Route = createFileRoute("/_app/orders")({
  head: () => ({
    meta: [
      { title: "Orders — ConnectSphere Admin" },
      { name: "description", content: "Track and update storefront orders." },
      { property: "og:title", content: "Orders — ConnectSphere Admin" },
      { property: "og:description", content: "Track and update storefront orders." },
    ],
  }),
  component: Orders,
});

function Orders() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<OrderStatus | "all">("all");
  const [source, setSource] = useState<Source | "all">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [open, setOpen] = useState<string | null>(null);
  const q = useDebounced(search);
  const params = { page, page_size: pageSize, search: q || undefined, status: status === "all" ? undefined : status, source: source === "all" ? undefined : source, date_from: from || undefined, date_to: to || undefined };
  const list = usePolledQuery(["orders", "list", params], () => api.listOrders(params));
  const reset = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setPage(1); };

  return (
    <>
      <PageHeader title="Orders" description="Orders are placed on the storefront. Update status as they move." />
      <Panel>
        <FilterBar>
          <div className="relative flex-1 sm:min-w-[220px]">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Ref, name, email or phone" className="h-9 pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <FilterSelect label="Status" allLabel="All statuses" value={status} onChange={reset(setStatus)} options={ORDER_STATUSES} format={titleCase} />
          <FilterSelect label="Source" allLabel="All sources" value={source} onChange={reset(setSource)} options={SOURCES} format={sourceLabel} />
          <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); setPage(1); }} />
        </FilterBar>
        {list.isError && !list.data ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : !list.data ? <TableSkeleton /> : list.data.results.length === 0 ? <EmptyState title="No orders match" description="Try changing the filters." /> : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr className="border-b"><th className="px-4 py-2.5">Order</th><th className="px-4 py-2.5">Customer</th><th className="hidden px-4 py-2.5 md:table-cell">Date</th><th className="px-4 py-2.5 text-right">Total</th><th className="px-4 py-2.5">Status</th><th className="hidden px-4 py-2.5 lg:table-cell">Source</th><th className="hidden px-4 py-2.5 lg:table-cell">Email</th></tr>
                </thead>
                <tbody>
                  {list.data.results.map((o) => (
                    <tr key={o.ref} onClick={() => setOpen(o.ref)} className="cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/60">
                      <td className="px-4 py-3 font-mono text-xs font-medium">{o.ref}</td>
                      <td className="px-4 py-3"><p className="font-medium">{o.customer.name}</p><p className="text-xs text-muted-foreground">{o.customer.email}</p></td>
                      <td className="hidden whitespace-nowrap px-4 py-3 text-muted-foreground md:table-cell">{formatDateTime(o.created_at)}</td>
                      <td className="px-4 py-3 text-right tabular">{formatINR(o.total)}</td>
                      <td className="px-4 py-3"><OrderStatusBadge status={o.status} /></td>
                      <td className="hidden px-4 py-3 lg:table-cell"><SourceBadge source={o.source} /></td>
                      <td className="hidden px-4 py-3 lg:table-cell"><EmailStatusBadge status={o.email_status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={page} pageSize={pageSize} count={list.data.count} onPage={setPage} onPageSize={(s) => { setPageSize(s); setPage(1); }} />
          </>
        )}
      </Panel>
      <OrderDetailSheet orderRef={open} onClose={() => setOpen(null)} />
    </>
  );
}
