import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { BarChart3, Boxes, LayoutDashboard, LogOut, Package, ShoppingCart, UserCircle, Users, UsersRound, Waypoints } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth";
import { MockBanner } from "./shared";

const NAV = [
  { to: "/overview", label: "Overview", icon: LayoutDashboard },
  { to: "/orders", label: "Orders", icon: ShoppingCart },
  { to: "/products", label: "Products", icon: Package },
  { to: "/inventory", label: "Inventory", icon: Boxes },
  { to: "/leads", label: "Leads", icon: UsersRound },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const current = NAV.find((n) => path.startsWith(n.to))?.label ?? (path.startsWith("/account") ? "Account" : "");

  const doLogout = async () => {
    await logout();
    toast.success("Signed out");
    navigate({ to: "/login" });
  };

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-1 py-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-primary text-primary-foreground">
              <Waypoints className="size-4" />
            </span>
            <span className="font-display text-lg font-semibold text-sidebar-accent-foreground group-data-[collapsible=icon]:hidden">ConnectSphere</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV.map((n) => (
                  <SidebarMenuItem key={n.to}>
                    <SidebarMenuButton asChild isActive={path.startsWith(n.to)} tooltip={n.label}>
                      <Link to={n.to}>
                        <n.icon />
                        <span>{n.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={path.startsWith("/account")} tooltip="Staff account">
                <Link to="/account">
                  <UserCircle />
                  <span>Staff account</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={doLogout} tooltip="Logout">
                <LogOut />
                <span>Logout</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <MockBanner />
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur">
          <SidebarTrigger />
          <span className="text-sm font-medium text-muted-foreground">{current}</span>
          <div className="ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 rounded-full border bg-card py-1 pl-1 pr-3 text-sm transition-colors hover:bg-muted">
                <span className="flex size-7 items-center justify-center rounded-full bg-gradient-primary text-xs font-semibold text-primary-foreground">
                  {(user?.name || user?.email || "?").charAt(0).toUpperCase()}
                </span>
                <span className="hidden max-w-[160px] truncate sm:inline">{user?.email}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">{user?.name}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate({ to: "/account" })}>
                  <UserCircle /> Staff account
                </DropdownMenuItem>
                <DropdownMenuItem onClick={doLogout}>
                  <LogOut /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 sm:p-6 lg:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
