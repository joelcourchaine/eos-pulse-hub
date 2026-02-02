import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronRight, Plus, Trash2, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Top10ItemRow } from "./Top10ItemRow";
import { Top10ListManagementDialog } from "./Top10ListManagementDialog";
import { CopyListToGroupDialog } from "./CopyListToGroupDialog";
import { ImportTop10Dialog } from "./ImportTop10Dialog";
import { ResizableTableHeader } from "./ResizableTableHeader";
import type { Json } from "@/integrations/supabase/types";

interface ColumnDefinition {
  key: string;
  label: string;
  width?: number;
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
  last_item_activity: string | null;
}

interface Top10ListCardProps {
  list: Top10List;
  departmentId: string;
  onListChange: () => void;
  canEdit: boolean;
  existingListCount: number;
  isSuperAdmin?: boolean;
}

export function Top10ListCard({
  list,
  departmentId,
  onListChange,
  canEdit,
  existingListCount,
  isSuperAdmin = false,
}: Top10ListCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<Top10Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateTitle, setDuplicateTitle] = useState("");
  const [duplicating, setDuplicating] = useState(false);
  
  // Column widths state - initialized from list.columns
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const widths: Record<string, number> = {};
    list.columns.forEach(col => {
      if (col.width) widths[col.key] = col.width;
    });
    return widths;
  });
  const saveWidthsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const maxItems = 10;
  
  // Sync column widths when list.columns change (e.g., template update)
  useEffect(() => {
    const widths: Record<string, number> = {};
    list.columns.forEach(col => {
      if (col.width) widths[col.key] = col.width;
    });
    setColumnWidths(widths);
  }, [list.columns]);

  const handleColumnResize = useCallback((key: string, width: number) => {
    setColumnWidths(prev => ({ ...prev, [key]: width }));
  }, []);

  const handleColumnResizeEnd = useCallback(() => {
    // Debounced save to database
    if (saveWidthsTimeoutRef.current) {
      clearTimeout(saveWidthsTimeoutRef.current);
    }
    saveWidthsTimeoutRef.current = setTimeout(async () => {
      try {
        // Update columns with new widths
        const updatedColumns = list.columns.map(col => ({
          ...col,
          width: columnWidths[col.key] || col.width,
        }));
        
        const { error } = await supabase
          .from("top_10_lists")
          .update({ columns: updatedColumns as unknown as Json })
          .eq("id", list.id);
        
        if (error) throw error;
        
        // Also sync to template if this list was deployed from one
        // Find template by matching title and sync widths back
        const { error: templateError } = await supabase
          .from("top_10_list_templates")
          .update({ columns: updatedColumns as unknown as Json })
          .eq("title", list.title);
        
        if (templateError) {
          console.log("No template to sync or sync failed:", templateError.message);
        } else {
          // Sync to all other lists using this template
          await supabase
            .from("top_10_lists")
            .update({ columns: updatedColumns as unknown as Json })
            .eq("title", list.title)
            .neq("id", list.id);
        }
      } catch (error) {
        console.error("Error saving column widths:", error);
      }
    }, 500);
  }, [list.id, list.title, list.columns, columnWidths]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveWidthsTimeoutRef.current) {
        clearTimeout(saveWidthsTimeoutRef.current);
      }
    };
  }, []);

  const loadItems = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("top_10_items")
        .select("id, rank, data")
        .eq("list_id", list.id)
        .order("rank", { ascending: true });

      if (error) throw error;

      const fetched = (data || []).map((item) => ({
        id: item.id,
        rank: item.rank,
        data: (item.data as Record<string, string>) || {},
      }));

      const sorted = [...fetched].sort(
        (a, b) => a.rank - b.rank || a.id.localeCompare(b.id)
      );

      // Check for gaps in ranks
      const existingRanks = new Set(sorted.map((i) => i.rank));
      const missingRanks: number[] = [];
      for (let r = 1; r <= maxItems; r++) {
        if (!existingRanks.has(r)) missingRanks.push(r);
      }

      // Insert any missing ranks to always have 10 rows
      if (missingRanks.length > 0) {
        const { error: insertError } = await supabase.from("top_10_items").insert(
          missingRanks.map((rank) => ({
            list_id: list.id,
            rank,
            data: {},
          }))
        );
        if (insertError) {
          console.error("Error inserting missing ranks:", insertError);
        }

        // Re-fetch after inserting
        const { data: healed, error: healedError } = await supabase
          .from("top_10_items")
          .select("id, rank, data")
          .eq("list_id", list.id)
          .order("rank", { ascending: true });

        if (healedError) throw healedError;
        setItems(
          (healed || []).map((item) => ({
            id: item.id,
            rank: item.rank,
            data: (item.data as Record<string, string>) || {},
          }))
        );
        return;
      }

      setItems(sorted);
    } catch (error) {
      console.error("Error loading items:", error);
    }
  }, [list.id, maxItems]);

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

    const existingRanks = new Set(items.map((i) => i.rank));
    const nextRank = Array.from({ length: maxItems }, (_, i) => i + 1).find(
      (r) => !existingRanks.has(r)
    );

    if (!nextRank) {
      toast.error("No available rank slot");
      return;
    }

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

  const handleDeleteItem = async (itemId: string, deletedRank: number) => {
    try {
      // Optimistic UI: shift ranks up and add new row at 10
      const remainingItems = items
        .filter((item) => item.id !== itemId)
        .sort((a, b) => a.rank - b.rank);

      const rerankedItems = remainingItems.map((item) => ({
        ...item,
        rank: item.rank > deletedRank ? item.rank - 1 : item.rank,
      }));

      setItems([...rerankedItems, { id: "temp-" + Date.now(), rank: 10, data: {} }]);

      // Delete the item first (this frees up its rank)
      const { error: deleteError } = await supabase
        .from("top_10_items")
        .delete()
        .eq("id", itemId);
      if (deleteError) throw deleteError;

      // Update ranks sequentially from highest to lowest to avoid collisions
      // When shifting down (e.g., rank 5 -> 4), we need to update in descending order
      const itemsToUpdate = remainingItems
        .filter((item) => item.rank > deletedRank)
        .sort((a, b) => a.rank - b.rank); // ascending order for shifting down

      for (const item of itemsToUpdate) {
        const { error: updateError } = await supabase
          .from("top_10_items")
          .update({ rank: item.rank - 1 })
          .eq("id", item.id);
        if (updateError) throw updateError;
      }

      // Insert new empty row at rank 10
      const { error: insertError } = await supabase.from("top_10_items").insert({
        list_id: list.id,
        rank: 10,
        data: {},
      });
      if (insertError) throw insertError;

      loadItems();
    } catch (error: any) {
      console.error("Error deleting item:", error);
      toast.error(error.message || "Failed to delete item");
      loadItems();
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

  const handleDuplicateList = async () => {
    if (!duplicateTitle.trim()) {
      toast.error("Please enter a title for the duplicate list");
      return;
    }

    setDuplicating(true);
    try {
      // Create the new list
      const { data: newList, error: listError } = await supabase
        .from("top_10_lists")
        .insert({
          department_id: departmentId,
          title: duplicateTitle.trim(),
          description: list.description,
          columns: JSON.parse(JSON.stringify(list.columns)),
          display_order: existingListCount,
          is_active: true,
        })
        .select("id")
        .single();

      if (listError) throw listError;

      // Copy items if there are any
      if (items.length > 0) {
        const itemsToInsert = items.map((item) => ({
          list_id: newList.id,
          rank: item.rank,
          data: JSON.parse(JSON.stringify(item.data)),
        }));

        const { error: itemsError } = await supabase
          .from("top_10_items")
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      toast.success("List duplicated successfully");
      setDuplicateDialogOpen(false);
      setDuplicateTitle("");
      onListChange();
    } catch (error: any) {
      console.error("Error duplicating list:", error);
      toast.error(error.message || "Failed to duplicate list");
    } finally {
      setDuplicating(false);
    }
  };

  const openDuplicateDialog = () => {
    setDuplicateTitle(`${list.title} (Copy)`);
    setDuplicateDialogOpen(true);
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

              {list.last_item_activity && (
                <span className="text-xs text-destructive opacity-70">
                  Last Updated: {format(new Date(list.last_item_activity), 'MMM d, yyyy')}
                </span>
              )}

              {canEdit && (
                <div className="flex items-center gap-1">
                  <ImportTop10Dialog
                    listId={list.id}
                    columns={list.columns}
                    onImportComplete={loadItems}
                  />
                  {isSuperAdmin && (
                    <CopyListToGroupDialog
                      list={list}
                      currentDepartmentId={departmentId}
                    />
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={openDuplicateDialog}
                    title="Duplicate list"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
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
                  <div className="border rounded-md overflow-visible">
                    <Table>
                      <ResizableTableHeader
                        columns={list.columns}
                        columnWidths={columnWidths}
                        onResize={handleColumnResize}
                        onResizeEnd={handleColumnResizeEnd}
                        canEdit={canEdit}
                        showActions={canEdit}
                      />
                      <TableBody>
                        {items.map((item) => (
                          <Top10ItemRow
                            key={item.id}
                            rank={item.rank}
                            data={item.data}
                            columns={list.columns}
                            columnWidths={columnWidths}
                            onUpdate={(data) => handleUpdateItem(item.id, data)}
                            onDelete={() => handleDeleteItem(item.id, item.rank)}
                            canEdit={canEdit}
                            departmentId={departmentId}
                            listTitle={list.title}
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

      <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Duplicate List</DialogTitle>
            <DialogDescription>
              Create a copy of "{list.title}" with all its items.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="duplicateTitle">New List Title</Label>
            <Input
              id="duplicateTitle"
              value={duplicateTitle}
              onChange={(e) => setDuplicateTitle(e.target.value)}
              placeholder="Enter title for the duplicate"
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDuplicateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleDuplicateList} disabled={duplicating}>
              {duplicating ? "Duplicating..." : "Duplicate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
