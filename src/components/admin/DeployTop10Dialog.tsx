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
import { Loader2, Rocket, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Column {
  key: string;
  label: string;
}

interface Template {
  id: string;
  title: string;
  description: string | null;
  columns: Column[];
  department_type_id: string | null;
  department_type?: { id: string; name: string } | null;
}

interface StoreGroup {
  id: string;
  name: string;
}

interface DeployTop10DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: Template;
}

export const DeployTop10Dialog = ({
  open,
  onOpenChange,
  template,
}: DeployTop10DialogProps) => {
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

      // Check for existing lists with same title to avoid duplicates
      const departmentIds = departments.map((d) => d.id);
      const { data: existingLists } = await supabase
        .from("top_10_lists")
        .select("department_id")
        .in("department_id", departmentIds)
        .eq("title", template.title);

      const existingDeptIds = new Set(existingLists?.map((l) => l.department_id) || []);
      const eligibleDepartments = departments.filter((d) => !existingDeptIds.has(d.id));

      if (eligibleDepartments.length === 0) {
        throw new Error("All matching departments already have a list with this title");
      }

      // Get max display_order for each department
      const listsToCreate = await Promise.all(
        eligibleDepartments.map(async (dept) => {
          const { data: maxOrderData } = await supabase
            .from("top_10_lists")
            .select("display_order")
            .eq("department_id", dept.id)
            .order("display_order", { ascending: false })
            .limit(1);

          const maxOrder = maxOrderData?.[0]?.display_order || 0;

          return {
            department_id: dept.id,
            title: template.title,
            description: template.description,
            columns: template.columns as unknown as Json,
            display_order: maxOrder + 1,
            is_active: true,
          };
        })
      );

      const { error: insertError } = await supabase
        .from("top_10_lists")
        .insert(listsToCreate);

      if (insertError) throw insertError;

      return {
        deployed: eligibleDepartments.length,
        skipped: existingDeptIds.size,
      };
    },
    onSuccess: (result) => {
      let message = `Deployed "${template.title}" to ${result.deployed} departments`;
      if (result.skipped > 0) {
        message += ` (${result.skipped} skipped - already exist)`;
      }
      toast.success(message);
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to deploy template");
    },
  });

  const departmentTypeLabel = template.department_type?.name || "all";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5" />
            Deploy Template
          </DialogTitle>
          <DialogDescription>
            Deploy "{template.title}" to {departmentTypeLabel === "all" ? "all" : departmentTypeLabel}{" "}
            departments in a store group.
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

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              This will create a new Top 10 list in each matching department.
              Departments that already have a list with this title will be skipped.
            </AlertDescription>
          </Alert>
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
