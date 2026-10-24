import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import type { StaffUser } from "@/lib/api/types";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: StaffUser | null;
  login: (email: string, password: string) => Promise<StaffUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Staff session lives in memory only (contract section 5). On mount the
 * session is restored through GET /auth/me/; nothing is kept in browser
 * storage by the auth layer itself.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<StaffUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then((u) => {
        if (cancelled) return;
        setUser(u);
        setStatus("authenticated");
      })
      .catch(() => {
        if (cancelled) return;
        setUser(null);
        setStatus("unauthenticated");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      login: async (email, password) => {
        const u = await api.login(email, password);
        setUser(u);
        setStatus("authenticated");
        return u;
      },
      logout: async () => {
        try {
          await api.logout();
        } finally {
          setUser(null);
          setStatus("unauthenticated");
        }
      },
    }),
    [status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
