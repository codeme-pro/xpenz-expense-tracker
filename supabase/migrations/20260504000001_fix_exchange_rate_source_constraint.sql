ALTER TABLE expenses DROP CONSTRAINT expenses_exchange_rate_source_check;

ALTER TABLE expenses ADD CONSTRAINT expenses_exchange_rate_source_check
  CHECK (
    exchange_rate_source IS NULL OR
    exchange_rate_source = ANY (ARRAY['receipt_date', 'scan_date', 'approx. today'])
  );
