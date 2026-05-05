-- Replaces lenient report total trigger with strict base_currency version.
-- Expenses: only sum reporting_amounts[base_currency] (JSONB, strict).
-- Mileage: sum amount directly (already stored in workspace base_currency at log time).
-- Also sets reports.currency = workspace base_currency on every recalculation.

-- Replace recalculate_report_total
CREATE OR REPLACE FUNCTION public.recalculate_report_total(p_report_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base_currency TEXT;
  v_expense_total NUMERIC;
  v_mileage_total NUMERIC;
BEGIN
  SELECT w.base_currency INTO v_base_currency
  FROM reports r
  JOIN workspaces w ON w.id = r.workspace_id
  WHERE r.id = p_report_id;

  IF v_base_currency IS NULL THEN RETURN; END IF;

  SELECT COALESCE(SUM((reporting_amounts ->> v_base_currency)::NUMERIC), 0)
  INTO v_expense_total
  FROM expenses
  WHERE report_id = p_report_id
    AND reporting_amounts ? v_base_currency;

  SELECT COALESCE(SUM(amount), 0)
  INTO v_mileage_total
  FROM mileage
  WHERE report_id = p_report_id;

  UPDATE reports
  SET total_amount = v_expense_total + v_mileage_total,
      currency = v_base_currency
  WHERE id = p_report_id;
END;
$$;

-- Recreate expense trigger to also watch reporting_amounts column
DROP TRIGGER IF EXISTS on_expense_report_total ON public.expenses;

CREATE OR REPLACE FUNCTION public.trigger_expense_report_total()
RETURNS TRIGGER
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

CREATE TRIGGER on_expense_report_total
AFTER INSERT OR UPDATE OF report_id, amount, reporting_amounts OR DELETE
ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.trigger_expense_report_total();
