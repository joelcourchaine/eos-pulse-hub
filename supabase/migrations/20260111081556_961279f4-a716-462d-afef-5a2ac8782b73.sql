-- Create enums for ticket management
CREATE TYPE public.ticket_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
CREATE TYPE public.ticket_category AS ENUM ('bug_report', 'feature_request', 'question', 'other');
CREATE TYPE public.ticket_priority AS ENUM ('low', 'normal', 'urgent');

-- Create help_tickets table
CREATE TABLE public.help_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_number SERIAL UNIQUE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  page_url TEXT,
  browser_info TEXT,
  error_message TEXT,
  error_stack TEXT,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  category public.ticket_category NOT NULL DEFAULT 'bug_report',
  priority public.ticket_priority NOT NULL DEFAULT 'normal',
  screenshot_path TEXT,
  status public.ticket_status NOT NULL DEFAULT 'open',
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Create help_ticket_replies table
CREATE TABLE public.help_ticket_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.help_tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  message TEXT NOT NULL,
  is_admin_reply BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.help_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.help_ticket_replies ENABLE ROW LEVEL SECURITY;

-- RLS Policies for help_tickets
-- Users can view their own tickets
CREATE POLICY "Users can view their own tickets"
  ON public.help_tickets
  FOR SELECT
  USING (user_id = auth.uid());

-- Users can create tickets for themselves
CREATE POLICY "Users can create their own tickets"
  ON public.help_tickets
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Super admins can view all tickets
CREATE POLICY "Super admins can view all tickets"
  ON public.help_tickets
  FOR SELECT
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Super admins can update any ticket
CREATE POLICY "Super admins can update any ticket"
  ON public.help_tickets
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'super_admin'));

-- RLS Policies for help_ticket_replies
-- Users can view replies on their own tickets
CREATE POLICY "Users can view replies on their tickets"
  ON public.help_ticket_replies
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.help_tickets
      WHERE help_tickets.id = help_ticket_replies.ticket_id
      AND help_tickets.user_id = auth.uid()
    )
  );

-- Super admins can view all replies
CREATE POLICY "Super admins can view all replies"
  ON public.help_ticket_replies
  FOR SELECT
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Users can reply to their own tickets
CREATE POLICY "Users can reply to their own tickets"
  ON public.help_ticket_replies
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.help_tickets
      WHERE help_tickets.id = help_ticket_replies.ticket_id
      AND help_tickets.user_id = auth.uid()
    )
  );

-- Super admins can reply to any ticket
CREATE POLICY "Super admins can reply to any ticket"
  ON public.help_ticket_replies
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Create updated_at trigger for help_tickets
CREATE TRIGGER update_help_tickets_updated_at
  BEFORE UPDATE ON public.help_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_help_tickets_user_id ON public.help_tickets(user_id);
CREATE INDEX idx_help_tickets_status ON public.help_tickets(status);
CREATE INDEX idx_help_tickets_created_at ON public.help_tickets(created_at DESC);
CREATE INDEX idx_help_ticket_replies_ticket_id ON public.help_ticket_replies(ticket_id);