import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, GripVertical, ChevronDown, ChevronRight, MapPin, ExternalLink, FileText } from "lucide-react";
import type { RoutineItem, RoutineTemplate } from "./AdminRoutinesTab";
import { DueDatePicker } from "./DueDatePicker";
import type { DueDayConfig, Cadence } from "@/utils/routineDueDate";

interface DepartmentType {
  id: string;
  name: string;
}

interface RoutineTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: RoutineTemplate | null;
  onSuccess: () => void;
}

const CADENCE_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];

const REPORT_TYPE_OPTIONS = [
  { value: "none", label: "No Report Link", icon: null },
  { value: "internal", label: "Internal App Route", icon: MapPin },
  { value: "external", label: "External URL", icon: ExternalLink },
  { value: "manual", label: "Manual Instructions", icon: FileText },
];

const generateItemId = () => `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const RoutineTemplateDialog = ({
  open,
  onOpenChange,
  template,
  onSuccess,
}: RoutineTemplateDialogProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cadence, setCadence] = useState<Cadence>("daily");
  const [departmentTypeId, setDepartmentTypeId] = useState<string>("all");
  const [dueDayConfig, setDueDayConfig] = useState<DueDayConfig | null>(null);
  const [items, setItems] = useState<RoutineItem[]>([]);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const isEditMode = !!template;

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

  useEffect(() => {
    if (template) {
      setTitle(template.title);
      setDescription(template.description || "");
      setCadence(template.cadence as Cadence);
      setDepartmentTypeId(template.department_type_id || "all");
      setDueDayConfig((template as any).due_day_config || null);
      // Ensure items are properly sanitized - filter out any with missing/empty titles and ensure each has an id
      const sanitizedItems = (template.items || [])
        .filter((item): item is RoutineItem => item && typeof item === 'object')
        .map((item, index) => ({
          ...item,
          id: item.id || generateItemId(),
          title: item.title || "",
          order: item.order || index + 1,
        }));
      setItems(sanitizedItems);
    } else {
      setTitle("");
      setDescription("");
      setCadence("daily");
      setDepartmentTypeId("all");
      setDueDayConfig(null);
      setItems([]);
    }
    setExpandedItems(new Set());
  }, [template, open]);

  // Reset due day config when cadence changes to daily
  useEffect(() => {
    if (cadence === "daily") {
      setDueDayConfig(null);
    }
  }, [cadence]);

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();

      // Ensure all items have proper order
      const orderedItems = items.map((item, index) => ({
        ...item,
        order: index + 1,
      }));

      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        cadence,
        department_type_id: departmentTypeId === "all" ? null : departmentTypeId,
        due_day_config: dueDayConfig as unknown as Json,
        items: orderedItems as unknown as Json,
        ...(isEditMode ? {} : { created_by: user?.id }),
      };

      if (isEditMode && template) {
        const { error } = await supabase
          .from("routine_templates")
          .update(payload)
          .eq("id", template.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("routine_templates")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEditMode ? "Template updated" : "Template created");
      onSuccess();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save template");
    },
  });

  const addItem = () => {
    const newItem: RoutineItem = {
      id: generateItemId(),
      title: "",
      description: "",
      order: items.length + 1,
    };
    setItems([...items, newItem]);
    setExpandedItems(new Set([...expandedItems, newItem.id]));
  };

  const removeItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
    const newExpanded = new Set(expandedItems);
    newExpanded.delete(id);
    setExpandedItems(newExpanded);
  };

  const updateItem = (id: string, updates: Partial<RoutineItem>) => {
    setItems(items.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  };

  const updateItemReportInfo = (
    id: string,
    reportType: string,
    field: "path" | "url" | "instructions",
    value: string
  ) => {
    setItems(items.map((item) => {
      if (item.id !== id) return item;
      
      if (reportType === "none") {
        const { report_info, ...rest } = item;
        return rest;
      }

      return {
        ...item,
        report_info: {
          ...item.report_info,
          type: reportType as "internal" | "external" | "manual",
          [field]: value,
        },
      };
    }));
  };

  const setReportType = (id: string, reportType: string) => {
    setItems(items.map((item) => {
      if (item.id !== id) return item;
      
      if (reportType === "none") {
        const { report_info, ...rest } = item;
        return rest;
      }

      return {
        ...item,
        report_info: {
          type: reportType as "internal" | "external" | "manual",
          path: reportType === "internal" ? "" : undefined,
          url: reportType === "external" ? "" : undefined,
          instructions: "",
        },
      };
    }));
  };

  const toggleItemExpanded = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (items.length === 0) {
      toast.error("Add at least one item");
      return;
    }
    const emptyItems = items.filter((item) => !item.title || !item.title.trim());
    if (emptyItems.length > 0) {
      console.log("Items with empty titles:", emptyItems);
      toast.error("All items must have a title");
      return;
    }
    mutation.mutate();
  };

  const getReportType = (item: RoutineItem) => {
    return item.report_info?.type || "none";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Edit Routine Template" : "Create Routine Template"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4 pb-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Service Manager Daily Routine"
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional description of this routine"
                    rows={2}
                  />
                </div>

                <div>
                  <Label htmlFor="cadence">Cadence *</Label>
                  <Select value={cadence} onValueChange={(v) => setCadence(v as Cadence)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select cadence" />
                    </SelectTrigger>
                    <SelectContent>
                      {CADENCE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="department-type">Department Type</Label>
                  <Select value={departmentTypeId} onValueChange={setDepartmentTypeId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select department type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      {departmentTypes?.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Due Date Configuration - only for non-daily cadences */}
              {cadence !== "daily" && (
                <DueDatePicker
                  cadence={cadence}
                  value={dueDayConfig}
                  onChange={setDueDayConfig}
                />
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Routine Items</Label>
                  <Button type="button" variant="default" size="sm" onClick={(e) => { e.preventDefault(); e.stopPropagation(); addItem(); }}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Item
                  </Button>
                </div>

                {items.length === 0 ? (
                  <div className="text-center py-6 border border-dashed rounded-lg text-muted-foreground">
                    <p>No items yet. Add items to this routine.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {items.map((item, index) => (
                      <Collapsible
                        key={item.id}
                        open={expandedItems.has(item.id)}
                        onOpenChange={() => toggleItemExpanded(item.id)}
                      >
                        <div className="border rounded-lg">
                          <div className="flex items-center gap-2 p-3">
                            <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                            <span className="text-sm text-muted-foreground w-6">
                              {index + 1}.
                            </span>
                            <Input
                              value={item.title}
                              onChange={(e) => updateItem(item.id, { title: e.target.value })}
                              placeholder="Item title (what to do)"
                              className="flex-1"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <CollapsibleTrigger asChild>
                              <Button type="button" variant="ghost" size="sm">
                                {expandedItems.has(item.id) ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
                            </CollapsibleTrigger>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeItem(item.id)}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          <CollapsibleContent>
                            <div className="px-3 pb-3 space-y-3 border-t pt-3 ml-10">
                              <div>
                                <Label className="text-xs">Why We Do This</Label>
                                <Textarea
                                  value={item.description || ""}
                                  onChange={(e) => updateItem(item.id, { description: e.target.value })}
                                  placeholder="Explain why this task matters..."
                                  rows={2}
                                  className="text-sm"
                                />
                              </div>

                              <div>
                                <Label className="text-xs">Report Access</Label>
                                <Select
                                  value={getReportType(item)}
                                  onValueChange={(value) => setReportType(item.id, value)}
                                >
                                  <SelectTrigger className="text-sm">
                                    <SelectValue placeholder="Select report type" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {REPORT_TYPE_OPTIONS.map((option) => (
                                      <SelectItem key={option.value} value={option.value}>
                                        <div className="flex items-center gap-2">
                                          {option.icon && <option.icon className="h-4 w-4" />}
                                          {option.label}
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              {item.report_info?.type === "internal" && (
                                <div>
                                  <Label className="text-xs">App Path</Label>
                                  <Input
                                    value={item.report_info.path || ""}
                                    onChange={(e) =>
                                      updateItemReportInfo(item.id, "internal", "path", e.target.value)
                                    }
                                    placeholder="/dashboard"
                                    className="text-sm"
                                  />
                                </div>
                              )}

                              {item.report_info?.type === "external" && (
                                <div>
                                  <Label className="text-xs">External URL</Label>
                                  <Input
                                    value={item.report_info.url || ""}
                                    onChange={(e) =>
                                      updateItemReportInfo(item.id, "external", "url", e.target.value)
                                    }
                                    placeholder="https://dms.example.com/reports"
                                    className="text-sm"
                                  />
                                </div>
                              )}

                              {item.report_info && (
                                <div>
                                  <Label className="text-xs">Navigation Instructions</Label>
                                  <Textarea
                                    value={item.report_info.instructions || ""}
                                    onChange={(e) =>
                                      updateItemReportInfo(
                                        item.id,
                                        item.report_info!.type,
                                        "instructions",
                                        e.target.value
                                      )
                                    }
                                    placeholder="Navigate to Dashboard > Scorecard > View Metrics"
                                    rows={2}
                                    className="text-sm"
                                  />
                                </div>
                              )}
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditMode ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
