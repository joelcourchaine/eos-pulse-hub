import { useState, useCallback, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { IssueManagementDialog } from "@/components/issues/IssueManagementDialog";
import { MiniConfetti } from "@/components/ui/mini-confetti";
import { differenceInDays, parse, isValid } from "date-fns";

interface ColumnDefinition {
  key: string;
  label: string;
}

interface Top10ItemRowProps {
  rank: number;
  data: Record<string, string>;
  columns: ColumnDefinition[];
  onUpdate: (data: Record<string, string>) => void;
  onDelete: () => void;
  canEdit: boolean;
  departmentId: string;
  listTitle: string;
  onIssueCreated?: () => void;
}

// Helper to find column key by label pattern
const findColumnKey = (columns: ColumnDefinition[], patterns: string[]): string | null => {
  for (const col of columns) {
    const label = col.label.toLowerCase();
    if (patterns.some(p => label.includes(p))) {
      return col.key;
    }
  }
  return null;
};

// Helper to parse various date formats
const parseDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  
  // Try common date formats
  const formats = [
    "MM/dd/yyyy",
    "M/d/yyyy",
    "MM-dd-yyyy",
    "yyyy-MM-dd",
    "MM/dd/yy",
    "M/d/yy",
  ];
  
  for (const fmt of formats) {
    const parsed = parse(dateStr, fmt, new Date());
    if (isValid(parsed)) {
      return parsed;
    }
  }
  
  // Try native Date parsing as fallback
  const nativeDate = new Date(dateStr);
  if (isValid(nativeDate)) {
    return nativeDate;
  }
  
  return null;
};

export function Top10ItemRow({
  rank,
  data,
  columns,
  onUpdate,
  onDelete,
  canEdit,
  departmentId,
  listTitle,
  onIssueCreated,
}: Top10ItemRowProps) {
  const [localData, setLocalData] = useState<Record<string, string>>(data);
  const [isHovered, setIsHovered] = useState(false);
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [selectedCellContent, setSelectedCellContent] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);

  // Find date and days columns for auto-calculation
  const roDateColKey = findColumnKey(columns, ["ro date", "date opened", "open date"]);
  const daysColKey = findColumnKey(columns, ["# of days", "days", "age", "days open"]);

  // Sync local data when props change AND auto-calculate days if missing
  useEffect(() => {
    let newData = { ...data };
    
    // Auto-calculate "# of Days" if RO Date exists but days is empty
    if (roDateColKey && daysColKey) {
      const roDateValue = data[roDateColKey];
      const daysValue = data[daysColKey];
      
      if (roDateValue && (!daysValue || daysValue === "# of Days")) {
        const roDate = parseDate(roDateValue);
        if (roDate) {
          const today = new Date();
          const daysDiff = differenceInDays(today, roDate);
          if (daysDiff >= 0) {
            newData[daysColKey] = String(daysDiff);
            // Save the calculated value
            onUpdate(newData);
          }
        }
      }
    }
    
    setLocalData(newData);
  }, [data, roDateColKey, daysColKey]);

  const handleChange = useCallback(
    (key: string, value: string) => {
      let newData = { ...localData, [key]: value };

      // Auto-calculate "# of days" when RO Date changes
      if (key === roDateColKey && daysColKey) {
        const roDate = parseDate(value);
        if (roDate) {
          const today = new Date();
          const daysDiff = differenceInDays(today, roDate);
          newData[daysColKey] = daysDiff >= 0 ? String(daysDiff) : "";
        }
      }

      setLocalData(newData);

      // Debounced auto-save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        onUpdate(newData);
      }, 500);
    },
    [localData, onUpdate, roDateColKey, daysColKey]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const handleCreateIssue = (cellContent: string) => {
    setSelectedCellContent(cellContent);
    setIssueDialogOpen(true);
  };

  const handleIssueAdded = () => {
    setIssueDialogOpen(false);
    onIssueCreated?.();
  };

  const handleDeleteClick = () => {
    setIsDeleting(true);
  };

  const handleConfettiComplete = useCallback(() => {
    onDelete();
  }, [onDelete]);

  // Get a summary of the row data for the issue title
  const getRowSummary = () => {
    const values = columns.map(col => localData[col.key]).filter(Boolean);
    return values.length > 0 ? values.join(" - ") : `Top 10 Item #${rank}`;
  };

  return (
    <TableRow
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative"
    >
      <TableCell className="w-12 text-center font-medium text-muted-foreground">
        {rank}
      </TableCell>
      {columns.map((col) => (
        <ContextMenu key={col.key}>
          <ContextMenuTrigger asChild>
            <TableCell className="p-1">
              {canEdit ? (
                <Input
                  value={localData[col.key] || ""}
                  onChange={(e) => handleChange(col.key, e.target.value)}
                  className="h-8 text-sm"
                  placeholder={col.label}
                />
              ) : (
                <span className="text-sm">{localData[col.key] || "-"}</span>
              )}
            </TableCell>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem
              onClick={() => handleCreateIssue(localData[col.key] || getRowSummary())}
            >
              Create Issue from this
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      ))}
      {canEdit && (
        <TableCell className="w-10 p-1 relative overflow-visible">
          <div className="relative flex items-center justify-center">
            <Button
              ref={deleteButtonRef}
              variant="ghost"
              size="icon"
              className={`h-7 w-7 text-destructive opacity-0 transition-opacity ${
                isHovered ? "opacity-100" : ""
              }`}
              onClick={handleDeleteClick}
              disabled={isDeleting}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            {isDeleting && (
              <MiniConfetti onComplete={handleConfettiComplete} />
            )}
          </div>
          {/* Portal the dialog outside of table structure */}
          <IssueManagementDialog
            departmentId={departmentId}
            onIssueAdded={handleIssueAdded}
            initialTitle={selectedCellContent}
            initialDescription={`From Top 10 List: ${listTitle}`}
            open={issueDialogOpen}
            onOpenChange={setIssueDialogOpen}
            trigger={<span className="hidden" />}
          />
        </TableCell>
      )}
      {!canEdit && (
        <IssueManagementDialog
          departmentId={departmentId}
          onIssueAdded={handleIssueAdded}
          initialTitle={selectedCellContent}
          initialDescription={`From Top 10 List: ${listTitle}`}
          open={issueDialogOpen}
          onOpenChange={setIssueDialogOpen}
          trigger={<span className="hidden" />}
        />
      )}
    </TableRow>
  );
}
