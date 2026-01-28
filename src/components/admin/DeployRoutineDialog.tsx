import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Rocket } from "lucide-react";
import type { RoutineTemplate } from "./AdminRoutinesTab";

interface StoreGroup {
  id: string;
  name: string;
}

interface Store {
  id: string;
  name: string;
  group_id: string;
}

type DeployMode = "group" | "store";

interface DeployRoutineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: RoutineTemplate;
}

export const DeployRoutineDialog = ({
  open,
  onOpenChange,
  template,
}: DeployRoutineDialogProps) => {
  const [deployMode, setDeployMode] = useState<DeployMode>("group");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedStoreId, setSelectedStoreId] = useState("");

  const { data: storeGroups, isLoading: groupsLoading } = useQuery({
    queryKey: ["admin-store-groups-deploy"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_groups")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data as StoreGroup[];
    },
  });

  const { data: stores, isLoading: storesLoading } = useQuery({
    queryKey: ["admin-stores-deploy"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, group_id")
        .order("name");
      if (error) throw error;
      return data as Store[];
    },
  });

  const deployMutation = useMutation({
    mutationFn: async () => {
      if (deployMode === "group" && !selectedGroupId) {
        throw new Error("Please select a store group");
      }
      if (deployMode === "store" && !selectedStoreId) {
        throw new Error("Please select a store");
      }

      let departments: { id: string; name: string; department_type_id: string | null }[] = [];

      if (deployMode === "group") {
        // Get all departments in the selected store group
        let groupQuery = supabase
          .from("departments")
          .select("id, name, department_type_id, stores!inner(group_id)")
          .eq("stores.group_id", selectedGroupId);

        if (template.department_type_id) {
          groupQuery = groupQuery.eq("department_type_id", template.department_type_id);
        }

        const { data, error } = await groupQuery;
        if (error) throw error;
        departments = data || [];
      } else {
        // Get departments in the selected store
        let storeQuery = supabase
          .from("departments")
          .select("id, name, department_type_id")
          .eq("store_id", selectedStoreId);

        if (template.department_type_id) {
          storeQuery = storeQuery.eq("department_type_id", template.department_type_id);
        }

        const { data, error } = await storeQuery;
        if (error) throw error;
        departments = data || [];
      }

      const targetLabel = deployMode === "group" ? "store group" : "store";
      if (departments.length === 0) {
        throw new Error(`No matching departments found in this ${targetLabel}`);
      }


      let created = 0;
      let updated = 0;

      // Process each department - update existing or create new
      for (const dept of departments) {
        // Check if a routine with this title and cadence already exists for this department
        const { data: existing } = await supabase
          .from("department_routines")
          .select("id")
          .eq("department_id", dept.id)
          .eq("title", template.title)
          .eq("cadence", template.cadence)
          .maybeSingle();

        if (existing) {
          // Update existing routine's items
          const { error: updateError } = await supabase
            .from("department_routines")
            .update({
              items: template.items as unknown as Json,
              template_id: template.id,
            })
            .eq("id", existing.id);

          if (updateError) throw updateError;
          updated++;
        } else {
          // Create new routine
          const { error: insertError } = await supabase
            .from("department_routines")
            .insert({
              department_id: dept.id,
              template_id: template.id,
              title: template.title,
              cadence: template.cadence,
              items: template.items as unknown as Json,
              is_active: true,
            });

          if (insertError) throw insertError;
          created++;
        }
      }

      return { created, updated, total: departments.length };
    },
    onSuccess: ({ created, updated }) => {
      if (updated > 0 && created > 0) {
        toast.success(`Updated ${updated} and created ${created} routines`);
      } else if (updated > 0) {
        toast.success(`Updated ${updated} existing routines`);
      } else {
        toast.success(`Created ${created} new routines`);
      }
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to deploy template");
    },
  });

  const departmentTypeLabel = template.department_type?.name || "all";
  const cadenceLabel = template.cadence.charAt(0).toUpperCase() + template.cadence.slice(1);
  const isValid = deployMode === "group" ? !!selectedGroupId : !!selectedStoreId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5" />
            Deploy Routine Template
          </DialogTitle>
          <DialogDescription>
            Deploy "{template.title}" ({cadenceLabel}) to{" "}
            {departmentTypeLabel === "all" ? "all" : departmentTypeLabel} departments.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label>Deploy To</Label>
            <Select value={deployMode} onValueChange={(v) => setDeployMode(v as DeployMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="group">Entire Store Group</SelectItem>
                <SelectItem value="store">Single Store</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {deployMode === "group" ? (
            <div>
              <Label htmlFor="store-group">Store Group</Label>
              <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a store group" />
                </SelectTrigger>
                <SelectContent>
                  {groupsLoading ? (
                    <div className="p-2 text-sm text-muted-foreground">Loading...</div>
                  ) : (
                    storeGroups?.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div>
              <Label htmlFor="store">Store</Label>
              <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a store" />
                </SelectTrigger>
                <SelectContent>
                  {storesLoading ? (
                    <div className="p-2 text-sm text-muted-foreground">Loading...</div>
                  ) : (
                    stores?.map((store) => (
                      <SelectItem key={store.id} value={store.id}>
                        {store.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="text-sm text-muted-foreground">
            <p>This will deploy {template.items?.length || 0} routine items.</p>
            <p className="mt-1">
              Existing routines with matching titles will be updated.
              New routines will be created for departments without one.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => deployMutation.mutate()}
            disabled={!isValid || deployMutation.isPending}
          >
            {deployMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {deployMode === "group" ? "Deploy to Group" : "Deploy to Store"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
