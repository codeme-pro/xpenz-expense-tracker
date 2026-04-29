-- Phase 8: link mileage to reports + rejection note
ALTER TABLE mileage ADD COLUMN report_id uuid REFERENCES reports(id) ON DELETE SET NULL;
ALTER TABLE reports ADD COLUMN rejection_note text;
