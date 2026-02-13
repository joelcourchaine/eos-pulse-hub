import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Globally tracks user activity by updating `last_active_at` on the profile.
 * Fires once per page load when an authenticated session exists.
 */
export function useTrackActivity() {
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user?.id || tracked.current) return;
      tracked.current = true;

      supabase
        .from("profiles")
        .update({ last_active_at: new Date().toISOString() } as any)
        .eq("id", session.user.id)
        .then(({ error }) => {
          if (error) console.error("Error updating last_active_at:", error);
        });
    });
  }, []);
}
