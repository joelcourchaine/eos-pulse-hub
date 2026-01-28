import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, MoreHorizontal, Pencil, Trash2, Rocket, CheckSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { RoutineTemplateDialog } from "./RoutineTemplateDialog";
import { DeployRoutineDialog } from "./DeployRoutineDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface RoutineItem {
  id: string;
  title: string;
  description?: string;
  order: number;
  report_info?: {
    type: "internal" | "external" | "manual";
    path?: string;
    url?: string;
    instructions?: string;
  };
}

export interface RoutineTemplate {
  id: string;
  title: string;
  description: string | null;
  cadence: "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
  items: RoutineItem[];
  department_type_id: string | null;
  department_type?: { id: string; name: string } | null;
  created_at: string;
  created_by: string | null;
}

const CADENCE_OPTIONS = [
  { value: "all", label: "All Cadences" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];

const getCadenceBadgeVariant = (cadence: string) => {
  switch (cadence) {
    case "daily":
      return "default";
    case "weekly":
      return "secondary";
    case "monthly":
      return "outline";
    case "quarterly":
      return "outline";
    case "yearly":
      return "outline";
    default:
      return "outline";
  }
};

export const AdminRoutinesTab = () => {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<RoutineTemplate | null>(null);
  const [deployTemplate, setDeployTemplate] = useState<RoutineTemplate | null>(null);
  const [deleteTemplate, setDeleteTemplate] = useState<RoutineTemplate | null>(null);
  const [cadenceFilter, setCadenceFilter] = useState("all");
  const queryClient = useQueryClient();

  const { data: templates, isLoading } = useQuery({
    queryKey: ["admin-routine-templates", cadenceFilter],
    queryFn: async () => {
      let query = supabase
        .from("routine_templates")
        .select("*, department_type:department_types(id, name)")
        .order("created_at", { ascending: false });

      if (cadenceFilter !== "all") {
        query = query.eq("cadence", cadenceFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []).map((item) => ({
        ...item,
        items: (item.items as unknown as RoutineItem[]) || [],
      })) as RoutineTemplate[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("routine_templates")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-routine-templates"] });
      toast.success("Template deleted");
      setDeleteTemplate(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete template");
    },
  });

  const getDepartmentTypeBadge = (template: RoutineTemplate) => {
    if (!template.department_type) {
      return <Badge variant="secondary">All Departments</Badge>;
    }
    return <Badge variant="outline">{template.department_type.name}</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5" />
              Routine Templates
            </CardTitle>
            <CardDescription>
              Create routine checklists and deploy them to departments
            </CardDescription>
          </div>
          <div className="flex gap-2 items-center">
            <Select value={cadenceFilter} onValueChange={setCadenceFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Filter by cadence" />
              </SelectTrigger>
              <SelectContent>
                {CADENCE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : templates?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No routine templates created yet.</p>
              <p className="text-sm">Create a template to deploy to departments.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Cadence</TableHead>
                  <TableHead>Department Type</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates?.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{template.title}</div>
                        {template.description && (
                          <div className="text-sm text-muted-foreground line-clamp-1">
                            {template.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getCadenceBadgeVariant(template.cadence)}>
                        {template.cadence.charAt(0).toUpperCase() + template.cadence.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>{getDepartmentTypeBadge(template)}</TableCell>
                    <TableCell>
                      <span className="text-muted-foreground">
                        {template.items?.length || 0} items
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDistanceToNow(new Date(template.created_at), {
                        addSuffix: true,
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setDeployTemplate(template)}>
                            <Rocket className="h-4 w-4 mr-2" />
                            Deploy to Group
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setEditTemplate(template)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeleteTemplate(template)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <RoutineTemplateDialog
        open={createDialogOpen || !!editTemplate}
        onOpenChange={(open) => {
          if (!open) {
            setCreateDialogOpen(false);
            setEditTemplate(null);
          }
        }}
        template={editTemplate}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["admin-routine-templates"] });
          setCreateDialogOpen(false);
          setEditTemplate(null);
        }}
      />

      {deployTemplate && (
        <DeployRoutineDialog
          open={!!deployTemplate}
          onOpenChange={(open) => !open && setDeployTemplate(null)}
          template={deployTemplate}
        />
      )}

      <AlertDialog open={!!deleteTemplate} onOpenChange={() => setDeleteTemplate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTemplate?.title}"? This will not
              affect routines that have already been deployed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTemplate && deleteMutation.mutate(deleteTemplate.id)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
