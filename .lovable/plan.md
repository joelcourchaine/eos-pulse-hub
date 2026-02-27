
## Plan

### 1. Fix org chart position color coding (database update)
The `team_members` positions are stored as free-text (e.g. "Service Director", "Shop Foreman", "Red Seal Technician") but `POSITION_COLORS` in `ReverseOrgChart.tsx` uses snake_case keys (e.g. `service_manager`, `foreman`, `red_seal_technician`). The positions need to match the keys used in the color map.

**Update `team_members` positions to snake_case keys:**
- "Service Director" → there's no key for this; add `service_director` to `POSITION_COLORS` in code
- "Fixed Ops Manager" → add `fixed_ops_manager` to `POSITION_COLORS`  
- "Shop Foreman" → maps to `foreman`
- "Service Manager" → `service_manager` ✓ (already exists)
- "Service Advisor" → `advisor` ✓
- "BDC Coordinator" → add `bdc_coordinator`
- "Warranty Administrator" → `warranty_admin` (update DB: "Warranty Administrator" → "warranty_admin")
- "Red Seal Technician" → `red_seal_technician` (add to POSITION_COLORS)
- "3rd Year Apprentice" → `apprentice_3` (add to POSITION_COLORS)
- "2nd Year Apprentice" → `apprentice_2` (add to POSITION_COLORS)
- "Lube Technician" → `lube_technician` (add to POSITION_COLORS)

**DB updates needed:** update `position` values to snake_case keys matching `POSITION_OPTIONS` in AddTeamMemberDialog (which already uses correct keys like `foreman`, `red_seal_technician`, etc.)

**Code change:** Add missing position colors to `POSITION_COLORS` map in `ReverseOrgChart.tsx`:
```ts
service_director: { bg: "hsl(230 55% 30%)", text: "white", border: "..." },
fixed_ops_manager: { bg: "hsl(200 60% 35%)", text: "white", border: "..." },
bdc_coordinator: { bg: "hsl(290 50% 50%)", text: "white", border: "..." },
lube_technician: { bg: "hsl(25 70% 58%)", text: "white", border: "..." },
red_seal_technician: { bg: "hsl(25 95% 45%)", text: "white", border: "..." },
apprentice_1/2/3/4: distinct amber/yellow shades,
```

Also add these to `POSITION_LABELS`.

### 2. Restructure org chart to match screenshot more closely
The current data already matches the screenshot structure (Jordan Mitchell → Tyler Brooks + Blake Harrison → Sam Chen etc.). The issue is purely the position key mismatch causing no colors. Once positions are corrected, the chart will render with colors.

**DB: Update positions to snake_case:**
```sql
UPDATE team_members SET position = 'foreman' WHERE name = 'Sam Chen';
UPDATE team_members SET position = 'warranty_admin' WHERE name = 'Avery Kim';
UPDATE team_members SET position = 'red_seal_technician' WHERE name IN ('Jordan Lee','Peyton Nguyen','Marcus Olsen','Tanner Walsh');
UPDATE team_members SET position = 'apprentice_3' WHERE name = 'Dylan Park';
UPDATE team_members SET position = 'apprentice_2' WHERE name = 'Brooke Santos';
UPDATE team_members SET position = 'lube_technician' WHERE name IN ('Jamie Torres','Sage Anderson','Remy Castillo');
UPDATE team_members SET position = 'advisor' WHERE position = 'Service Advisor';
UPDATE team_members SET position = 'service_manager' WHERE name = 'Blake Harrison';
UPDATE team_members SET position = 'fixed_ops_manager' WHERE name = 'Tyler Brooks';
UPDATE team_members SET position = 'bdc_coordinator' WHERE name = 'Alex Rivera';
-- Add service_director as new position type for Jordan Mitchell
UPDATE team_members SET position = 'service_director' WHERE name = 'Jordan Mitchell';
```

### 3. Insert issues for the Service department

Insert 6 realistic service department issues with mixed statuses and severities:
```sql
INSERT INTO issues (department_id, title, description, status, severity, created_by) VALUES
('8d003f60...', 'CP Labour Absorption Below 75% Target', '...', 'open', 'high', '9477e2ed...'),
('8d003f60...', 'Tech Efficiency at 98% — Below 105% Goal', '...', 'open', 'medium', ...),
('8d003f60...', 'Advisor Upsell Compliance Low (42%)', '...', 'in_progress', 'medium', ...),
('8d003f60...', 'CSI Score Declined 3 Consecutive Weeks', '...', 'open', 'high', ...),
('8d003f60...', 'Parts WIP Aging Over 30 Days on 12 ROs', '...', 'in_progress', 'low', ...),
('8d003f60...', 'Loaner Fleet Utilization at 61% — 2 Units Offline', '...', 'open', 'low', ...);
```

### Files changed
- `src/components/team/ReverseOrgChart.tsx` — add missing position colors + labels
- DB updates (no migrations needed — data + code only)
