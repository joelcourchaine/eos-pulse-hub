
## Plan

Run a single DELETE to clear **all** rows from `financial_targets` — both regular targets and sub-metric (`sub:`) rows.

**SQL to execute:**
```sql
DELETE FROM financial_targets;
```

This removes all 3,967 rows entirely. No code changes needed.
