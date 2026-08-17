import { Router } from "express";
import { db } from "../db.js";
import { saleSchema, saleUpdateSchema } from "../types.js";

export const salesRouter = Router();

function getSaleWithItems(id: number | bigint) {
  const sale = db
    .prepare(
      `SELECT s.*, c.name as customer_name, c.phone as customer_phone
       FROM sales s LEFT JOIN customers c ON c.id = s.customer_id WHERE s.id = ?`
    )
    .get(id) as any;
  if (!sale) return null;
  const items = db.prepare("SELECT * FROM sale_items WHERE sale_id = ?").all(id);
  const total = items.reduce((sum: number, it: any) => sum + it.total_price, 0);
  return { ...sale, items, total };
}

salesRouter.get("/", (_req, res) => {
  const sales = db
    .prepare(
      `SELECT s.*, c.name as customer_name,
        (SELECT COALESCE(SUM(total_price),0) FROM sale_items WHERE sale_id = s.id) as total
       FROM sales s LEFT JOIN customers c ON c.id = s.customer_id
       ORDER BY s.date DESC, s.id DESC`
    )
    .all();
  res.json(sales);
});

salesRouter.get("/:id", (req, res) => {
  const sale = getSaleWithItems(Number(req.params.id));
  if (!sale) return res.status(404).json({ error: "Nicht gefunden" });
  res.json(sale);
});

salesRouter.post("/", (req, res) => {
  const parsed = saleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const d = parsed.data;

  const createSale = db.transaction(() => {
    const saleInfo = db
      .prepare(
        `INSERT INTO sales (customer_id, payment_method, payment_status, notes) VALUES (?, ?, ?, ?)`
      )
      .run(d.customer_id ?? null, d.payment_method, d.payment_status, d.notes ?? null);
    const saleId = saleInfo.lastInsertRowid;

    const insertItem = db.prepare(
      `INSERT INTO sale_items (sale_id, cut_id, description, weight_kg, quantity, unit_price, total_price)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const markSold = db.prepare(`UPDATE cuts SET status = 'sold' WHERE id = ?`);

    for (const item of d.items) {
      const totalPrice = item.unit_price * item.quantity;
      insertItem.run(
        saleId,
        item.cut_id ?? null,
        item.description,
        item.weight_kg ?? null,
        item.quantity,
        item.unit_price,
        totalPrice
      );
      if (item.cut_id) markSold.run(item.cut_id);
    }
    return saleId;
  });

  try {
    const saleId = createSale();
    res.status(201).json(getSaleWithItems(saleId));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

salesRouter.put("/:id", (req, res) => {
  const parsed = saleUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = db.prepare("SELECT * FROM sales WHERE id = ?").get(req.params.id) as any;
  if (!existing) return res.status(404).json({ error: "Nicht gefunden" });
  const d = { ...existing, ...parsed.data };
  db.prepare(`UPDATE sales SET payment_status = ?, notes = ? WHERE id = ?`).run(
    d.payment_status,
    d.notes ?? null,
    req.params.id
  );
  res.json(getSaleWithItems(Number(req.params.id)));
});

salesRouter.delete("/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM sales WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Nicht gefunden" });

  const cancelSale = db.transaction(() => {
    const items = db.prepare("SELECT * FROM sale_items WHERE sale_id = ?").all(req.params.id) as any[];
    const restore = db.prepare(`UPDATE cuts SET status = 'available' WHERE id = ?`);
    for (const item of items) {
      if (item.cut_id) restore.run(item.cut_id);
    }
    db.prepare("DELETE FROM sales WHERE id = ?").run(req.params.id);
  });
  cancelSale();
  res.status(204).end();
});
