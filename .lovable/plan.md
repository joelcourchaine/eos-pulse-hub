
## Delete Duplicate "Open and Closed Hours" KPIs for River City Ram

### What was found
Every technician at River City Ram has exactly **2** "Open and Closed Hours" KPI definitions — the original one (renamed from "Closed Hours") and a new one (created when the import code ran after the rename). **Neither duplicate has any scorecard entries** — all 14 duplicates have `entry_count: 0` — so we can safely delete one from each technician with zero data loss.

### Technicians affected (7 technicians, 7 rows to delete)
For each technician, we keep the first ID and delete the second. The specific IDs to delete (one per technician):

| Technician | ID to DELETE |
|---|---|
| Andrew | `51e58c73-1a0e-4642-8441-b13542924fd0` |
| Gavin | `faa18aa0-a19b-4a6a-b81c-69969fb9cbc8` |
| Jim E | `81ca84d6-4e91-4da3-ad14-531a20b1cb8a` |
| Ken | `493728b5-9d16-4860-b045-b4e65debea48` |
| Kiel | `5dd21542-5ba1-452e-bd54-dc3f07e2a8d3` |
| Martin | `a09eb444-ae37-4ece-8401-d6584033cd88` |
| Noah | `85981ba3-4eaa-469b-a47f-68db9244ac9d` |

### SQL (DB-only, no code changes)
```sql
DELETE FROM kpi_definitions
WHERE id IN (
  '51e58c73-1a0e-4642-8441-b13542924fd0',
  'faa18aa0-a19b-4a6a-b81c-69969fb9cbc8',
  '81ca84d6-4e91-4da3-ad14-531a20b1cb8a',
  '493728b5-9d16-4860-b045-b4e65debea48',
  '5dd21542-5ba1-452e-bd54-dc3f07e2a8d3',
  'a09eb444-ae37-4ece-8401-d6584033cd88',
  '85981ba3-4eaa-469b-a47f-68db9244ac9d'
);
```

**No code changes. No migration needed. No data lost.** All entries are 0 on both duplicates so any one is safe to remove.

### Root cause note
The duplicates were created because: (1) the original "Closed Hours" KPI was renamed to "Open and Closed Hours" in the DB, then (2) the technician import ran and found no matching "Open and Closed Hours" KPI, so it created a new one — resulting in two. After this cleanup, re-running the import will correctly match against the single remaining KPI by name.
