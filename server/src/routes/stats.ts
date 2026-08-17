import { Router } from "express";
import { db } from "../db.js";

export const statsRouter = Router();

statsRouter.get("/", (_req, res) => {
  const inventoryValue = db
    .prepare(
      `SELECT COALESCE(SUM(
          CASE WHEN fixed_price IS NOT NULL THEN fixed_price
               WHEN price_per_kg IS NOT NULL AND weight_kg IS NOT NULL THEN price_per_kg * weight_kg
               ELSE 0 END
        ), 0) as value
       FROM cuts WHERE status = 'available'`
    )
    .get() as any;

  const cutCounts = db
    .prepare(`SELECT status, COUNT(*) as count FROM cuts GROUP BY status`)
    .all() as any[];

  const revenueThisMonth = db
    .prepare(
      `SELECT COALESCE(SUM(si.total_price), 0) as total
       FROM sales s JOIN sale_items si ON si.sale_id = s.id
       WHERE strftime('%Y-%m', s.date) = strftime('%Y-%m', 'now')`
    )
    .get() as any;

  const openPayments = db
    .prepare(
      `SELECT COALESCE(SUM(si.total_price), 0) as total
       FROM sales s JOIN sale_items si ON si.sale_id = s.id
       WHERE s.payment_status = 'offen'`
    )
    .get() as any;

  const recentSales = db
    .prepare(
      `SELECT s.*, c.name as customer_name,
        (SELECT COALESCE(SUM(total_price),0) FROM sale_items WHERE sale_id = s.id) as total
       FROM sales s LEFT JOIN customers c ON c.id = s.customer_id
       ORDER BY s.date DESC, s.id DESC LIMIT 5`
    )
    .all();

  const animalCount = (db.prepare(`SELECT COUNT(*) as count FROM animals`).get() as any).count;
  const customerCount = (db.prepare(`SELECT COUNT(*) as count FROM customers`).get() as any).count;

  res.json({
    inventory_value: inventoryValue.value,
    cut_counts: Object.fromEntries(cutCounts.map((r) => [r.status, r.count])),
    revenue_this_month: revenueThisMonth.total,
    open_payments: openPayments.total,
    recent_sales: recentSales,
    animal_count: animalCount,
    customer_count: customerCount,
  });
});
