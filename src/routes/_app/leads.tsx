import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Lock, Search } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { LEAD_STATUSES, SOURCES, type Lead, type LeadStatus, type Source } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { DateRange, EmptyState, ErrorState, FilterBar, FilterSelect, LeadStatusBadge, PageHeader, Pager, Panel, SourceBadge, TableSkeleton, errorMessage, fieldError, sourceLabel, titleCase, usePolledQuery } from "@/components/dashboard/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDebounced } from "@/hooks/use-debounced";

export const Route = createFileRoute("/_app/leads")({
  head: () => ({
    meta: [
      { title: "Leads — ConnectSphere Admin" },
      { name: "description", content: "Follow up on leads from every channel." },
      { property: "og:title", content: "Leads — ConnectSphere Admin" },
      { property: "og:description", content: "Follow up on leads from every channel." },
    ],
  }),
  component: Leads,
});

function Leads() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<LeadStatus | "all">("all");
  const [source, setSource] = useState<Source | "all">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [editing, setEditing] = useState<Lead | null>(null);
  const s = useDebounced(search);
  const params = { page, page_size: pageSize, search: s || undefined, status: status === "all" ? undefined : status, source: source === "all" ? undefined : source, date_from: from || undefined, date_to: to || undefined };
  const list = usePolledQuery(["leads", "list", params], () => api.listLeads(params));
  const reset = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setPage(1); };

  return (
    <>
      <PageHeader title="Leads" description="Leads convert automatically when they place their first order." />
      <Panel>
        <FilterBar>
          <div className="relative flex-1 sm:min-w-[200px]">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Name, email or phone" className="h-9 pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <FilterSelect label="Status" allLabel="All statuses" value={status} onChange={reset(setStatus)} options={LEAD_STATUSES} format={titleCase} />
          <FilterSelect label="Source" allLabel="All sources" value={source} onChange={reset(setSource)} options={SOURCES} format={sourceLabel} />
          <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); setPage(1); }} />
        </FilterBar>
        {list.isError && !list.data ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : !list.data ? <TableSkeleton /> : list.data.results.length === 0 ? <EmptyState title="No leads match" /> : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr className="border-b"><th className="px-4 py-2.5">Lead</th><th className="px-4 py-2.5">Source</th><th className="hidden px-4 py-2.5 lg:table-cell">Campaign</th><th className="px-4 py-2.5">Status</th><th className="hidden px-4 py-2.5 md:table-cell">First touch</th><th className="hidden px-4 py-2.5 text-right md:table-cell">Orders</th></tr>
                </thead>
                <tbody>
                  {list.data.results.map((l) => (
                    <tr key={l.id} onClick={() => setEditing(l)} className="cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/60">
                      <td className="px-4 py-3"><p className="font-medium">{l.name}</p><p className="text-xs text-muted-foreground">{l.email ?? l.phone ?? "—"}</p></td>
                      <td className="px-4 py-3"><SourceBadge source={l.source} />{l.medium && <p className="mt-1 text-xs text-muted-foreground">{l.medium}</p>}</td>
                      <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">{l.campaign ?? "—"}</td>
                      <td className="px-4 py-3"><LeadStatusBadge status={l.status} /></td>
                      <td className="hidden whitespace-nowrap px-4 py-3 text-muted-foreground md:table-cell">{formatDateTime(l.first_touch_at)}</td>
                      <td className="hidden px-4 py-3 text-right tabular md:table-cell">{l.order_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={page} pageSize={pageSize} count={list.data.count} onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1); }} />
          </>
        )}
      </Panel>
      {editing && <LeadDialog lead={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

const EDITABLE = ["new", "contacted", "lost"] as const;

function LeadDialog({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const qc = useQueryClient();
  const locked = lead.status === "converted";
  const [status, setStatus] = useState<(typeof EDITABLE)[number] | "converted">(lead.status);
  const [note, setNote] = useState(lead.note ?? "");
  const save = useMutation({
    mutationFn: () => api.updateLead(lead.id, locked ? { note } : { status: status as (typeof EDITABLE)[number], note }),
    onSuccess: (l) => { toast.success(`${l.name} updated`); qc.invalidateQueries({ queryKey: ["leads"] }); onClose(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const submit = (e: FormEvent) => { e.preventDefault(); save.mutate(); };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{lead.name}</DialogTitle>
          <DialogDescription>{[lead.email, lead.phone].filter(Boolean).join(" · ") || "No contact details"}</DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-2 gap-3 rounded-lg bg-muted p-3 text-sm">
          <div><dt className="text-xs text-muted-foreground">Source</dt><dd>{sourceLabel(lead.source)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Medium</dt><dd>{lead.medium ?? "—"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Campaign</dt><dd>{lead.campaign ?? "—"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Orders</dt><dd className="tabular">{lead.order_count}</dd></div>
          <div><dt className="text-xs text-muted-foreground">First touch</dt><dd>{formatDateTime(lead.first_touch_at)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Converted</dt><dd>{formatDateTime(lead.converted_at)}</dd></div>
        </dl>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Status</Label>
            {locked ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground"><Lock className="size-4" /> <LeadStatusBadge status="converted" /> Converted leads can't change status.</p>
            ) : (
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EDITABLE.map((s) => <SelectItem key={s} value={s}>{titleCase(s)}</SelectItem>)}</SelectContent>
              </Select>
            )}
            {fieldError(save.error, "status") && <p className="text-xs text-destructive">{fieldError(save.error, "status")}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="note">Note</Label>
            <Textarea id="note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
            {fieldError(save.error, "note") && <p className="text-xs text-destructive">{fieldError(save.error, "note")}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending && <Loader2 className="size-4 animate-spin" />} Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
