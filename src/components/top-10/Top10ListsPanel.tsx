import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Top10ListCard } from "./Top10ListCard";
import { Top10ListManagementDialog } from "./Top10ListManagementDialog";
import { ListOrdered } from "lucide-react";

interface ColumnDefinition {
  key: string;
  label: string;
}

interface Top10List {
  id: string;
  title: string;
  description: string | null;
  columns: ColumnDefinition[];
  display_order: number;
}

interface Top10ListsPanelProps {
  departmentId: string;
  canEdit?: boolean;
}

export function Top10ListsPanel({ departmentId, canEdit = true }: Top10ListsPanelProps) {
  const [lists, setLists] = useState<Top10List[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLists = useCallback(async () => {
    if (!departmentId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("top_10_lists")
        .select("id, title, description, columns, display_order")
        .eq("department_id", departmentId)
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (error) throw error;
      
      // Cast the columns properly
      const typedData = (data || []).map(list => ({
        ...list,
        columns: (Array.isArray(list.columns) ? list.columns : []) as unknown as ColumnDefinition[]
      }));
      
      setLists(typedData);
    } catch (error) {
      console.error("Error loading Top 10 lists:", error);
    } finally {
      setLoading(false);
    }
  }, [departmentId]);

  useEffect(() => {
    loadLists();
  }, [loadLists]);

  if (!departmentId) {
    return null;
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListOrdered className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Top 10 Lists</CardTitle>
          </div>
          {canEdit && (
            <Top10ListManagementDialog
              departmentId={departmentId}
              onListChange={loadLists}
              existingListCount={lists.length}
            />
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <div className="text-center py-4 text-muted-foreground">
            Loading lists...
          </div>
        ) : lists.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <p className="mb-2">No Top 10 lists created yet.</p>
            {canEdit && (
              <p className="text-sm">
                Click "Add List" to create your first list.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {lists.map((list) => (
              <Top10ListCard
                key={list.id}
                list={list}
                onListChange={loadLists}
                canEdit={canEdit}
                existingListCount={lists.length}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
