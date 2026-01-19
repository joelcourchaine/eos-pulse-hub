import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useUserRole = (userId: string | undefined) => {
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const previousUserId = useRef<string | undefined>(undefined);

  useEffect(() => {
    // If userId hasn't been set yet, keep loading true
    if (!userId) {
      // Only reset roles if we had a userId before (user logged out)
      if (previousUserId.current !== undefined) {
        setRoles([]);
        setLoading(false);
      }
      // Otherwise keep loading = true (initial state, waiting for user)
      return;
    }

    // userId is now defined, fetch roles
    const fetchRoles = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId);

        if (error) throw error;
        setRoles(data?.map((r) => r.role) || []);
      } catch (error) {
        console.error("Error fetching user roles:", error);
        setRoles([]);
      } finally {
        setLoading(false);
        previousUserId.current = userId;
      }
    };

    fetchRoles();
  }, [userId]);

  const hasRole = (role: string) => roles.includes(role);
  const isSuperAdmin = hasRole("super_admin");
  const isStoreGM = hasRole("store_gm");
  const isController = hasRole("controller");
  const isDepartmentManager = hasRole("department_manager") || hasRole("fixed_ops_manager");
  const isFixedOpsManager = hasRole("fixed_ops_manager");
  const isConsultingScheduler = hasRole("consulting_scheduler");
  const hasElevatedAccess = isSuperAdmin || isConsultingScheduler;
  // Controller has same view access as Store GM but read-only
  const hasStoreViewAccess = isStoreGM || isController;

  return {
    roles,
    loading,
    hasRole,
    isSuperAdmin,
    isStoreGM,
    isController,
    isDepartmentManager,
    isFixedOpsManager,
    isConsultingScheduler,
    hasElevatedAccess,
    hasStoreViewAccess,
  };
};
