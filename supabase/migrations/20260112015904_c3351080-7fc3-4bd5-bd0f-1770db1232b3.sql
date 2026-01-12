-- Add last_item_activity column to top_10_lists
ALTER TABLE public.top_10_lists 
ADD COLUMN last_item_activity timestamptz DEFAULT now();

-- Create trigger function to update last_item_activity
CREATE OR REPLACE FUNCTION public.update_list_item_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.top_10_lists 
    SET last_item_activity = now() 
    WHERE id = OLD.list_id;
    RETURN OLD;
  ELSE
    UPDATE public.top_10_lists 
    SET last_item_activity = now() 
    WHERE id = NEW.list_id;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on top_10_items
CREATE TRIGGER update_list_activity_on_item_change
AFTER INSERT OR UPDATE OR DELETE ON public.top_10_items
FOR EACH ROW EXECUTE FUNCTION public.update_list_item_activity();

-- Backfill existing lists with their most recent item activity
UPDATE public.top_10_lists l
SET last_item_activity = COALESCE(
  (SELECT MAX(GREATEST(created_at, updated_at)) 
   FROM public.top_10_items 
   WHERE list_id = l.id),
  l.created_at
);