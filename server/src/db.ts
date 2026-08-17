import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "wildverkauf.sqlite");
export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS animals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  species TEXT NOT NULL,
  date_harvested TEXT NOT NULL,
  weight_kg REAL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cuts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  animal_id INTEGER REFERENCES animals(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  weight_kg REAL,
  price_per_kg REAL,
  fixed_price REAL,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','reserved','sold')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  date TEXT NOT NULL DEFAULT (datetime('now')),
  payment_method TEXT NOT NULL DEFAULT 'bar',
  payment_status TEXT NOT NULL DEFAULT 'bezahlt' CHECK (payment_status IN ('bezahlt','offen')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  cut_id INTEGER REFERENCES cuts(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  weight_kg REAL,
  quantity REAL NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL,
  total_price REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cuts_status ON cuts(status);
CREATE INDEX IF NOT EXISTS idx_cuts_animal ON cuts(animal_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
`);
