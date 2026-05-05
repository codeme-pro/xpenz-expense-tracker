import { createClient } from "npm:@supabase/supabase-js@2.51.0";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
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

  try {
    // ─── Auth ──────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization header" }, 401);

    const token = authHeader.replace("Bearer ", "");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const userId = user.id;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { authorization: authHeader } } }
    );

    // ─── Get user's workspace_id + reporting_currency ──────────────────────
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("workspace_id, reporting_currency")
      .eq("id", userId)
      .single();

    if (userError) throw new Error(`[user] ${userError.message}`);

    // ─── Extract image from form data ──────────────────────────────────────
    const form = await req.formData();
    const file = form.get("receipt");

    if (!(file instanceof File)) {
      return json({ error: "Missing 'receipt' file in form data" }, 400);
    }

    const mimeType = file.type || "image/jpeg";
    const fileExt = mimeType.split("/")[1] || "jpg";

    // ─── Generate scan_id ──────────────────────────────────────────────────
    const { data: scanIdRow } = await supabaseAdmin.rpc("uuid_generate_v7");
    const scanId = scanIdRow as string;
    const filePath = `${userId}/${scanId}.${fileExt}`;

    // ─── Upload image to storage (scans bucket) ────────────────────────────
    const fileBuffer = await file.arrayBuffer();

    const { error: storageError } = await supabaseAdmin.storage
      .from("scans")
      .upload(filePath, fileBuffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (storageError) throw new Error(`[storage] ${storageError.message}`);

    // ─── Insert scan row ───────────────────────────────────────────────────
    const { error: scanError } = await supabaseAdmin
      .from("scans")
      .insert({
        id: scanId,
        user_id: userId,
        workspace_id: userData.workspace_id ?? null,
        file_path: filePath,
        status: "uploaded",
      });

    if (scanError) throw new Error(`[scan] ${scanError.message}`);

    // ─── Fire → process-receipt, watch for fast gateway failures ──────────
    fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/process-receipt`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({
        scan_id: scanId,
        currency_hint: userData.reporting_currency ?? null,
      }),
    })
    .then(async (res) => {
      // 400 = function ran its catch block and already updated the scan — don't overwrite
      // 401/403/5xx = gateway rejection before function body ran — update scan ourselves
      if (!res.ok && res.status !== 400) {
        await supabaseAdmin
          .from("scans")
          .update({ status: "failed", error_reason: `[process-receipt] HTTP ${res.status}` })
          .eq("id", scanId);
      }
    })
    .catch(async (err: Error) => {
      await supabaseAdmin
        .from("scans")
        .update({ status: "failed", error_reason: `[network] ${err.message}` })
        .eq("id", scanId);
    });

    // ─── Return immediately ────────────────────────────────────────────────
    return json({
      success: true,
      scan_id: scanId,
      file_path: filePath,
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return json({ success: false, error: message }, 400);
  }
});
