import ExcelJS from "exceljs";
import { db } from "./db.mts";

// Number format codes are stored with the invariant English tokens; Excel
// shows them localised (a German Excel displays this date format as TT.MM.JJJJ).
const EURO = '#,##0.00 "€"';
const KG = '#,##0.000 " kg"';
const DATE = "dd.mm.yyyy";

const STATUS_LABELS: Record<string, string> = {
  available: "Verfügbar",
  reserved: "Reserviert",
  sold: "Verkauft",
};

type CellKind = "text" | "number" | "money" | "weight" | "date";

interface Column {
  header: string;
  key: string;
  width: number;
  kind: CellKind;
}

export interface SheetSpec {
  /** Slug used in the URL. */
  key: string;
  name: string;
  columns: Column[];
  rows: Record<string, unknown>[];
}

function numFmt(kind: CellKind): string | undefined {
  if (kind === "money") return EURO;
  if (kind === "weight") return KG;
  if (kind === "date") return DATE;
  return undefined;
}

/** Postgres hands NUMERIC back as a string; Excel needs real numbers. */
function num(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function date(value: unknown): Date | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function cutTotal(cut: any): number | null {
  const fixed = num(cut.fixed_price);
  if (fixed !== null) return fixed;
  const perKg = num(cut.price_per_kg);
  const weight = num(cut.weight_kg);
  return perKg !== null && weight !== null ? perKg * weight : null;
}

/**
 * Collects every sheet once so the workbook and the text formats cannot drift
 * apart. `from`/`to` narrow the sales sheets only — stock and customers are
 * always complete, since they describe the current state rather than a period.
 */
export async function collectSheets(from: string | null, to: string | null): Promise<SheetSpec[]> {
  const cuts = (await db.sql`
    SELECT c.*, a.species AS animal_species, a.date_harvested AS animal_date
    FROM cuts c LEFT JOIN animals a ON a.id = c.animal_id
    ORDER BY c.id`) as any[];

  const animals = (await db.sql`
    SELECT a.*,
      (SELECT COUNT(*) FROM cuts c WHERE c.animal_id = a.id) AS cut_count,
      (SELECT COUNT(*) FROM cuts c WHERE c.animal_id = a.id AND c.status = 'available') AS cuts_available
    FROM animals a ORDER BY a.date_harvested DESC, a.id DESC`) as any[];

  const sales = (await db.sql`
    SELECT s.*, c.name AS customer_name,
      (SELECT COALESCE(SUM(total_price), 0) FROM sale_items WHERE sale_id = s.id) AS total
    FROM sales s LEFT JOIN customers c ON c.id = s.customer_id
    WHERE (${from}::date IS NULL OR s.date >= ${from}::date)
      AND (${to}::date IS NULL OR s.date < ${to}::date + 1)
    ORDER BY s.date, s.id`) as any[];

  const items = (await db.sql`
    SELECT si.*, s.date, c.name AS customer_name
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    LEFT JOIN customers c ON c.id = s.customer_id
    WHERE (${from}::date IS NULL OR s.date >= ${from}::date)
      AND (${to}::date IS NULL OR s.date < ${to}::date + 1)
    ORDER BY s.date, si.sale_id, si.id`) as any[];

  const customers = (await db.sql`
    SELECT c.*,
      (SELECT COUNT(*) FROM sales s WHERE s.customer_id = c.id) AS sale_count,
      (SELECT COALESCE(SUM(si.total_price), 0) FROM sales s
         JOIN sale_items si ON si.sale_id = s.id WHERE s.customer_id = c.id) AS total_spent
    FROM customers c ORDER BY c.name`) as any[];

  return [
    {
      key: "bestand",
      name: "Bestand",
      columns: [
        { header: "Nr.", key: "id", width: 6, kind: "number" },
        { header: "Teilstück", key: "name", width: 22, kind: "text" },
        { header: "Wildart", key: "species", width: 16, kind: "text" },
        { header: "Erlegt am", key: "harvested", width: 13, kind: "date" },
        { header: "Gewicht", key: "weight", width: 13, kind: "weight" },
        { header: "Preis/kg", key: "perKg", width: 13, kind: "money" },
        { header: "Festpreis", key: "fixed", width: 13, kind: "money" },
        { header: "Gesamtpreis", key: "total", width: 14, kind: "money" },
        { header: "Status", key: "status", width: 13, kind: "text" },
        { header: "Barcode", key: "barcode", width: 18, kind: "text" },
        { header: "Verpackt am", key: "packed", width: 13, kind: "date" },
        { header: "Haltbar bis", key: "best", width: 13, kind: "date" },
        { header: "Notizen", key: "notes", width: 30, kind: "text" },
      ],
      rows: cuts.map((cut) => ({
        id: cut.id,
        name: cut.name,
        species: cut.animal_species ?? "",
        harvested: date(cut.animal_date),
        weight: num(cut.weight_kg),
        perKg: num(cut.price_per_kg),
        fixed: num(cut.fixed_price),
        total: cutTotal(cut),
        status: STATUS_LABELS[cut.status] ?? cut.status,
        barcode: cut.barcode ?? "",
        packed: date(cut.packed_on),
        best: date(cut.best_before),
        notes: cut.notes ?? "",
      })),
    },
    {
      key: "wildtiere",
      name: "Wildtiere",
      columns: [
        { header: "Nr.", key: "id", width: 6, kind: "number" },
        { header: "Wildart", key: "species", width: 16, kind: "text" },
        { header: "Erlegt am", key: "harvested", width: 13, kind: "date" },
        { header: "Gewicht", key: "weight", width: 13, kind: "weight" },
        { header: "Teilstücke", key: "cuts", width: 12, kind: "number" },
        { header: "davon verfügbar", key: "available", width: 16, kind: "number" },
        { header: "Notizen", key: "notes", width: 30, kind: "text" },
      ],
      rows: animals.map((animal) => ({
        id: animal.id,
        species: animal.species,
        harvested: date(animal.date_harvested),
        weight: num(animal.weight_kg),
        cuts: num(animal.cut_count),
        available: num(animal.cuts_available),
        notes: animal.notes ?? "",
      })),
    },
    {
      key: "verkaeufe",
      name: "Verkäufe",
      columns: [
        { header: "Beleg-Nr.", key: "id", width: 11, kind: "number" },
        { header: "Datum", key: "date", width: 13, kind: "date" },
        { header: "Kunde", key: "customer", width: 24, kind: "text" },
        { header: "Zahlungsart", key: "method", width: 14, kind: "text" },
        { header: "Status", key: "status", width: 12, kind: "text" },
        { header: "Summe", key: "total", width: 13, kind: "money" },
        { header: "Notizen", key: "notes", width: 30, kind: "text" },
      ],
      rows: sales.map((sale) => ({
        id: sale.id,
        date: date(sale.date),
        customer: sale.customer_name ?? "Laufkundschaft",
        method: sale.payment_method,
        status: sale.payment_status === "offen" ? "Offen" : "Bezahlt",
        total: num(sale.total),
        notes: sale.notes ?? "",
      })),
    },
    {
      key: "positionen",
      name: "Verkaufspositionen",
      columns: [
        { header: "Beleg-Nr.", key: "saleId", width: 11, kind: "number" },
        { header: "Datum", key: "date", width: 13, kind: "date" },
        { header: "Kunde", key: "customer", width: 24, kind: "text" },
        { header: "Artikel", key: "description", width: 26, kind: "text" },
        { header: "Gewicht", key: "weight", width: 13, kind: "weight" },
        { header: "Menge", key: "quantity", width: 10, kind: "number" },
        { header: "Einzelpreis", key: "unit", width: 13, kind: "money" },
        { header: "Gesamt", key: "total", width: 13, kind: "money" },
      ],
      rows: items.map((item) => ({
        saleId: item.sale_id,
        date: date(item.date),
        customer: item.customer_name ?? "Laufkundschaft",
        description: item.description,
        weight: num(item.weight_kg),
        quantity: num(item.quantity),
        unit: num(item.unit_price),
        total: num(item.total_price),
      })),
    },
    {
      key: "kunden",
      name: "Kunden",
      columns: [
        { header: "Nr.", key: "id", width: 6, kind: "number" },
        { header: "Name", key: "name", width: 24, kind: "text" },
        { header: "Telefon", key: "phone", width: 18, kind: "text" },
        { header: "E-Mail", key: "email", width: 26, kind: "text" },
        { header: "Adresse", key: "address", width: 32, kind: "text" },
        { header: "Käufe", key: "count", width: 9, kind: "number" },
        { header: "Umsatz", key: "spent", width: 13, kind: "money" },
        { header: "Notizen", key: "notes", width: 30, kind: "text" },
      ],
      rows: customers.map((customer) => ({
        id: customer.id,
        name: customer.name,
        phone: customer.phone ?? "",
        email: customer.email ?? "",
        address: customer.address ?? "",
        count: num(customer.sale_count),
        spent: num(customer.total_spent),
        notes: customer.notes ?? "",
      })),
    },
  ];
}

// --------------------------------------------------------------------------
// Workbook
// --------------------------------------------------------------------------

export async function buildWorkbook(from: string | null, to: string | null): Promise<ArrayBuffer> {
  const book = new ExcelJS.Workbook();
  book.creator = "Wildverkauf";
  book.created = new Date();

  for (const spec of await collectSheets(from, to)) {
    const sheet = book.addWorksheet(spec.name);
    sheet.columns = spec.columns.map(({ header, key, width }) => ({ header, key, width }));

    for (const column of spec.columns) {
      const format = numFmt(column.kind);
      if (format) sheet.getColumn(column.key).numFmt = format;
    }

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE1EBDE" } };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: spec.columns.length } };
    sheet.addRows(spec.rows as any[]);
  }

  return book.xlsx.writeBuffer();
}

// --------------------------------------------------------------------------
// Delimited text (clipboard and CSV)
// --------------------------------------------------------------------------

/** German conventions: comma as decimal separator, dotted dates. */
function formatCell(value: unknown, kind: CellKind): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    const day = String(value.getUTCDate()).padStart(2, "0");
    const month = String(value.getUTCMonth() + 1).padStart(2, "0");
    return `${day}.${month}.${value.getUTCFullYear()}`;
  }
  if (typeof value === "number") {
    const decimals = kind === "money" ? 2 : kind === "weight" ? 3 : 0;
    return value.toFixed(Number.isInteger(value) && kind === "number" ? 0 : decimals).replace(".", ",");
  }
  return String(value);
}

function escapeCell(text: string, delimiter: string): string {
  if (!text.includes(delimiter) && !text.includes('"') && !/[\r\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

export function toDelimited(
  spec: SheetSpec,
  delimiter: string,
  /**
   * Folds line breaks inside a cell onto one line. Set for clipboard output:
   * spreadsheets disagree on how to reassemble a quoted multi-line field when
   * pasting, so a note with a line break could land in the wrong row. Files are
   * parsed properly, so they keep the real line breaks.
   */
  collapseNewlines = false
): string {
  const cell = (value: string) =>
    escapeCell(collapseNewlines ? value.replace(/\r?\n/g, " / ") : value, delimiter);

  const lines = [spec.columns.map((c) => cell(c.header)).join(delimiter)];
  for (const row of spec.rows) {
    lines.push(
      spec.columns.map((column) => cell(formatCell(row[column.key], column.kind))).join(delimiter)
    );
  }
  return lines.join("\r\n");
}

export function exportFilename(from: string | null, to: string | null, extension: string, sheet?: string): string {
  const range = from || to ? `_${from ?? "Anfang"}_bis_${to ?? "heute"}` : "";
  const part = sheet ? `_${sheet}` : "";
  return `Wildverkauf${part}${range}_${new Date().toISOString().slice(0, 10)}.${extension}`;
}
