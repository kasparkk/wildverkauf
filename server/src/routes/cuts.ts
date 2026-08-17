import { Router } from "express";
import { db } from "../db.js";
import { cutSchema } from "../types.js";

export const cutsRouter = Router();

cutsRouter.get("/", (req, res) => {
  const status = req.query.status as string | undefined;
  let query = `SELECT c.*, a.species as animal_species, a.date_harvested as animal_date
               FROM cuts c LEFT JOIN animals a ON a.id = c.animal_id`;
  const params: any[] = [];
  if (status) {
    query += ` WHERE c.status = ?`;
    params.push(status);
  }
  query += ` ORDER BY c.created_at DESC, c.id DESC`;
  const cuts = db.prepare(query).all(...params);
  res.json(cuts);
});

cutsRouter.post("/", (req, res) => {
  const parsed = cutSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const d = parsed.data;
  const info = db
    .prepare(
      `INSERT INTO cuts (animal_id, name, weight_kg, price_per_kg, fixed_price, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      d.animal_id ?? null,
      d.name,
      d.weight_kg ?? null,
      d.price_per_kg ?? null,
      d.fixed_price ?? null,
      d.status ?? "available",
      d.notes ?? null
    );
  const cut = db.prepare("SELECT * FROM cuts WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json(cut);
});

cutsRouter.put("/:id", (req, res) => {
  const parsed = cutSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = db.prepare("SELECT * FROM cuts WHERE id = ?").get(req.params.id) as any;
  if (!existing) return res.status(404).json({ error: "Nicht gefunden" });
  const d = { ...existing, ...parsed.data };
  db.prepare(
    `UPDATE cuts SET animal_id = ?, name = ?, weight_kg = ?, price_per_kg = ?, fixed_price = ?, status = ?, notes = ?
     WHERE id = ?`
  ).run(
    d.animal_id ?? null,
    d.name,
    d.weight_kg ?? null,
    d.price_per_kg ?? null,
    d.fixed_price ?? null,
    d.status,
    d.notes ?? null,
    req.params.id
  );
  const cut = db.prepare("SELECT * FROM cuts WHERE id = ?").get(req.params.id);
  res.json(cut);
});

cutsRouter.delete("/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM cuts WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Nicht gefunden" });
  db.prepare("DELETE FROM cuts WHERE id = ?").run(req.params.id);
  res.status(204).end();
});
