-- Add fixed_ops_manager to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'fixed_ops_manager';