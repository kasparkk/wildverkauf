-- A foreign product barcode (EAN, Code 128, ...) can be linked to a cut so the
-- till recognises it on the next scan. Unique so one code maps to one cut.
ALTER TABLE cuts ADD COLUMN IF NOT EXISTS barcode TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cuts_barcode ON cuts (barcode) WHERE barcode IS NOT NULL;
