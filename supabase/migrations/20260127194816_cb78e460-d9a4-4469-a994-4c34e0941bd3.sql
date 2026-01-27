-- 1. Update all existing "Oldest RO's" lists to add Status column
UPDATE top_10_lists 
SET columns = columns || '[{"key": "col_6", "label": "Status"}]'::jsonb,
    updated_at = now()
WHERE title ILIKE '%oldest%ro%'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(columns) elem 
    WHERE elem->>'label' = 'Status'
  );

-- 2. Update the template for future lists
UPDATE top_10_list_templates 
SET columns = '[
  {"key": "col_1", "label": "RO Date"},
  {"key": "col_2", "label": "Customer Last Name"},
  {"key": "col_3", "label": "RO #"},
  {"key": "col_4", "label": "RO Value"},
  {"key": "col_5", "label": "# of Days"},
  {"key": "col_6", "label": "Status"}
]'::jsonb,
updated_at = now()
WHERE title ILIKE '%oldest%ro%';