export interface ReportingAmountsResult {
  reportingAmounts: Record<string, number>;
  exchangeRatesMap: Record<string, number>;
  reportingAmount: number | null;
  exchangeRate: number | null;
  exchangeRateDate: string | null;
  exchangeRateSource: string | null;
}

export async function fetchExchangeRate(
  from: string,
  to: string,
  date: string,
): Promise<{ rate: number; today: boolean } | null> {
  const fromL = from.toLowerCase();
  const toL = to.toLowerCase();

  // 1. Frankfurter historical
  try {
    const res = await fetch(`https://api.frankfurter.dev/v1/${date}?from=${from}&to=${to}`);
    if (res.ok) {
      const data = await res.json();
      const rate = data.rates?.[to] as number | undefined;
      if (rate) return { rate, today: false };
    }
  } catch { /* continue */ }

  // 2. fawazahmed0 historical (200+ currencies incl. VND, from ~Jun 2024)
  for (const url of [
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${date}/v1/currencies/${fromL}.json`,
    `https://${date}.currency-api.pages.dev/v1/currencies/${fromL}.json`,
  ]) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const rate = data[fromL]?.[toL] as number | undefined;
        if (rate) return { rate, today: false };
      }
    } catch { /* continue */ }
  }

  // 3. Frankfurter today
  try {
    const res = await fetch(`https://api.frankfurter.dev/v1/latest?from=${from}&to=${to}`);
    if (res.ok) {
      const data = await res.json();
      const rate = data.rates?.[to] as number | undefined;
      if (rate) return { rate, today: true };
    }
  } catch { /* continue */ }

  // 4. fawazahmed0 latest (200+ currencies incl. VND — today's rate for any pair)
  for (const url of [
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${fromL}.json`,
    `https://latest.currency-api.pages.dev/v1/currencies/${fromL}.json`,
  ]) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const rate = data[fromL]?.[toL] as number | undefined;
        if (rate) return { rate, today: true };
      }
    } catch { /* continue */ }
  }

  return null;
}

/**
 * Fan-out exchange rate fetch for all supportedCurrencies.
 * dateLabel is used as exchangeRateSource when historical rates are available
 * (e.g. "receipt_date", "scan_date", "edit_date").
 */
export async function buildReportingAmounts(
  amount: number,
  currency: string,
  date: string | null,
  supportedCurrencies: string[],
  reportingCurrency: string,
  dateLabel: string,
): Promise<ReportingAmountsResult> {
  const reportingAmounts: Record<string, number> = {};
  const exchangeRatesMap: Record<string, number> = {};
  let exchangeRateDate: string | null = null;
  let exchangeRateSource: string | null = null;

  if (date) {
    const rateResults = await Promise.allSettled(
      supportedCurrencies.map(async (code) => {
        if (code === currency) {
          return { code, rate: 1, amount, today: false };
        }
        const result = await fetchExchangeRate(currency, code, date);
        if (!result) return null;
        return {
          code,
          rate: result.rate,
          amount: Math.round(amount * result.rate * 100) / 100,
          today: result.today,
        };
      }),
    );

    for (const r of rateResults) {
      if (r.status === "fulfilled" && r.value) {
        reportingAmounts[r.value.code] = r.value.amount;
        exchangeRatesMap[r.value.code] = r.value.rate;
      }
    }

    // Use user's reportingCurrency result to determine date/source metadata
    const legacyEntry = rateResults.find(
      (r) =>
        r.status === "fulfilled" &&
        (r as PromiseFulfilledResult<{ code: string; today: boolean } | null>).value?.code === reportingCurrency,
    ) as PromiseFulfilledResult<{ code: string; rate: number; amount: number; today: boolean } | null> | undefined;

    if (legacyEntry?.value) {
      if (legacyEntry.value.today) {
        exchangeRateDate = new Date().toISOString().split("T")[0];
        exchangeRateSource = "approx. today";
      } else {
        exchangeRateDate = date;
        exchangeRateSource = dateLabel;
      }
    }
  } else {
    reportingAmounts[currency] = amount;
    exchangeRatesMap[currency] = 1;
  }

  const reportingAmount = reportingAmounts[reportingCurrency] ?? null;
  const exchangeRate = exchangeRatesMap[reportingCurrency] ?? null;

  return {
    reportingAmounts,
    exchangeRatesMap,
    reportingAmount,
    exchangeRate,
    exchangeRateDate,
    exchangeRateSource,
  };
}
