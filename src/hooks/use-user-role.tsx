import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useUserRole = (userId: string | undefined) => {
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setRoles([]);
      setLoading(false);
      return;
    }

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
      }
    };

    fetchRoles();
  }, [userId]);

  const hasRole = (role: string) => roles.includes(role);
  const isSuperAdmin = hasRole("super_admin");
  const isStoreGM = hasRole("store_gm");
  const isDepartmentManager = hasRole("department_manager") || hasRole("fixed_ops_manager");
  const isFixedOpsManager = hasRole("fixed_ops_manager");

  return {
    roles,
    loading,
    hasRole,
    isSuperAdmin,
    isStoreGM,
    isDepartmentManager,
    isFixedOpsManager,
  };
};
