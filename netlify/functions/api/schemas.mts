import { z } from "zod";

export const animalSchema = z.object({
  species: z.string().min(1),
  date_harvested: z.string().min(1),
  weight_kg: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const cutSchema = z.object({
  animal_id: z.number().int().nullable().optional(),
  name: z.string().min(1),
  weight_kg: z.number().nullable().optional(),
  price_per_kg: z.number().nullable().optional(),
  fixed_price: z.number().nullable().optional(),
  status: z.enum(["available", "reserved", "sold"]).optional(),
  notes: z.string().nullable().optional(),
  packed_on: z.string().nullable().optional(),
  best_before: z.string().nullable().optional(),
});

export const settingsSchema = z.object({
  business_name: z.string().nullable().optional(),
  business_address: z.string().nullable().optional(),
  shelf_life_days: z.number().int().positive().nullable().optional(),
});

/** Stamps packaging and best-before dates onto the cuts being labelled. */
export const labelStampSchema = z.object({
  cut_ids: z.array(z.number().int()).min(1),
  packed_on: z.string().min(1),
  best_before: z.string().min(1),
});

export const customerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const saleItemInputSchema = z.object({
  cut_id: z.number().int().nullable().optional(),
  description: z.string().min(1),
  weight_kg: z.number().nullable().optional(),
  quantity: z.number().positive().default(1),
  unit_price: z.number().nonnegative(),
});

export const saleSchema = z.object({
  customer_id: z.number().int().nullable().optional(),
  payment_method: z.string().min(1).default("bar"),
  payment_status: z.enum(["bezahlt", "offen"]).default("bezahlt"),
  notes: z.string().nullable().optional(),
  items: z.array(saleItemInputSchema).min(1),
});

export const saleUpdateSchema = z.object({
  payment_status: z.enum(["bezahlt", "offen"]).optional(),
  notes: z.string().nullable().optional(),
});
