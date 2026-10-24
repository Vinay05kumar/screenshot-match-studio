import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { api } from "@/lib/api";
import { formatDateTime, formatINR } from "@/lib/format";
import { ChannelVolumeChart, LowStockPanel, RevenueChart, SummaryCards } from "@/components/dashboard/analytics";
import { DateRange, EmptyState, LeadStatusBadge, OrderStatusBadge, PageHeader, Panel, SourceBadge, TableSkeleton, usePolledQuery } from "@/components/dashboard/shared";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/overview")({
  head: () => ({
    meta: [
      { title: "Overview — ConnectSphere Admin" },
      { name: "description", content: "Leads, customers, orders and revenue at a glance." },
      { property: "og:title", content: "Overview — ConnectSphere Admin" },
      { property: "og:description", content: "Leads, customers, orders and revenue at a glance." },
    ],
  }),
  component: Overview,
});

function Overview() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const params = { date_from: from || undefined, date_to: to || undefined };
  const orders = usePolledQuery(["orders", "recent"], () => api.listOrders({ page: 1, page_size: 5 }));
  const leads = usePolledQuery(["leads", "recent"], () => api.listLeads({ page: 1, page_size: 5 }));

  return (
    <>
      <PageHeader
        title="Overview"
        description="A snapshot of every channel."
        actions={
          <>
            <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
            {(from || to) && <Button variant="ghost" size="sm" onClick={() => { setFrom(""); setTo(""); }}>Clear</Button>}
          </>
        }
      />
      <SummaryCards params={params} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2"><ChannelVolumeChart params={params} /></div>
        <RevenueChart params={params} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Recent orders" className="lg:col-span-2" action={<Link to="/orders" className="text-xs font-medium text-primary hover:underline">All orders →</Link>}>
          {!orders.data ? <TableSkeleton rows={5} cols={4} /> : orders.data.results.length === 0 ? <EmptyState title="No orders yet" /> : (
            <ul className="divide-y">
              {orders.data.results.map((o) => (
                <li key={o.ref} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-medium">{o.ref}</p>
                    <p className="truncate text-muted-foreground">{o.customer.name} · {formatDateTime(o.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="hidden tabular sm:inline">{formatINR(o.total)}</span>
                    <OrderStatusBadge status={o.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <LowStockPanel params={params} />
      </div>
      <Panel title="Recent leads" action={<Link to="/leads" className="text-xs font-medium text-primary hover:underline">All leads →</Link>}>
        {!leads.data ? <TableSkeleton rows={5} cols={4} /> : leads.data.results.length === 0 ? <EmptyState title="No leads yet" /> : (
          <ul className="divide-y">
            {leads.data.results.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{l.name}</p>
                  <p className="truncate text-muted-foreground">{l.email ?? l.phone ?? "—"} · {formatDateTime(l.first_touch_at)}</p>
                </div>
                <div className="flex items-center gap-2"><SourceBadge source={l.source} /><LeadStatusBadge status={l.status} /></div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
