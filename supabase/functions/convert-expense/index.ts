import { createClient } from "npm:@supabase/supabase-js@2.51.0";
import { buildReportingAmounts } from "../_shared/exchange-rates.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // ─── Auth — user JWT ─────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  let user: { id: string } | null = null;
  try {
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !data.user) return json({ error: "Unauthorized" }, 401);
    user = data.user;
  } catch (authErr) {
    console.error("Auth error:", authErr);
    return json({ error: "Unauthorized" }, 401);
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { expense_id } = await req.json();
  if (!expense_id) return json({ error: "Missing expense_id" }, 400);

  try {
    // ─── 1. Fetch expense — verify ownership + draft status ───────────────
    const { data: expense, error: expError } = await supabaseAdmin
      .from("expenses")
      .select("id, user_id, amount, currency, date, created_at")
      .eq("id", expense_id)
      .eq("user_id", user.id)
      .single();

    if (expError || !expense) return json({ error: "Expense not found" }, 404);

    // ─── 2. Fetch user's reporting_currency ───────────────────────────────
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("reporting_currency")
      .eq("id", user.id)
      .single();

    if (userError || !userData) return json({ error: "User not found" }, 404);
    const reportingCurrency: string = userData.reporting_currency ?? "";
    if (!reportingCurrency) return json({ error: "User reporting_currency not set" }, 422);

    // ─── 3. Fetch all supported currencies ────────────────────────────────
    const { data: currencyRows, error: currencyError } = await supabaseAdmin
      .from("lookup_currencies")
      .select("code");

    if (currencyError) return json({ error: "Failed to fetch currencies" }, 500);
    const supportedCurrencies: string[] = (currencyRows ?? []).map((c) => c.code);

    // ─── 4. Determine date to use for rate lookup ─────────────────────────
    const scanDate = expense.created_at
      ? new Date(expense.created_at).toISOString().split("T")[0]
      : null;
    const dateToUse = expense.date ?? scanDate;
    const dateLabel = expense.date ? "receipt_date" : "scan_date";

    // ─── 5. Build reporting amounts ───────────────────────────────────────
    const {
      reportingAmounts,
      exchangeRatesMap,
      reportingAmount,
      exchangeRate,
      exchangeRateDate,
      exchangeRateSource,
    } = await buildReportingAmounts(
      expense.amount,
      expense.currency,
      dateToUse,
      supportedCurrencies,
      reportingCurrency,
      dateLabel,
    );

    // ─── 6. Patch expense ─────────────────────────────────────────────────
    const { error: updateError } = await supabaseAdmin
      .from("expenses")
      .update({
        reporting_currency: reportingCurrency,
        reporting_amount: reportingAmount,
        reporting_amounts: Object.keys(reportingAmounts).length ? reportingAmounts : null,
        exchange_rate: exchangeRate,
        exchange_rates: Object.keys(exchangeRatesMap).length ? exchangeRatesMap : null,
        exchange_rate_date: exchangeRateDate,
        exchange_rate_source: exchangeRateSource,
      })
      .eq("id", expense_id);

    if (updateError) throw new Error(updateError.message);

    return json({ success: true });
  } catch (err) {
    console.error("convert-expense error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return json({ success: false, error: message }, 500);
  }
});
