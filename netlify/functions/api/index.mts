import { db, normalize, normalizeAll } from "./db.mts";
import {
  authConfigError,
  checkPassword,
  clearedCookie,
  createSessionToken,
  isAuthenticated,
  sessionCookie,
} from "./auth.mts";
import {
  animalSchema,
  cutSchema,
  customerSchema,
  saleSchema,
  saleUpdateSchema,
} from "./schemas.mts";

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
    return json({ authenticated: isAuthenticated(req) });
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
      default:
        return notFound();
    }
  } catch (error) {
    console.error("API-Fehler", error);
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

async function handleCuts(req: Request, id: number | null): Promise<Response> {
  if (req.method === "GET" && id === null) {
    const status = new URL(req.url).searchParams.get("status");
    const rows = await db.sql`
      SELECT c.*, a.species AS animal_species, a.date_harvested AS animal_date
      FROM cuts c
      LEFT JOIN animals a ON a.id = c.animal_id
      WHERE (${status}::text IS NULL OR c.status = ${status}::text)
      ORDER BY c.created_at DESC, c.id DESC`;
    return json(normalizeAll(rows));
  }

  if (req.method === "POST") {
    const parsed = cutSchema.safeParse(await readBody(req));
    if (!parsed.success) return badRequest(parsed.error.flatten());
    const d = parsed.data;
    const [cut] = await db.sql`
      INSERT INTO cuts (animal_id, name, weight_kg, price_per_kg, fixed_price, status, notes)
      VALUES (${d.animal_id ?? null}, ${d.name}, ${d.weight_kg ?? null}, ${d.price_per_kg ?? null},
              ${d.fixed_price ?? null}, ${d.status ?? "available"}, ${d.notes ?? null})
      RETURNING *`;
    return json(normalize(cut), 201);
  }

  if (req.method === "PUT" && id !== null) {
    const parsed = cutSchema.partial().safeParse(await readBody(req));
    if (!parsed.success) return badRequest(parsed.error.flatten());
    const [existing] = await db.sql`SELECT * FROM cuts WHERE id = ${id}`;
    if (!existing) return notFound();
    const d = { ...existing, ...parsed.data } as Record<string, any>;
    const [cut] = await db.sql`
      UPDATE cuts
      SET animal_id = ${d.animal_id ?? null},
          name = ${d.name},
          weight_kg = ${d.weight_kg ?? null},
          price_per_kg = ${d.price_per_kg ?? null},
          fixed_price = ${d.fixed_price ?? null},
          status = ${d.status},
          notes = ${d.notes ?? null}
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
