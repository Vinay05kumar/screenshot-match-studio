import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Mail } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { ORDER_STATUS_TRANSITIONS, type OrderStatus } from "@/lib/api/types";
import { formatDateTime, formatINR } from "@/lib/format";
import { appConfig } from "@/lib/config";
import { EmailStatusBadge, ErrorState, OrderStatusBadge, SourceBadge, errorMessage, titleCase } from "./shared";

export function OrderDetailSheet({ orderRef, onClose }: { orderRef: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [pending, setPending] = useState<OrderStatus | null>(null);
  const q = useQuery({
    queryKey: ["orders", "detail", orderRef],
    queryFn: () => api.getOrder(orderRef!),
    enabled: !!orderRef,
    refetchInterval: appConfig.pollIntervalMs,
  });
  const status = useMutation({
    mutationFn: (s: OrderStatus) => api.updateOrderStatus(orderRef!, s),
    onSuccess: (o) => {
      toast.success(`Order ${o.ref} marked ${o.status}`);
      qc.setQueryData(["orders", "detail", orderRef], o);
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
      if (o.status === "cancelled") qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e) => {
      toast.error(errorMessage(e));
      qc.invalidateQueries({ queryKey: ["orders", "detail", orderRef] });
    },
    onSettled: () => setPending(null),
  });
  const resend = useMutation({
    mutationFn: () => api.resendOrderEmail(orderRef!),
    onSuccess: (r) => {
      toast.success(r.detail);
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const o = q.data;
  const next = o ? ORDER_STATUS_TRANSITIONS[o.status] : [];

  return (
    <Sheet open={!!orderRef} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="font-mono">{orderRef}</SheetTitle>
          <SheetDescription>{o ? formatDateTime(o.created_at) : "Loading order…"}</SheetDescription>
        </SheetHeader>
        {q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !o ? (
          <div className="space-y-3 py-6"><Skeleton className="h-6 w-1/2" /><Skeleton className="h-24" /><Skeleton className="h-40" /></div>
        ) : (
          <div className="space-y-6 py-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <OrderStatusBadge status={o.status} />
              <SourceBadge source={o.source} />
              <EmailStatusBadge status={o.email_status} />
            </div>

            <div className="rounded-lg border p-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Update status</p>
              {next.length === 0 ? (
                <p className="text-muted-foreground">{titleCase(o.status)} is a final state.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {next.map((s) => (
                    <Button key={s} size="sm" variant={s === "cancelled" ? "destructive" : "default"} disabled={status.isPending} onClick={() => setPending(s)}>
                      {status.isPending && status.variables === s && <Loader2 className="size-4 animate-spin" />}
                      Mark {s}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            <section>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Customer</h3>
              <p className="font-medium">{o.customer.name}</p>
              <p className="text-muted-foreground">{o.customer.email} · {o.customer.phone}</p>
            </section>
            <section>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Shipping address</h3>
              <p>{o.shipping_address.line1}{o.shipping_address.line2 ? `, ${o.shipping_address.line2}` : ""}</p>
              <p className="text-muted-foreground">{o.shipping_address.city}, {o.shipping_address.state} {o.shipping_address.postal_code}, {o.shipping_address.country}</p>
            </section>
            <section>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Items</h3>
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full">
                  <thead className="bg-muted text-left text-xs text-muted-foreground"><tr><th className="px-3 py-2">Product</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Price</th><th className="px-3 py-2 text-right">Total</th></tr></thead>
                  <tbody className="tabular">
                    {o.items.map((i) => (
                      <tr key={i.sku} className="border-t">
                        <td className="px-3 py-2"><p>{i.name}</p><p className="font-mono text-xs text-muted-foreground">{i.sku}</p></td>
                        <td className="px-3 py-2 text-right">{i.quantity}</td>
                        <td className="px-3 py-2 text-right">{formatINR(i.unit_price)}</td>
                        <td className="px-3 py-2 text-right">{formatINR(i.line_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="tabular">
                    <tr className="border-t"><td colSpan={3} className="px-3 py-2 text-right text-muted-foreground">Subtotal</td><td className="px-3 py-2 text-right">{formatINR(o.subtotal)}</td></tr>
                    <tr className="border-t font-semibold"><td colSpan={3} className="px-3 py-2 text-right">Total</td><td className="px-3 py-2 text-right">{formatINR(o.total)}</td></tr>
                  </tfoot>
                </table>
              </div>
            </section>
            <section className="grid grid-cols-2 gap-3">
              {([["Confirmed", o.confirmed_at], ["Shipped", o.shipped_at], ["Delivered", o.delivered_at], ["Cancelled", o.cancelled_at], ["Email sent", o.email_sent_at]] as const).map(([l, v]) => (
                <div key={l}><p className="text-xs text-muted-foreground">{l}</p><p>{formatDateTime(v)}</p></div>
              ))}
            </section>
            <Button variant="outline" onClick={() => resend.mutate()} disabled={resend.isPending}>
              {resend.isPending ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />} Resend confirmation email
            </Button>
          </div>
        )}
      </SheetContent>
      <AlertDialog open={!!pending} onOpenChange={(v) => !v && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark {orderRef} as {pending}?</AlertDialogTitle>
            <AlertDialogDescription>
              {pending === "cancelled" ? "Cancelling is final. The server will restock the items automatically." : "This status change can't be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Back</AlertDialogCancel>
            <AlertDialogAction onClick={() => pending && status.mutate(pending)}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
