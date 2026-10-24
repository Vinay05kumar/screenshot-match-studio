/**
 * Deterministic mock dataset for development before the backend is available.
 * Everything here is clearly mock data: it lives in memory, is regenerated on
 * each page load from a fixed seed, and is replaced wholesale when the real
 * adapter is enabled (VITE_USE_MOCK_API=false).
 */
import {
  LOW_STOCK_THRESHOLD,
  type Customer,
  type EmailStatus,
  type Lead,
  type LeadStatus,
  type OrderDetail,
  type OrderItem,
  type OrderStatus,
  type Product,
  type Source,
  type StockMovement,
} from "../types";

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260214);
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const weighted = <T extends string>(weights: [T, number][]): T => {
  const total = weights.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [value, w] of weights) {
    r -= w;
    if (r <= 0) return value;
  }
  return weights[weights.length - 1][0];
};

const FIRST_NAMES = [
  "Aarav", "Ananya", "Rohit", "Priya", "Vikram", "Sneha", "Karthik", "Meera",
  "Arjun", "Divya", "Nikhil", "Riya", "Sanjay", "Pooja", "Aditya", "Kavya",
  "Rahul", "Neha", "Siddharth", "Ishita", "Manish", "Tanvi", "Harish", "Shreya",
  "Varun", "Anjali", "Deepak", "Nandini", "Prateek", "Sanya",
];
const LAST_NAMES = [
  "Sharma", "Patel", "Reddy", "Iyer", "Gupta", "Nair", "Singh", "Das",
  "Kulkarni", "Menon", "Joshi", "Rao", "Bose", "Chopra", "Mehta", "Pillai",
];
const CITIES: [string, string][] = [
  ["Mumbai", "Maharashtra"], ["Bengaluru", "Karnataka"], ["Delhi", "Delhi"],
  ["Hyderabad", "Telangana"], ["Chennai", "Tamil Nadu"], ["Pune", "Maharashtra"],
  ["Kolkata", "West Bengal"], ["Ahmedabad", "Gujarat"], ["Jaipur", "Rajasthan"],
  ["Kochi", "Kerala"], ["Indore", "Madhya Pradesh"], ["Lucknow", "Uttar Pradesh"],
];

const SOURCE_WEIGHTS: [Source, number][] = [
  ["instagram", 30], ["telegram", 20], ["google_ads", 20], ["direct", 20], ["other", 10],
];

const MEDIUMS: Record<Source, string[]> = {
  instagram: ["social", "story", "reel"],
  telegram: ["bot", "channel"],
  google_ads: ["cpc", "search"],
  direct: ["none"],
  other: ["referral", "affiliate"],
};

const CAMPAIGNS: Record<Source, string[]> = {
  instagram: ["glow_serum_q3", "festive_drop", "reel_organic"],
  telegram: ["deal_alerts", "launch_channel"],
  google_ads: ["skincare_search", "brand_terms", "retargeting"],
  direct: [],
  other: ["influencer_referral"],
};

const CATALOG: Record<string, [string, number][]> = {
  Skincare: [
    ["Vitamin C Face Serum", 899], ["Hyaluronic Day Moisturiser", 749],
    ["Niacinamide Clarifying Toner", 549], ["SPF 50 PA+++ Sunscreen", 649],
    ["Overnight Repair Night Cream", 999], ["Gentle Foaming Face Wash", 399],
    ["Rose Clay Detox Mask", 599], ["Under-Eye Brightening Gel", 799],
  ],
  Haircare: [
    ["Anti-Hairfall Onion Oil", 549], ["Keratin Repair Shampoo", 649],
    ["Silk Protein Conditioner", 599], ["Scalp Exfoliating Scrub", 699],
    ["Curls Defining Cream", 749], ["Hair Growth Scalp Serum", 899],
  ],
  Wellness: [
    ["Ashwagandha Stress Tablets", 649], ["Melatonin Sleep Gummies", 799],
    ["Omega-3 Fish Oil Capsules", 899], ["Immunity Kadha Mix", 349],
    ["Magnesium Relax Powder", 699], ["Multivitamin Daily Tablets", 549],
  ],
  Fitness: [
    ["Whey Protein Isolate 1kg", 2999], ["Resistance Bands Set", 899],
    ["Yoga Mat 6mm TPE", 1299], ["Smart Skipping Rope", 599],
    ["Foam Roller Deep Tissue", 999], ["Shaker Bottle 700ml", 399],
  ],
  Nutrition: [
    ["Cold-Pressed Almond Oil 500ml", 899], ["Organic Chia Seeds 250g", 449],
    ["Roasted Makhana Peri Peri", 299], ["A2 Ghee Jar 1L", 1499],
    ["Peanut Butter Crunchy 1kg", 649], ["Matcha Green Tea Powder", 1199],
  ],
};

const PHONE_PREFIXES = ["+91 98", "+91 97", "+91 90", "+91 81"];

function isoDaysAgo(days: number, hourOffset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(9 + hourOffset, int(0, 59), int(0, 59), 0);
  return d.toISOString();
}

export interface MockStore {
  products: Product[];
  orders: OrderDetail[];
  leads: Lead[];
  customers: Customer[];
  movements: StockMovement[];
  movementSeq: number;
  leadSeq: number;
}

export function buildMockStore(): MockStore {
  // ----- Products -----
  const products: Product[] = [];
  let skuIndex = 1;
  for (const [category, items] of Object.entries(CATALOG)) {
    for (const [name, basePrice] of items) {
      const prefix = category.slice(0, 3).toUpperCase();
      // ~15% of products sit at or below the low-stock threshold (5, inclusive).
      const stock = rand() < 0.15 ? int(0, LOW_STOCK_THRESHOLD) : int(6, 200);
      const price = basePrice + int(-2, 2) * 10;
      products.push({
        sku: `CS-${prefix}-${String(skuIndex).padStart(3, "0")}`,
        name,
        description: `${name} from the ConnectSphere ${category.toLowerCase()} range. Quality checked and dispatched within 24 hours.`,
        category,
        price: `${price}.00`,
        image_url: null,
        stock,
        is_active: rand() > 0.08,
        created_at: isoDaysAgo(int(120, 300)),
        updated_at: isoDaysAgo(int(1, 30)),
      });
      skuIndex++;
    }
  }
  const activeProducts = products.filter((p) => p.is_active);

  // ----- People pool (shared by orders, leads, customers) -----
  const people = Array.from({ length: 64 }, (_, i) => {
    const first = FIRST_NAMES[i % FIRST_NAMES.length];
    const last = pick(LAST_NAMES);
    const [city, state] = pick(CITIES);
    return {
      name: `${first} ${last}`,
      email: `${first.toLowerCase()}.${last.toLowerCase()}${i}@example.com`,
      phone: `${pick(PHONE_PREFIXES)}${int(10, 99)} ${int(100, 999)} ${int(100, 999)}`,
      city,
      state,
      line1: `${int(1, 999)}, ${pick(["Green Park", "MG Road", "Lake View Apt", "Rose Villa", "Sector " + int(1, 40)])}`,
      postal: String(int(110001, 799999)),
    };
  });

  // ----- Orders -----
  const statuses: [OrderStatus, number][] = [
    ["confirmed", 18], ["processing", 18], ["shipped", 15], ["delivered", 37], ["cancelled", 12],
  ];
  const emailStatuses: [EmailStatus, number][] = [["sent", 84], ["pending", 10], ["failed", 6]];
  const orders: OrderDetail[] = [];
  for (let i = 0; i < 140; i++) {
    const person = pick(people);
    const source = weighted(SOURCE_WEIGHTS);
    const status = weighted(statuses);
    const daysAgo = int(0, 89);
    const created = isoDaysAgo(daysAgo, int(0, 12));
    const itemCount = int(1, 4);
    const chosen = new Set<number>();
    const items: OrderItem[] = [];
    while (items.length < itemCount) {
      const p = pick(activeProducts);
      if (chosen.has(products.indexOf(p))) continue;
      chosen.add(products.indexOf(p));
      const qty = int(1, 3);
      const unit = Number.parseFloat(p.price);
      items.push({
        sku: p.sku,
        name: p.name,
        quantity: qty,
        unit_price: p.price,
        line_total: `${(unit * qty).toFixed(2)}`,
      });
    }
    const subtotal = items.reduce((s, it) => s + Number.parseFloat(it.line_total), 0);
    const shipping = subtotal >= 999 ? 0 : 79;
    const total = subtotal + shipping;
    const emailStatus = weighted(emailStatuses);
    orders.push({
      ref: `CS-2026-${String(10000 + i)}`,
      customer: { name: person.name, email: person.email, phone: person.phone },
      status,
      source,
      total: `${total.toFixed(2)}`,
      email_status: emailStatus,
      created_at: created,
      items,
      shipping_address: {
        line1: person.line1,
        line2: rand() > 0.7 ? `Near ${pick(["Metro Station", "City Mall", "Bus Depot"])}` : null,
        city: person.city,
        state: person.state,
        postal_code: person.postal,
        country: "India",
      },
      subtotal: `${subtotal.toFixed(2)}`,
      confirmed_at: status === "cancelled" ? created : isoDaysAgo(daysAgo, int(12, 14)),
      shipped_at: status === "shipped" || status === "delivered" ? isoDaysAgo(Math.max(0, daysAgo - 1), int(0, 8)) : null,
      delivered_at: status === "delivered" ? isoDaysAgo(Math.max(0, daysAgo - 3), int(0, 8)) : null,
      cancelled_at: status === "cancelled" ? isoDaysAgo(daysAgo, int(14, 20)) : null,
      email_sent_at: emailStatus === "sent" ? isoDaysAgo(daysAgo, int(0, 1)) : null,
    });
  }
  orders.sort((a, b) => b.created_at.localeCompare(a.created_at));

  // ----- Leads -----
  const leadStatuses: [LeadStatus, number][] = [["new", 34], ["contacted", 31], ["lost", 15], ["converted", 20]];
  const leads: Lead[] = [];
  for (let i = 0; i < 170; i++) {
    const person = pick(people);
    const source = weighted(SOURCE_WEIGHTS);
    const status = weighted(leadStatuses);
    const daysAgo = int(0, 89);
    const firstTouch = isoDaysAgo(daysAgo, int(0, 14));
    const converted = status === "converted";
    const personOrders = orders.filter((o) => o.customer.email === person.email && o.status !== "cancelled");
    leads.push({
      id: i + 1,
      name: person.name,
      email: rand() > 0.1 ? person.email : null,
      phone: rand() > 0.25 ? person.phone : null,
      source,
      medium: pick(MEDIUMS[source]),
      campaign: CAMPAIGNS[source].length ? pick(CAMPAIGNS[source]) : null,
      status,
      note:
        status === "contacted"
          ? pick(["Called once, interested in skincare range.", "WhatsApp follow-up sent.", "Asked for catalogue."])
          : status === "lost"
            ? pick(["No response after 3 attempts.", "Bought from competitor.", "Out of delivery area."])
            : null,
      first_touch_at: firstTouch,
      converted_at: converted ? isoDaysAgo(Math.max(0, daysAgo - int(1, 10)), int(0, 8)) : null,
      order_count: converted ? Math.max(1, personOrders.length || 1) : 0,
    });
  }
  leads.sort((a, b) => b.first_touch_at.localeCompare(a.first_touch_at));

  // ----- Customers (derived from orders; totals exclude cancelled) -----
  const customers: Customer[] = people.map((person, idx) => {
    const personOrders = orders.filter((o) => o.customer.email === person.email);
    const paid = personOrders.filter((o) => o.status !== "cancelled");
    const first = [...personOrders].sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
    const last = [...paid].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    return {
      id: idx + 1,
      name: person.name,
      email: person.email,
      phone: person.phone,
      is_active: rand() > 0.05,
      first_source: (first?.source ?? weighted(SOURCE_WEIGHTS)) as Source,
      order_count: paid.length,
      total_spent: `${paid.reduce((s, o) => s + Number.parseFloat(o.total), 0).toFixed(2)}`,
      last_order_at: last?.created_at ?? null,
      created_at: first?.created_at ?? isoDaysAgo(int(30, 200)),
    };
  });
  customers.sort((a, b) => b.total_spent.localeCompare(a.total_spent, "en", { numeric: true }));

  // ----- Seeded stock movements -----
  const movements: StockMovement[] = [];
  let movementSeq = 1;
  for (const p of products) {
    movements.push({
      id: movementSeq++,
      sku: p.sku,
      change: p.stock,
      stock_after: p.stock,
      reason: "initial_stock",
      note: "Opening stock at dashboard launch.",
      staff: "System Import",
      order_ref: null,
      created_at: p.created_at,
    });
  }

  return { products, orders, leads, customers, movements, movementSeq, leadSeq: leads.length + 1 };
}

export { rand as mockRand, pick as mockPick, int as mockInt, LOW_STOCK_THRESHOLD };
