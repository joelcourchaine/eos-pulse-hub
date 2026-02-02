import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { 
  ArrowLeft, 
  Plus, 
  Search, 
  MoreHorizontal, 
  Pencil, 
  Trash2, 
  Eye, 
  EyeOff,
  BookOpen,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { ResourceManagementDialog } from "@/components/resources/ResourceManagementDialog";
import type { Resource, ResourceType, ResourceCategory } from "@/components/resources/ResourceCard";

interface DepartmentType {
  id: string;
  name: string;
}

interface StoreGroup {
  id: string;
  name: string;
}

const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  google_doc: 'Google Doc',
  spreadsheet: 'Spreadsheet',
  powerpoint: 'Presentation',
  pdf: 'PDF',
  weblink: 'Web Link',
  video: 'Video',
};

const CATEGORY_LABELS: Record<ResourceCategory, string> = {
  training: 'Training',
  templates: 'Templates',
  guides: 'Guides',
  best_practices: 'Best Practices',
  processes: 'Processes',
  reports: 'Reports',
};

const AdminResources = () => {
  const navigate = useNavigate();
  const [resources, setResources] = useState<(Resource & { is_active: boolean })[]>([]);
  const [departmentTypes, setDepartmentTypes] = useState<DepartmentType[]>([]);
  const [storeGroups, setStoreGroups] = useState<StoreGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [resourceToDelete, setResourceToDelete] = useState<Resource | null>(null);

  useEffect(() => {
    fetchDepartmentTypes();
    fetchStoreGroups();
    fetchResources();
  }, []);

  const fetchStoreGroups = async () => {
    const { data } = await supabase
      .from("store_groups")
      .select("id, name")
      .order("name");
    
    if (data) setStoreGroups(data);
  };

  const fetchDepartmentTypes = async () => {
    const { data } = await supabase
      .from("department_types")
      .select("id, name")
      .order("display_order");
    
    if (data) setDepartmentTypes(data);
  };

  const fetchResources = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("resources")
        .select(`
          id,
          title,
          description,
          resource_type,
          url,
          file_path,
          thumbnail_url,
          category,
          tags,
          department_type_id,
          store_group_id,
          view_count,
          is_active,
          created_at,
          department_types (name),
          store_groups (name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setResources((data || []) as (Resource & { is_active: boolean })[]);
    } catch (error) {
      console.error("Error fetching resources:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (resource: Resource) => {
    setSelectedResource(resource);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setSelectedResource(null);
    setDialogOpen(true);
  };

  const handleToggleActive = async (resource: Resource & { is_active: boolean }) => {
    try {
      const { error } = await supabase
        .from("resources")
        .update({ is_active: !resource.is_active })
        .eq("id", resource.id);

      if (error) throw error;
      toast.success(resource.is_active ? "Resource hidden" : "Resource published");
      fetchResources();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDelete = async () => {
    if (!resourceToDelete) return;
    
    try {
      const { error } = await supabase
        .from("resources")
        .delete()
        .eq("id", resourceToDelete.id);

      if (error) throw error;
      toast.success("Resource deleted");
      fetchResources();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setDeleteDialogOpen(false);
      setResourceToDelete(null);
    }
  };

  const filteredResources = resources.filter((r) =>
    r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="container flex h-16 items-center gap-4 px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold">Manage Resources</h1>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container px-4 py-8">
        {/* Actions bar */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search resources..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button onClick={handleAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Add Resource
          </Button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Group</TableHead>
                  <TableHead className="text-center">Views</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredResources.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No resources found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredResources.map((resource) => (
                    <TableRow key={resource.id}>
                      <TableCell className="font-medium max-w-[300px]">
                        <div className="truncate">{resource.title}</div>
                        {resource.description && (
                          <div className="text-xs text-muted-foreground truncate">
                            {resource.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {RESOURCE_TYPE_LABELS[resource.resource_type]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {CATEGORY_LABELS[resource.category]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {resource.department_types?.name || (
                          <span className="text-muted-foreground">All</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {resource.store_groups?.name || (
                          <span className="text-muted-foreground">All</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">{resource.view_count}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={resource.is_active ? "default" : "secondary"}>
                          {resource.is_active ? "Active" : "Hidden"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(resource)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleActive(resource)}>
                              {resource.is_active ? (
                                <>
                                  <EyeOff className="h-4 w-4 mr-2" />
                                  Hide
                                </>
                              ) : (
                                <>
                                  <Eye className="h-4 w-4 mr-2" />
                                  Publish
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => {
                                setResourceToDelete(resource);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </main>

      {/* Management Dialog */}
      <ResourceManagementDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        resource={selectedResource}
        departmentTypes={departmentTypes}
        storeGroups={storeGroups}
        onSuccess={fetchResources}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Resource</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{resourceToDelete?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminResources;
