
## Two changes: (1) Stunning email HTML template, (2) Email button inside the GO Scorecard header

---

### Change 1 — Redesign the weekly scorecard email HTML

**Current state**: Plain white `Arial` table with `#f4f4f4` headers and pale `#efe/#ffc/#fee` cell backgrounds. No branding, no structure.

**Goal**: A beautiful HTML email that mirrors the app's GO Scorecard visual identity:
- **Dark navy header banner** (`#1e2d47` / `hsl(222,47%,16%)`) with white text showing store name, department, quarter, and summary stats (weeks entered, green rate %)
- **Per-owner section headers** styled like the navy summary strip — dark background, owner name prominently displayed
- **Week column headers** using the "WK N / M/D–M/D" two-line style matching the app
- **Target column** in navy like in the UI
- **Data cells** using bold, saturated colors instead of pale pastels:
  - Green: `#059669` background, white text
  - Yellow/Amber: `#d97706` background, white text  
  - Red: `#dc2626` background, white text
  - Empty: light grey `#f8fafc`
- **Compact row height** with `text-xs` sizing, mirroring the dense scorecard layout
- **Director's Notes** section with left blue border (already exists, keep and polish)
- **Legend footer** row showing ● Green = At/above, ● Amber = Within 10%, ● Red = Below

This is purely a change to the `html` string construction in `supabase/functions/send-scorecard-email/index.ts`.

Key HTML structure:
```
<!-- Header banner (navy) -->
<div style="background:#1e2d47; color:white; padding:20px 24px; border-radius:8px 8px 0 0">
  <h1>Store Name — Dept Scorecard</h1>
  <div style="display:flex; gap:24px; margin-top:12px">
    Q1 2026 | 13 weeks | Wk 7 | 54% Green Rate
  </div>
</div>

<!-- Per-owner table -->
<div style="margin-top:20px">
  <div style="background:#2d3f5e; color:white; padding:8px 12px; font-weight:bold">
    John Smith — Service Advisor
  </div>
  <table style="width:100%; border-collapse:collapse">
    <thead>
      <tr>
        <th style="background:#1e2d47; color:white; ...">KPI</th>
        <th style="background:#1e2d47; color:white; ...">Target</th>
        <!-- 13 week columns -->
        <th style="background:#e2e8f0; ...">WK 1<br><small>12/30–1/5</small></th>
        ...
        <th style="background:#e2e8f0; ...">Q-Total</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="font-weight:600; ...">CP Hours Per RO</td>
        <td style="background:#1e2d47; color:white; ...">3.50</td>
        <td style="background:#059669; color:white; ...">3.8</td>
        <td style="background:#dc2626; color:white; ...">2.9</td>
        ...
      </tr>
    </tbody>
  </table>
</div>
```

---

### Change 2 — Email button in ScorecardGrid header (inside the component)

Add a `Mail` icon button to the right-side actions area of the GO Scorecard header (around line 3699–3719 in ScorecardGrid.tsx). This button:

1. Opens a **compact popover/dialog** (not the full Dashboard email dialog) with:
   - A **role selector** — dropdown/radio with the same role options as the `selectedRoleFilter` (Service Advisor, Technician, etc.) but defaulting to whichever role is currently selected in the filter
   - A **recipients input** — plain text field for comma-separated emails (same pattern as other dialogs)
   - A **Send** button

2. On send, calls the `send-scorecard-email` edge function directly from inside ScorecardGrid, passing:
   - `departmentId`
   - `year`, `quarter`
   - `mode: "weekly"` (fixed — this button is for the 13-week view)
   - `recipientEmails`
   - **`roleFilter`** (new parameter to filter KPIs by owner role)

3. The edge function needs to support a new optional `roleFilter` parameter — when provided, it filters the `kpis` array to only include KPIs whose assigned user has that role before building the table sections.

**ScorecardGrid needs to:**
- Add `emailScorecardOpen` state (boolean) + `emailRoleFilter` state + `emailRecipientsInput` state
- Add the Mail button + popover in the right-side actions bar
- Add `handleEmailFromGrid()` function that calls the edge function with supabase auth token

**Edge function needs to:**
- Accept optional `roleFilter?: string` in `EmailRequest`
- When `roleFilter` is set, fetch `user_roles` for each KPI's assigned user and filter the `kpisByOwner` map to only include owners matching that role

---

### Files to change

1. **`supabase/functions/send-scorecard-email/index.ts`**:
   - Completely rewrite the HTML builder to use the navy/branded design
   - Add `roleFilter` to `EmailRequest` interface
   - After building `kpisByOwner`, filter by role if `roleFilter` is present (fetch `user_roles` for assigned users)

2. **`src/components/scorecard/ScorecardGrid.tsx`**:
   - Add 3 state vars: `emailPopoverOpen`, `emailRoleFilter`, `emailCustomRecipients`
   - Add `handleSendEmailFromGrid` async function
   - Add Mail button + Popover UI in the right-side actions section (~line 3699)
   - Pass `Mail` from lucide imports (check if already imported)
