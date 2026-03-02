-- Bulk update forecast entries in a single transaction
-- Replaces 800+ individual PATCH requests with 1 RPC call
CREATE OR REPLACE FUNCTION public.bulk_update_forecast_entries(p_updates jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  item jsonb;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(p_updates)
  LOOP
    UPDATE public.forecast_entries
    SET
      forecast_value = (item ->> 'forecast_value')::numeric,
      baseline_value = CASE
        WHEN item ? 'baseline_value' THEN (item ->> 'baseline_value')::numeric
        ELSE baseline_value
      END,
      is_locked = CASE
        WHEN item ? 'is_locked' THEN (item ->> 'is_locked')::boolean
        ELSE is_locked
      END
    WHERE id = (item ->> 'id')::uuid;
  END LOOP;
END;
$$;
