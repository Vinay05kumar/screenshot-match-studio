import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { PageHeader, Panel } from "@/components/dashboard/shared";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/account")({
  head: () => ({
    meta: [
      { title: "Staff account — ConnectSphere Admin" },
      { name: "description", content: "Your ConnectSphere staff account." },
      { property: "og:title", content: "Staff account — ConnectSphere Admin" },
      { property: "og:description", content: "Your ConnectSphere staff account." },
    ],
  }),
  component: Account,
});

function Account() {
  const { user } = useAuth();
  return (
    <>
      <PageHeader title="Staff account" description="Accounts are created by an administrator on the server." />
      <Panel className="max-w-xl">
        <div className="flex items-center gap-4 p-5">
          <span className="flex size-14 items-center justify-center rounded-full bg-gradient-primary font-display text-xl font-semibold text-primary-foreground">
            {(user?.name || user?.email || "?").charAt(0).toUpperCase()}
          </span>
          <div>
            <p className="text-lg font-semibold">{user?.name}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-4 border-t p-5 text-sm">
          <div><dt className="text-muted-foreground">Staff ID</dt><dd className="font-mono">{user?.id}</dd></div>
          <div><dt className="text-muted-foreground">Role</dt><dd><Badge variant="success"><ShieldCheck className="mr-1 size-3" />{user?.role}</Badge></dd></div>
        </dl>
        <p className="border-t p-5 text-xs text-muted-foreground">All staff have full access in this version.</p>
      </Panel>
    </>
  );
}
