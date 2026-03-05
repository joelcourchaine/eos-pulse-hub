import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface CombinedReportRequest {
  departmentId: string;
  recipientEmails: string[];
  sections: Array<"issues-todos" | "scorecard" | "top10">;
  // scorecard options
  year?: number;
  quarter?: number;
  scorecardMode?: "weekly" | "monthly" | "quarterly-trend" | "yearly";
  roleFilter?: string;
  // top10 options
  top10ListIds?: string[];
  clientDate?: string;
}

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
  pending:     { label: "Pending",     bg: "#f1f5f9", color: "#475569" },
  completed:   { label: "Completed",   bg: "#f0fdf4", color: "#16a34a" },
  in_progress: { label: "In Progress", bg: "#eff6ff", color: "#2563eb" },
  open:        { label: "Open",        bg: "#fef2f2", color: "#dc2626" },
};

function sectionLabel(text: string): string {
  return `<div style="background: #1e293b; color: #fff; padding: 10px 20px; font-size: 14px; font-weight: 700; border-radius: 4px; margin-bottom: 16px; margin-top: 8px;">${escapeHtml(text)}</div>`;
}

function divider(): string {
  return `<hr style="border: none; border-top: 2px solid #e2e8f0; margin: 32px 0;">`;
}

// ─── Issues & To-Dos section ────────────────────────────────────────────────

async function buildIssuesTodosSection(supabase: any, departmentId: string, profileMap: Record<string, string>): Promise<string> {
  const { data: todos } = await supabase
    .from("todos")
    .select("id, title, description, status, severity, due_date, assigned_to, issue_id")
    .eq("department_id", departmentId)
    .in("status", ["pending", "in_progress", "completed"])
    .order("status", { ascending: true })
    .order("severity", { ascending: true });

  const { data: issues } = await supabase
    .from("issues")
    .select("id, title, description, status, severity")
    .eq("department_id", departmentId)
    .neq("status", "resolved")
    .order("display_order", { ascending: true });

  const issueMap: Record<string, string> = {};
  (issues || []).forEach((i: any) => { issueMap[i.id] = i.title; });

  const pending = (todos || []).filter((t: any) => t.status !== "completed");
  const completed = (todos || []).filter((t: any) => t.status === "completed");
  const linkedIssueIds = new Set((todos || []).map((t: any) => t.issue_id).filter(Boolean));
  const openIssues = (issues || []).filter((i: any) => !linkedIssueIds.has(i.id));

  function buildIssueRow(issue: any, idx: number): string {
    const sev = severityConfig[issue.severity] || severityConfig.low;
    const stat = statusConfig[issue.status] || statusConfig.open;
    const rowBg = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
    return `<tr>
      <td style="padding:12px 16px; border-bottom:1px solid #e2e8f0; background:${rowBg}; vertical-align:top;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td>
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${sev.dot};margin-right:6px;vertical-align:middle;"></span>
            <span style="font-size:14px;font-weight:600;color:#1e293b;">${escapeHtml(issue.title)}</span>
            ${issue.description ? `<div style="font-size:13px;color:#64748b;margin-left:22px;margin-top:4px;">${escapeHtml(issue.description)}</div>` : ""}
          </td>
          <td align="right" style="vertical-align:top;white-space:nowrap;padding-left:12px;">
            <span style="display:inline-block;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;background:${sev.bg};color:${sev.color};">${sev.label}</span>
          </td>
        </tr></table>
      </td>
    </tr>`;
  }

  function buildTodoRow(todo: any, idx: number): string {
    const sev = severityConfig[todo.severity] || severityConfig.low;
    const stat = statusConfig[todo.status] || statusConfig.pending;
    const assignee = todo.assigned_to ? profileMap[todo.assigned_to] : null;
    const issueName = todo.issue_id ? issueMap[todo.issue_id] : null;
    let dueDate = "";
    if (todo.due_date) {
      const [y, m, d] = todo.due_date.split("-").map(Number);
      dueDate = new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    }
    const rowBg = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
    const isCompleted = todo.status === "completed";
    return `<tr>
      <td style="padding:12px 16px; border-bottom:1px solid #e2e8f0; background:${rowBg}; vertical-align:top;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td>
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${sev.dot};margin-right:6px;vertical-align:middle;"></span>
            <span style="font-size:14px;font-weight:600;color:${isCompleted ? "#94a3b8" : "#1e293b"};${isCompleted ? "text-decoration:line-through;" : ""}">${escapeHtml(todo.title)}</span>
            ${issueName ? `<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:500;background:#eff6ff;color:#3b82f6;margin-left:6px;">↳ ${escapeHtml(issueName)}</span>` : ""}
            ${todo.description ? `<div style="font-size:13px;color:#64748b;margin-left:22px;margin-top:4px;">${escapeHtml(todo.description)}</div>` : ""}
            ${(assignee || dueDate) ? `<div style="font-size:12px;color:#94a3b8;margin-left:22px;margin-top:4px;">${assignee ? `👤 ${escapeHtml(assignee)}` : ""}${assignee && dueDate ? " &nbsp;·&nbsp; " : ""}${dueDate ? `📅 Due: ${dueDate}` : ""}</div>` : ""}
          </td>
          <td align="right" style="vertical-align:top;white-space:nowrap;padding-left:12px;">
            <span style="display:inline-block;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;background:${sev.bg};color:${sev.color};margin-bottom:4px;">${sev.label}</span><br>
            <span style="display:inline-block;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:500;background:${stat.bg};color:${stat.color};">${stat.label}</span>
          </td>
        </tr></table>
      </td>
    </tr>`;
  }

  function tableBlock(rows: string): string {
    return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;margin-bottom:16px;"><tbody>${rows}</tbody></table>`;
  }

  let html = sectionLabel("Issues &amp; To-Dos");

  if (openIssues.length > 0) {
    html += `<div style="font-size:13px;font-weight:600;color:#ef4444;margin-bottom:8px;">🔥 Open Issues (${openIssues.length})</div>`;
    html += tableBlock(openIssues.map((i: any, idx: number) => buildIssueRow(i, idx)).join(""));
  }

  if (pending.length > 0) {
    html += `<div style="font-size:13px;font-weight:600;color:#d97706;margin-bottom:8px;">📋 Open To-Dos (${pending.length})</div>`;
    html += tableBlock(pending.map((t: any, idx: number) => buildTodoRow(t, idx)).join(""));
  }

  if (completed.length > 0) {
    html += `<div style="font-size:13px;font-weight:600;color:#16a34a;margin-bottom:8px;">✅ Completed To-Dos (${completed.length})</div>`;
    html += tableBlock(completed.map((t: any, idx: number) => buildTodoRow(t, idx)).join(""));
  }

  if (!openIssues.length && !pending.length && !completed.length) {
    html += `<p style="font-size:14px;color:#94a3b8;text-align:center;padding:24px 0;">No issues or to-dos found.</p>`;
  }

  return html;
}

// ─── Scorecard section ───────────────────────────────────────────────────────

function formatScorecardValue(value: number | null, metricType: string, kpiName?: string): string {
  if (value === null || value === undefined) return "-";
  if (kpiName === "CP Hours Per RO" || kpiName === "Total CP Hours Per RO" || kpiName === "Total ELR" || kpiName === "Total CP ELR" || kpiName === "Warranty ELR") {
    return Number(value).toFixed(2);
  }
  if (kpiName === "Total Labour Sales" || kpiName === "CP Labour Sales Per RO" || kpiName === "Total CP Labour Sales Per RO" || kpiName === "CP ELR" || kpiName === "CP Labour Sales") {
    return `$${Math.round(value).toLocaleString()}`;
  }
  if (kpiName === "Total Hours" || kpiName === "CP Hours" || kpiName === "Customer Pay Hours" || kpiName === "CP RO's" || kpiName === "Total RO's") {
    return Math.round(value).toLocaleString();
  }
  if (kpiName === "Internal ELR") return `$${Number(value).toFixed(2)}`;
  if (metricType === "dollar") return `$${value.toLocaleString()}`;
  if (metricType === "percentage") return `${Math.round(value)}%`;
  const hasDecimals = value % 1 !== 0;
  return hasDecimals ? Number(value).toFixed(2) : value.toLocaleString();
}

const YEAR_STARTS: Record<number, string> = {
  2025: "2024-12-30",
  2026: "2025-12-29",
  2027: "2026-12-28",
};

function getScorecardPeriods(mode: string, year: number, quarter: number) {
  const yearStart = new Date(YEAR_STARTS[year] || `${year}-01-01`);
  if (mode === "weekly") {
    const weeks = [];
    const quarterStartWeek = (quarter - 1) * 13;
    for (let i = 0; i < 13; i++) {
      const ws = new Date(yearStart);
      ws.setDate(yearStart.getDate() + (quarterStartWeek + i) * 7);
      const we = new Date(ws);
      we.setDate(ws.getDate() + 6);
      weeks.push({ label: `${ws.getMonth()+1}/${ws.getDate()}-${we.getMonth()+1}/${we.getDate()}`, start: ws, type: "week" as const });
    }
    return weeks;
  }
  if (mode === "monthly") {
    const months = [];
    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    for (let i = 0; i < 3; i++) {
      const monthIndex = (quarter - 1) * 3 + i;
      months.push({ label: monthNames[monthIndex], identifier: `${year}-${String(monthIndex+1).padStart(2,"0")}`, type: "month" as const });
    }
    return months;
  }
  // yearly
  const months = [];
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  for (let i = 0; i < 12; i++) {
    months.push({ label: monthNames[i], identifier: `${year}-${String(i+1).padStart(2,"0")}`, type: "month" as const });
  }
  return months;
}

const getCellStyle = (cellClass: string, baseFontSize: string, isWeekly = false): string => {
  const baseStyle = `border: 1px solid #d1d5db; padding: 3px 4px; text-align: center; font-size: ${baseFontSize}; font-weight: 600;`;
  if (isWeekly) {
    switch (cellClass) {
      case "green": return `${baseStyle} background-color: #059669; color: #ffffff;`;
      case "yellow": return `${baseStyle} background-color: #d97706; color: #ffffff;`;
      case "red": return `${baseStyle} background-color: #dc2626; color: #ffffff;`;
      default: return `border: 1px solid #d1d5db; padding: 3px 4px; text-align: center; font-size: ${baseFontSize}; background-color: #f8fafc; color: #64748b;`;
    }
  }
  switch (cellClass) {
    case "green": return `${baseStyle} background-color: #d1fae5; color: #065f46;`;
    case "yellow": return `${baseStyle} background-color: #fef3c7; color: #92400e;`;
    case "red": return `${baseStyle} background-color: #fee2e2; color: #991b1b;`;
    default: return `border: 1px solid #d1d5db; padding: 3px 4px; text-align: center; font-size: ${baseFontSize};`;
  }
};

async function buildScorecardSection(supabase: any, departmentId: string, year: number, quarter: number, mode: string, roleFilter?: string): Promise<string> {
  const periods = getScorecardPeriods(mode, year, quarter);
  const entryType = mode === "weekly" ? "weekly" : "monthly";
  const baseFontSize = mode === "weekly" ? "8px" : "11px";
  const isWeeklyMode = mode === "weekly";

  const { data: allKpis } = await supabase
    .from("kpi_definitions")
    .select("id, name, metric_type, target_direction, assigned_to, aggregation_type")
    .eq("department_id", departmentId)
    .order("display_order");

  if (!allKpis?.length) return sectionLabel(`Scorecard — ${mode.charAt(0).toUpperCase() + mode.slice(1)}`) + `<p style="font-size:14px;color:#94a3b8;text-align:center;padding:24px 0;">No KPIs configured.</p>`;

  // Fetch profiles to resolve owner names
  const { data: profilesData } = await supabase.from("profiles").select("id, full_name");
  const profilesMap = new Map((profilesData || []).map((p: any) => [p.id, p]));

  // Fetch KPI targets for the quarter
  const kpiIds = allKpis.map((k: any) => k.id);
  const kpiTargetsMap = new Map<string, number>();
  if (quarter) {
    // Must use `let` — Supabase query builder is immutable; .eq() returns a NEW object.
    // Discarding the return value (as `const` forces) silently drops the filter.
    let kpiTargetsQuery = supabase
      .from("kpi_targets")
      .select("kpi_id, target_value")
      .eq("year", year)
      .eq("quarter", quarter)
      .in("kpi_id", kpiIds);
    // Weekly mode must only use weekly targets — monthly targets (e.g. Available Hours = 40)
    // must not colour weekly cells or the cells turn red incorrectly.
    if (isWeeklyMode) kpiTargetsQuery = kpiTargetsQuery.eq("entry_type", "weekly");
    const { data: kpiTargets } = await kpiTargetsQuery;
    (kpiTargets || []).forEach((t: any) => { if (t.target_value != null) kpiTargetsMap.set(t.kpi_id, t.target_value); });
  }

  // Group KPIs by owner
  const kpisByOwner = new Map<string, any[]>();
  allKpis.forEach((kpi: any) => {
    const ownerId = kpi.assigned_to || "unassigned";
    if (!kpisByOwner.has(ownerId)) kpisByOwner.set(ownerId, []);
    kpisByOwner.get(ownerId)!.push(kpi);
  });

  // Apply role filter
  if (roleFilter && roleFilter !== "all") {
    const allOwnerIds = Array.from(kpisByOwner.keys()).filter(id => id !== "unassigned");
    if (allOwnerIds.length > 0) {
      const [{ data: userRolesData }, { data: profileRolesData }] = await Promise.all([
        supabase.from("user_roles").select("user_id, role").in("user_id", allOwnerIds),
        supabase.from("profiles").select("id, role").in("id", allOwnerIds),
      ]);
      const ownerRoleMap = new Map<string, string>();
      (profileRolesData || []).forEach((p: any) => { if (p.role) ownerRoleMap.set(p.id, p.role); });
      (userRolesData || []).forEach((ur: any) => { ownerRoleMap.set(ur.user_id, ur.role); });
      const usersWithRole = new Set(
        Array.from(ownerRoleMap.entries())
          .filter(([, role]) => role === roleFilter)
          .map(([userId]) => userId)
      );
      for (const ownerId of Array.from(kpisByOwner.keys())) {
        if (ownerId !== "unassigned" && !usersWithRole.has(ownerId)) kpisByOwner.delete(ownerId);
      }
    }
  }

  if (kpisByOwner.size === 0) return sectionLabel(`Scorecard — ${mode.charAt(0).toUpperCase() + mode.slice(1)}`) + `<p style="font-size:14px;color:#94a3b8;text-align:center;padding:24px 0;">No KPIs found for the selected role.</p>`;

  // Fetch entries
  let identifiers: string[] = [];
  if (mode === "weekly") {
    identifiers = periods.map((p: any) => p.start.toISOString().split("T")[0]);
  } else {
    identifiers = periods.map((p: any) => (p as any).identifier);
  }

  const filteredKpiIds = Array.from(kpisByOwner.values()).flat().map((k: any) => k.id);
  const { data: entries } = await supabase
    .from("scorecard_entries")
    .select("kpi_id, actual_value, month, week_start_date, status")
    .in("kpi_id", filteredKpiIds)
    .eq("entry_type", entryType)
    .in(mode === "weekly" ? "week_start_date" : "month", identifiers);

  const modeName = mode === "weekly" ? `Weekly (Q${quarter} ${year})` : mode === "monthly" ? `Monthly (Q${quarter} ${year})` : `Yearly (${year})`;
  let html = sectionLabel(`Scorecard — ${modeName}`);

  // Styles
  const navyBg = "#1e2d47";
  const navyHeaderStyle = `background-color: ${navyBg}; color: #ffffff; padding: 3px 4px; font-size: ${baseFontSize}; font-weight: 700; text-align: left; border: 1px solid #2d3f5e; white-space: nowrap;`;
  const navyTargetStyle = `background-color: ${navyBg}; color: #ffffff; padding: 3px 4px; font-size: ${baseFontSize}; font-weight: 700; text-align: center; border: 1px solid #2d3f5e; white-space: nowrap;`;
  const weekHeaderStyle = `background-color: #e2e8f0; color: #1e293b; padding: 3px 4px; font-size: 9px; font-weight: 700; text-align: center; border: 1px solid #cbd5e1; white-space: nowrap;`;
  const kpiNameStyle = `background-color: #f8fafc; padding: 3px 5px; font-size: ${baseFontSize}; font-weight: 600; text-align: left; border: 1px solid #d1d5db; color: #1e293b; white-space: nowrap; max-width: 140px; overflow: hidden;`;
  const qtotalHeaderStyle = `background-color: #334155; color: #ffffff; padding: 3px 4px; font-size: 9px; font-weight: 700; text-align: center; border: 1px solid #475569;`;
  const thStyle = `border: 1px solid #ddd; padding: 6px 4px; text-align: left; font-size: ${baseFontSize}; background-color: #f4f4f4; font-weight: bold;`;
  const tdStyle = `border: 1px solid #ddd; padding: 6px 4px; text-align: left; font-size: ${baseFontSize};`;

  if (isWeeklyMode) {
    const totalCols = 2 + periods.length + 1; // KPI + Target + weeks + Q-Total
    html += `<div style="overflow-x:auto;"><table style="border-collapse:collapse;width:100%;min-width:900px;">
  <thead><tr>
    <th style="${navyHeaderStyle} min-width:140px;">KPI</th>
    <th style="${navyTargetStyle} min-width:60px;">Target</th>`;
    periods.forEach((p: any, i: number) => {
      html += `<th style="${weekHeaderStyle} min-width:55px;">WK ${i+1}<br/><span style="font-size:9px;font-weight:500;color:#64748b;">${p.label}</span></th>`;
    });
    html += `<th style="${qtotalHeaderStyle} min-width:65px;">Q-Total</th></tr></thead><tbody>`;

    // Detect special KPI IDs for totals section
    const allKpisFlat: any[] = Array.from(kpisByOwner.values()).flat();
    const availKpiIds = new Set(allKpisFlat.filter((k: any) => k.name.toLowerCase().includes('available')).map((k: any) => k.id));
    const soldKpiIds = new Set(allKpisFlat.filter((k: any) => k.metric_type === 'unit' && k.name !== 'Available Hours' && k.name !== 'Productivity').map((k: any) => k.id));
    const productivityKpi = allKpis.find((k: any) => k.metric_type === 'percentage' && k.name.toLowerCase().includes('product'));
    const productivityTarget = productivityKpi
      ? (kpiTargetsMap.has(productivityKpi.id) ? kpiTargetsMap.get(productivityKpi.id)! : productivityKpi.target_value) ?? 115
      : 115;

    const weekAvailTotals: (number | null)[] = periods.map(() => null);
    const weekSoldTotals: (number | null)[] = periods.map(() => null);

    Array.from(kpisByOwner.entries()).forEach(([ownerId, ownerKpis]) => {
      const ownerName = ownerId === "unassigned" ? "Unassigned" : (profilesMap.get(ownerId) as any)?.full_name || "Unknown";
      html += `<tr><td colspan="${totalCols}" style="background-color:#2d3f5e;color:#ffffff;padding:4px 8px;font-size:10px;font-weight:700;letter-spacing:0.2px;border:1px solid #1e2d47;">${escapeHtml(ownerName)}</td></tr>`;

      ownerKpis.forEach((kpi: any) => {
        const target = kpiTargetsMap.has(kpi.id) ? kpiTargetsMap.get(kpi.id)! : kpi.target_value;
        const displayTarget = formatScorecardValue(target, kpi.metric_type, kpi.name);
        html += `<tr><td style="${kpiNameStyle}">${escapeHtml(kpi.name)}</td><td style="${navyTargetStyle} min-width:50px;">${displayTarget}</td>`;

        const periodValues: number[] = [];
        periods.forEach((p: any, pIdx: number) => {
          const entry = (entries || []).find((e: any) =>
            e.kpi_id === kpi.id && e.week_start_date === p.start.toISOString().split("T")[0]
          );
          const targetValue = kpiTargetsMap.has(kpi.id) ? kpiTargetsMap.get(kpi.id)! : kpi.target_value;
          let cellClass = "";
          if (entry?.actual_value !== null && entry?.actual_value !== undefined) {
            const actualValue = entry.actual_value;
            periodValues.push(actualValue);
            if (availKpiIds.has(kpi.id)) weekAvailTotals[pIdx] = (weekAvailTotals[pIdx] ?? 0) + actualValue;
            if (soldKpiIds.has(kpi.id)) weekSoldTotals[pIdx] = (weekSoldTotals[pIdx] ?? 0) + actualValue;
            if (targetValue !== null && targetValue !== 0) {
              const variance = kpi.metric_type === "percentage"
                ? actualValue - targetValue
                : ((actualValue - targetValue) / Math.abs(targetValue)) * 100;
              if (kpi.target_direction === "above") {
                cellClass = variance >= 0 ? "green" : variance >= -10 ? "yellow" : "red";
              } else {
                cellClass = variance <= 0 ? "green" : variance <= 10 ? "yellow" : "red";
              }
            }
          }
          html += `<td style="${getCellStyle(cellClass, baseFontSize, true)}">${formatScorecardValue(entry?.actual_value, kpi.metric_type, kpi.name)}</td>`;
        });

        // Q-Total cell
        const shouldAvg = kpi.aggregation_type === 'average';
        const qTotal = periodValues.length > 0
          ? shouldAvg ? periodValues.reduce((s, v) => s + v, 0) / periodValues.length : periodValues.reduce((s, v) => s + v, 0)
          : null;
        let qCellClass = "";
        if (qTotal !== null && target !== null && target !== 0) {
          const qVariance = kpi.metric_type === "percentage"
            ? qTotal - target
            : ((qTotal - target) / Math.abs(target)) * 100;
          if (kpi.target_direction === "above") {
            qCellClass = qVariance >= 0 ? "green" : qVariance >= -10 ? "yellow" : "red";
          } else {
            qCellClass = qVariance <= 0 ? "green" : qVariance <= 10 ? "yellow" : "red";
          }
        }
        html += `<td style="${getCellStyle(qCellClass, baseFontSize, true)}">${formatScorecardValue(qTotal, kpi.metric_type, kpi.name)}</td></tr>`;
      });
    });

    // Σ Totals section
    const totalsNavy = `background-color:#1e293b;color:#ffffff;padding:3px 4px;font-size:${baseFontSize};font-weight:700;text-align:center;border:1px solid #0f172a;`;
    const totalsPlain = `background-color:#e2e8f0;color:#1e293b;padding:3px 4px;font-size:${baseFontSize};font-weight:700;text-align:center;border:1px solid #cbd5e1;`;
    const qAvailSum = weekAvailTotals.reduce<number>((s, v) => s + (v ?? 0), 0);
    const qSoldSum = weekSoldTotals.reduce<number>((s, v) => s + (v ?? 0), 0);

    html += `<tr><td colspan="${totalCols}" style="${totalsNavy} text-align:left;">Σ Totals</td></tr>`;

    // Available Hours row
    const availKpiForTarget = allKpisFlat.find((k: any) => availKpiIds.has(k.id));
    const availTarget = availKpiForTarget ? (kpiTargetsMap.has(availKpiForTarget.id) ? kpiTargetsMap.get(availKpiForTarget.id)! : availKpiForTarget.target_value) : null;
    html += `<tr><td style="${kpiNameStyle}">Available Hours</td><td style="${navyTargetStyle} min-width:50px;">${availTarget !== null ? Number(availTarget).toLocaleString() : '—'}</td>`;
    weekAvailTotals.forEach(v => { html += `<td style="${totalsPlain}">${v !== null ? Number(v.toFixed(1)).toLocaleString() : '—'}</td>`; });
    html += `<td style="${totalsPlain} font-weight:700;">${qAvailSum > 0 ? Number(qAvailSum.toFixed(1)).toLocaleString() : '—'}</td></tr>`;

    // Sold Hours row
    const soldKpiForTarget = allKpisFlat.find((k: any) => soldKpiIds.has(k.id));
    const soldTarget = soldKpiForTarget ? (kpiTargetsMap.has(soldKpiForTarget.id) ? kpiTargetsMap.get(soldKpiForTarget.id)! : soldKpiForTarget.target_value) : null;
    html += `<tr><td style="${kpiNameStyle}">Sold Hours</td><td style="${navyTargetStyle} min-width:50px;">${soldTarget !== null ? Number(soldTarget).toLocaleString() : '—'}</td>`;
    weekSoldTotals.forEach(v => { html += `<td style="${totalsPlain}">${v !== null ? Number(v.toFixed(1)).toLocaleString() : '—'}</td>`; });
    html += `<td style="${totalsPlain} font-weight:700;">${qSoldSum > 0 ? Number(qSoldSum.toFixed(1)).toLocaleString() : '—'}</td></tr>`;

    // Productivity row (color-coded)
    const calcProdClass = (sold: number | null, avail: number | null): string => {
      if (sold === null || avail === null || avail === 0) return "";
      const pct = (sold / avail) * 100;
      const variance = pct - productivityTarget;
      return variance >= 0 ? "green" : variance >= -10 ? "yellow" : "red";
    };
    html += `<tr><td style="${kpiNameStyle}">Productivity</td><td style="${navyTargetStyle} min-width:50px;">${productivityTarget}%</td>`;
    weekAvailTotals.forEach((avail, i) => {
      const sold = weekSoldTotals[i];
      const pct = avail !== null && sold !== null && avail > 0 ? (sold / avail) * 100 : null;
      html += `<td style="${getCellStyle(calcProdClass(sold, avail), baseFontSize, true)}">${pct !== null ? Math.round(pct) + '%' : '—'}</td>`;
    });
    const qProdPct = qAvailSum > 0 ? (qSoldSum / qAvailSum) * 100 : null;
    const qProdClass = qProdPct !== null ? (qProdPct - productivityTarget >= 0 ? "green" : qProdPct - productivityTarget >= -10 ? "yellow" : "red") : "";
    html += `<td style="${getCellStyle(qProdClass, baseFontSize, true)}">${qProdPct !== null ? Math.round(qProdPct) + '%' : '—'}</td></tr>`;

    html += `</tbody></table></div>`;
  } else {
    // Non-weekly: separate table per owner
    const thStyle2 = `border:1px solid #ddd;padding:6px 4px;text-align:left;font-size:${baseFontSize};background-color:#f4f4f4;font-weight:bold;`;
    const tdStyle2 = `border:1px solid #ddd;padding:6px 4px;text-align:left;font-size:${baseFontSize};`;

    Array.from(kpisByOwner.entries()).forEach(([ownerId, ownerKpis]) => {
      const ownerName = ownerId === "unassigned" ? "Unassigned" : (profilesMap.get(ownerId) as any)?.full_name || "Unknown";
      html += `<h2 style="color:#374151;margin-top:20px;margin-bottom:4px;font-size:14px;font-weight:700;">${escapeHtml(ownerName)}</h2>`;
      html += `<table style="border-collapse:collapse;width:100%;margin-top:8px;"><thead><tr><th style="${thStyle2}">KPI</th><th style="${thStyle2}">Target</th>`;
      periods.forEach((p: any) => { html += `<th style="${thStyle2}">${escapeHtml(p.label)}</th>`; });
      html += `</tr></thead><tbody>`;

      ownerKpis.forEach((kpi: any) => {
        const target = kpiTargetsMap.has(kpi.id) ? kpiTargetsMap.get(kpi.id)! : kpi.target_value;
        html += `<tr><td style="${tdStyle2}">${escapeHtml(kpi.name)}</td><td style="${tdStyle2}">${formatScorecardValue(target, kpi.metric_type, kpi.name)}</td>`;
        periods.forEach((p: any) => {
          const periodKey = (p as any).identifier;
          const entry = (entries || []).find((e: any) => e.kpi_id === kpi.id && e.month === periodKey);
          const val = entry?.actual_value ?? null;
          let cellClass = "";
          if (val !== null && target !== null && target !== 0) {
            const variance = kpi.metric_type === "percentage"
              ? val - target
              : ((val - target) / Math.abs(target)) * 100;
            if (kpi.target_direction === "above") cellClass = variance >= 0 ? "green" : variance >= -10 ? "yellow" : "red";
            else cellClass = variance <= 0 ? "green" : variance <= 10 ? "yellow" : "red";
          }
          html += `<td style="${getCellStyle(cellClass, baseFontSize, false)}">${formatScorecardValue(val, kpi.metric_type, kpi.name)}</td>`;
        });
        html += `</tr>`;
      });
      html += `</tbody></table>`;
    });
  }

  return html;
}

// ─── Top 10 section ──────────────────────────────────────────────────────────

async function buildTop10Section(supabase: any, listIds: string[]): Promise<string> {
  if (!listIds?.length) return "";

  let html = sectionLabel("Top 10 Lists");

  for (const listId of listIds) {
    const { data: list } = await supabase
      .from("top_10_lists")
      .select("id, title, description, columns, last_item_activity, departments(name, stores(name))")
      .eq("id", listId)
      .single();

    if (!list) continue;

    const { data: items } = await supabase
      .from("top_10_items")
      .select("rank, data")
      .eq("list_id", listId)
      .order("rank", { ascending: true });

    const columns = (list.columns || []) as Array<{ key: string; label: string }>;

    const thStyle = `padding:8px 12px;font-size:12px;font-weight:600;color:#ffffff;border-bottom:2px solid #e2e8f0;text-align:left;white-space:nowrap;`;
    let headerRow = `<th style="${thStyle}">#</th>`;
    for (const col of columns) {
      headerRow += `<th style="${thStyle}">${escapeHtml(col.label)}</th>`;
    }

    let bodyRows = "";
    for (const item of (items || [])) {
      const data = (item.data || {}) as Record<string, string>;
      const rowBg = item.rank % 2 === 0 ? "#f8fafc" : "#ffffff";
      let cells = `<td style="padding:8px 12px;font-size:12px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;background:${rowBg};">${item.rank}</td>`;
      for (const col of columns) {
        const val = data[col.key] || "";
        cells += `<td style="padding:8px 12px;font-size:12px;color:#1e293b;border-bottom:1px solid #e2e8f0;background:${rowBg};">${escapeHtml(val) || "&mdash;"}</td>`;
      }
      bodyRows += `<tr>${cells}</tr>`;
    }

    html += `<div style="font-size:13px;font-weight:700;color:#1e293b;margin-bottom:8px;margin-top:12px;">${escapeHtml(list.title)}</div>`;
    if (list.description) {
      html += `<div style="font-size:12px;color:#64748b;margin-bottom:8px;font-style:italic;">${escapeHtml(list.description)}</div>`;
    }
    html += `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:20px;">
      <thead><tr style="background:#16213e;">${headerRow}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>`;
  }

  return html;
}

// ─── Main handler ────────────────────────────────────────────────────────────

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

    const body: CombinedReportRequest = await req.json();
    const {
      departmentId,
      recipientEmails,
      sections,
      year = new Date().getFullYear(),
      quarter = Math.ceil((new Date().getMonth() + 1) / 3),
      scorecardMode = "monthly",
      roleFilter = "all",
      top10ListIds = [],
      clientDate,
    } = body;

    if (!departmentId || !recipientEmails?.length) {
      throw new Error("departmentId and recipientEmails are required");
    }
    if (!sections?.length) {
      throw new Error("At least one section is required");
    }

    // Fetch department context
    const { data: dept } = await supabaseClient
      .from("departments")
      .select("name, stores(name)")
      .eq("id", departmentId)
      .single();

    const deptName = dept?.name || "Department";
    const storeName = (dept?.stores as any)?.name || "";

    // Fetch sender
    const { data: senderProfile } = await supabaseClient
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();
    const senderName = senderProfile?.full_name || user.email;

    // Fetch profileMap (for todos assignee names)
    const { data: profiles } = await supabaseClient.from("profiles").select("id, full_name");
    const profileMap: Record<string, string> = {};
    (profiles || []).forEach((p: any) => { profileMap[p.id] = p.full_name; });

    const now = new Date();
    const dateStr = clientDate || now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    // Build each section
    const sectionBlocks: string[] = [];

    for (const section of sections) {
      if (section === "issues-todos") {
        const html = await buildIssuesTodosSection(supabaseClient, departmentId, profileMap);
        sectionBlocks.push(`<div style="padding: 0 32px;">${html}</div>`);
      } else if (section === "scorecard") {
        const html = await buildScorecardSection(supabaseClient, departmentId, year, quarter, scorecardMode, roleFilter);
        sectionBlocks.push(`<div style="padding: 0 32px;">${html}</div>`);
      } else if (section === "top10") {
        let listIds = top10ListIds;
        // If the section was checked but no specific lists were selected, fall back to all active lists
        if (!listIds.length) {
          const { data: allLists } = await supabaseClient
            .from("top_10_lists")
            .select("id")
            .eq("department_id", departmentId)
            .eq("is_active", true)
            .order("display_order");
          listIds = (allLists || []).map((l: any) => l.id);
        }
        if (listIds.length > 0) {
          const html = await buildTop10Section(supabaseClient, listIds);
          sectionBlocks.push(`<div style="padding: 0 32px;">${html}</div>`);
        }
      }
    }

    const bodyContent = sectionBlocks.join(`<div style="padding: 0 32px;">${divider()}</div>`);

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="700" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#0f172a;padding:28px 32px;">
            <h1 style="margin:0 0 6px 0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">Combined Report</h1>
            <div style="font-size:14px;color:#94a3b8;">${escapeHtml(storeName)}${deptName ? ` &bull; ${escapeHtml(deptName)}` : ""}</div>
          </td>
        </tr>

        <!-- Meta -->
        <tr>
          <td style="padding:16px 32px 20px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:13px;color:#64748b;">Sent by <strong style="color:#1e293b;">${escapeHtml(senderName)}</strong></td>
                <td align="right" style="font-size:13px;color:#64748b;">${dateStr}</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Sections -->
        <tr><td style="padding-bottom:32px;">${bodyContent}</td></tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">Sent from Growth Scorecard</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

    const subject = `Combined Report — ${storeName}${deptName ? ` · ${deptName}` : ""}`;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Growth Scorecard <reports@dealergrowth.solutions>",
        to: recipientEmails,
        subject,
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
