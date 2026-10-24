import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Waypoints } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { appConfig } from "@/lib/config";
import { errorMessage, fieldError } from "@/components/dashboard/shared";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Staff sign in — ConnectSphere" },
      { name: "description", content: "Sign in to the ConnectSphere staff dashboard." },
      { property: "og:title", content: "Staff sign in — ConnectSphere" },
      { property: "og:description", content: "Sign in to the ConnectSphere staff dashboard." },
    ],
  }),
  component: Login,
});

function Login() {
  const { login, status } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (status === "authenticated") navigate({ to: "/overview", replace: true });
  }, [status, navigate]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      toast.success("Welcome back");
      navigate({ to: "/overview" });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const generalError =
    error instanceof ApiError && error.status === 401 ? "Invalid email or password." : error && !(error instanceof ApiError && error.fieldErrors) ? errorMessage(error) : null;

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between bg-gradient-auth p-10 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-gradient-primary text-primary-foreground">
            <Waypoints className="size-5" />
          </span>
          <span className="font-display text-xl font-semibold text-sidebar-accent-foreground">ConnectSphere</span>
        </div>
        <div className="max-w-md">
          <h2 className="font-display text-4xl font-semibold leading-tight text-sidebar-accent-foreground">Every channel, every order, one calm view.</h2>
          <p className="mt-4 text-sidebar-foreground/80">Track leads from Instagram, Telegram and Google Ads through to delivered orders.</p>
        </div>
        <p className="text-xs text-sidebar-foreground/60">Staff access only</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="animate-rise w-full max-w-sm space-y-5" noValidate>
          <div>
            <h1 className="text-2xl font-semibold">Staff sign in</h1>
            <p className="mt-1 text-sm text-muted-foreground">Use the account created for you by your administrator.</p>
          </div>
          {appConfig.useMockApi && (
            <p className="rounded-lg bg-accent px-3 py-2 text-xs text-accent-foreground">Mock mode: any email and password will sign you in.</p>
          )}
          {generalError && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{generalError}</p>}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            {fieldError(error, "email") && <p className="text-xs text-destructive">{fieldError(error, "email")}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            {fieldError(error, "password") && <p className="text-xs text-destructive">{fieldError(error, "password")}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />} Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}
