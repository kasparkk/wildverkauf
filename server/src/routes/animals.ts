import { Router } from "express";
import { db } from "../db.js";
import { animalSchema } from "../types.js";

export const animalsRouter = Router();

animalsRouter.get("/", (_req, res) => {
  const animals = db
    .prepare(
      `SELECT a.*,
        (SELECT COUNT(*) FROM cuts c WHERE c.animal_id = a.id) as cut_count,
        (SELECT COUNT(*) FROM cuts c WHERE c.animal_id = a.id AND c.status = 'available') as cuts_available
       FROM animals a ORDER BY date_harvested DESC, id DESC`
    )
    .all();
  res.json(animals);
});

animalsRouter.get("/:id", (req, res) => {
  const animal = db.prepare("SELECT * FROM animals WHERE id = ?").get(req.params.id);
  if (!animal) return res.status(404).json({ error: "Nicht gefunden" });
  const cuts = db.prepare("SELECT * FROM cuts WHERE animal_id = ? ORDER BY id DESC").all(req.params.id);
  res.json({ ...animal, cuts });
});

animalsRouter.post("/", (req, res) => {
  const parsed = animalSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const d = parsed.data;
  const info = db
    .prepare(
      `INSERT INTO animals (species, date_harvested, weight_kg, notes) VALUES (?, ?, ?, ?)`
    )
    .run(d.species, d.date_harvested, d.weight_kg ?? null, d.notes ?? null);
  const animal = db.prepare("SELECT * FROM animals WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json(animal);
});

animalsRouter.put("/:id", (req, res) => {
  const parsed = animalSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = db.prepare("SELECT * FROM animals WHERE id = ?").get(req.params.id) as any;
  if (!existing) return res.status(404).json({ error: "Nicht gefunden" });
  const d = { ...existing, ...parsed.data };
  db.prepare(
    `UPDATE animals SET species = ?, date_harvested = ?, weight_kg = ?, notes = ? WHERE id = ?`
  ).run(d.species, d.date_harvested, d.weight_kg ?? null, d.notes ?? null, req.params.id);
  const animal = db.prepare("SELECT * FROM animals WHERE id = ?").get(req.params.id);
  res.json(animal);
});

animalsRouter.delete("/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM animals WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Nicht gefunden" });
  db.prepare("DELETE FROM animals WHERE id = ?").run(req.params.id);
  res.status(204).end();
});
