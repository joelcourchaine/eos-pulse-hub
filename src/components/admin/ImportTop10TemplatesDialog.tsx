import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Download, ListOrdered } from "lucide-react";

interface Column {
  key: string;
  label: string;
}

interface UniqueList {
  title: string;
  columns: Column[];
  selectedDepartmentTypeId: string | null;
  selected: boolean;
}

interface DepartmentType {
  id: string;
  name: string;
}

interface ImportTop10TemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const ImportTop10TemplatesDialog = ({
  open,
  onOpenChange,
  onSuccess,
}: ImportTop10TemplatesDialogProps) => {
  const [uniqueLists, setUniqueLists] = useState<UniqueList[]>([]);
  const queryClient = useQueryClient();

  // Fetch department types
  const { data: departmentTypes } = useQuery({
    queryKey: ["department-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("department_types")
        .select("id, name")
        .order("display_order");
      if (error) throw error;
      return data as DepartmentType[];
    },
  });

  // Fetch unique lists from existing top_10_lists
  const { isLoading } = useQuery({
    queryKey: ["importable-top10-lists"],
    queryFn: async () => {
      // Get all existing lists
      const { data: existingLists, error: listsError } = await supabase
        .from("top_10_lists")
        .select("title, columns");
      if (listsError) throw listsError;

      // Get existing templates to filter out duplicates
      const { data: existingTemplates, error: templatesError } = await supabase
        .from("top_10_list_templates")
        .select("title");
      if (templatesError) throw templatesError;

      const existingTemplateTitles = new Set(
        existingTemplates?.map((t) => t.title.toLowerCase()) || []
      );

      // Find unique (title, columns) combinations
      const seen = new Map<string, UniqueList>();
      for (const list of existingLists || []) {
        const key = list.title.toLowerCase();
        if (!seen.has(key) && !existingTemplateTitles.has(key)) {
          seen.set(key, {
            title: list.title,
            columns: (list.columns as unknown as Column[]) || [],
            selectedDepartmentTypeId: null,
            selected: true,
          });
        }
      }

      const unique = Array.from(seen.values());
      setUniqueLists(unique);
      return unique;
    },
    enabled: open,
  });

  const importMutation = useMutation({
    mutationFn: async (lists: UniqueList[]) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      const toInsert = lists
        .filter((l) => l.selected)
        .map((l) => ({
          title: l.title,
          columns: JSON.parse(JSON.stringify(l.columns)),
          department_type_id: l.selectedDepartmentTypeId,
          created_by: userId,
        }));

      if (toInsert.length === 0) {
        throw new Error("No lists selected for import");
      }

      const { error } = await supabase
        .from("top_10_list_templates")
        .insert(toInsert);
      if (error) throw error;

      return toInsert.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["admin-top10-templates"] });
      toast.success(`Imported ${count} template${count > 1 ? "s" : ""}`);
      onSuccess();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to import templates");
    },
  });

  const toggleSelected = (index: number) => {
    setUniqueLists((prev) =>
      prev.map((l, i) => (i === index ? { ...l, selected: !l.selected } : l))
    );
  };

  const setDepartmentType = (index: number, typeId: string | null) => {
    setUniqueLists((prev) =>
      prev.map((l, i) =>
        i === index ? { ...l, selectedDepartmentTypeId: typeId } : l
      )
    );
  };

  const selectedCount = uniqueLists.filter((l) => l.selected).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Import Existing Lists as Templates
          </DialogTitle>
          <DialogDescription>
            Select which unique list structures to import as reusable templates.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : uniqueLists.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ListOrdered className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No unique lists found to import.</p>
              <p className="text-sm">
                All existing list structures are already templates.
              </p>
            </div>
          ) : (
            uniqueLists.map((list, index) => (
              <div
                key={`${list.title}-${index}`}
                className="border rounded-lg p-4 space-y-3"
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    id={`list-${index}`}
                    checked={list.selected}
                    onCheckedChange={() => toggleSelected(index)}
                  />
                  <div className="flex-1 space-y-2">
                    <Label
                      htmlFor={`list-${index}`}
                      className="text-base font-medium cursor-pointer"
                    >
                      {list.title}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {list.columns.length} columns:{" "}
                      {list.columns.map((c) => c.label).join(", ")}
                    </p>
                  </div>
                </div>

                {list.selected && (
                  <div className="ml-7">
                    <Label className="text-sm text-muted-foreground mb-1 block">
                      Department Type (optional)
                    </Label>
                    <Select
                      value={list.selectedDepartmentTypeId || "all"}
                      onValueChange={(val) =>
                        setDepartmentType(index, val === "all" ? null : val)
                      }
                    >
                      <SelectTrigger className="w-[220px]">
                        <SelectValue placeholder="All Departments" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Departments</SelectItem>
                        {departmentTypes?.map((dt) => (
                          <SelectItem key={dt.id} value={dt.id}>
                            {dt.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => importMutation.mutate(uniqueLists)}
            disabled={selectedCount === 0 || importMutation.isPending}
          >
            {importMutation.isPending
              ? "Importing..."
              : `Import ${selectedCount} Template${selectedCount !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
