-- ─── 1. Upgrade lookup_categories schema ──────────────────────────────────────
ALTER TABLE lookup_categories
  ADD COLUMN IF NOT EXISTS group_name text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS sort_order integer;

-- ─── 2. Update 3 existing rows that keep their names ──────────────────────────
-- (Entertainment, Office Supplies, Others already exist — update in place)
UPDATE lookup_categories SET
  group_name = 'Meals & Entertainment',
  description = 'Event tickets or activities used for client networking',
  sort_order = 203
WHERE name = 'Entertainment' AND group_name IS NULL;

UPDATE lookup_categories SET
  group_name = 'Office & Technology',
  description = 'Paper, pens, toner, and stationery',
  sort_order = 303
WHERE name = 'Office Supplies' AND group_name IS NULL;

UPDATE lookup_categories SET
  group_name = 'Insurance & Miscellaneous',
  description = 'Anything not covered by the categories above',
  sort_order = 704
WHERE name = 'Others' AND group_name IS NULL;

-- ─── 3. Insert 26 new corporate categories (excluding the 3 updated above) ────
INSERT INTO lookup_categories (id, name, group_name, description, sort_order) VALUES
  -- Travel & Lodging
  (gen_random_uuid(), 'Airfare',                  'Travel & Lodging',           'Flights, seat upgrades, and baggage fees',               101),
  (gen_random_uuid(), 'Hotel/Lodging',             'Travel & Lodging',           'Room rates, taxes, and mandatory resort fees',           102),
  (gen_random_uuid(), 'Car Rental',                'Travel & Lodging',           'Vehicle hire and rental insurance',                     103),
  (gen_random_uuid(), 'Ground Transportation',     'Travel & Lodging',           'Taxis, Grab/Uber/Lyft, trains, and shuttles',           104),
  (gen_random_uuid(), 'Parking & Tolls',           'Travel & Lodging',           'Airport parking and highway tolls',                     105),
  (gen_random_uuid(), 'Per Diem',                  'Travel & Lodging',           'Daily fixed allowance for meals and incidentals',       106),
  -- Meals & Entertainment (3 new; Entertainment already exists above)
  (gen_random_uuid(), 'Business Meals (Internal)', 'Meals & Entertainment',      'Meals with coworkers for project meetings',             201),
  (gen_random_uuid(), 'Business Meals (Client)',   'Meals & Entertainment',      'Dining with prospects or existing clients',             202),
  (gen_random_uuid(), 'Office Snacks/Catering',    'Meals & Entertainment',      'Group lunches or kitchen restocking',                   204),
  -- Office & Technology (4 new; Office Supplies already exists above)
  (gen_random_uuid(), 'Software/SaaS',             'Office & Technology',        'Recurring subscriptions such as Slack, Zoom, Adobe',   301),
  (gen_random_uuid(), 'Hardware',                  'Office & Technology',        'Laptops, monitors, keyboards, and mice',               302),
  (gen_random_uuid(), 'Telecommunications',        'Office & Technology',        'Company mobile phone bills or home internet stipends', 304),
  (gen_random_uuid(), 'Postage & Shipping',        'Office & Technology',        'FedEx, UPS, or courier services',                     305),
  -- Auto & Mileage
  (gen_random_uuid(), 'Fuel',                      'Auto & Mileage',             'Petrol or diesel receipts for company or rental vehicles', 401),
  -- Professional Development
  (gen_random_uuid(), 'Training & Certifications', 'Professional Development',   'Courses, exams, and professional licenses',             501),
  (gen_random_uuid(), 'Conferences & Events',      'Professional Development',   'Ticket fees and registration costs',                   502),
  (gen_random_uuid(), 'Memberships',               'Professional Development',   'Industry associations or professional bodies',          503),
  (gen_random_uuid(), 'Books & Resources',         'Professional Development',   'Technical manuals or educational subscriptions',        504),
  -- Operations & Facilities
  (gen_random_uuid(), 'Rent',                      'Operations & Facilities',    'Satellite offices or co-working spaces such as WeWork', 601),
  (gen_random_uuid(), 'Marketing/Advertising',     'Operations & Facilities',    'Ad spend and promotional materials',                    602),
  (gen_random_uuid(), 'Legal & Professional',      'Operations & Facilities',    'Consultant fees, legal advice, or bookkeeping',         603),
  (gen_random_uuid(), 'Recruiting',                'Operations & Facilities',    'Job board postings and interview travel for candidates', 604),
  -- Insurance & Miscellaneous (3 new; Others already exists above)
  (gen_random_uuid(), 'Business Insurance',        'Insurance & Miscellaneous',  'Liability or equipment insurance',                     701),
  (gen_random_uuid(), 'Bank Charges',              'Insurance & Miscellaneous',  'Wire transfer fees or corporate card interest',         702),
  (gen_random_uuid(), 'Gifts',                     'Insurance & Miscellaneous',  'Client holiday gifts or employee recognition',          703);

-- ─── 4. Remap expense_items FKs for 7 old categories being deleted ────────────
-- (Entertainment, Office Supplies, Others kept in place — no remap needed)
WITH mapping(old_name, new_name) AS (
  VALUES
    ('Food & Beverage', 'Business Meals (Internal)'),
    ('Transport',       'Ground Transportation'),
    ('Accommodation',   'Hotel/Lodging'),
    ('Education',       'Training & Certifications'),
    ('Healthcare',      'Others'),
    ('Shopping',        'Others'),
    ('Utilities',       'Telecommunications')
),
old_cats AS (
  SELECT lc.id AS old_id, m.new_name
  FROM lookup_categories lc
  JOIN mapping m ON lc.name = m.old_name
  WHERE lc.group_name IS NULL
),
new_cats AS (
  SELECT lc.id AS new_id, lc.name
  FROM lookup_categories lc
  WHERE lc.group_name IS NOT NULL
)
UPDATE expense_items ei
SET category_id = nc.new_id
FROM old_cats oc
JOIN new_cats nc ON nc.name = oc.new_name
WHERE ei.category_id = oc.old_id;

-- Safety net: null-out any remaining refs to unmapped old rows
UPDATE expense_items
SET category_id = NULL
WHERE category_id IN (
  SELECT id FROM lookup_categories WHERE group_name IS NULL
);

-- ─── 5. Delete 7 old categories ───────────────────────────────────────────────
DELETE FROM lookup_categories
WHERE group_name IS NULL;

-- ─── 6. Add category_id to expenses ───────────────────────────────────────────
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES lookup_categories(id);

-- ─── 7. Backfill expenses.category_id from first expense_item ─────────────────
UPDATE expenses e
SET category_id = (
  SELECT ei.category_id
  FROM expense_items ei
  WHERE ei.expense_id = e.id AND ei.category_id IS NOT NULL
  LIMIT 1
)
WHERE e.category_id IS NULL;
