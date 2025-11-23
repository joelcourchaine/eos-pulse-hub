-- Fix infinite recursion by recreating security definer functions with plpgsql
-- This ensures they properly bypass RLS policies

CREATE OR REPLACE FUNCTION public.get_user_store_group(_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_group_id uuid;
BEGIN
  SELECT store_group_id INTO v_store_group_id
  FROM public.profiles
  WHERE id = _user_id
  LIMIT 1;
  
  RETURN v_store_group_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_store(_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id uuid;
BEGIN
  SELECT store_id INTO v_store_id
  FROM public.profiles
  WHERE id = _user_id
  LIMIT 1;
  
  RETURN v_store_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_department(_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_department_id uuid;
BEGIN
  SELECT id INTO v_department_id
  FROM public.departments
  WHERE manager_id = _user_id
  LIMIT 1;
  
  RETURN v_department_id;
END;
$$;