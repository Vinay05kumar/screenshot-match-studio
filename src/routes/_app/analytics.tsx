import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChannelTable, ChannelVolumeChart, ConversionChart, LowStockPanel, RevenueChart, SummaryCards } from "@/components/dashboard/analytics";
import { DateRange, PageHeader } from "@/components/dashboard/shared";
import { Button } from "@/components/ui/button";
import { daysAgoISO, todayISO } from "@/lib/format";

export const Route = createFileRoute("/_app/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — ConnectSphere Admin" },
      { name: "description", content: "Channel performance, revenue and conversion analytics." },
      { property: "og:title", content: "Analytics — ConnectSphere Admin" },
      { property: "og:description", content: "Channel performance, revenue and conversion analytics." },
    ],
  }),
  component: Analytics,
});

function Analytics() {
  const [from, setFrom] = useState(daysAgoISO(29));
  const [to, setTo] = useState(todayISO());
  const params = { date_from: from || undefined, date_to: to || undefined };
  const preset = (d: number) => { setFrom(daysAgoISO(d - 1)); setTo(todayISO()); };
  return (
    <>
      <PageHeader
        title="Analytics"
        description="Cancelled orders are excluded from revenue and order counts. Dates are inclusive."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => preset(7)}>7d</Button>
            <Button variant="outline" size="sm" onClick={() => preset(30)}>30d</Button>
            <Button variant="outline" size="sm" onClick={() => preset(90)}>90d</Button>
            <Button variant="ghost" size="sm" onClick={() => { setFrom(""); setTo(""); }}>All time</Button>
            <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
          </>
        }
      />
      <SummaryCards params={params} />
      <div className="grid gap-4 lg:grid-cols-2">
        <ChannelVolumeChart params={params} />
        <RevenueChart params={params} />
        <ConversionChart params={params} />
        <LowStockPanel params={params} />
      </div>
      <ChannelTable params={params} />
    </>
  );
}
