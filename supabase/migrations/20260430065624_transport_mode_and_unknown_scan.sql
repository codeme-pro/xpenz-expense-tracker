-- Add 'unknown' to scans.status check constraint
ALTER TABLE public.scans DROP CONSTRAINT scans_status_check;
ALTER TABLE public.scans ADD CONSTRAINT scans_status_check
  CHECK (status = ANY (ARRAY['uploaded','processing','parsed','failed','unknown']));

-- Create lookup_transport_mode table
CREATE TABLE IF NOT EXISTS public.lookup_transport_mode (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE
);

ALTER TABLE public.lookup_transport_mode ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read transport modes"
  ON public.lookup_transport_mode FOR SELECT
  TO authenticated USING (true);

INSERT INTO public.lookup_transport_mode (name, slug) VALUES
  ('Driving', 'driving'),
  ('Motorcycle', 'motorcycle'),
  ('Public Transit', 'transit'),
  ('Walking', 'walking'),
  ('Unknown', 'unknown')
ON CONFLICT (slug) DO NOTHING;

-- Add transport_mode FK to mileage
ALTER TABLE public.mileage
  ADD COLUMN IF NOT EXISTS transport_mode uuid
  REFERENCES public.lookup_transport_mode(id) ON DELETE SET NULL;
