-- Create announcement priority enum
CREATE TYPE public.announcement_priority AS ENUM ('info', 'warning', 'urgent');

-- Create announcements table with store group targeting
CREATE TABLE public.announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority announcement_priority NOT NULL DEFAULT 'info',
  is_active BOOLEAN NOT NULL DEFAULT true,
  store_group_id UUID REFERENCES public.store_groups(id) ON DELETE SET NULL,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create announcement dismissals table
CREATE TABLE public.announcement_dismissals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(announcement_id, user_id)
);

-- Enable RLS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_dismissals ENABLE ROW LEVEL SECURITY;

-- Announcements policies
CREATE POLICY "Users can view active announcements for their groups"
ON public.announcements
FOR SELECT
USING (
  is_active = true 
  AND now() >= starts_at 
  AND now() <= expires_at
  AND (
    store_group_id IS NULL 
    OR store_group_id IN (
      SELECT store_group_id FROM public.stores 
      WHERE id IN (SELECT store_id FROM public.user_store_access WHERE user_id = auth.uid())
    )
  )
);

CREATE POLICY "Super admins can manage all announcements"
ON public.announcements
FOR ALL
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
);

-- Dismissals policies
CREATE POLICY "Users can view their own dismissals"
ON public.announcement_dismissals
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can dismiss announcements"
ON public.announcement_dismissals
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Create updated_at trigger
CREATE TRIGGER update_announcements_updated_at
BEFORE UPDATE ON public.announcements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();