-- Update get_user_store_group function to fallback to store's group if store_group_id is null
CREATE OR REPLACE FUNCTION public.get_user_store_group(_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_store_group_id uuid;
BEGIN
  -- First try to get store_group_id directly from profile
  SELECT store_group_id INTO v_store_group_id
  FROM public.profiles
  WHERE id = _user_id
  LIMIT 1;
  
  -- If null, fallback to getting group from the user's assigned store
  IF v_store_group_id IS NULL THEN
    SELECT s.group_id INTO v_store_group_id
    FROM public.profiles p
    JOIN public.stores s ON s.id = p.store_id
    WHERE p.id = _user_id
    LIMIT 1;
  END IF;
  
  RETURN v_store_group_id;
END;
$function$;

-- Also update get_user_store_group_no_rls for consistency
CREATE OR REPLACE FUNCTION public.get_user_store_group_no_rls(_user_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    p.store_group_id,
    s.group_id
  )
  FROM public.profiles p
  LEFT JOIN public.stores s ON s.id = p.store_id
  WHERE p.id = _user_id
  LIMIT 1
$function$;

-- Also update get_current_user_store_group for consistency
CREATE OR REPLACE FUNCTION public.get_current_user_store_group()
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_store_group_id uuid;
BEGIN
  -- First try to get store_group_id directly from profile
  SELECT store_group_id INTO v_store_group_id
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
  
  -- If null, fallback to getting group from the user's assigned store
  IF v_store_group_id IS NULL THEN
    SELECT s.group_id INTO v_store_group_id
    FROM public.profiles p
    JOIN public.stores s ON s.id = p.store_id
    WHERE p.id = auth.uid()
    LIMIT 1;
  END IF;
  
  RETURN v_store_group_id;
END;
$function$;