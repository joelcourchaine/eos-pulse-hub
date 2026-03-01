
## What I found

All 18 technician KPI definitions exist in the database with **zero scorecard entries** — the re-imports never actually wrote data (likely because the KPI label `Open and Closed Hours` didn't match the new expected label `Sold Hours`). The technician profiles and aliases are fine and should be kept.

## Plan: Delete all tech KPIs, keep profiles & aliases, re-import fresh

### Step 1: Database cleanup (direct delete)

Delete all 18 KPI definitions for the 6 technicians in department `c6ffe45e-de3d-4b5c-a913-e1b41393c153`. Since entry count is 0 for all, there's no data loss:

```sql
DELETE FROM kpi_definitions
WHERE department_id = 'c6ffe45e-de3d-4b5c-a913-e1b41393c153'
AND assigned_to IN (
  '008d17fa-0db7-49fc-a4ed-b584da119d6d', -- Bill Vanderbos
  'd1db405c-e737-4eeb-9b57-c4dcf4114243', -- Michael Abrahamsz
  'a67aef03-766b-4136-9e5c-aa846eda3de7', -- Vincente Castillo
  'cd312d24-403c-481c-a54d-92eaf034ba83', -- Samantha Reitsema
  '156f0c95-659c-4bec-852a-6ecf9d7ad120', -- Manny Ruiz
  '83c83e30-fdeb-4c1b-9fde-581b566bc3b3'  -- Ray Prakash
)
AND name IN ('Available Hours', 'Open and Closed Hours', 'Sold Hours', 'Closed Hours', 'Productive');
```

### Step 2: Also fix the import label used in code

Looking at the current import code, `kpiLabel` is used for the "Sold Hrs" KPI name. I need to verify what value it resolves to — the previous import created `Open and Closed Hours` which suggests `kpiLabel` was being set to that old label. I need to check the current code to confirm it now correctly uses `Sold Hours`.

### Step 3: Re-import

After cleanup, re-import the technician hours report. The aliases are still intact so technician names will auto-match — you just confirm and submit.

### What stays intact
- All 6 technician **profiles** (their user accounts, won't be touched)
- All 6 **aliases** (name → user ID mapping, won't be touched)
- All **advisor scorecard data** (completely separate department rows)
