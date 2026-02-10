-- Drop old unique constraint and create new one that includes effective_year
ALTER TABLE financial_cell_mappings 
  DROP CONSTRAINT financial_cell_mappings_brand_department_name_metric_key_key;

ALTER TABLE financial_cell_mappings 
  ADD CONSTRAINT financial_cell_mappings_brand_dept_metric_year_key 
  UNIQUE (brand, department_name, metric_key, effective_year);