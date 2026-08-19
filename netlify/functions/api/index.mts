import { db, normalize, normalizeAll } from "./db.mts";
import {
  authConfigError,
  checkPassword,
  clearedCookie,
  createSessionToken,
  isAuthenticated,
  isProtected,
  sessionCookie,
} from "./auth.mts";
import {
  animalSchema,
  cutSchema,
  customerSchema,
  labelStampSchema,
  saleSchema,
  saleUpdateSchema,
  settingsSchema,
} from "./schemas.mts";
import { scanConfigError, scanLabel, scanRequestSchema } from "./scan.mts";
import { buildWorkbook, collectSheets, exportFilename, toDelimited } from "./export.mts";

function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  // A missing payload would serialise to an empty body and reach the client as
  // a successful but unusable response, so surface it as the error it is.
  if (data === undefined && status !== 204) {
    return new Response(JSON.stringify({ error: "Interner Fehler: keine Daten erhalten" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
  return new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

const notFound = () => json({ error: "Nicht gefunden" }, 404);
const badRequest = (error: unknown) => json({ error }, 400);

/** Walks the error's cause chain looking for the barcode unique violation. */
function isBarcodeConflict(error: unknown): boolean {
  for (let current = error, depth = 0; current && depth < 5; depth++) {
    const e = current as { code?: string; constraint?: string; message?: string; cause?: unknown };
    if (e.code === "23505" || e.constraint === "idx_cuts_barcode") return true;
    if (typeof e.message === "string" && e.message.includes("idx_cuts_barcode")) return true;
    current = e.cause;
  }
  return false;
}

async function readBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

export default async (req: Request): Promise<Response> => {
  const configError = authConfigError();
  if (configError) return json({ error: configError }, 500);

  let path = new URL(req.url).pathname;
  for (const prefix of ["/.netlify/functions/api", "/api"]) {
    if (path.startsWith(prefix)) {
      path = path.slice(prefix.length);
      break;
    }
  }
  const segments = path.split("/").filter(Boolean);
  const [resource, rawId] = segments;
  const id = rawId ? Number(rawId) : null;
  if (rawId && !Number.isInteger(id)) return notFound();

  // --- Session endpoints (the only ones reachable without a valid cookie) ---
  if (resource === "login" && req.method === "POST") {
    if (!isProtected()) return json({ ok: true });
    const body = (await readBody(req)) as { password?: unknown };
    if (!checkPassword(body.password)) {
      return json({ error: "Falsches Passwort" }, 401);
    }
    return json({ ok: true }, 200, { "set-cookie": sessionCookie(createSessionToken()) });
  }

  if (resource === "logout" && req.method === "POST") {
    return json({ ok: true }, 200, { "set-cookie": clearedCookie() });
  }

  if (resource === "session" && req.method === "GET") {
    return json({ authenticated: isAuthenticated(req), protected: isProtected() });
  }

  if (!isAuthenticated(req)) {
    return json({ error: "Nicht angemeldet" }, 401);
  }

  try {
    switch (resource) {
      case "animals":
        return await handleAnimals(req, id);
      case "cuts":
        return await handleCuts(req, id);
      case "customers":
        return await handleCustomers(req, id);
      case "sales":
        return await handleSales(req, id);
      case "stats":
        return await handleStats(req);
      case "settings":
        return await handleSettings(req);
      case "labels":
        return await handleLabels(req);
      case "scan":
        return await handleScan(req);
      case "export":
        return await handleExport(req);
      default:
        return notFound();
    }
  } catch (error) {
    console.error("API-Fehler", error);
    // Backstop for two tills linking the same barcode at once: the driver wraps
    // the Postgres error, so the whole cause chain is inspected.
    if (isBarcodeConflict(error)) return barcodeConflict();
    return json({ error: (error as Error).message }, 500);
  }
};

// --------------------------------------------------------------------------
// Animals
// --------------------------------------------------------------------------

async function handleAnimals(req: Request, id: number | null): Promise<Response> {
  if (req.method === "GET" && id === null) {
    const rows = await db.sql`
      SELECT a.*,
        (SELECT COUNT(*) FROM cuts c WHERE c.animal_id = a.id) AS cut_count,
        (SELECT COUNT(*) FROM cuts c WHERE c.animal_id = a.id AND c.status = 'available') AS cuts_available
      FROM animals a
      ORDER BY a.date_harvested DESC, a.id DESC`;
    return json(normalizeAll(rows));
  }

  if (req.method === "GET" && id !== null) {
    const [animal] = await db.sql`SELECT * FROM animals WHERE id = ${id}`;
    if (!animal) return notFound();
    const cuts = await db.sql`SELECT * FROM cuts WHERE animal_id = ${id} ORDER BY id DESC`;
    return json({ ...normalize(animal), cuts: normalizeAll(cuts) });
  }

  if (req.method === "POST") {
    const parsed = animalSchema.safeParse(await readBody(req));
    if (!parsed.success) return badRequest(parsed.error.flatten());
    const d = parsed.data;
    const [animal] = await db.sql`
      INSERT INTO animals (species, date_harvested, weight_kg, notes)
      VALUES (${d.species}, ${d.date_harvested}, ${d.weight_kg ?? null}, ${d.notes ?? null})
      RETURNING *`;
    return json(normalize(animal), 201);
  }

  if (req.method === "PUT" && id !== null) {
    const parsed = animalSchema.partial().safeParse(await readBody(req));
    if (!parsed.success) return badRequest(parsed.error.flatten());
    const [existing] = await db.sql`SELECT * FROM animals WHERE id = ${id}`;
    if (!existing) return notFound();
    const d = { ...existing, ...parsed.data } as Record<string, any>;
    const [animal] = await db.sql`
      UPDATE animals
      SET species = ${d.species},
          date_harvested = ${d.date_harvested},
          weight_kg = ${d.weight_kg ?? null},
          notes = ${d.notes ?? null}
      WHERE id = ${id}
      RETURNING *`;
    return json(normalize(animal));
  }

  if (req.method === "DELETE" && id !== null) {
    const deleted = await db.sql`DELETE FROM animals WHERE id = ${id} RETURNING id`;
    if (deleted.length === 0) return notFound();
    return json(null, 204);
  }

  return notFound();
}

// --------------------------------------------------------------------------
// Cuts
// --------------------------------------------------------------------------

/**
 * A barcode may only point at one cut. The unique index guards against races,
 * but checking up front lets us answer with something readable instead of a
 * driver-wrapped constraint violation.
 */
async function barcodeTaken(barcode: string, exceptCutId: number | null): Promise<boolean> {
  const rows = await db.sql`
    SELECT id FROM cuts
    WHERE barcode = ${barcode} AND (${exceptCutId}::int IS NULL OR id <> ${exceptCutId}::int)
    LIMIT 1`;
  return rows.length > 0;
}

const barcodeConflict = () =>
  json({ error: "Dieser Barcode ist bereits einem anderen Teilstück zugeordnet." }, 409);

async function handleCuts(req: Request, id: number | null): Promise<Response> {
  if (req.method === "GET" && id === null) {
    const params = new URL(req.url).searchParams;
    const status = params.get("status");
    const barcode = params.get("barcode");
    const rows = await db.sql`
      SELECT c.*, a.species AS animal_species, a.date_harvested AS animal_date
      FROM cuts c
      LEFT JOIN animals a ON a.id = c.animal_id
      WHERE (${status}::text IS NULL OR c.status = ${status}::text)
        AND (${barcode}::text IS NULL OR c.barcode = ${barcode}::text)
      ORDER BY c.created_at DESC, c.id DESC`;
    return json(normalizeAll(rows));
  }

  if (req.method === "POST") {
    const parsed = cutSchema.safeParse(await readBody(req));
    if (!parsed.success) return badRequest(parsed.error.flatten());
    const d = parsed.data;
    if (d.barcode && (await barcodeTaken(d.barcode, null))) return barcodeConflict();
    const [cut] = await db.sql`
      INSERT INTO cuts (animal_id, name, weight_kg, price_per_kg, fixed_price, status, notes,
                        packed_on, best_before, barcode)
      VALUES (${d.animal_id ?? null}, ${d.name}, ${d.weight_kg ?? null}, ${d.price_per_kg ?? null},
              ${d.fixed_price ?? null}, ${d.status ?? "available"}, ${d.notes ?? null},
              ${d.packed_on ?? null}, ${d.best_before ?? null}, ${d.barcode ?? null})
      RETURNING *`;
    return json(normalize(cut), 201);
  }

  if (req.method === "PUT" && id !== null) {
    const parsed = cutSchema.partial().safeParse(await readBody(req));
    if (!parsed.success) return badRequest(parsed.error.flatten());
    const [existing] = await db.sql`SELECT * FROM cuts WHERE id = ${id}`;
    if (!existing) return notFound();
    const d = { ...existing, ...parsed.data } as Record<string, any>;
    if (d.barcode && (await barcodeTaken(d.barcode, id))) return barcodeConflict();
    const [cut] = await db.sql`
      UPDATE cuts
      SET animal_id = ${d.animal_id ?? null},
          name = ${d.name},
          weight_kg = ${d.weight_kg ?? null},
          price_per_kg = ${d.price_per_kg ?? null},
          fixed_price = ${d.fixed_price ?? null},
          status = ${d.status},
          notes = ${d.notes ?? null},
          packed_on = ${d.packed_on ?? null},
          best_before = ${d.best_before ?? null},
          barcode = ${d.barcode ?? null}
      WHERE id = ${id}
      RETURNING *`;
    return json(normalize(cut));
  }

  if (req.method === "DELETE" && id !== null) {
    const deleted = await db.sql`DELETE FROM cuts WHERE id = ${id} RETURNING id`;
    if (deleted.length === 0) return notFound();
    return json(null, 204);
  }

  return notFound();
}

// --------------------------------------------------------------------------
// Customers
// --------------------------------------------------------------------------

async function handleCustomers(req: Request, id: number | null): Promise<Response> {
  if (req.method === "GET" && id === null) {
    const rows = await db.sql`
      SELECT c.*,
        (SELECT COUNT(*) FROM sales s WHERE s.customer_id = c.id) AS sale_count,
        (SELECT COALESCE(SUM(si.total_price), 0)
           FROM sales s JOIN sale_items si ON si.sale_id = s.id
          WHERE s.customer_id = c.id) AS total_spent
      FROM customers c
      ORDER BY c.name ASC`;
    return json(normalizeAll(rows));
  }

  if (req.method === "GET" && id !== null) {
    const [customer] = await db.sql`SELECT * FROM customers WHERE id = ${id}`;
    if (!customer) return notFound();
    const sales = await db.sql`
      SELECT s.*,
        (SELECT COALESCE(SUM(total_price), 0) FROM sale_items WHERE sale_id = s.id) AS total
      FROM sales s
      WHERE s.customer_id = ${id}
      ORDER BY s.date DESC`;
    return json({ ...normalize(customer), sales: normalizeAll(sales) });
  }

  if (req.method === "POST") {
    const parsed = customerSchema.safeParse(await readBody(req));
    if (!parsed.success) return badRequest(parsed.error.flatten());
    const d = parsed.data;
    const [customer] = await db.sql`
      INSERT INTO customers (name, phone, email, address, notes)
      VALUES (${d.name}, ${d.phone ?? null}, ${d.email ?? null}, ${d.address ?? null}, ${d.notes ?? null})
      RETURNING *`;
    return json(normalize(customer), 201);
  }

  if (req.method === "PUT" && id !== null) {
    const parsed = customerSchema.partial().safeParse(await readBody(req));
    if (!parsed.success) return badRequest(parsed.error.flatten());
    const [existing] = await db.sql`SELECT * FROM customers WHERE id = ${id}`;
    if (!existing) return notFound();
    const d = { ...existing, ...parsed.data } as Record<string, any>;
    const [customer] = await db.sql`
      UPDATE customers
      SET name = ${d.name},
          phone = ${d.phone ?? null},
          email = ${d.email ?? null},
          address = ${d.address ?? null},
          notes = ${d.notes ?? null}
      WHERE id = ${id}
      RETURNING *`;
    return json(normalize(customer));
  }

  if (req.method === "DELETE" && id !== null) {
    const deleted = await db.sql`DELETE FROM customers WHERE id = ${id} RETURNING id`;
    if (deleted.length === 0) return notFound();
    return json(null, 204);
  }

  return notFound();
}

// --------------------------------------------------------------------------
// Sales
// --------------------------------------------------------------------------

async function getSaleWithItems(id: number) {
  const [sale] = await db.sql`
    SELECT s.*, c.name AS customer_name, c.phone AS customer_phone
    FROM sales s
    LEFT JOIN customers c ON c.id = s.customer_id
    WHERE s.id = ${id}`;
  if (!sale) return null;
  const items = normalizeAll(
    await db.sql`SELECT * FROM sale_items WHERE sale_id = ${id} ORDER BY id ASC`
  ) as Array<{ total_price: number }>;
  const total = items.reduce((sum, item) => sum + item.total_price, 0);
  return { ...normalize(sale), items, total };
}

async function handleSales(req: Request, id: number | null): Promise<Response> {
  if (req.method === "GET" && id === null) {
    const rows = await db.sql`
      SELECT s.*, c.name AS customer_name,
        (SELECT COALESCE(SUM(total_price), 0) FROM sale_items WHERE sale_id = s.id) AS total
      FROM sales s
      LEFT JOIN customers c ON c.id = s.customer_id
      ORDER BY s.date DESC, s.id DESC`;
    return json(normalizeAll(rows));
  }

  if (req.method === "GET" && id !== null) {
    const sale = await getSaleWithItems(id);
    return sale ? json(sale) : notFound();
  }

  if (req.method === "POST") {
    const parsed = saleSchema.safeParse(await readBody(req));
    if (!parsed.success) return badRequest(parsed.error.flatten());
    const d = parsed.data;

    const client = await db.pool.connect();
    let saleId: number;
    try {
      await client.query("BEGIN");
      const saleResult = await client.query(
        `INSERT INTO sales (customer_id, payment_method, payment_status, notes)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [d.customer_id ?? null, d.payment_method, d.payment_status, d.notes ?? null]
      );
      saleId = saleResult.rows[0].id;

      for (const item of d.items) {
        await client.query(
          `INSERT INTO sale_items (sale_id, cut_id, description, weight_kg, quantity, unit_price, total_price)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            saleId,
            item.cut_id ?? null,
            item.description,
            item.weight_kg ?? null,
            item.quantity,
            item.unit_price,
            item.unit_price * item.quantity,
          ]
        );
        if (item.cut_id) {
          await client.query(`UPDATE cuts SET status = 'sold' WHERE id = $1`, [item.cut_id]);
        }
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    return json(await getSaleWithItems(saleId), 201);
  }

  if (req.method === "PUT" && id !== null) {
    const parsed = saleUpdateSchema.safeParse(await readBody(req));
    if (!parsed.success) return badRequest(parsed.error.flatten());
    const [existing] = await db.sql`SELECT * FROM sales WHERE id = ${id}`;
    if (!existing) return notFound();
    const d = { ...existing, ...parsed.data } as Record<string, any>;
    await db.sql`
      UPDATE sales SET payment_status = ${d.payment_status}, notes = ${d.notes ?? null}
      WHERE id = ${id}`;
    return json(await getSaleWithItems(id));
  }

  if (req.method === "DELETE" && id !== null) {
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");
      const existing = await client.query(`SELECT id FROM sales WHERE id = $1`, [id]);
      if (existing.rowCount === 0) {
        await client.query("ROLLBACK");
        return notFound();
      }
      // Cancelling a sale puts its cuts back into the available stock.
      await client.query(
        `UPDATE cuts SET status = 'available'
         WHERE id IN (SELECT cut_id FROM sale_items WHERE sale_id = $1 AND cut_id IS NOT NULL)`,
        [id]
      );
      await client.query(`DELETE FROM sales WHERE id = $1`, [id]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    return json(null, 204);
  }

  return notFound();
}

// --------------------------------------------------------------------------
// Settings (key/value pairs shown on printed labels)
// --------------------------------------------------------------------------

const SETTING_DEFAULTS: Record<string, string> = {
  business_name: "",
  business_address: "",
  shelf_life_days: "14",
};

async function readSettings(): Promise<Record<string, string>> {
  const rows = (await db.sql`SELECT key, value FROM settings`) as Array<{
    key: string;
    value: string | null;
  }>;
  const stored = Object.fromEntries(rows.map((row) => [row.key, row.value ?? ""]));
  return { ...SETTING_DEFAULTS, ...stored };
}

async function handleSettings(req: Request): Promise<Response> {
  if (req.method === "GET") {
    const settings = await readSettings();
    return json({ ...settings, shelf_life_days: Number(settings.shelf_life_days) });
  }

  if (req.method === "PUT") {
    const parsed = settingsSchema.safeParse(await readBody(req));
    if (!parsed.success) return badRequest(parsed.error.flatten());

    for (const [key, value] of Object.entries(parsed.data)) {
      if (value === undefined) continue;
      await db.sql`
        INSERT INTO settings (key, value) VALUES (${key}, ${value === null ? null : String(value)})
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
    }

    const settings = await readSettings();
    return json({ ...settings, shelf_life_days: Number(settings.shelf_life_days) });
  }

  return notFound();
}

// --------------------------------------------------------------------------
// Labels
// --------------------------------------------------------------------------

async function handleLabels(req: Request): Promise<Response> {
  // Records which packaging dates were printed onto which cuts, so a reprint
  // reproduces the label already stuck on the package.
  if (req.method === "POST") {
    const parsed = labelStampSchema.safeParse(await readBody(req));
    if (!parsed.success) return badRequest(parsed.error.flatten());
    const { cut_ids, packed_on, best_before } = parsed.data;

    const updated = await db.sql`
      UPDATE cuts SET packed_on = ${packed_on}, best_before = ${best_before}
      WHERE id = ANY(${cut_ids}::int[])
      RETURNING *`;
    return json(normalizeAll(updated));
  }

  return notFound();
}

// --------------------------------------------------------------------------
// Excel export
// --------------------------------------------------------------------------

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

async function handleExport(req: Request): Promise<Response> {
  if (req.method !== "GET") return notFound();

  const params = new URL(req.url).searchParams;
  const from = params.get("from");
  const to = params.get("to");
  for (const value of [from, to]) {
    if (value !== null && !ISO_DATE.test(value)) {
      return badRequest("Datum bitte als JJJJ-MM-TT angeben.");
    }
  }

  const format = params.get("format") ?? "xlsx";

  if (format === "csv" || format === "tsv") {
    const sheetKey = params.get("sheet");
    const sheets = await collectSheets(from, to);
    const sheet = sheets.find((s) => s.key === sheetKey);
    if (!sheet) {
      return badRequest(
        `Unbekannter Datensatz. Möglich sind: ${sheets.map((s) => s.key).join(", ")}.`
      );
    }

    // Tab-separated text pastes straight into spreadsheet columns; CSV uses the
    // semicolon German Excel expects, since the decimal separator is a comma.
    const isCsv = format === "csv";
    const body = toDelimited(sheet, isCsv ? ";" : "\t", !isCsv);
    // The BOM keeps umlauts intact when Excel opens the file by double-click.
    const payload = isCsv ? `﻿${body}` : body;

    return new Response(payload, {
      headers: {
        "content-type": `text/${isCsv ? "csv" : "tab-separated-values"}; charset=utf-8`,
        ...(isCsv
          ? {
              "content-disposition": `attachment; filename="${exportFilename(from, to, "csv", sheet.key)}"`,
            }
          : {}),
        "cache-control": "no-store",
      },
    });
  }

  if (format !== "xlsx") {
    return badRequest("Format muss xlsx, csv oder tsv sein.");
  }

  const workbook = await buildWorkbook(from, to);
  return new Response(workbook, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${exportFilename(from, to, "xlsx")}"`,
      "cache-control": "no-store",
    },
  });
}

// --------------------------------------------------------------------------
// Label text recognition
// --------------------------------------------------------------------------

async function handleScan(req: Request): Promise<Response> {
  if (req.method !== "POST") return notFound();

  const configError = scanConfigError();
  if (configError) return json({ error: configError }, 503);

  const parsed = scanRequestSchema.safeParse(await readBody(req));
  if (!parsed.success) return badRequest(parsed.error.flatten());

  let result;
  try {
    result = await scanLabel(parsed.data.image, parsed.data.media_type);
  } catch (error) {
    // Raw API errors are of no use to whoever is standing there with a camera.
    console.error("Texterkennung fehlgeschlagen", error);
    const status = (error as { status?: number }).status;
    if (status === 400) {
      return json({ error: "Das Bild konnte nicht verarbeitet werden. Bitte neu aufnehmen." }, 422);
    }
    if (status === 429) {
      return json({ error: "Die Texterkennung ist gerade ausgelastet. Bitte kurz warten." }, 429);
    }
    return json({ error: "Die Texterkennung ist momentan nicht erreichbar." }, 502);
  }

  if (!result) {
    return json({ error: "Auf dem Bild war kein lesbares Etikett zu erkennen." }, 422);
  }
  return json(result);
}

// --------------------------------------------------------------------------
// Stats
// --------------------------------------------------------------------------

async function handleStats(req: Request): Promise<Response> {
  if (req.method !== "GET") return notFound();

  const [inventory] = await db.sql`
    SELECT COALESCE(SUM(
      CASE WHEN fixed_price IS NOT NULL THEN fixed_price
           WHEN price_per_kg IS NOT NULL AND weight_kg IS NOT NULL THEN price_per_kg * weight_kg
           ELSE 0 END
    ), 0) AS value
    FROM cuts WHERE status = 'available'`;

  const cutCounts = (await db.sql`
    SELECT status, COUNT(*) AS count FROM cuts GROUP BY status`) as Array<{
    status: string;
    count: string;
  }>;

  const [revenue] = await db.sql`
    SELECT COALESCE(SUM(si.total_price), 0) AS total
    FROM sales s JOIN sale_items si ON si.sale_id = s.id
    WHERE date_trunc('month', s.date) = date_trunc('month', NOW())`;

  const [openPayments] = await db.sql`
    SELECT COALESCE(SUM(si.total_price), 0) AS total
    FROM sales s JOIN sale_items si ON si.sale_id = s.id
    WHERE s.payment_status = 'offen'`;

  const recentSales = await db.sql`
    SELECT s.*, c.name AS customer_name,
      (SELECT COALESCE(SUM(total_price), 0) FROM sale_items WHERE sale_id = s.id) AS total
    FROM sales s
    LEFT JOIN customers c ON c.id = s.customer_id
    ORDER BY s.date DESC, s.id DESC
    LIMIT 5`;

  const [animals] = await db.sql`SELECT COUNT(*) AS count FROM animals`;
  const [customers] = await db.sql`SELECT COUNT(*) AS count FROM customers`;

  return json({
    inventory_value: Number((inventory as any).value),
    cut_counts: Object.fromEntries(cutCounts.map((row) => [row.status, Number(row.count)])),
    revenue_this_month: Number((revenue as any).total),
    open_payments: Number((openPayments as any).total),
    recent_sales: normalizeAll(recentSales),
    animal_count: Number((animals as any).count),
    customer_count: Number((customers as any).count),
  });
}
