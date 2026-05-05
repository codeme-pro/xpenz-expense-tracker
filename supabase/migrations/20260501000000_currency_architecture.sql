-- Phase A: Currency Architecture
-- A1: lookup_currencies table
CREATE TABLE IF NOT EXISTS public.lookup_currencies (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  symbol TEXT,
  sort_order INTEGER DEFAULT 999
);

ALTER TABLE public.lookup_currencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lookup_currencies_read" ON public.lookup_currencies
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.lookup_currencies (code, name, symbol, sort_order) VALUES
  ('MYR', 'Malaysian Ringgit', 'RM', 1),
  ('USD', 'US Dollar', '$', 2),
  ('SGD', 'Singapore Dollar', 'S$', 3),
  ('EUR', 'Euro', '€', 4),
  ('GBP', 'British Pound', '£', 5),
  ('AUD', 'Australian Dollar', 'A$', 6),
  ('JPY', 'Japanese Yen', '¥', 7),
  ('CNY', 'Chinese Yuan', '¥', 8),
  ('THB', 'Thai Baht', '฿', 9),
  ('IDR', 'Indonesian Rupiah', 'Rp', 10),
  ('PHP', 'Philippine Peso', '₱', 11),
  ('CAD', 'Canadian Dollar', 'CA$', 12),
  ('CHF', 'Swiss Franc', 'Fr', 13),
  ('INR', 'Indian Rupee', '₹', 14)
ON CONFLICT (code) DO NOTHING;

-- A2: workspace base currency
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS base_currency TEXT DEFAULT 'MYR'
  REFERENCES public.lookup_currencies(code);

-- A3: mileage currency (always = workspace base_currency at time of log)
ALTER TABLE public.mileage
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'MYR'
  REFERENCES public.lookup_currencies(code);

-- A4: drop redundant raw_json from expenses
-- scans.raw_json covers audit trail; all fields normalized into columns + expense_items table
ALTER TABLE public.expenses DROP COLUMN IF EXISTS raw_json;

-- A5: multi-currency JSONB for pre-computed conversions at scan time
-- reporting_amounts: { "USD": 24.00, "EUR": 18.50, ... } — locked at scan time
-- exchange_rates:   { "USD": 0.24,  "EUR": 0.185, ... }
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS reporting_amounts JSONB,
  ADD COLUMN IF NOT EXISTS exchange_rates JSONB;
