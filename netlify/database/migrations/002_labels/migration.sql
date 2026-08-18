-- Business details and defaults that appear on printed labels.
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- Packaging and best-before dates are stored per cut so a reprinted label
-- always carries the same dates as the one already on the package.
ALTER TABLE cuts ADD COLUMN IF NOT EXISTS packed_on TEXT;
ALTER TABLE cuts ADD COLUMN IF NOT EXISTS best_before TEXT;
