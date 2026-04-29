import { createClient } from "npm:@supabase/supabase-js@2.51.0";
import { Mistral } from "npm:@mistralai/mistralai";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExpenseItem {
  name: string;
  quantity: number;
  unit_price: number | null;
  total_price: number | null;
  computed_total_price: number | null;
  category_id: string;
}

interface ParsedExpense {
  merchant: {
    name: string;
    address: string | null;
    phone: string | null;
  };
  transaction: {
    date: string | null;
    time: string | null;
    receipt_number: string | null;
    payment_method: string | null;
  };
  items: ExpenseItem[];
  totals: {
    subtotal: number | null;
    tax: number | null;
    tax_breakdown: { label: string; amount: number }[] | null;
    discount: number | null;
    rounding: number | null;
    grand_total: number;
    computed_grand_total: number | null;
  };
  currency: string;
  currency_source: "from_address" | "from_symbol" | "from_hint" | "from_hint_override" | "unknown";
  authenticity: {
    ai_generated_probability: number;
    verdict: "likely_authentic" | "suspicious" | "likely_ai_generated";
    flags: string[];
  };
}

interface ParsedMileage {
  distance: number;
  unit: "km" | "mi";
  duration: string | null;
  estimated_amount: number | null;
  source: "google_maps" | "unknown";
  from_location: string | null;
  to_location: string | null;
}

interface ParsedResult {
  type: "expense" | "mileage";
  expense: ParsedExpense | null;
  mileage: ParsedMileage | null;
}

// ─── OCR + Parse ──────────────────────────────────────────────────────────────

async function ocrAndParse(
  client: Mistral,
  imageBase64: string,
  mimeType: string,
  categories: { id: string; name: string }[],
  currencyHint: string | null,
): Promise<{ markdown: string; parsed: ParsedResult }> {
  const categoryList = categories
    .map((c) => `- "${c.id}" → ${c.name}`)
    .join("\n");

  const currencyHintText = currencyHint ?? "unknown";

  const ocrResponse = await client.ocr.process({
    model: "mistral-ocr-latest",
    document: {
      type: "image_url",
      imageUrl: `data:${mimeType};base64,${imageBase64}`,
    },
    includeImageBase64: false,
    documentAnnotationFormat: {
      type: "json_schema",
      jsonSchema: {
        name: "response_schema",
        schemaDefinition: {
          type: "object",
          required: ["type", "expense", "mileage"],
          properties: {
            type: {
              type: "string",
              enum: ["expense", "mileage"],
            },
            expense: {
              type: ["object", "null"],
              required: [
                "merchant", "transaction", "items", "totals",
                "currency", "currency_source", "authenticity",
              ],
              properties: {
                merchant: {
                  type: "object",
                  required: ["name", "address", "phone"],
                  properties: {
                    name: { type: "string" },
                    address: { type: ["string", "null"] },
                    phone: { type: ["string", "null"] },
                  },
                },
                transaction: {
                  type: "object",
                  required: ["date", "time", "receipt_number", "payment_method"],
                  properties: {
                    date: { type: ["string", "null"] },
                    time: { type: ["string", "null"] },
                    receipt_number: { type: ["string", "null"] },
                    payment_method: { type: ["string", "null"] },
                  },
                },
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    required: ["name", "quantity", "unit_price", "total_price", "computed_total_price", "category_id"],
                    properties: {
                      name: { type: "string" },
                      quantity: { type: "number" },
                      unit_price: { type: ["number", "null"] },
                      total_price: { type: ["number", "null"] },
                      computed_total_price: {
                        type: ["number", "null"],
                        description: "quantity × unit_price if both available",
                      },
                      category_id: { type: "string" },
                    },
                  },
                },
                totals: {
                  type: "object",
                  required: ["subtotal", "tax", "tax_breakdown", "discount", "rounding", "grand_total", "computed_grand_total"],
                  properties: {
                    subtotal: { type: ["number", "null"] },
                    tax: { type: ["number", "null"] },
                    tax_breakdown: {
                      type: ["array", "null"],
                      description: "Individual tax lines when multiple tax types appear on receipt. null if only one tax type or no tax.",
                      items: {
                        type: "object",
                        required: ["label", "amount"],
                        properties: {
                          label: { type: "string", description: "Tax type label as printed (e.g. 'SST 6%', 'Service Tax 10%')" },
                          amount: { type: "number" },
                        },
                      },
                    },
                    discount: { type: ["number", "null"] },
                    rounding: {
                      type: ["number", "null"],
                      description: "Explicit rounding adjustment printed on receipt (e.g. Malaysian 5-sen rounding). Positive = rounded up, negative = rounded down. null if not shown.",
                    },
                    grand_total: { type: "number" },
                    computed_grand_total: {
                      type: ["number", "null"],
                      description: "Calculated from items or subtotal/tax if items incomplete",
                    },
                  },
                },
                currency: { type: "string" },
                currency_source: {
                  type: "string",
                  enum: ["from_address", "from_symbol", "from_hint", "from_hint_override", "unknown"],
                },
                authenticity: {
                  type: "object",
                  required: ["ai_generated_probability", "verdict", "flags"],
                  properties: {
                    ai_generated_probability: { type: "number", minimum: 0, maximum: 100 },
                    verdict: {
                      type: "string",
                      enum: ["likely_authentic", "suspicious", "likely_ai_generated"],
                    },
                    flags: { type: "array", items: { type: "string" } },
                  },
                },
              },
            },
            mileage: {
              type: ["object", "null"],
              required: ["distance", "unit", "duration", "estimated_amount", "source", "from_location", "to_location"],
              properties: {
                distance: { type: "number" },
                unit: { type: "string", enum: ["km", "mi"] },
                duration: { type: ["string", "null"] },
                estimated_amount: { type: ["number", "null"] },
                source: { type: "string", enum: ["google_maps", "unknown"] },
                from_location: { type: ["string", "null"] },
                to_location: { type: ["string", "null"] },
              },
            },
          },
        },
        strict: true,
      },
    },
    documentAnnotationPrompt: `--- TYPE CLASSIFICATION ---

Determine the document type:

Return "type" as:

- "expense":
  - receipt
  - invoice
  - printed bill
  - contains merchant, prices, totals

- "mileage":
  - map screenshot (e.g. Google Maps)
  - contains distance (km/mi), duration, route

---

--- TYPE-SPECIFIC OUTPUT RULES ---

If type = "expense":
- Populate ONLY the "expense" object
- Set "mileage" = null
- Extract currency and set currency_source per CURRENCY RULES below
- Perform full extraction and authenticity analysis

If type = "mileage":
- Populate ONLY the "mileage" object
- Set "expense" = null
- DO NOT perform authenticity analysis
- DO NOT create receipt-related fields

Never mix both types.
Never hallucinate missing structures.

---

--- CATEGORY RULES ---

Assign category_id to each line item using ONLY these exact values:
${categoryList}

If no match → use the "Others" category_id.

---

--- DATE RULES ---

Use ISO 8601 format (YYYY-MM-DD) for all dates.

---

--- CURRENCY RULES (EXPENSE ONLY) ---

Determine currency using this priority order. Always output both "currency" and "currency_source".

1. If merchant.address contains a recognisable country:
   → derive currency from that country
   Examples: Malaysia → MYR, Singapore → SGD, United Kingdom → GBP,
             United States → USD, Australia → AUD, Japan → JPY,
             Thailand → THB, Indonesia → IDR, Philippines → PHP
   → set currency_source = "from_address"

2. If no address but currency symbol is clearly visible on the receipt:
   → use that symbol
   → set currency_source = "from_symbol"

3. If a currency hint is provided (${currencyHintText}):
   → if symbol is ambiguous or absent: use the hint currency
     → set currency_source = "from_hint"
   → if receipt explicitly shows a different currency: use that currency instead
     → set currency_source = "from_hint_override"

4. If none of the above apply:
   → best effort guess
   → set currency_source = "unknown"

---

--- CALCULATION RULES (EXPENSE ONLY) ---

- Do NOT modify extracted totals from the receipt

- Compute:
  computed_grand_total = sum of all item total_price values
  - If total_price missing but unit_price × quantity exists:
    total_price = unit_price × quantity
  - Ignore items where total_price is null
  - Round to 2 decimal places

- If items incomplete but subtotal and tax are available:
  computed_grand_total = subtotal + tax - discount

- For rounding:
  - If the receipt explicitly prints a rounding adjustment line (e.g. "Rounding", "Rounding Adj", "Sen Bulat"):
    → extract the value (positive if added, negative if deducted)
    → set rounding to that value
  - If no explicit rounding line is shown on the receipt:
    → set rounding = null

- Do NOT guess missing numbers

- For tax_breakdown:
  - If the receipt shows multiple distinct tax lines (e.g. SST 6%, Service Tax 10%):
    → extract each as { "label": "<label as printed>", "amount": <number> }
    → list all in tax_breakdown array
    → set tax = sum of all tax_breakdown amounts (rounded to 2 decimal places)
  - If only one tax type or tax is a single undifferentiated line:
    → set tax_breakdown = null
    → set tax = the single tax value
  - If no tax:
    → set tax = null, tax_breakdown = null

---

--- VALIDATION RULES (EXPENSE ONLY) ---

- If difference between grand_total and computed_grand_total > 0.5:
  → flag "total_mismatch"

- If any item has missing price or unit_price × quantity ≠ total_price:
  → flag "item_price_inconsistency"

- If subtotal exists but does not match sum of item totals:
  → flag "subtotal_mismatch"

---

--- AUTHENTICITY ANALYSIS (EXPENSE ONLY) ---

You are viewing the actual receipt image. Use your visual judgment as a vision model
to assess whether this is a genuine physical receipt from a real transaction.

Score ai_generated_probability from 0 to 100:
- Does it look like a real printed or handwritten receipt (thermal, dot matrix, stamp, pen)?
- Does the layout, font, and formatting look naturally produced rather than digitally composed?
- Is the receipt number present and plausible?
- Are there visible signs of digital fabrication or image manipulation?

verdict must be one of: "likely_authentic", "suspicious", "likely_ai_generated"
- 0–30  → "likely_authentic"
- 31–60 → "suspicious"
- 61–100 → "likely_ai_generated"

Only add flags when you have clear visual evidence. Use only these exact values:
- "ai_generated_text"         — text looks digitally composed, not from real printer or handwriting
- "inconsistent_formatting"   — layout shows signs of editing or fabrication
- "unrealistic_prices"        — amounts appear clearly fabricated
- "edited_metadata"           — visible signs of image manipulation or overlaid content
- "blurry_image"              — image quality too low to verify authenticity
- "missing_merchant"          — no merchant name visible anywhere

Do not flag based on missing optional fields (address, phone, tax ID) —
many legitimate small merchants omit these. Default to "likely_authentic" when in doubt.

---

--- MILEAGE EXTRACTION RULES ---

Extract:
- distance (number only, no units)
- unit: "km" or "mi"
- duration: time string if visible (e.g. "23 mins"), null if not
- estimated_amount: monetary value if shown, null if not — do NOT infer
- source:
  - "google_maps" if Google Maps UI is recognisable
  - "unknown" for anything else
- from_location: origin location text if visible (e.g. "Petaling Jaya, Malaysia"), null if not
- to_location: destination location text if visible (e.g. "KLCC, Kuala Lumpur"), null if not

---

Ensure output strictly follows the schema. Never populate both expense and mileage.`,
  });

  const markdown = ocrResponse.pages.map((p) => p.markdown).join("\n\n");

  const annotationRaw = ocrResponse.pages
    .map((p) => (p as any).structuredAnnotation ?? (p as any).annotation ?? null)
    .filter(Boolean)
    .pop();

  const topLevelAnnotation =
    (ocrResponse as any).structuredAnnotation ??
    (ocrResponse as any).documentAnnotation ??
    annotationRaw;

  if (!topLevelAnnotation) {
    throw new Error("[ocr] No structured annotation returned by OCR model");
  }

  const parsed: ParsedResult =
    typeof topLevelAnnotation === "string"
      ? JSON.parse(topLevelAnnotation)
      : topLevelAnnotation;

  return { markdown, parsed };
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function fetchExchangeRate(
  from: string,
  to: string,
  date: string,
): Promise<number | null> {
  try {
    const res = await fetch(`https://api.frankfurter.dev/v1/${date}?from=${from}&to=${to}`);
    if (!res.ok) return null;
    const data = await res.json();
    return (data.rates?.[to] as number) ?? null;
  } catch {
    return null;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // ─── Auth — service role only ────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const token = authHeader.replace("Bearer ", "");
  if (token !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { scan_id, currency_hint } = await req.json();
  if (!scan_id) return json({ error: "Missing scan_id" }, 400);

  try {
    // ─── 1. Set status → processing ───────────────────────────────────────
    await supabaseAdmin
      .from("scans")
      .update({ status: "processing" })
      .eq("id", scan_id);

    // ─── 2. Fetch scan row ─────────────────────────────────────────────────
    const { data: scan, error: scanError } = await supabaseAdmin
      .from("scans")
      .select("*")
      .eq("id", scan_id)
      .single();

    if (scanError || !scan) throw new Error(`[fetch] Scan not found`);

    // ─── 3. Fetch user's reporting_currency ───────────────────────────────
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("reporting_currency")
      .eq("id", scan.user_id)
      .single();

    if (userError || !userData) throw new Error(`[user] ${userError?.message}`);
    const reportingCurrency: string = userData.reporting_currency;

    // ─── 4. Download image from storage ───────────────────────────────────
    const { data: fileData, error: fileError } = await supabaseAdmin.storage
      .from("scans")
      .download(scan.file_path);

    if (fileError || !fileData) throw new Error(`[storage] ${fileError?.message}`);

    const fileBuffer = await fileData.arrayBuffer();
    const imageBase64 = arrayBufferToBase64(fileBuffer);
    const mimeType = fileData.type || "image/jpeg";

    // ─── 5. Fetch categories ───────────────────────────────────────────────
    const { data: categories, error: catError } = await supabaseAdmin
      .from("lookup_categories")
      .select("id, name");

    if (catError) throw new Error(`[categories] ${catError.message}`);

    // ─── 6. OCR + Parse ────────────────────────────────────────────────────
    const mistral = new Mistral({ apiKey: Deno.env.get("MISTRAL_API_KEY")! });

    let markdown: string;
    let parsed: ParsedResult;
    try {
      ({ markdown, parsed } = await ocrAndParse(
        mistral, imageBase64, mimeType, categories ?? [], currency_hint ?? null,
      ));
    } catch (err) {
      throw new Error(`[ocr] ${(err as Error).message}`);
    }

    // ─── 7. Save OCR markdown + raw Mistral JSON ──────────────────────────
    await supabaseAdmin
      .from("scans")
      .update({ ocr_text: markdown, raw_json: parsed })
      .eq("id", scan_id);

    // ─── Expense path ──────────────────────────────────────────────────────
    if (parsed.type === "expense" && parsed.expense) {
      const exp = parsed.expense;

      // Post-OCR date validation
      if (exp.transaction.date) {
        const receiptDate = new Date(exp.transaction.date);
        const today = new Date();
        today.setHours(23, 59, 59, 999);

        if (receiptDate > today) {
          exp.authenticity.flags.push("future_date");
          if (exp.authenticity.ai_generated_probability < 40) {
            exp.authenticity.ai_generated_probability = 40;
          }
          if (exp.authenticity.verdict === "likely_authentic") {
            exp.authenticity.verdict = "suspicious";
          }
        }
      }

      // Exchange rate logic
      let reportingAmount: number | null = null;
      let exchangeRate: number | null = null;
      let exchangeRateDate: string | null = null;
      let exchangeRateSource: string | null = null;

      if (exp.currency === reportingCurrency) {
        reportingAmount = exp.totals.grand_total;
      } else {
        const scanDate = scan.created_at
          ? new Date(scan.created_at).toISOString().split("T")[0]
          : null;
        const dateToUse = exp.transaction.date ?? scanDate;

        if (dateToUse) {
          exchangeRateDate = dateToUse;
          exchangeRateSource = exp.transaction.date ? "receipt_date" : "scan_date";
          exchangeRate = await fetchExchangeRate(exp.currency, reportingCurrency, dateToUse);
          if (exchangeRate !== null) {
            reportingAmount = Math.round(exp.totals.grand_total * exchangeRate * 100) / 100;
          }
        }
      }

      // ─── 8. Insert expense ───────────────────────────────────────────────
      const { data: expense, error: expenseError } = await supabaseAdmin
        .from("expenses")
        .insert({
          user_id: scan.user_id,
          workspace_id: scan.workspace_id,
          scan_id: scan_id,
          merchant: exp.merchant.name,
          merchant_address: exp.merchant.address,
          merchant_phone: exp.merchant.phone,
          receipt_number: exp.transaction.receipt_number,
          payment_method: exp.transaction.payment_method,
          amount: exp.totals.grand_total,
          computed_grand_total: exp.totals.computed_grand_total,
          subtotal: exp.totals.subtotal,
          tax: exp.totals.tax_breakdown?.length
            ? Math.round(exp.totals.tax_breakdown.reduce((s, t) => s + t.amount, 0) * 100) / 100
            : exp.totals.tax,
          tax_breakdown: exp.totals.tax_breakdown?.length ? exp.totals.tax_breakdown : null,
          discount: exp.totals.discount,
          rounding: exp.totals.rounding,
          currency: exp.currency,
          currency_source: exp.currency_source,
          reporting_currency: reportingCurrency,
          reporting_amount: reportingAmount,
          exchange_rate: exchangeRate,
          exchange_rate_date: exchangeRateDate,
          exchange_rate_source: exchangeRateSource,
          date: exp.transaction.date,
          raw_json: parsed,
          needs_review: exp.authenticity.verdict !== "likely_authentic",
          confirmed: false,
          authenticity_score: exp.authenticity.ai_generated_probability,
          authenticity_verdict: exp.authenticity.verdict,
          flags: exp.authenticity.flags,
          status: "draft",
        })
        .select()
        .single();

      if (expenseError) throw new Error(`[expense] ${expenseError.message}`);

      // ─── 9. Insert expense_items ─────────────────────────────────────────
      if (exp.items && exp.items.length > 0) {
        const items = exp.items.map((item) => ({
          expense_id: expense.id,
          user_id: scan.user_id,
          workspace_id: scan.workspace_id,
          name: item.name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price ?? item.computed_total_price,
          computed_total_price: item.computed_total_price,
          category_id: item.category_id ?? null,
        }));

        const { error: itemsError } = await supabaseAdmin
          .from("expense_items")
          .insert(items);

        if (itemsError) throw new Error(`[items] ${itemsError.message}`);
      }

      // ─── 10. Update scan → parsed ────────────────────────────────────────
      await supabaseAdmin
        .from("scans")
        .update({ status: "parsed" })
        .eq("id", scan_id);

      await supabaseAdmin.rpc("increment_scans_used", { user_id: scan.user_id });

      return json({ success: true, expense_id: expense.id });
    }

    // ─── Mileage path ──────────────────────────────────────────────────────
    if (parsed.type === "mileage" && parsed.mileage) {
      const mil = parsed.mileage;

      // Fetch workspace mileage rate (fall back to 0.80 if workspace not found)
      let ratePerKm = 0.80;
      if (scan.workspace_id) {
        const { data: wsData } = await supabaseAdmin
          .from("workspaces")
          .select("mileage_rate_per_km")
          .eq("id", scan.workspace_id)
          .single();
        if (wsData?.mileage_rate_per_km != null) {
          ratePerKm = Number(wsData.mileage_rate_per_km);
        }
      }

      const amount = Math.round(mil.distance * ratePerKm * 100) / 100;

      const { data: mileage, error: mileageError } = await supabaseAdmin
        .from("mileage")
        .insert({
          user_id: scan.user_id,
          workspace_id: scan.workspace_id,
          scan_id: scan_id,
          from_location: mil.from_location,
          to_location: mil.to_location,
          distance: mil.distance,
          unit: mil.unit,
          duration: mil.duration,
          source: mil.source,
          estimated_amount: mil.estimated_amount,
          rate_per_km: ratePerKm,
          amount,
          status: "draft",
        })
        .select()
        .single();

      if (mileageError) throw new Error(`[mileage] ${mileageError.message}`);

      await supabaseAdmin
        .from("scans")
        .update({ status: "parsed" })
        .eq("id", scan_id);

      await supabaseAdmin.rpc("increment_scans_used", { user_id: scan.user_id });

      return json({ success: true, mileage_id: mileage.id });
    }

    throw new Error(`[type] Unrecognised type: ${(parsed as any).type}`);

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    await supabaseAdmin
      .from("scans")
      .update({ status: "failed", error_reason: message })
      .eq("id", scan_id);

    return json({ success: false, error: message }, 400);
  }
});
