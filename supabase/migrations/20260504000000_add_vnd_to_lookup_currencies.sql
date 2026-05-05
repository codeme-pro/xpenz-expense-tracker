INSERT INTO lookup_currencies (code, name, symbol, sort_order) VALUES ('VND', 'Vietnamese Dong', '₫', 999) ON CONFLICT (code) DO NOTHING;
