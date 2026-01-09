-- Fix the get_signature_spots_by_request function to use correct return types
DROP FUNCTION IF EXISTS public.get_signature_spots_by_request(uuid);

CREATE OR REPLACE FUNCTION public.get_signature_spots_by_request(p_request_id uuid)
RETURNS TABLE (
  id uuid,
  page_number integer,
  x_position double precision,
  y_position double precision,
  width double precision,
  height double precision,
  label text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ss.id,
    ss.page_number,
    ss.x_position,
    ss.y_position,
    ss.width,
    ss.height,
    ss.label
  FROM signature_spots ss
  WHERE ss.request_id = p_request_id;
END;
$$;