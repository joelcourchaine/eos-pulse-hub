import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ColumnDefinition {
  key: string;
  label: string;
  width?: number;
}

interface EmailRequest {
  listId: string;
  recipientEmails: string[];
}

function escapeHtml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { listId, recipientEmails }: EmailRequest = await req.json();

    if (!listId || !recipientEmails?.length) {
      throw new Error("listId and recipientEmails are required");
    }

    // Fetch list with department/store context
    const { data: list, error: listError } = await supabaseClient
      .from("top_10_lists")
      .select(`
        id, title, description, columns,
        departments(
          name,
          stores(name)
        )
      `)
      .eq("id", listId)
      .single();

    if (listError || !list) throw new Error("List not found");

    const dept = list.departments as unknown as { name: string; stores: { name: string } } | null;
    const storeName = dept?.stores?.name || "Unknown Store";
    const deptName = dept?.name || "";

    const columns = (list.columns || []) as ColumnDefinition[];

    // Fetch items
    const { data: items, error: itemsError } = await supabaseClient
      .from("top_10_items")
      .select("rank, data")
      .eq("list_id", listId)
      .order("rank", { ascending: true });

    if (itemsError) throw itemsError;

    // Fetch sender name
    const { data: senderProfile } = await supabaseClient
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    const senderName = senderProfile?.full_name || user.email;

    // Build HTML email with inline styles
    const headerBg = "#1a1a2e";
    const accentColor = "#16213e";
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    // Build column headers
    const thStyle = `style="padding: 10px 14px; text-align: left; font-size: 13px; font-weight: 600; color: #ffffff; border-bottom: 2px solid #e2e8f0; white-space: nowrap;"`;
    let headerRow = `<th ${thStyle}>#</th>`;
    for (const col of columns) {
      headerRow += `<th ${thStyle}>${escapeHtml(col.label)}</th>`;
    }

    // Build data rows
    let bodyRows = "";
    for (const item of items || []) {
      const data = (item.data || {}) as Record<string, string>;
      const hasData = Object.values(data).some(v => v && v.trim());
      const rank = item.rank;
      const bgColor = rank % 2 === 0 ? "#f8fafc" : "#ffffff";

      let cells = `<td style="padding: 10px 14px; font-size: 13px; color: #64748b; font-weight: 600; border-bottom: 1px solid #e2e8f0; background: ${bgColor};">${rank}</td>`;
      for (const col of columns) {
        const val = data[col.key] || "";
        cells += `<td style="padding: 10px 14px; font-size: 13px; color: ${hasData ? '#1e293b' : '#94a3b8'}; border-bottom: 1px solid #e2e8f0; background: ${bgColor};">${escapeHtml(val) || "&mdash;"}</td>`;
      }
      bodyRows += `<tr>${cells}</tr>`;
    }

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; background: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background: #f1f5f9; padding: 32px 16px;">
    <tr><td align="center">
      <table width="700" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
        
        <!-- Header -->
        <tr>
          <td style="background: ${headerBg}; padding: 28px 32px;">
            <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: -0.3px;">${escapeHtml(list.title)}</h1>
            <p style="margin: 6px 0 0 0; font-size: 14px; color: #94a3b8;">${escapeHtml(storeName)}${deptName ? ` &bull; ${escapeHtml(deptName)}` : ""}</p>
          </td>
        </tr>

        <!-- Meta info -->
        <tr>
          <td style="padding: 20px 32px 8px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size: 13px; color: #64748b;">Sent by <strong style="color: #1e293b;">${escapeHtml(senderName)}</strong></td>
                <td align="right" style="font-size: 13px; color: #64748b;">${dateStr}</td>
              </tr>
            </table>
          </td>
        </tr>

        ${list.description ? `
        <tr>
          <td style="padding: 8px 32px 0 32px;">
            <p style="margin: 0; font-size: 13px; color: #64748b; font-style: italic;">${escapeHtml(list.description)}</p>
          </td>
        </tr>` : ""}

        <!-- Table -->
        <tr>
          <td style="padding: 16px 32px 32px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0;">
              <thead>
                <tr style="background: ${accentColor};">
                  ${headerRow}
                </tr>
              </thead>
              <tbody>
                ${bodyRows}
              </tbody>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding: 20px 32px; border-top: 1px solid #e2e8f0;">
            <p style="margin: 0; font-size: 12px; color: #94a3b8; text-align: center;">Sent from Growth Scorecard</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    // Send via Resend
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Growth Scorecard <reports@dealergrowth.solutions>",
        to: recipientEmails,
        subject: `${list.title} — ${storeName}`,
        html,
      }),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.text();
      console.error("Resend error:", errBody);
      throw new Error("Failed to send email");
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
