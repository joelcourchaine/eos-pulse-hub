import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { ChevronRight, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Top10ItemRow } from "./Top10ItemRow";
import { Top10ListManagementDialog } from "./Top10ListManagementDialog";

interface ColumnDefinition {
  key: string;
  label: string;
}

interface Top10Item {
  id: string;
  rank: number;
  data: Record<string, string>;
}

interface Top10List {
  id: string;
  title: string;
  description: string | null;
  columns: ColumnDefinition[];
  display_order: number;
}

interface Top10ListCardProps {
  list: Top10List;
  onListChange: () => void;
  canEdit: boolean;
  existingListCount: number;
}

export function Top10ListCard({
  list,
  onListChange,
  canEdit,
  existingListCount,
}: Top10ListCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<Top10Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const maxItems = 10;

  const loadItems = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("top_10_items")
        .select("id, rank, data")
        .eq("list_id", list.id)
        .order("rank", { ascending: true });

      if (error) throw error;
      
      // Cast the data properly
      const typedData = (data || []).map(item => ({
        id: item.id,
        rank: item.rank,
        data: (item.data as Record<string, string>) || {}
      }));
      
      setItems(typedData);
    } catch (error) {
      console.error("Error loading items:", error);
    }
  }, [list.id]);

  useEffect(() => {
    if (isOpen) {
      loadItems();
    }
  }, [isOpen, loadItems]);

  const handleAddItem = async () => {
    if (items.length >= maxItems) {
      toast.error("Maximum 10 items allowed per list");
      return;
    }

    const nextRank = items.length + 1;

    try {
      const { error } = await supabase.from("top_10_items").insert({
        list_id: list.id,
        rank: nextRank,
        data: {},
      });

      if (error) throw error;
      loadItems();
    } catch (error: any) {
      console.error("Error adding item:", error);
      toast.error(error.message || "Failed to add item");
    }
  };

  const handleUpdateItem = async (itemId: string, data: Record<string, string>) => {
    try {
      const { error } = await supabase
        .from("top_10_items")
        .update({ data })
        .eq("id", itemId);

      if (error) throw error;
    } catch (error: any) {
      console.error("Error updating item:", error);
      toast.error(error.message || "Failed to save changes");
    }
  };

  const handleDeleteItem = async (itemId: string, rank: number) => {
    try {
      // Delete the item
      const { error: deleteError } = await supabase
        .from("top_10_items")
        .delete()
        .eq("id", itemId);

      if (deleteError) throw deleteError;

      // Re-rank remaining items
      const remainingItems = items.filter((item) => item.id !== itemId);
      for (let i = 0; i < remainingItems.length; i++) {
        if (remainingItems[i].rank !== i + 1) {
          await supabase
            .from("top_10_items")
            .update({ rank: i + 1 })
            .eq("id", remainingItems[i].id);
        }
      }

      loadItems();
    } catch (error: any) {
      console.error("Error deleting item:", error);
      toast.error(error.message || "Failed to delete item");
    }
  };

  const handleDeleteList = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("top_10_lists")
        .delete()
        .eq("id", list.id);

      if (error) throw error;
      toast.success("List deleted successfully");
      onListChange();
    } catch (error: any) {
      console.error("Error deleting list:", error);
      toast.error(error.message || "Failed to delete list");
    } finally {
      setLoading(false);
      setDeleteDialogOpen(false);
    }
  };

  return (
    <>
      <Card className="border shadow-sm">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <CollapsibleTrigger asChild>
                <div
                  className="flex items-center gap-2 cursor-pointer hover:opacity-80"
                >
                  <ChevronRight
                    className={`h-4 w-4 transition-transform ${
                      isOpen ? "rotate-90" : ""
                    }`}
                  />
                  <CardTitle className="text-base font-medium">
                    {list.title}
                  </CardTitle>
                  <span className="text-sm text-muted-foreground">
                    ({items.length} items)
                  </span>
                </div>
              </CollapsibleTrigger>

              {canEdit && (
                <div className="flex items-center gap-1">
                  <Top10ListManagementDialog
                    departmentId=""
                    list={list}
                    onListChange={onListChange}
                    existingListCount={existingListCount}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            {list.description && (
              <p className="text-sm text-muted-foreground mt-1 ml-6">
                {list.description}
              </p>
            )}
          </CardHeader>

          <CollapsibleContent>
            <CardContent className="pt-0 px-4 pb-4">
              {list.columns.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No columns configured. Edit the list to add columns.
                </p>
              ) : (
                <>
                  <div className="border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12 text-center">#</TableHead>
                          {list.columns.map((col) => (
                            <TableHead key={col.key}>{col.label}</TableHead>
                          ))}
                          {canEdit && <TableHead className="w-10" />}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item) => (
                          <Top10ItemRow
                            key={item.id}
                            rank={item.rank}
                            data={item.data}
                            columns={list.columns}
                            onUpdate={(data) => handleUpdateItem(item.id, data)}
                            onDelete={() => handleDeleteItem(item.id, item.rank)}
                            canEdit={canEdit}
                          />
                        ))}
                        {items.length === 0 && (
                          <TableRow>
                            <td
                              colSpan={list.columns.length + (canEdit ? 2 : 1)}
                              className="text-center py-4 text-muted-foreground text-sm"
                            >
                              No items yet. {canEdit && "Click 'Add Row' to get started."}
                            </td>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {canEdit && items.length < maxItems && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 gap-1"
                      onClick={handleAddItem}
                    >
                      <Plus className="h-4 w-4" />
                      Add Row
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete List</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{list.title}"? This will also
              delete all items in this list. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteList}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={loading}
            >
              {loading ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
