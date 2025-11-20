-- Add new advisor roles to the app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'sales_advisor';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'service_advisor';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'parts_advisor';