-- Recalculates reports.total_amount from all linked expenses + mileage
CREATE OR REPLACE FUNCTION recalculate_report_total(p_report_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE reports
  SET total_amount = (
    SELECT COALESCE(SUM(COALESCE(e.reporting_amount, e.amount)), 0)
    FROM expenses e WHERE e.report_id = p_report_id
  ) + (
    SELECT COALESCE(SUM(m.amount), 0)
    FROM mileage m WHERE m.report_id = p_report_id
  )
  WHERE id = p_report_id;
END;
$$;

-- Trigger function for expenses
CREATE OR REPLACE FUNCTION trigger_expense_report_total()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.report_id IS NOT NULL THEN
      PERFORM recalculate_report_total(OLD.report_id);
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.report_id IS DISTINCT FROM NEW.report_id THEN
    IF OLD.report_id IS NOT NULL THEN
      PERFORM recalculate_report_total(OLD.report_id);
    END IF;
  END IF;
  IF NEW.report_id IS NOT NULL THEN
    PERFORM recalculate_report_total(NEW.report_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_expense_report_total ON expenses;
CREATE TRIGGER on_expense_report_total
  AFTER INSERT OR UPDATE OF report_id, amount, reporting_amount OR DELETE
  ON expenses FOR EACH ROW EXECUTE FUNCTION trigger_expense_report_total();

-- Trigger function for mileage
CREATE OR REPLACE FUNCTION trigger_mileage_report_total()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.report_id IS NOT NULL THEN
      PERFORM recalculate_report_total(OLD.report_id);
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.report_id IS DISTINCT FROM NEW.report_id THEN
    IF OLD.report_id IS NOT NULL THEN
      PERFORM recalculate_report_total(OLD.report_id);
    END IF;
  END IF;
  IF NEW.report_id IS NOT NULL THEN
    PERFORM recalculate_report_total(NEW.report_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_mileage_report_total ON mileage;
CREATE TRIGGER on_mileage_report_total
  AFTER INSERT OR UPDATE OF report_id, amount OR DELETE
  ON mileage FOR EACH ROW EXECUTE FUNCTION trigger_mileage_report_total();
