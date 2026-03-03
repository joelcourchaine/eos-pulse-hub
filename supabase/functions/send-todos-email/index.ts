import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function escapeHtml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const severityConfig: Record<string, { label: string; bg: string; color: string; dot: string }> = {
  high:   { label: "High",   bg: "#fef2f2", color: "#dc2626", dot: "#ef4444" },
  medium: { label: "Medium", bg: "#fffbeb", color: "#d97706", dot: "#f59e0b" },
  low:    { label: "Low",    bg: "#f0fdf4", color: "#16a34a", dot: "#22c55e" },
};

const statusConfig: Record<string, { label: string; bg: string; color: string }> = {
  pending:    { label: "Pending",    bg: "#f1f5f9", color: "#475569" },
  completed:  { label: "Completed",  bg: "#f0fdf4", color: "#16a34a" },
  in_progress:{ label: "In Progress",bg: "#eff6ff", color: "#2563eb" },
  open:       { label: "Open",       bg: "#fef2f2", color: "#dc2626" },
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { departmentId, recipientEmails } = await req.json();
    if (!departmentId || !recipientEmails?.length) {
      throw new Error("departmentId and recipientEmails are required");
    }

    // Fetch department + store context
    const { data: dept } = await supabaseClient
      .from("departments")
      .select("name, stores(name)")
      .eq("id", departmentId)
      .single();

    const deptName = dept?.name || "Department";
    const storeName = (dept?.stores as any)?.name || "";

    // Fetch all todos (both pending and completed)
    const { data: todos } = await supabaseClient
      .from("todos")
      .select("id, title, description, status, severity, due_date, assigned_to, issue_id")
      .eq("department_id", departmentId)
      .in("status", ["pending", "in_progress", "completed"])
      .order("status", { ascending: true })
      .order("severity", { ascending: true });

    // Fetch open issues for the department (non-resolved)
    const { data: issues } = await supabaseClient
      .from("issues")
      .select("id, title, description, status, severity")
      .eq("department_id", departmentId)
      .neq("status", "resolved")
      .order("display_order", { ascending: true });

    // Build issueMap for todo → issue title lookup
    const issueMap: Record<string, string> = {};
    (issues || []).forEach(i => { issueMap[i.id] = i.title; });

    // Fetch profiles for assigned_to
    const assignedIds = [...new Set((todos || []).map(t => t.assigned_to).filter(Boolean))];
    let profileMap: Record<string, string> = {};
    if (assignedIds.length) {
      const { data: profiles } = await supabaseClient
        .from("profiles")
        .select("id, full_name")
        .in("id", assignedIds);
      (profiles || []).forEach(p => { profileMap[p.id] = p.full_name; });
    }

    // Fetch sender name
    const { data: senderProfile } = await supabaseClient
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();
    const senderName = senderProfile?.full_name || user.email;

    // Split todos
    const pending = (todos || []).filter(t => t.status !== "completed");
    const completed = (todos || []).filter(t => t.status === "completed");
    const openIssues = issues || [];

    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    function buildIssueRow(issue: any, idx: number): string {
      const sev = severityConfig[issue.severity] || severityConfig.low;
      const stat = statusConfig[issue.status] || statusConfig.open;
      const rowBg = idx % 2 === 0 ? "#ffffff" : "#f8fafc";

      return `
      <tr>
        <td style="padding: 14px 16px; border-bottom: 1px solid #e2e8f0; background: ${rowBg}; vertical-align: top;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <div style="margin-bottom: 4px;">
                  <span style="
                    display: inline-block;
                    width: 8px; height: 8px;
                    border-radius: 50%;
                    background: ${sev.dot};
                    margin-right: 6px;
                    vertical-align: middle;
                  "></span>
                  <span style="font-size: 14px; font-weight: 600; color: #1e293b;">${escapeHtml(issue.title)}</span>
                </div>
                ${issue.description ? `<div style="font-size: 13px; color: #64748b; margin-left: 22px; margin-top: 4px; line-height: 1.5;">${escapeHtml(issue.description)}</div>` : ""}
              </td>
              <td align="right" style="vertical-align: top; white-space: nowrap; padding-left: 12px;">
                <span style="
                  display: inline-block;
                  padding: 3px 10px;
                  border-radius: 12px;
                  font-size: 11px;
                  font-weight: 600;
                  background: ${sev.bg};
                  color: ${sev.color};
                  margin-bottom: 4px;
                ">${sev.label}</span>
                <br>
                <span style="
                  display: inline-block;
                  padding: 3px 10px;
                  border-radius: 12px;
                  font-size: 11px;
                  font-weight: 500;
                  background: ${stat.bg};
                  color: ${stat.color};
                ">${stat.label}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
    }

    function buildTodoRow(todo: any, idx: number): string {
      const sev = severityConfig[todo.severity] || severityConfig.low;
      const stat = statusConfig[todo.status] || statusConfig.pending;
      const assignee = todo.assigned_to ? profileMap[todo.assigned_to] : null;
      const issueName = todo.issue_id ? issueMap[todo.issue_id] : null;
      let dueDate: string | null = null;
      if (todo.due_date) {
        const [year, month, day] = todo.due_date.split("-").map(Number);
        const d = new Date(year, month - 1, day);
        dueDate = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      }
      const rowBg = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
      const isCompleted = todo.status === "completed";

      return `
      <tr>
        <td style="padding: 14px 16px; border-bottom: 1px solid #e2e8f0; background: ${rowBg}; vertical-align: top;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                  <span style="
                    display: inline-block;
                    width: 8px; height: 8px;
                    border-radius: 50%;
                    background: ${sev.dot};
                    margin-right: 6px;
                    vertical-align: middle;
                  "></span>
                  <span style="font-size: 14px; font-weight: 600; color: ${isCompleted ? '#94a3b8' : '#1e293b'}; ${isCompleted ? 'text-decoration: line-through;' : ''}">${escapeHtml(todo.title)}</span>${issueName ? `<span style="display:inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 500; background: #eff6ff; color: #3b82f6; margin-left: 6px; vertical-align: middle;">↳ ${escapeHtml(issueName)}</span>` : ""}
                </div>
                ${todo.description ? `<div style="font-size: 13px; color: #64748b; margin-left: 22px; margin-top: 4px; line-height: 1.5;">${escapeHtml(todo.description)}</div>` : ""}
              </td>
              <td align="right" style="vertical-align: top; white-space: nowrap; padding-left: 12px;">
                <span style="
                  display: inline-block;
                  padding: 3px 10px;
                  border-radius: 12px;
                  font-size: 11px;
                  font-weight: 600;
                  background: ${sev.bg};
                  color: ${sev.color};
                  margin-bottom: 4px;
                ">${sev.label}</span>
                <br>
                <span style="
                  display: inline-block;
                  padding: 3px 10px;
                  border-radius: 12px;
                  font-size: 11px;
                  font-weight: 500;
                  background: ${stat.bg};
                  color: ${stat.color};
                ">${stat.label}</span>
              </td>
            </tr>
            ${(assignee || dueDate) ? `
            <tr>
              <td colspan="2" style="padding-top: 6px; padding-left: 22px;">
                <table cellpadding="0" cellspacing="0">
                  <tr>
                    ${assignee ? `<td style="font-size: 12px; color: #94a3b8; padding-right: 16px;">👤 ${escapeHtml(assignee)}</td>` : ""}
                    ${dueDate ? `<td style="font-size: 12px; color: #94a3b8;">📅 Due: ${dueDate}</td>` : ""}
                  </tr>
                </table>
              </td>
            </tr>` : ""}
          </table>
        </td>
      </tr>`;
    }

    function buildSection(title: string, items: any[], iconEmoji: string, accentColor: string, rowBuilder: (item: any, idx: number) => string): string {
      if (!items.length) return "";
      const rows = items.map((t, i) => rowBuilder(t, i)).join("");
      return `
        <!-- Section: ${title} -->
        <tr>
          <td style="padding: 24px 32px 8px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="border-left: 4px solid ${accentColor}; padding-left: 12px;">
                  <span style="font-size: 15px; font-weight: 700; color: #1e293b;">${iconEmoji} ${title}</span>
                  <span style="font-size: 12px; color: #94a3b8; margin-left: 8px;">${items.length} item${items.length !== 1 ? "s" : ""}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 32px 0 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0;">
              <tbody>${rows}</tbody>
            </table>
          </td>
        </tr>`;
    }

    const issuesSection = buildSection("Open Issues", openIssues, "🔥", "#ef4444", buildIssueRow);
    const pendingSection = buildSection("Open To-Dos", pending, "📋", "#f59e0b", buildTodoRow);
    const completedSection = buildSection("Completed To-Dos", completed, "✅", "#22c55e", buildTodoRow);

    const noContentMsg = (!openIssues.length && !pending.length && !completed.length)
      ? `<tr><td style="padding: 32px; text-align: center; color: #94a3b8; font-size: 14px;">No issues or to-dos found for this department.</td></tr>`
      : "";

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; background: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background: #f1f5f9; padding: 32px 16px;">
    <tr><td align="center">
      <table width="680" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background: #0f172a; padding: 28px 32px;">
            <h1 style="margin: 0 0 6px 0; font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: -0.3px;">Issues & To-Do Summary</h1>
            <div style="font-size: 14px; color: #94a3b8;">${escapeHtml(storeName)}${deptName ? ` &bull; ${escapeHtml(deptName)}` : ""}</div>
          </td>
        </tr>

        <!-- Meta -->
        <tr>
          <td style="padding: 16px 32px 0 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size: 13px; color: #64748b;">Sent by <strong style="color: #1e293b;">${escapeHtml(senderName)}</strong></td>
                <td align="right" style="font-size: 13px; color: #64748b;">${dateStr}</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Summary pills -->
        <tr>
          <td style="padding: 16px 32px 0 32px;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding-right: 8px;">
                  <span style="display: inline-block; padding: 4px 12px; border-radius: 20px; background: #fee2e2; color: #991b1b; font-size: 12px; font-weight: 600;">
                    🔥 ${openIssues.length} Issue${openIssues.length !== 1 ? "s" : ""}
                  </span>
                </td>
                <td style="padding-right: 8px;">
                  <span style="display: inline-block; padding: 4px 12px; border-radius: 20px; background: #fef3c7; color: #92400e; font-size: 12px; font-weight: 600;">
                    📋 ${pending.length} Open To-Do${pending.length !== 1 ? "s" : ""}
                  </span>
                </td>
                <td>
                  <span style="display: inline-block; padding: 4px 12px; border-radius: 20px; background: #dcfce7; color: #166534; font-size: 12px; font-weight: 600;">
                    ✅ ${completed.length} Completed
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        ${noContentMsg}
        ${issuesSection}
        ${pendingSection}
        ${completedSection}

        <!-- Spacer -->
        <tr><td style="height: 24px;"></td></tr>

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
        subject: `Issues & To-Do Summary — ${storeName}${deptName ? ` · ${deptName}` : ""}`,
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
