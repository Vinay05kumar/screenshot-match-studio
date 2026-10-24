/**
 * HTTP implementation of the DashboardApi against the contract base URL
 * (default https://localhost:8002/api/dashboard).
 *
 * Contract behaviours implemented here:
 * - Secure session cookies with credentials: "include" (no tokens in storage).
 * - CSRF token fetched from GET /auth/csrf/ and sent as X-CSRFToken on unsafe
 *   methods, kept in memory only.
 * - A 403 "csrf_failed" response refreshes the token and retries once.
 * - 401/403/404/422/409/429 surfaced as ApiError with the documented payloads.
 *
 * Assumptions to reconcile with the final OpenAPI spec (flagged in README):
 * - CSRF token is read from the /auth/csrf/ response body key
 *   `csrfToken` (falls back to `csrf_token`).
 * - 422 field errors are read from `field_errors` / DRF-style `detail`.
 */
import { ApiError, type DashboardApi } from "../adapter";
import type {
  AnalyticsParams,
  AnalyticsSummary,
  Customer,
  CustomerDetail,
  CustomerListParams,
  EmailStatus,
  Lead,
  LeadListParams,
  LeadUpdateInput,
  LowStockProduct,
  MovementListParams,
  OrderDetail,
  OrderListItem,
  OrderListParams,
  OrderStatus,
  Paginated,
  Product,
  ProductCreateInput,
  ProductListParams,
  ProductUpdateInput,
  SourceStat,
  StaffUser,
  StockUpdateInput,
  StockUpdateResult,
} from "../types";

type UnauthorizedListener = () => void;

const CSRF_BODY_KEYS = ["csrfToken", "csrf_token", "token"] as const;

export class HttpDashboardApi implements DashboardApi {
  private base: string;
  private csrfToken: string | null = null;
  private unauthorizedListener: UnauthorizedListener | null = null;

  constructor(baseUrl: string) {
    this.base = baseUrl.replace(/\/$/, "");
  }

  /** The auth layer registers itself to react to 401s (session expiry). */
  onUnauthorized(listener: UnauthorizedListener) {
    this.unauthorizedListener = listener;
  }

  private async fetchJson<T>(path: string, init: RequestInit = {}, isRetry = false): Promise<T> {
    const method = (init.method ?? "GET").toUpperCase();
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    if (init.body) headers.set("Content-Type", "application/json");
    if (method !== "GET" && method !== "HEAD" && this.csrfToken) {
      headers.set("X-CSRFToken", this.csrfToken);
    }

    const response = await fetch(`${this.base}${path}`, {
      ...init,
      headers,
      credentials: "include",
    });

    if (response.status === 403) {
      const body = await this.safeBody(response);
      if (body?.code === "csrf_failed" && !isRetry) {
        await this.getCsrf();
        return this.fetchJson<T>(path, init, true);
      }
      if (response.status === 403 && !body?.code) {
        // A plain 403 without csrf_failed is a permission failure.
        throw new ApiError(403, body?.detail ?? "You do not have permission to perform this action.");
      }
    }

    if (!response.ok) {
      const body = await this.safeBody(response);
      if (response.status === 401) {
        this.unauthorizedListener?.();
        throw new ApiError(401, body?.detail ?? "Your session has expired. Please sign in again.");
      }
      if (response.status === 403) {
        throw new ApiError(403, body?.detail ?? "CSRF verification failed.");
      }
      if (response.status === 404) throw new ApiError(404, body?.detail ?? "Resource not found.");
      if (response.status === 409) {
        throw new ApiError(409, body?.detail ?? "This action conflicts with the current state.", {
          code: body?.code ?? "conflict",
        });
      }
      if (response.status === 429) throw new ApiError(429, "Too many requests. Please wait a moment and try again.");
      if (response.status === 422 || response.status === 400) {
        throw new ApiError(response.status, body?.detail ?? "Please correct the highlighted fields.", {
          fieldErrors: body?.field_errors ?? undefined,
        });
      }
      throw new ApiError(response.status, "Something went wrong. Please try again.");
    }

    return (await response.json()) as T;
  }

  private async safeBody(response: Response): Promise<{ detail?: string; code?: string; field_errors?: Record<string, string[]> } | null> {
    try {
      return (await response.clone().json()) as Awaited<ReturnType<typeof this.safeBody>>;
    } catch {
      return null;
    }
  }

  // ---------- Auth ----------

  async getCsrf(): Promise<void> {
    const data = await this.fetchJson<Record<string, string>>(`/auth/csrf/`);
    const token = CSRF_BODY_KEYS.map((k) => data[k]).find(Boolean);
    if (token) this.csrfToken = token;
  }

  async login(email: string, password: string): Promise<StaffUser> {
    const user = await this.fetchJson<StaffUser>(`/auth/login/`, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    await this.getCsrf(); // contract: refresh the CSRF token after login
    return user;
  }

  async logout(): Promise<void> {
    await this.fetchJson<unknown>(`/auth/logout/`, { method: "POST" });
    this.csrfToken = null;
    await this.getCsrf(); // contract: refresh the CSRF token after logout
  }

  async me(): Promise<StaffUser> {
    return this.fetchJson<StaffUser>(`/auth/me/`);
  }

  // ---------- Analytics ----------

  private query(params: Record<string, string | number | boolean | undefined>): string {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") search.set(key, String(value));
    }
    const qs = search.toString();
    return qs ? `?${qs}` : "";
  }

  analyticsSummary(params: AnalyticsParams): Promise<AnalyticsSummary> {
    return this.fetchJson(`/analytics/summary/${this.query(params)}`);
  }

  analyticsSources(params: AnalyticsParams): Promise<SourceStat[]> {
    return this.fetchJson(`/analytics/sources/${this.query(params)}`);
  }

  analyticsLowStock(params: AnalyticsParams): Promise<LowStockProduct[]> {
    return this.fetchJson(`/analytics/low-stock/${this.query(params)}`);
  }

  // ---------- Products ----------

  listProducts(params: ProductListParams): Promise<Paginated<Product>> {
    return this.fetchJson(`/products/${this.query(params)}`);
  }

  createProduct(input: ProductCreateInput): Promise<Product> {
    return this.fetchJson(`/products/`, { method: "POST", body: JSON.stringify(input) });
  }

  getProduct(sku: string): Promise<Product> {
    return this.fetchJson(`/products/${encodeURIComponent(sku)}/`);
  }

  updateProduct(sku: string, input: ProductUpdateInput): Promise<Product> {
    return this.fetchJson(`/products/${encodeURIComponent(sku)}/`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  updateStock(sku: string, input: StockUpdateInput): Promise<StockUpdateResult> {
    return this.fetchJson(`/products/${encodeURIComponent(sku)}/stock/`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  listMovements(sku: string, params: MovementListParams): Promise<Paginated<StockMovement2>> {
    return this.fetchJson(`/products/${encodeURIComponent(sku)}/movements/${this.query(params)}`);
  }

  // ---------- Orders ----------

  listOrders(params: OrderListParams): Promise<Paginated<OrderListItem>> {
    return this.fetchJson(`/orders/${this.query(params)}`);
  }

  getOrder(ref: string): Promise<OrderDetail> {
    return this.fetchJson(`/orders/${encodeURIComponent(ref)}/`);
  }

  updateOrderStatus(ref: string, status: OrderStatus): Promise<OrderDetail> {
    return this.fetchJson(`/orders/${encodeURIComponent(ref)}/status/`, {
      method: "POST",
      body: JSON.stringify({ status }),
    });
  }

  resendOrderEmail(ref: string): Promise<{ detail: string; email_status: EmailStatus }> {
    return this.fetchJson(`/orders/${encodeURIComponent(ref)}/resend-email/`, { method: "POST" });
  }

  // ---------- Leads ----------

  listLeads(params: LeadListParams): Promise<Paginated<Lead>> {
    return this.fetchJson(`/leads/${this.query(params)}`);
  }

  getLead(id: number): Promise<Lead> {
    return this.fetchJson(`/leads/${id}/`);
  }

  updateLead(id: number, input: LeadUpdateInput): Promise<Lead> {
    return this.fetchJson(`/leads/${id}/`, { method: "PATCH", body: JSON.stringify(input) });
  }

  // ---------- Customers ----------

  listCustomers(params: CustomerListParams): Promise<Paginated<Customer>> {
    return this.fetchJson(`/customers/${this.query(params)}`);
  }

  getCustomer(id: number): Promise<CustomerDetail> {
    return this.fetchJson(`/customers/${id}/`);
  }
}

type StockMovement2 = import("../types").StockMovement;
