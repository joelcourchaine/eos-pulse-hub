import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Globally tracks user activity by:
 * 1. Updating `last_active_at` on the profile (existing behavior)
 * 2. Inserting a row into `activity_log` for historical tracking
 * Fires once per page load when an authenticated session exists.
 */
export function useTrackActivity() {
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user?.id || tracked.current) return;
      tracked.current = true;

      const userId = session.user.id;

      // Update last_active_at on profile (keeps existing behavior)
      supabase
        .from("profiles")
        .update({ last_active_at: new Date().toISOString() } as any)
        .eq("id", userId)
        .then(({ error }) => {
          if (error) console.error("Error updating last_active_at:", error);
        });

      // Insert activity log entry for historical tracking
      supabase
        .from("activity_log")
        .insert({ user_id: userId, event_type: "page_view" } as any)
        .then(({ error }) => {
          if (error) console.error("Error inserting activity log:", error);
        });
    });
  }, []);
}

/**
 * Log a specific activity event (e.g., excel_import, scorecard_import).
 * Call this from components when notable actions occur.
 */
export async function logActivity(
  eventType: string,
  metadata?: Record<string, unknown>
) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return;

  const { error } = await supabase
    .from("activity_log")
    .insert({
      user_id: session.user.id,
      event_type: eventType,
      metadata: metadata ?? {},
    } as any);

  if (error) console.error("Error logging activity:", error);
}
