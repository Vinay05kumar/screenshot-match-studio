import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Loader2, PackagePlus, Search } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { LOW_STOCK_THRESHOLD, type Product, type StockMode, type StockUpdateInput } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { appConfig } from "@/lib/config";
import { EmptyState, ErrorState, FilterBar, PageHeader, Pager, Panel, StockBadge, TableSkeleton, errorMessage, fieldError, usePolledQuery } from "@/components/dashboard/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useDebounced } from "@/hooks/use-debounced";

export const Route = createFileRoute("/_app/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory — ConnectSphere Admin" },
      { name: "description", content: "Stock levels, updates and movement history." },
      { property: "og:title", content: "Inventory — ConnectSphere Admin" },
      { property: "og:description", content: "Stock levels, updates and movement history." },
    ],
  }),
  component: Inventory,
});

function Inventory() {
  const [search, setSearch] = useState("");
  const [lowStock, setLowStock] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [adjust, setAdjust] = useState<Product | null>(null);
  const [history, setHistory] = useState<Product | null>(null);
  const s = useDebounced(search);
  const params = { page, page_size: pageSize, search: s || undefined, low_stock: lowStock || undefined };
  const list = usePolledQuery(["products", "inventory", params], () => api.listProducts(params));

  return (
    <>
      <PageHeader title="Inventory" description={`Stock at or below ${LOW_STOCK_THRESHOLD} units is flagged as low.`} />
      <Panel>
        <FilterBar>
          <div className="relative flex-1 sm:min-w-[220px]">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search SKU or name" className="h-9 pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <label className="flex items-center gap-2 text-sm"><Switch checked={lowStock} onCheckedChange={(v) => { setLowStock(v); setPage(1); }} /> Low stock only</label>
        </FilterBar>
        {list.isError && !list.data ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : !list.data ? <TableSkeleton /> : list.data.results.length === 0 ? <EmptyState title="No products match" /> : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr className="border-b"><th className="px-4 py-2.5">Product</th><th className="hidden px-4 py-2.5 sm:table-cell">Category</th><th className="px-4 py-2.5 text-right">Stock</th><th className="px-4 py-2.5" /></tr>
                </thead>
                <tbody>
                  {list.data.results.map((p) => (
                    <tr key={p.sku} className={cn("border-b transition-colors last:border-0 hover:bg-muted/60", p.stock <= LOW_STOCK_THRESHOLD && "bg-warning/5")}>
                      <td className="px-4 py-3"><p className="font-medium">{p.name}</p><p className="font-mono text-xs text-muted-foreground">{p.sku}{!p.is_active && " · inactive"}</p></td>
                      <td className="hidden px-4 py-3 sm:table-cell">{p.category}</td>
                      <td className="px-4 py-3 text-right font-medium"><StockBadge stock={p.stock} /></td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => setHistory(p)}><History className="size-4" /> <span className="hidden sm:inline">History</span></Button>
                        <Button variant="outline" size="sm" onClick={() => setAdjust(p)}><PackagePlus className="size-4" /> <span className="hidden sm:inline">Update</span></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={page} pageSize={pageSize} count={list.data.count} onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1); }} />
          </>
        )}
      </Panel>
      {adjust && <StockDialog product={adjust} onClose={() => setAdjust(null)} />}
      <MovementsSheet product={history} onClose={() => setHistory(null)} />
    </>
  );
}

function StockDialog({ product, onClose }: { product: Product; onClose: () => void }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<StockMode>("add");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const qty = Number(quantity);
  const save = useMutation({
    mutationFn: (input: StockUpdateInput) => api.updateStock(product.sku, input),
    onSuccess: (r) => {
      toast.success(`${r.sku} stock is now ${r.stock} (${r.movement.change >= 0 ? "+" : ""}${r.movement.change})`);
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
      qc.invalidateQueries({ queryKey: ["movements", product.sku] });
      onClose();
    },
    onError: (e) => { setConfirm(false); toast.error(errorMessage(e)); },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!Number.isInteger(qty) || quantity.trim() === "") return setLocalError("Enter a whole number.");
    if (mode === "add" && qty === 0) return setLocalError("Quantity to add can't be zero.");
    if (mode === "set" && qty < 0) return setLocalError("Stock can't be negative.");
    if (!reason.trim()) return setLocalError("A reason is required.");
    setLocalError(null);
    setConfirm(true);
  };
  const err = (k: string) => fieldError(save.error, k);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Update stock</DialogTitle>
          <DialogDescription>{product.name} · currently <span className="font-semibold tabular">{product.stock}</span> units</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Tabs value={mode} onValueChange={(v) => setMode(v as StockMode)}>
            <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="add">Add / remove</TabsTrigger><TabsTrigger value="set">Set exact</TabsTrigger></TabsList>
          </Tabs>
          <div className="space-y-1.5">
            <Label htmlFor="qty">{mode === "add" ? "Change (use negative to remove)" : "New stock level"}</Label>
            <Input id="qty" type="number" step={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            {err("quantity") && <p className="text-xs text-destructive">{err("quantity")}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reason">Reason</Label>
            <Input id="reason" placeholder="e.g. restock, damaged, recount" value={reason} onChange={(e) => setReason(e.target.value)} />
            {err("reason") && <p className="text-xs text-destructive">{err("reason")}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="note">Note (optional)</Label>
            <Textarea id="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {localError && <p className="text-sm text-destructive">{localError}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending && <Loader2 className="size-4 animate-spin" />} Review</Button>
          </DialogFooter>
        </form>
      </DialogContent>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm stock update</AlertDialogTitle>
            <AlertDialogDescription>
              {mode === "add" ? `${qty >= 0 ? "Add" : "Remove"} ${Math.abs(qty)} units ${qty >= 0 ? "to" : "from"} ${product.name}.` : `Set ${product.name} stock to ${qty} units.`} The server will calculate and record the final stock.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Back</AlertDialogCancel>
            <AlertDialogAction onClick={() => save.mutate({ mode, quantity: qty, reason: reason.trim(), note: note.trim() || undefined })}>Update stock</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

function MovementsSheet({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const q = useQuery({
    queryKey: ["movements", product?.sku, page, pageSize],
    queryFn: () => api.listMovements(product!.sku, { page, page_size: pageSize }),
    enabled: !!product,
    refetchInterval: appConfig.pollIntervalMs,
  });
  return (
    <Sheet open={!!product} onOpenChange={(v) => { if (!v) { onClose(); setPage(1); } }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Stock movements</SheetTitle>
          <SheetDescription>{product?.name} · <span className="font-mono">{product?.sku}</span></SheetDescription>
        </SheetHeader>
        {q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !q.data ? <TableSkeleton rows={5} cols={3} /> : q.data.results.length === 0 ? <EmptyState title="No movements yet" /> : (
          <>
            <ol className="mt-4 space-y-3">
              {q.data.results.map((m) => (
                <li key={m.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className={cn("font-mono font-semibold", m.change >= 0 ? "text-success" : "text-destructive")}>{m.change >= 0 ? "+" : ""}{m.change}</span>
                    <span className="text-xs text-muted-foreground">{formatDateTime(m.created_at)}</span>
                  </div>
                  <p className="mt-1">{m.reason} <span className="text-muted-foreground">→ {m.stock_after} in stock</span></p>
                  {m.note && <p className="mt-1 text-muted-foreground">{m.note}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">{m.staff}{m.order_ref && <> · order <span className="font-mono">{m.order_ref}</span></>}</p>
                </li>
              ))}
            </ol>
            <Pager page={page} pageSize={pageSize} count={q.data.count} onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1); }} />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
