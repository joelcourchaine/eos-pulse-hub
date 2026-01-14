-- Add invited_at column to profiles table to track when invitation emails were sent
ALTER TABLE public.profiles ADD COLUMN invited_at TIMESTAMPTZ;