/**
 * Mock implementation of the DashboardApi contract. Simulates latency,
 * pagination, validation errors (422), invalid order transitions (409) and
 * not-found (404) so every screen behaves like the real integration will.
 *
 * Mock-only convenience: the signed-in staff identity is kept in
 * sessionStorage under a clearly-named key (it stores only name/email — never
 * passwords, session tokens or CSRF tokens). The HTTP adapter relies on real
 * session cookies instead.
 */
import { ApiError, type DashboardApi } from "../adapter";
import {
  ORDER_STATUS_TRANSITIONS,
  type AnalyticsParams,
  type AnalyticsSummary,
  type Customer,
  type CustomerDetail,
  type CustomerListParams,
  type EmailStatus,
  type Lead,
  type LeadListParams,
  type LeadUpdateInput,
  type LowStockProduct,
  type MovementListParams,
  type OrderDetail,
  type OrderListItem,
  type OrderListParams,
  type OrderStatus,
  type Paginated,
  type Product,
  type ProductCreateInput,
  type ProductListParams,
  type ProductUpdateInput,
  type Source,
  type SourceStat,
  type StaffUser,
  type StockMovement,
  type StockUpdateInput,
  type StockUpdateResult,
} from "../types";
import { LOW_STOCK_THRESHOLD, buildMockStore, type MockStore } from "./data";

const MOCK_SESSION_KEY = "cs_mock_session";

const delay = () => new Promise<void>((r) => setTimeout(r, 180 + Math.random() * 320));

function paginate<T>(rows: T[], page?: number, pageSize?: number): Paginated<T> {
  const size = Math.min(Math.max(pageSize ?? 20, 1), 100);
  const p = Math.max(page ?? 1, 1);
  return {
    count: rows.length,
    page: p,
    page_size: size,
    results: rows.slice((p - 1) * size, p * size),
  };
}

function money(n: number): string {
  return n.toFixed(2);
}

function readMockSession(): StaffUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(MOCK_SESSION_KEY);
    return raw ? (JSON.parse(raw) as StaffUser) : null;
  } catch {
    return null;
  }
}

function writeMockSession(user: StaffUser | null) {
  if (typeof window === "undefined") return;
  if (user) window.sessionStorage.setItem(MOCK_SESSION_KEY, JSON.stringify(user));
  else window.sessionStorage.removeItem(MOCK_SESSION_KEY);
}

export class MockDashboardApi implements DashboardApi {
  private store: MockStore = buildMockStore();
  private user: StaffUser | null = readMockSession();
  private csrf: string = `mock-csrf-${Math.random().toString(36).slice(2)}`;

  // ---------- Auth ----------

  async getCsrf(): Promise<void> {
    await delay();
    this.csrf = `mock-csrf-${Math.random().toString(36).slice(2)}`;
  }

  async login(email: string, password: string): Promise<StaffUser> {
    await delay();
    const fieldErrors: Record<string, string[]> = {};
    if (!email.trim()) fieldErrors.email = ["Email is required."];
    if (!password) fieldErrors.password = ["Password is required."];
    if (Object.keys(fieldErrors).length) {
      throw new ApiError(422, "Validation failed.", { fieldErrors });
    }
    // Mock accepts any well-formed credentials — staff accounts come from a
    // server command in the real deployment, so there is nothing to check.
    this.user = { id: 1, email: email.trim().toLowerCase(), name: "Admin", role: "admin", is_staff: true };
    writeMockSession(this.user);
    await this.getCsrf(); // contract: refresh the CSRF token after login
    return this.user;
  }

  async logout(): Promise<void> {
    await delay();
    this.user = null;
    writeMockSession(null);
    await this.getCsrf(); // contract: refresh the CSRF token after logout
  }

  async me(): Promise<StaffUser> {
    await delay();
    if (!this.user) throw new ApiError(401, "Not authenticated.");
    return this.user;
  }

  // ---------- Analytics ----------

  private inRange(iso: string, params: AnalyticsParams): boolean {
    const day = iso.slice(0, 10);
    if (params.date_from && day < params.date_from) return false;
    if (params.date_to && day > params.date_to) return false;
    return true;
  }

  async analyticsSummary(params: AnalyticsParams): Promise<AnalyticsSummary> {
    await delay();
    const leads = this.store.leads.filter((l) => this.inRange(l.first_touch_at, params));
    const orders = this.store.orders.filter((o) => this.inRange(o.created_at, params) && o.status !== "cancelled");
    const revenue = orders.reduce((s, o) => s + Number.parseFloat(o.total), 0);
    return {
      leads: leads.length,
      customers: this.store.customers.filter((c) => this.inRange(c.created_at, params)).length,
      orders: orders.length,
      revenue: money(revenue),
      conversion_rate: leads.length ? leads.filter((l) => l.status === "converted").length / leads.length : 0,
    };
  }

  async analyticsSources(params: AnalyticsParams): Promise<SourceStat[]> {
    await delay();
    const sources: Source[] = ["instagram", "telegram", "google_ads", "direct", "other"];
    return sources.map((source) => {
      const leads = this.store.leads.filter((l) => l.source === source && this.inRange(l.first_touch_at, params));
      const orders = this.store.orders.filter(
        (o) => o.source === source && o.status !== "cancelled" && this.inRange(o.created_at, params),
      );
      return {
        source,
        leads: leads.length,
        orders: orders.length,
        revenue: money(orders.reduce((s, o) => s + Number.parseFloat(o.total), 0)),
        conversion_rate: leads.length ? leads.filter((l) => l.status === "converted").length / leads.length : 0,
      };
    });
  }

  async analyticsLowStock(): Promise<LowStockProduct[]> {
    await delay();
    return this.store.products
      .filter((p) => p.is_active && p.stock <= LOW_STOCK_THRESHOLD)
      .sort((a, b) => a.stock - b.stock)
      .map((p) => ({ sku: p.sku, name: p.name, category: p.category, stock: p.stock }));
  }

  // ---------- Products ----------

  async listProducts(params: ProductListParams): Promise<Paginated<Product>> {
    await delay();
    const q = params.search?.trim().toLowerCase();
    let rows = this.store.products;
    if (q) rows = rows.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
    if (params.category) rows = rows.filter((p) => p.category === params.category);
    if (params.is_active !== undefined) rows = rows.filter((p) => p.is_active === params.is_active);
    if (params.low_stock) rows = rows.filter((p) => p.stock <= LOW_STOCK_THRESHOLD);
    return paginate(rows, params.page, params.page_size);
  }

  async createProduct(input: ProductCreateInput): Promise<Product> {
    await delay();
    const fieldErrors: Record<string, string[]> = {};
    const sku = input.sku.trim().toUpperCase();
    if (!sku) fieldErrors.sku = ["SKU is required."];
    else if (this.store.products.some((p) => p.sku === sku)) fieldErrors.sku = ["A product with this SKU already exists."];
    if (!input.name.trim()) fieldErrors.name = ["Name is required."];
    if (!input.category.trim()) fieldErrors.category = ["Category is required."];
    const price = Number.parseFloat(input.price);
    if (!Number.isFinite(price) || price < 0) fieldErrors.price = ["Enter a valid non-negative price."];
    if (!Number.isInteger(input.stock) || input.stock < 0) fieldErrors.stock = ["Stock must be a whole number of zero or more."];
    if (Object.keys(fieldErrors).length) throw new ApiError(422, "Validation failed.", { fieldErrors });

    const now = new Date().toISOString();
    const product: Product = {
      sku,
      name: input.name.trim(),
      description: input.description,
      category: input.category.trim(),
      price: money(price),
      image_url: input.image_url,
      stock: input.stock,
      is_active: input.is_active,
      created_at: now,
      updated_at: now,
    };
    this.store.products.unshift(product);
    this.store.movements.unshift({
      id: this.store.movementSeq++,
      sku,
      change: input.stock,
      stock_after: input.stock,
      reason: "product_created",
      note: "Stock set while creating the product.",
      staff: this.user?.name ?? "Admin",
      order_ref: null,
      created_at: now,
    });
    return product;
  }

  async getProduct(sku: string): Promise<Product> {
    await delay();
    const product = this.store.products.find((p) => p.sku === sku.toUpperCase());
    if (!product) throw new ApiError(404, `Product ${sku} not found.`);
    return product;
  }

  async updateProduct(sku: string, input: ProductUpdateInput): Promise<Product> {
    await delay();
    const product = this.store.products.find((p) => p.sku === sku.toUpperCase());
    if (!product) throw new ApiError(404, `Product ${sku} not found.`);
    const fieldErrors: Record<string, string[]> = {};
    if (!input.name.trim()) fieldErrors.name = ["Name is required."];
    const price = Number.parseFloat(input.price);
    if (!Number.isFinite(price) || price < 0) fieldErrors.price = ["Enter a valid non-negative price."];
    if (Object.keys(fieldErrors).length) throw new ApiError(422, "Validation failed.", { fieldErrors });
    Object.assign(product, {
      name: input.name.trim(),
      description: input.description,
      category: input.category.trim(),
      price: money(price),
      image_url: input.image_url,
      is_active: input.is_active,
      updated_at: new Date().toISOString(),
    });
    return product;
  }

  async updateStock(sku: string, input: StockUpdateInput): Promise<StockUpdateResult> {
    await delay();
    const product = this.store.products.find((p) => p.sku === sku.toUpperCase());
    if (!product) throw new ApiError(404, `Product ${sku} not found.`);
    const fieldErrors: Record<string, string[]> = {};
    if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
      fieldErrors.quantity = ["Quantity must be a whole number greater than zero."];
    }
    if (!input.reason.trim()) fieldErrors.reason = ["A reason is required."];
    if (Object.keys(fieldErrors).length) throw new ApiError(422, "Validation failed.", { fieldErrors });

    const change = input.mode === "add" ? input.quantity : input.quantity - product.stock;
    const after = input.mode === "add" ? product.stock + input.quantity : input.quantity;
    if (after < 0) {
      throw new ApiError(422, "Validation failed.", {
        fieldErrors: { quantity: ["Resulting stock cannot be negative."] },
      });
    }
    product.stock = after;
    product.updated_at = new Date().toISOString();
    const movement: StockMovement = {
      id: this.store.movementSeq++,
      sku: product.sku,
      change,
      stock_after: after,
      reason: input.reason.trim(),
      note: input.note?.trim() || null,
      staff: this.user?.name ?? "Admin",
      order_ref: null,
      created_at: new Date().toISOString(),
    };
    this.store.movements.unshift(movement);
    return { sku: product.sku, stock: after, movement };
  }

  async listMovements(sku: string, params: MovementListParams): Promise<Paginated<StockMovement>> {
    await delay();
    const rows = this.store.movements.filter((m) => m.sku === sku.toUpperCase());
    return paginate(rows, params.page, params.page_size);
  }

  // ---------- Orders ----------

  async listOrders(params: OrderListParams): Promise<Paginated<OrderListItem>> {
    await delay();
    let rows: OrderListItem[] = this.store.orders;
    if (params.status) rows = rows.filter((o) => o.status === params.status);
    if (params.source) rows = rows.filter((o) => o.source === params.source);
    if (params.date_from || params.date_to) {
      rows = rows.filter((o) => this.inRange(o.created_at, params));
    }
    const q = params.search?.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (o) =>
          o.ref.toLowerCase().includes(q) ||
          o.customer.name.toLowerCase().includes(q) ||
          o.customer.email.toLowerCase().includes(q) ||
          o.customer.phone.replace(/\s/g, "").includes(q.replace(/\s/g, "")),
      );
    }
    return paginate(rows, params.page, params.page_size);
  }

  async getOrder(ref: string): Promise<OrderDetail> {
    await delay();
    const order = this.store.orders.find((o) => o.ref === ref);
    if (!order) throw new ApiError(404, `Order ${ref} not found.`);
    return order;
  }

  async updateOrderStatus(ref: string, status: OrderStatus): Promise<OrderDetail> {
    await delay();
    const order = this.store.orders.find((o) => o.ref === ref);
    if (!order) throw new ApiError(404, `Order ${ref} not found.`);
    const allowed = ORDER_STATUS_TRANSITIONS[order.status];
    if (!allowed.includes(status)) {
      throw new ApiError(409, `Cannot move order from "${order.status}" to "${status}".`, {
        code: "invalid_transition",
      });
    }
    order.status = status;
    const now = new Date().toISOString();
    if (status === "processing") order.confirmed_at = order.confirmed_at ?? now;
    if (status === "shipped") order.shipped_at = now;
    if (status === "delivered") order.delivered_at = now;
    if (status === "cancelled") {
      order.cancelled_at = now;
      // Backend behaviour simulated: cancellation restocks inventory and logs
      // movements. The frontend never restocks independently.
      for (const item of order.items) {
        const product = this.store.products.find((p) => p.sku === item.sku);
        if (!product) continue;
        product.stock += item.quantity;
        product.updated_at = now;
        this.store.movements.unshift({
          id: this.store.movementSeq++,
          sku: product.sku,
          change: item.quantity,
          stock_after: product.stock,
          reason: "order_cancelled",
          note: `Restocked after cancelling order ${order.ref}.`,
          staff: this.user?.name ?? "Admin",
          order_ref: order.ref,
          created_at: now,
        });
      }
    }
    return order;
  }

  async resendOrderEmail(ref: string): Promise<{ detail: string; email_status: EmailStatus }> {
    await delay();
    const order = this.store.orders.find((o) => o.ref === ref);
    if (!order) throw new ApiError(404, `Order ${ref} not found.`);
    order.email_status = "sent";
    order.email_sent_at = new Date().toISOString();
    return { detail: `Confirmation email for ${ref} queued for delivery.`, email_status: "sent" };
  }

  // ---------- Leads ----------

  async listLeads(params: LeadListParams): Promise<Paginated<Lead>> {
    await delay();
    let rows = this.store.leads;
    const q = params.search?.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          (l.email ?? "").toLowerCase().includes(q) ||
          (l.phone ?? "").includes(q),
      );
    }
    if (params.status) rows = rows.filter((l) => l.status === params.status);
    if (params.source) rows = rows.filter((l) => l.source === params.source);
    if (params.date_from || params.date_to) {
      rows = rows.filter((l) => this.inRange(l.first_touch_at, params));
    }
    return paginate(rows, params.page, params.page_size);
  }

  async getLead(id: number): Promise<Lead> {
    await delay();
    const lead = this.store.leads.find((l) => l.id === id);
    if (!lead) throw new ApiError(404, `Lead #${id} not found.`);
    return lead;
  }

  async updateLead(id: number, input: LeadUpdateInput): Promise<Lead> {
    await delay();
    const lead = this.store.leads.find((l) => l.id === id);
    if (!lead) throw new ApiError(404, `Lead #${id} not found.`);
    if (lead.status === "converted") {
      throw new ApiError(422, "A converted lead cannot have its status changed.", {
        fieldErrors: { status: ["Converted leads are locked."] },
      });
    }
    if (input.status === "converted") {
      throw new ApiError(422, "Manual conversion is not allowed; conversion happens with the first order.", {
        fieldErrors: { status: ["Conversion happens automatically with the first order."] },
      });
    }
    if (input.status !== undefined) lead.status = input.status;
    if (input.note !== undefined) lead.note = input.note.trim() || null;
    return lead;
  }

  // ---------- Customers ----------

  async listCustomers(params: CustomerListParams): Promise<Paginated<Customer>> {
    await delay();
    let rows = this.store.customers;
    const q = params.search?.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.phone.includes(q),
      );
    }
    if (params.source) rows = rows.filter((c) => c.first_source === params.source);
    if (params.is_active !== undefined) rows = rows.filter((c) => c.is_active === params.is_active);
    return paginate(rows, params.page, params.page_size);
  }

  async getCustomer(id: number): Promise<CustomerDetail> {
    await delay();
    const customer = this.store.customers.find((c) => c.id === id);
    if (!customer) throw new ApiError(404, `Customer #${id} not found.`);
    const orders: OrderListItem[] = this.store.orders.filter((o) => o.customer.email === customer.email);
    const lead = this.store.leads.find((l) => l.email === customer.email) ?? null;
    return { ...customer, orders, lead };
  }
}
