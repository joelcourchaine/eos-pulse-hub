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
  const [selectedGroupId, setSelectedGroupId] = useState("");

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

  const deployMutation = useMutation({
    mutationFn: async () => {
      if (!selectedGroupId) throw new Error("Please select a store group");

      // Get all departments in the selected store group
      let query = supabase
        .from("departments")
        .select("id, name, department_type_id, stores!inner(group_id)")
        .eq("stores.group_id", selectedGroupId);

      // Filter by department type if specified
      if (template.department_type_id) {
        query = query.eq("department_type_id", template.department_type_id);
      }

      const { data: departments, error: deptError } = await query;
      if (deptError) throw deptError;

      if (!departments || departments.length === 0) {
        throw new Error("No matching departments found in this store group");
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
            {departmentTypeLabel === "all" ? "all" : departmentTypeLabel} departments in a store group.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
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
            disabled={!selectedGroupId || deployMutation.isPending}
          >
            {deployMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Deploy to Group
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
