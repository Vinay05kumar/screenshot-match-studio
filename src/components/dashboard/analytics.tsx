import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { IndianRupee, Percent, ShoppingCart, Users, UsersRound } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { api } from "@/lib/api";
import type { AnalyticsParams } from "@/lib/api/types";
import { formatCompactINR, formatINR, formatRate } from "@/lib/format";
import { EmptyState, ErrorState, Panel, StatCard, StockBadge, TableSkeleton, sourceLabel, usePolledQuery } from "./shared";
import { Skeleton } from "@/components/ui/skeleton";

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const tooltipStyle = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 };

export function SummaryCards({ params }: { params: AnalyticsParams }) {
  const q = usePolledQuery(["analytics", "summary", params], () => api.analyticsSummary(params));
  if (q.isError && !q.data) return <Panel><ErrorState error={q.error} onRetry={() => q.refetch()} /></Panel>;
  const d = q.data;
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
      <StatCard label="Leads" loading={!d} value={d?.leads.toLocaleString("en-IN")} icon={<UsersRound className="size-4" />} />
      <StatCard label="Customers" loading={!d} value={d?.customers.toLocaleString("en-IN")} icon={<Users className="size-4" />} />
      <StatCard label="Orders" loading={!d} value={d?.orders.toLocaleString("en-IN")} icon={<ShoppingCart className="size-4" />} hint="Excludes cancelled" />
      <StatCard label="Revenue" loading={!d} value={d && formatCompactINR(d.revenue)} icon={<IndianRupee className="size-4" />} hint={d ? formatINR(d.revenue) : undefined} />
      <StatCard label="Conversion" loading={!d} value={d && formatRate(d.conversion_rate)} icon={<Percent className="size-4" />} hint="Leads → customers" />
    </div>
  );
}

function useSources(params: AnalyticsParams) {
  return usePolledQuery(["analytics", "sources", params], () => api.analyticsSources(params));
}

export function ChannelVolumeChart({ params }: { params: AnalyticsParams }) {
  const q = useSources(params);
  const data = q.data?.map((s) => ({ name: sourceLabel(s.source), Leads: s.leads, Orders: s.orders }));
  return (
    <Panel title="Leads & orders by channel">
      <div className="h-72 p-3">
        {q.isError && !q.data ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !data ? <Skeleton className="h-full w-full" /> : (
          <ResponsiveContainer>
            <BarChart data={data} margin={{ left: -16 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Leads" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Orders" fill="var(--chart-4)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Panel>
  );
}

export function RevenueChart({ params }: { params: AnalyticsParams }) {
  const q = useSources(params);
  const data = q.data?.map((s) => ({ name: sourceLabel(s.source), value: Number.parseFloat(s.revenue) })).filter((d) => d.value > 0);
  return (
    <Panel title="Revenue by channel">
      <div className="h-72 p-3">
        {q.isError && !q.data ? <ErrorState error={q.error} /> : !data ? <Skeleton className="h-full w-full" /> : data.length === 0 ? <EmptyState title="No revenue in this range" /> : (
          <ResponsiveContainer>
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={2}>
                {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatINR(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </Panel>
  );
}

export function ConversionChart({ params }: { params: AnalyticsParams }) {
  const q = useSources(params);
  const data = q.data?.map((s) => ({ name: sourceLabel(s.source), rate: +(s.conversion_rate * 100).toFixed(1) }));
  return (
    <Panel title="Conversion rate by channel">
      <div className="h-72 p-3">
        {!data ? <Skeleton className="h-full w-full" /> : (
          <ResponsiveContainer>
            <BarChart data={data} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid horizontal={false} stroke="var(--border)" />
              <XAxis type="number" unit="%" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} fontSize={12} width={80} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v}%`} cursor={{ fill: "var(--muted)" }} />
              <Bar dataKey="rate" name="Conversion" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Panel>
  );
}

export function ChannelTable({ params }: { params: AnalyticsParams }) {
  const q = useSources(params);
  return (
    <Panel title="Channel breakdown">
      {!q.data ? <TableSkeleton rows={5} /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr className="border-b"><th className="px-4 py-2.5">Channel</th><th className="px-4 py-2.5 text-right">Leads</th><th className="px-4 py-2.5 text-right">Orders</th><th className="px-4 py-2.5 text-right">Revenue</th><th className="px-4 py-2.5 text-right">Conversion</th></tr>
            </thead>
            <tbody className="tabular">
              {q.data.map((s) => (
                <tr key={s.source} className="border-b last:border-0">
                  <td className="px-4 py-2.5 font-medium">{sourceLabel(s.source)}</td>
                  <td className="px-4 py-2.5 text-right">{s.leads}</td>
                  <td className="px-4 py-2.5 text-right">{s.orders}</td>
                  <td className="px-4 py-2.5 text-right">{formatINR(s.revenue)}</td>
                  <td className="px-4 py-2.5 text-right">{formatRate(s.conversion_rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

export function LowStockPanel({ params }: { params: AnalyticsParams }) {
  const q = usePolledQuery(["analytics", "low-stock", params], () => api.analyticsLowStock(params));
  return (
    <Panel title="Low stock (≤ 5 units)" action={<Link to="/inventory" className="text-xs font-medium text-primary hover:underline">Inventory →</Link>}>
      {q.isError && !q.data ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !q.data ? <TableSkeleton rows={4} cols={3} /> : q.data.length === 0 ? <EmptyState title="All stocked up" description="No products at or below five units." /> : (
        <ul className="divide-y">
          {q.data.map((p) => (
            <li key={p.sku} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{p.name}</p>
                <p className="font-mono text-xs text-muted-foreground">{p.sku} · {p.category}</p>
              </div>
              <StockBadge stock={p.stock} />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
