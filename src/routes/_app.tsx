import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/dashboard/AppShell";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { status, logout } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (status === "unauthenticated") navigate({ to: "/login", replace: true });
  }, [status, navigate]);

  // Any 401 from a data request means the session expired.
  useEffect(() => {
    return qc.getQueryCache().subscribe((event) => {
      const err = event.query.state.error;
      if (event.type === "updated" && err instanceof ApiError && err.status === 401) {
        qc.clear();
        toast.error("Your session has expired. Please sign in again.");
        logout();
      }
    });
  }, [qc, logout]);

  if (status !== "authenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
