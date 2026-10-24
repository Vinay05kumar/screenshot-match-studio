/**
 * TypeScript models matching the ConnectSphere Dashboard API contract.
 * Money values are decimal strings as returned by the API; conversion rates
 * are numbers between 0 and 1. Dates are ISO strings, filters use YYYY-MM-DD.
 */

export const SOURCES = ["instagram", "telegram", "google_ads", "direct", "other"] as const;
export type Source = (typeof SOURCES)[number];

export const ORDER_STATUSES = ["confirmed", "processing", "shipped", "delivered", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const LEAD_STATUSES = ["new", "contacted", "lost", "converted"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const EMAIL_STATUSES = ["pending", "sent", "failed"] as const;
export type EmailStatus = (typeof EMAIL_STATUSES)[number];

export const STOCK_MODES = ["add", "set"] as const;
export type StockMode = (typeof STOCK_MODES)[number];

/** Allowed order status transitions per the contract. Delivered/cancelled are final. */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

export interface Paginated<T> {
  count: number;
  page: number;
  page_size: number;
  results: T[];
}

export interface StaffUser {
  id: number;
  email: string;
  name: string;
  role: "admin";
  is_staff: boolean;
}

// ---------- Products ----------

export interface Product {
  sku: string;
  name: string;
  description: string;
  category: string;
  /** Decimal string, e.g. "1299.00" */
  price: string;
  image_url: string | null;
  stock: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductListParams {
  page?: number;
  page_size?: number;
  search?: string;
  category?: string;
  is_active?: boolean;
  low_stock?: boolean;
}

export interface ProductCreateInput {
  sku: string;
  name: string;
  description: string;
  category: string;
  price: string;
  image_url: string | null;
  stock: number;
  is_active: boolean;
}

/** SKU and stock cannot be changed through PATCH. */
export interface ProductUpdateInput {
  name: string;
  description: string;
  category: string;
  price: string;
  image_url: string | null;
  is_active: boolean;
}

export interface StockUpdateInput {
  mode: StockMode;
  quantity: number;
  reason: string;
  note?: string;
}

export interface StockUpdateResult {
  sku: string;
  stock: number;
  movement: StockMovement;
}

export interface StockMovement {
  id: number;
  sku: string;
  change: number;
  stock_after: number;
  reason: string;
  note: string | null;
  staff: string;
  order_ref: string | null;
  created_at: string;
}

export interface MovementListParams {
  page?: number;
  page_size?: number;
}

// ---------- Orders ----------

export interface OrderCustomer {
  name: string;
  email: string;
  phone: string;
}

export interface OrderListItem {
  ref: string;
  customer: OrderCustomer;
  status: OrderStatus;
  source: Source;
  total: string;
  email_status: EmailStatus;
  created_at: string;
}

export interface OrderItem {
  sku: string;
  name: string;
  quantity: number;
  unit_price: string;
  line_total: string;
}

export interface ShippingAddress {
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

export interface OrderDetail extends OrderListItem {
  items: OrderItem[];
  shipping_address: ShippingAddress;
  subtotal: string;
  confirmed_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  email_sent_at: string | null;
}

export interface OrderListParams {
  page?: number;
  page_size?: number;
  status?: OrderStatus;
  source?: Source;
  date_from?: string;
  date_to?: string;
  /** Matches order reference, customer name, email or phone. */
  search?: string;
}

// ---------- Leads ----------

export interface Lead {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  source: Source;
  medium: string | null;
  campaign: string | null;
  status: LeadStatus;
  note: string | null;
  first_touch_at: string;
  converted_at: string | null;
  order_count: number;
}

export interface LeadListParams {
  page?: number;
  page_size?: number;
  search?: string;
  status?: LeadStatus;
  source?: Source;
  date_from?: string;
  date_to?: string;
}

/** Manual conversion is not allowed; converted leads are locked. */
export type LeadUpdateInput = {
  status?: Exclude<LeadStatus, "converted">;
  note?: string;
};

// ---------- Customers ----------

export interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  is_active: boolean;
  first_source: Source;
  order_count: number;
  /** Decimal string. Excludes cancelled orders. */
  total_spent: string;
  last_order_at: string | null;
  created_at: string;
}

export interface CustomerDetail extends Customer {
  orders: OrderListItem[];
  lead: Lead | null;
}

export interface CustomerListParams {
  page?: number;
  page_size?: number;
  search?: string;
  source?: Source;
  is_active?: boolean;
}

// ---------- Analytics ----------

export interface AnalyticsParams {
  date_from?: string;
  date_to?: string;
}

export interface AnalyticsSummary {
  leads: number;
  customers: number;
  orders: number;
  /** Decimal string. Cancelled orders excluded. */
  revenue: string;
  /** 0..1 */
  conversion_rate: number;
}

export interface SourceStat {
  source: Source;
  leads: number;
  orders: number;
  revenue: string;
  conversion_rate: number;
}

export interface LowStockProduct {
  sku: string;
  name: string;
  category: string;
  stock: number;
}

/** Low-stock threshold is five units, inclusive. */
export const LOW_STOCK_THRESHOLD = 5;
