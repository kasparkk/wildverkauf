import { Router } from "express";
import { db } from "../db.js";
import { customerSchema } from "../types.js";

export const customersRouter = Router();

customersRouter.get("/", (_req, res) => {
  const customers = db
    .prepare(
      `SELECT c.*,
        (SELECT COUNT(*) FROM sales s WHERE s.customer_id = c.id) as sale_count,
        (SELECT COALESCE(SUM(si.total_price), 0) FROM sales s
           JOIN sale_items si ON si.sale_id = s.id WHERE s.customer_id = c.id) as total_spent
       FROM customers c ORDER BY name ASC`
    )
    .all();
  res.json(customers);
});

customersRouter.get("/:id", (req, res) => {
  const customer = db.prepare("SELECT * FROM customers WHERE id = ?").get(req.params.id);
  if (!customer) return res.status(404).json({ error: "Nicht gefunden" });
  const sales = db
    .prepare(
      `SELECT s.*, (SELECT COALESCE(SUM(total_price),0) FROM sale_items WHERE sale_id = s.id) as total
       FROM sales s WHERE s.customer_id = ? ORDER BY s.date DESC`
    )
    .all(req.params.id);
  res.json({ ...customer, sales });
});

customersRouter.post("/", (req, res) => {
  const parsed = customerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const d = parsed.data;
  const info = db
    .prepare(`INSERT INTO customers (name, phone, email, address, notes) VALUES (?, ?, ?, ?, ?)`)
    .run(d.name, d.phone ?? null, d.email ?? null, d.address ?? null, d.notes ?? null);
  const customer = db.prepare("SELECT * FROM customers WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json(customer);
});

customersRouter.put("/:id", (req, res) => {
  const parsed = customerSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = db.prepare("SELECT * FROM customers WHERE id = ?").get(req.params.id) as any;
  if (!existing) return res.status(404).json({ error: "Nicht gefunden" });
  const d = { ...existing, ...parsed.data };
  db.prepare(
    `UPDATE customers SET name = ?, phone = ?, email = ?, address = ?, notes = ? WHERE id = ?`
  ).run(d.name, d.phone ?? null, d.email ?? null, d.address ?? null, d.notes ?? null, req.params.id);
  const customer = db.prepare("SELECT * FROM customers WHERE id = ?").get(req.params.id);
  res.json(customer);
});

customersRouter.delete("/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM customers WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Nicht gefunden" });
  db.prepare("DELETE FROM customers WHERE id = ?").run(req.params.id);
  res.status(204).end();
});
