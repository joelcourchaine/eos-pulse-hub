
## Understanding

The user wants every store to automatically have all 5 core departments (Parts Department, Service Department, Body Shop Department, New Vehicles, Used Vehicles) available — both for existing stores that are missing some, and for any new store created going forward. "Executive Rollup" is excluded as it's a special aggregate type.

### Current state (from database)
- Most stores only have 2 departments (Parts + Service)
- A few have 3-4
- None have all 5 core types
- There are 34 stores, many missing Body Shop, New Vehicles, and/or Used Vehicles
- 1 store (Woldu Select) has zero departments

## Two-part fix

### Part 1 — Backfill existing stores (database migration)
A SQL migration that inserts all 5 core department types for every store that is currently missing any of them:

```sql
INSERT INTO departments (name, store_id, department_type_id)
SELECT 
  dt.name,
  s.id AS store_id,
  dt.id AS department_type_id
FROM stores s
CROSS JOIN department_types dt
WHERE dt.name NOT IN ('Executive Rollup')
AND NOT EXISTS (
  SELECT 1 FROM departments d
  WHERE d.store_id = s.id AND d.department_type_id = dt.id
);
```

This is safe — it only inserts missing combinations and skips ones that already exist.

### Part 2 — Auto-provision for new stores (database trigger)
Add a trigger on the `stores` table that fires `AFTER INSERT` and creates all 5 core department rows automatically when a new store is created. This mirrors the existing `auto_deploy_customer_journey` trigger pattern already in the codebase.

```sql
CREATE OR REPLACE FUNCTION public.auto_provision_departments()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.departments (name, store_id, department_type_id)
  SELECT dt.name, NEW.id, dt.id
  FROM public.department_types dt
  WHERE dt.name NOT IN ('Executive Rollup');
  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_provision_departments_on_store_create
AFTER INSERT ON public.stores
FOR EACH ROW EXECUTE FUNCTION public.auto_provision_departments();
```

### Files to change
- **Database migration** — backfill + trigger (no code files changed)

### What this does NOT touch
- Existing manager assignments (kept as-is)
- Executive Rollup department type (intentionally excluded — it's a special aggregate)
- Any custom departments already created
- The `DepartmentSelectionDialog` still works as-is for managing assignments

### Result
- All 34 existing stores get the missing departments filled in immediately
- Any new store created via "Add Store" automatically gets all 5 departments
- No UI changes needed — the department selector will simply show all departments since they'll all exist
