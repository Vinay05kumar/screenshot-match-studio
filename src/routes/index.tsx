import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ConnectSphere Admin" },
      { name: "description", content: "ConnectSphere staff dashboard." },
      { property: "og:title", content: "ConnectSphere Admin" },
      { property: "og:description", content: "ConnectSphere staff dashboard." },
    ],
  }),
  component: Index,
});

function Index() {
  const { status } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (status === "authenticated") navigate({ to: "/overview", replace: true });
    if (status === "unauthenticated") navigate({ to: "/login", replace: true });
  }, [status, navigate]);
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="size-6 animate-spin text-primary" />
    </div>
  );
}
