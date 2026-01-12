-- Fix GP% sub-metric values for North Island Nissan that are stored as decimals instead of percentages
UPDATE public.financial_entries fe
SET value = value * 100,
    updated_at = now()
FROM departments d, stores s
WHERE fe.department_id = d.id
  AND d.store_id = s.id
  AND s.name = 'North Island Nissan'
  AND fe.metric_name LIKE 'sub:gp_percent:%'
  AND fe.value IS NOT NULL
  AND fe.value <= 1;