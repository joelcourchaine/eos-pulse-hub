import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

export interface CommissionRule {
  source_metric: string;
  rate: number;
  min_threshold: number | null;
  max_threshold: number | null;
  description?: string;
}

export interface PayplanScenario {
  id: string;
  user_id: string;
  name: string;
  base_salary_annual: number;
  commission_rules: { rules: CommissionRule[] };
  department_names: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreatePayplanScenarioInput {
  name: string;
  base_salary_annual: number;
  commission_rules: { rules: CommissionRule[] };
  department_names?: string[];
}

export interface UpdatePayplanScenarioInput extends Partial<CreatePayplanScenarioInput> {
  id: string;
  is_active?: boolean;
}

// Helper to safely parse commission_rules from JSON
function parseCommissionRules(jsonValue: Json | undefined): { rules: CommissionRule[] } {
  if (!jsonValue || typeof jsonValue !== 'object' || Array.isArray(jsonValue)) {
    return { rules: [] };
  }
  const obj = jsonValue as Record<string, unknown>;
  if (Array.isArray(obj.rules)) {
    return { rules: obj.rules as CommissionRule[] };
  }
  return { rules: [] };
}

export function usePayplanScenarios() {
  const queryClient = useQueryClient();

  const { data: scenarios, isLoading, error } = useQuery({
    queryKey: ["payplan_scenarios"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("payplan_scenarios")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      return (data || []).map(s => ({
        ...s,
        commission_rules: parseCommissionRules(s.commission_rules),
      })) as PayplanScenario[];
    },
  });

  const activeScenarios = scenarios?.filter(s => s.is_active) || [];

  const createScenario = useMutation({
    mutationFn: async (input: CreatePayplanScenarioInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("payplan_scenarios")
        .insert({
          user_id: user.id,
          name: input.name,
          base_salary_annual: input.base_salary_annual,
          commission_rules: input.commission_rules as unknown as Json,
          department_names: input.department_names || [],
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payplan_scenarios"] });
      toast.success("Payplan scenario created");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create scenario");
    },
  });

  const updateScenario = useMutation({
    mutationFn: async (input: UpdatePayplanScenarioInput) => {
      const { id, commission_rules, ...otherUpdates } = input;
      
      const updatePayload: Record<string, unknown> = { ...otherUpdates };
      if (commission_rules) {
        updatePayload.commission_rules = commission_rules as unknown as Json;
      }
      
      const { error } = await supabase
        .from("payplan_scenarios")
        .update(updatePayload)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payplan_scenarios"] });
      toast.success("Payplan scenario updated");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update scenario");
    },
  });

  const deleteScenario = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("payplan_scenarios")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payplan_scenarios"] });
      toast.success("Payplan scenario deleted");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete scenario");
    },
  });

  const toggleScenarioActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("payplan_scenarios")
        .update({ is_active })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payplan_scenarios"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to toggle scenario");
    },
  });

  return {
    scenarios: scenarios || [],
    activeScenarios,
    isLoading,
    error,
    createScenario,
    updateScenario,
    deleteScenario,
    toggleScenarioActive,
  };
}
