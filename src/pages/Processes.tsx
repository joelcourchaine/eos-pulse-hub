import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus, Users, Settings, TrendingUp, Loader2, Trash2 } from "lucide-react";
import { CreateProcessDialog } from "@/components/processes/CreateProcessDialog";
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
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface ProcessRow {
  id: string;
  title: string;
  description: string | null;
  category_id: string;
  updated_at: string;
  owner: { full_name: string } | null;
}

interface Category {
  id: string;
  name: string;
  display_order: number;
}

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "Serve the Customer": Users,
  "Run the Department": Settings,
  "Grow the Business": TrendingUp,
};

const Processes = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const departmentId = searchParams.get("dept");

  const [categories, setCategories] = useState<Category[]>([]);
  const [processes, setProcesses] = useState<ProcessRow[]>([]);
  const [departmentName, setDepartmentName] = useState("");
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [createCategoryId, setCreateCategoryId] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProcessRow | null>(null);

  useEffect(() => {
    if (!departmentId) {
      navigate("/dashboard");
      return;
    }
    fetchData();
  }, [departmentId]);

  const fetchData = async () => {
    if (!departmentId) return;
    setLoading(true);

    const [catRes, procRes, deptRes, userRes] = await Promise.all([
      supabase.from("process_categories").select("*").order("display_order"),
      supabase
        .from("processes")
        .select("id, title, description, category_id, updated_at, owner:profiles!processes_owner_id_fkey(full_name)")
        .eq("department_id", departmentId)
        .eq("is_active", true)
        .order("display_order"),
      supabase.from("departments").select("name").eq("id", departmentId).single(),
      supabase.auth.getUser(),
    ]);

    if (catRes.data) setCategories(catRes.data);
    if (procRes.data) setProcesses(procRes.data as unknown as ProcessRow[]);
    if (deptRes.data) setDepartmentName(deptRes.data.name);

    // Check edit permission
    if (userRes.data?.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userRes.data.user.id)
        .single();
      if (profile) {
        const editRoles = ["super_admin", "store_gm", "department_manager", "fixed_ops_manager"];
        setCanEdit(editRoles.includes(profile.role));
      }
    }

    setLoading(false);
  };

  const handleCreateProcess = (categoryId: string) => {
    setCreateCategoryId(categoryId);
    setCreateOpen(true);
  };

  const handleDeleteProcess = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase
      .from("processes")
      .update({ is_active: false })
      .eq("id", deleteTarget.id);
    if (error) {
      toast.error("Failed to delete process");
    } else {
      setProcesses((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      toast.success("Process deleted");
    }
    setDeleteTarget(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Processes</h1>
            <p className="text-sm text-muted-foreground">{departmentName}</p>
          </div>
        </div>

        {/* Category Tiles */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {categories.map((category) => {
            const Icon = CATEGORY_ICONS[category.name] || Settings;
            const catProcesses = processes.filter((p) => p.category_id === category.id);

            return (
              <Card key={category.id} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-lg">{category.name}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  {catProcesses.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center flex-1">
                      No processes defined yet
                    </p>
                  ) : (
                    <div className="space-y-2 flex-1">
                      {catProcesses.map((proc, idx) => (
                        <div
                          key={proc.id}
                          className="flex items-center justify-between p-3 rounded-lg border hover:opacity-90 cursor-pointer transition-all hover:shadow-sm"
                          style={{
                            background: `hsl(var(--primary) / ${0.07 + (idx % 3) * 0.03})`,
                            borderColor: `hsl(var(--primary) / 0.2)`,
                          }}
                          onClick={() => navigate(`/processes/${proc.id}`)}
                        >
                          <div className="min-w-0 flex items-center gap-2">
                            <div
                              className="h-2 w-2 rounded-full shrink-0"
                              style={{ background: `hsl(var(--primary) / ${0.5 + (idx % 3) * 0.15})` }}
                            />
                            <div>
                              <p className="text-sm font-medium truncate text-foreground">{proc.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {proc.owner?.full_name && <span>{proc.owner.full_name} · </span>}
                                Updated {formatDistanceToNow(new Date(proc.updated_at), { addSuffix: true })}
                              </p>
                            </div>
                          </div>
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget(proc);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-4 w-full text-muted-foreground"
                      onClick={() => handleCreateProcess(category.id)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Create Process
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {departmentId && createCategoryId && (
        <CreateProcessDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          departmentId={departmentId}
          categoryId={createCategoryId}
          onCreated={(processId) => {
            setCreateOpen(false);
            navigate(`/processes/${processId}?edit=true`);
          }}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Process</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.title}"? This action can be undone by an administrator.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProcess} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Processes;
