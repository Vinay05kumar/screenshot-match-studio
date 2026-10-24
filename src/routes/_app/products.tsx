import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImageOff, Loader2, Pencil, Plus, Search } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { Product } from "@/lib/api/types";
import { formatINR } from "@/lib/format";
import { ActiveBadge, EmptyState, ErrorState, FilterBar, PageHeader, Pager, Panel, StockBadge, TableSkeleton, errorMessage, fieldError, usePolledQuery } from "@/components/dashboard/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useDebounced } from "@/hooks/use-debounced";

export const Route = createFileRoute("/_app/products")({
  head: () => ({
    meta: [
      { title: "Products — ConnectSphere Admin" },
      { name: "description", content: "Manage the ConnectSphere product catalogue." },
      { property: "og:title", content: "Products — ConnectSphere Admin" },
      { property: "og:description", content: "Manage the ConnectSphere product catalogue." },
    ],
  }),
  component: Products,
});

function Products() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [active, setActive] = useState<"all" | "active" | "inactive">("all");
  const [lowStock, setLowStock] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [deactivating, setDeactivating] = useState<Product | null>(null);
  const s = useDebounced(search);
  const c = useDebounced(category);
  const params = { page, page_size: pageSize, search: s || undefined, category: c || undefined, is_active: active === "all" ? undefined : active === "active", low_stock: lowStock || undefined };
  const list = usePolledQuery(["products", "list", params], () => api.listProducts(params));

  const deactivate = useMutation({
    mutationFn: (p: Product) => api.updateProduct(p.sku, { name: p.name, description: p.description, category: p.category, price: p.price, image_url: p.image_url, is_active: false }),
    onSuccess: (p) => { toast.success(`${p.name} deactivated`); qc.invalidateQueries({ queryKey: ["products"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <>
      <PageHeader title="Products" description="Products can be deactivated but not deleted." actions={<Button onClick={() => setEditing("new")}><Plus className="size-4" /> New product</Button>} />
      <Panel>
        <FilterBar>
          <div className="relative flex-1 sm:min-w-[200px]">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search SKU or name" className="h-9 pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <Input placeholder="Category" className="h-9 sm:w-[160px]" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} />
          <Select value={active} onValueChange={(v) => { setActive(v as typeof active); setPage(1); }}>
            <SelectTrigger className="h-9 sm:w-[140px]" aria-label="Active filter"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All products</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-sm"><Switch checked={lowStock} onCheckedChange={(v) => { setLowStock(v); setPage(1); }} /> Low stock only</label>
        </FilterBar>
        {list.isError && !list.data ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : !list.data ? <TableSkeleton /> : list.data.results.length === 0 ? <EmptyState title="No products match" /> : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr className="border-b"><th className="px-4 py-2.5">Product</th><th className="hidden px-4 py-2.5 md:table-cell">Category</th><th className="px-4 py-2.5 text-right">Price</th><th className="px-4 py-2.5 text-right">Stock</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5" /></tr>
                </thead>
                <tbody>
                  {list.data.results.map((p) => (
                    <tr key={p.sku} className="border-b transition-colors last:border-0 hover:bg-muted/60">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                            {p.image_url ? <img src={p.image_url} alt="" className="size-full object-cover" loading="lazy" /> : <ImageOff className="size-4 text-muted-foreground" />}
                          </div>
                          <div className="min-w-0"><p className="truncate font-medium">{p.name}</p><p className="font-mono text-xs text-muted-foreground">{p.sku}</p></div>
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">{p.category}</td>
                      <td className="px-4 py-3 text-right tabular">{formatINR(p.price)}</td>
                      <td className="px-4 py-3 text-right"><StockBadge stock={p.stock} /></td>
                      <td className="px-4 py-3"><ActiveBadge active={p.is_active} /></td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => setEditing(p)}><Pencil className="size-4" /> Edit</Button>
                        {p.is_active && <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeactivating(p)}>Deactivate</Button>}
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
      {editing && <ProductForm product={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      <AlertDialog open={!!deactivating} onOpenChange={(v) => !v && setDeactivating(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate {deactivating?.name}?</AlertDialogTitle>
            <AlertDialogDescription>It will be hidden from the storefront. You can reactivate it later by editing it.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deactivating && deactivate.mutate(deactivating)}>Deactivate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ProductForm({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const qc = useQueryClient();
  const isNew = !product;
  // Form state is captured once on open so background refreshes never overwrite edits.
  const [f, setF] = useState({
    sku: product?.sku ?? "",
    name: product?.name ?? "",
    description: product?.description ?? "",
    category: product?.category ?? "",
    price: product?.price ?? "",
    image_url: product?.image_url ?? "",
    stock: String(product?.stock ?? 0),
    is_active: product?.is_active ?? true,
  });
  const set = (k: keyof typeof f) => (v: string | boolean) => setF((p) => ({ ...p, [k]: v }));
  const save = useMutation({
    mutationFn: () => {
      const common = { name: f.name.trim(), description: f.description, category: f.category.trim(), price: f.price.trim(), image_url: f.image_url.trim() || null, is_active: f.is_active };
      return isNew ? api.createProduct({ ...common, sku: f.sku.trim(), stock: Number(f.stock) }) : api.updateProduct(product.sku, common);
    },
    onSuccess: (p) => { toast.success(isNew ? `${p.name} created` : `${p.name} saved`); qc.invalidateQueries({ queryKey: ["products"] }); onClose(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const err = (k: string) => fieldError(save.error, k);
  const submit = (e: FormEvent) => { e.preventDefault(); save.mutate(); };

  const field = (k: keyof typeof f, label: string, props: Record<string, unknown> = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={k}>{label}</Label>
      <Input id={k} value={f[k] as string} onChange={(e) => set(k)(e.target.value)} {...props} />
      {err(k) && <p className="text-xs text-destructive">{err(k)}</p>}
    </div>
  );

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isNew ? "New product" : `Edit ${product.name}`}</DialogTitle>
          <DialogDescription>{isNew ? "SKU and opening stock can't be changed here later." : "SKU and stock can't be edited here. Use Inventory for stock."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            {isNew ? field("sku", "SKU") : <div className="space-y-1.5"><Label>SKU</Label><Input value={f.sku} disabled /></div>}
            {field("category", "Category")}
          </div>
          {field("name", "Name")}
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={3} value={f.description} onChange={(e) => set("description")(e.target.value)} />
            {err("description") && <p className="text-xs text-destructive">{err("description")}</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {field("price", "Price (INR)", { inputMode: "decimal", placeholder: "1299.00" })}
            {isNew ? field("stock", "Opening stock", { type: "number", min: 0 }) : <div className="space-y-1.5"><Label>Stock</Label><Input value={f.stock} disabled /></div>}
          </div>
          {field("image_url", "Image URL", { type: "url", placeholder: "https://…" })}
          <label className="flex items-center gap-2 text-sm"><Switch checked={f.is_active} onCheckedChange={set("is_active")} /> Active</label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending && <Loader2 className="size-4 animate-spin" />} {isNew ? "Create" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
