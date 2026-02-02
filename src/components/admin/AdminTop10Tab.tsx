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
import { toast } from "sonner";
import { Plus, MoreHorizontal, Pencil, Trash2, Rocket, ListOrdered, Download, Eye } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Top10TemplateDialog } from "./Top10TemplateDialog";
import { DeployTop10Dialog } from "./DeployTop10Dialog";
import { ImportTop10TemplatesDialog } from "./ImportTop10TemplatesDialog";
import { Top10DeploymentOverview } from "./Top10DeploymentOverview";
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

interface Column {
  key: string;
  label: string;
  width?: number;
}

interface Template {
  id: string;
  title: string;
  description: string | null;
  columns: Column[];
  department_type_id: string | null;
  department_type?: { id: string; name: string } | null;
  created_at: string;
  created_by: string | null;
}

export const AdminTop10Tab = () => {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<Template | null>(null);
  const [deployTemplate, setDeployTemplate] = useState<Template | null>(null);
  const [viewDeployments, setViewDeployments] = useState<Template | null>(null);
  const [deleteTemplate, setDeleteTemplate] = useState<Template | null>(null);
  const queryClient = useQueryClient();

  const { data: templates, isLoading } = useQuery({
    queryKey: ["admin-top10-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("top_10_list_templates")
        .select("*, department_type:department_types(id, name)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []).map((item) => ({
        ...item,
        columns: (item.columns as unknown as Column[]) || [],
      })) as Template[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("top_10_list_templates")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-top10-templates"] });
      toast.success("Template deleted");
      setDeleteTemplate(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete template");
    },
  });

  const getDepartmentTypeBadge = (template: Template) => {
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
              <ListOrdered className="h-5 w-5" />
              Top 10 List Templates
            </CardTitle>
            <CardDescription>
              Create templates and deploy them to store groups
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
              <Download className="h-4 w-4 mr-2" />
              Import from Existing
            </Button>
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
              <ListOrdered className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No templates created yet.</p>
              <p className="text-sm">Create a template to deploy to store groups.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Department Type</TableHead>
                  <TableHead>Columns</TableHead>
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
                          <div className="text-sm text-muted-foreground">
                            {template.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getDepartmentTypeBadge(template)}</TableCell>
                    <TableCell>
                      <span className="text-muted-foreground">
                        {template.columns?.length || 0} columns
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
                          <DropdownMenuItem onClick={() => setViewDeployments(template)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Deployments
                          </DropdownMenuItem>
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

      <Top10TemplateDialog
        open={createDialogOpen || !!editTemplate}
        onOpenChange={(open) => {
          if (!open) {
            setCreateDialogOpen(false);
            setEditTemplate(null);
          }
        }}
        template={editTemplate}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["admin-top10-templates"] });
          setCreateDialogOpen(false);
          setEditTemplate(null);
        }}
      />

      <ImportTop10TemplatesDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["admin-top10-templates"] });
          setImportDialogOpen(false);
        }}
      />

      {viewDeployments && (
        <Top10DeploymentOverview
          open={!!viewDeployments}
          onOpenChange={(open) => !open && setViewDeployments(null)}
          template={viewDeployments}
        />
      )}

      {deployTemplate && (
        <DeployTop10Dialog
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
              affect lists that have already been deployed.
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
