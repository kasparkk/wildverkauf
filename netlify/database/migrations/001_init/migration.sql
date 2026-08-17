CREATE TABLE IF NOT EXISTS animals (
  id SERIAL PRIMARY KEY,
  species TEXT NOT NULL,
  date_harvested TEXT NOT NULL,
  weight_kg DOUBLE PRECISION,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cuts (
  id SERIAL PRIMARY KEY,
  animal_id INTEGER REFERENCES animals(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  weight_kg DOUBLE PRECISION,
  price_per_kg NUMERIC(12, 2),
  fixed_price NUMERIC(12, 2),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'sold')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payment_method TEXT NOT NULL DEFAULT 'bar',
  payment_status TEXT NOT NULL DEFAULT 'bezahlt' CHECK (payment_status IN ('bezahlt', 'offen')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sale_items (
  id SERIAL PRIMARY KEY,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  cut_id INTEGER REFERENCES cuts(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  weight_kg DOUBLE PRECISION,
  quantity DOUBLE PRECISION NOT NULL DEFAULT 1,
  unit_price NUMERIC(12, 2) NOT NULL,
  total_price NUMERIC(12, 2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cuts_status ON cuts (status);
CREATE INDEX IF NOT EXISTS idx_cuts_animal ON cuts (animal_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items (sale_id);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales (customer_id);
