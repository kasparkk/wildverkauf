import { getDatabase } from "@netlify/database";

export const db = getDatabase();

/**
 * Postgres returns NUMERIC and COUNT(...) values as strings to avoid precision
 * loss. The client expects plain numbers, so known numeric columns are coerced
 * on the way out.
 */
const NUMERIC_FIELDS = new Set([
  "animal_count",
  "count",
  "customer_count",
  "cut_count",
  "cuts_available",
  "fixed_price",
  "inventory_value",
  "open_payments",
  "price_per_kg",
  "quantity",
  "revenue_this_month",
  "sale_count",
  "total",
  "total_price",
  "total_spent",
  "unit_price",
  "value",
  "weight_kg",
]);

export function normalize<T>(row: T): T {
  if (row === null || typeof row !== "object") return row;
  const out: Record<string, unknown> = { ...(row as Record<string, unknown>) };
  for (const [key, value] of Object.entries(out)) {
    if (!NUMERIC_FIELDS.has(key) || value === null || value === undefined) continue;
    if (typeof value === "number") continue;
    const parsed = Number(value);
    out[key] = Number.isNaN(parsed) ? value : parsed;
  }
  return out as T;
}

export function normalizeAll<T>(rows: T[]): T[] {
  return rows.map(normalize);
}
