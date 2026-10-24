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
} from "./types";

/**
 * Error thrown by every adapter. `status` mirrors the contract's documented
 * codes: 401 unauthenticated, 403 CSRF failure, 404 not found, 422 validation,
 * 409 invalid order status transition, 429 rate limited.
 */
export class ApiError extends Error {
  status: number;
  /** Machine code, e.g. "csrf_failed" or "invalid_transition". */
  code?: string;
  /** Field-level validation errors keyed by field name. */
  fieldErrors?: Record<string, string[]>;

  constructor(
    status: number,
    message: string,
    options?: { code?: string; fieldErrors?: Record<string, string[]> },
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = options?.code;
    this.fieldErrors = options?.fieldErrors;
  }
}

/**
 * The single seam between the dashboard UI and the backend. The mock adapter
 * implements it now; the HTTP adapter implements it against the contract and
 * is selected through environment configuration (see src/lib/config.ts).
 */
export interface DashboardApi {
  // ----- Auth (section 5) -----
  /** GET /auth/csrf/ — fetch (and internally keep) a CSRF token. */
  getCsrf(): Promise<void>;
  /** POST /auth/login/ */
  login(email: string, password: string): Promise<StaffUser>;
  /** POST /auth/logout/ */
  logout(): Promise<void>;
  /** GET /auth/me/ — restore the current session; rejects with 401 when none. */
  me(): Promise<StaffUser>;

  // ----- Analytics (sections 6, 12) -----
  analyticsSummary(params: AnalyticsParams): Promise<AnalyticsSummary>;
  analyticsSources(params: AnalyticsParams): Promise<SourceStat[]>;
  analyticsLowStock(params: AnalyticsParams): Promise<LowStockProduct[]>;

  // ----- Products (section 7) -----
  listProducts(params: ProductListParams): Promise<Paginated<Product>>;
  createProduct(input: ProductCreateInput): Promise<Product>;
  getProduct(sku: string): Promise<Product>;
  updateProduct(sku: string, input: ProductUpdateInput): Promise<Product>;
  /** POST /products/{sku}/stock/ — mode "add" | "set". */
  updateStock(sku: string, input: StockUpdateInput): Promise<StockUpdateResult>;
  /** GET /products/{sku}/movements/ */
  listMovements(sku: string, params: MovementListParams): Promise<Paginated<StockMovement>>;

  // ----- Orders (section 9) -----
  listOrders(params: OrderListParams): Promise<Paginated<OrderListItem>>;
  getOrder(ref: string): Promise<OrderDetail>;
  /** POST /orders/{ref}/status/ — rejects with 409 on invalid transitions. */
  updateOrderStatus(ref: string, status: OrderStatus): Promise<OrderDetail>;
  /** POST /orders/{ref}/resend-email/ */
  resendOrderEmail(ref: string): Promise<{ detail: string; email_status: EmailStatus }>;

  // ----- Leads (section 10) -----
  listLeads(params: LeadListParams): Promise<Paginated<Lead>>;
  getLead(id: number): Promise<Lead>;
  updateLead(id: number, input: LeadUpdateInput): Promise<Lead>;

  // ----- Customers (section 11) -----
  listCustomers(params: CustomerListParams): Promise<Paginated<Customer>>;
  getCustomer(id: number): Promise<CustomerDetail>;
}
