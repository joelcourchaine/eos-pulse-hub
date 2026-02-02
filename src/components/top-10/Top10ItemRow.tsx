import { useState, useCallback, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, CalendarIcon } from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { IssueManagementDialog } from "@/components/issues/IssueManagementDialog";
import { MiniConfetti } from "@/components/ui/mini-confetti";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { differenceInDays, parse, isValid, format } from "date-fns";
import { cn } from "@/lib/utils";

interface ColumnDefinition {
  key: string;
  label: string;
  width?: number;
}

interface Top10ItemRowProps {
  rank: number;
  data: Record<string, string>;
  columns: ColumnDefinition[];
  columnWidths?: Record<string, number>;
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

// Helper to check if a column should display as currency
const isCurrencyColumn = (col: ColumnDefinition): boolean => {
  const label = col.label.toLowerCase();
  return label.includes("value") || label.includes("amount") || label.includes("total");
};

// Helper to check if a column should be narrow (9 chars wide)
const isNarrowColumn = (col: ColumnDefinition): boolean => {
  const label = col.label.toLowerCase();
  return label.includes("ro #") || label.includes("ro#") || 
         label.includes("value") || label.includes("amount") || 
         label.includes("# of days") || label.includes("days");
};

// Format value as currency for display
const formatAsCurrency = (value: string): string => {
  if (!value) return "";
  const num = parseFloat(value.replace(/[^0-9.-]/g, ""));
  if (isNaN(num)) return value;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
};

// Helper to parse various date formats (for legacy data)
const parseDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  
  // Try common date formats
  const formats = [
    "yyyy-MM-dd", // ISO format (new storage format)
    "MM/dd/yyyy",
    "M/d/yyyy",
    "MM-dd-yyyy",
    "MM/dd/yy",
    "M/d/yy",
    "dd/MM/yyyy",
    "d/M/yyyy",
    "dd/MM/yy",
    "d/M/yy",
  ];
  
  for (const fmt of formats) {
    const parsed = parse(dateStr, fmt, new Date());
    if (isValid(parsed)) {
      // Fix 2-digit year parsing (0025 -> 2025)
      const year = parsed.getFullYear();
      if (year < 100) {
        parsed.setFullYear(year + 2000);
      }
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

// Helper to parse stored ISO dates (for date picker)
const parseStoredDate = (dateStr: string): Date | undefined => {
  if (!dateStr) return undefined;
  // Try ISO format first (new storage format)
  const isoDate = parse(dateStr, "yyyy-MM-dd", new Date());
  if (isValid(isoDate)) return isoDate;
  // Fall back to legacy parsing for existing data
  return parseDate(dateStr) || undefined;
};

export function Top10ItemRow({
  rank,
  data,
  columns,
  columnWidths = {},
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

  // Check if a column is a date column
  const isDateColumn = (colKey: string) => colKey === roDateColKey;

  // Handle date selection from calendar picker
  const handleDateSelect = useCallback(
    (key: string, date: Date | undefined) => {
      const formatted = date ? format(date, "yyyy-MM-dd") : "";
      let newData = { ...localData, [key]: formatted };

      // Auto-calculate "# of days" when date changes
      if (key === roDateColKey && daysColKey && date) {
        const today = new Date();
        const daysDiff = differenceInDays(today, date);
        newData[daysColKey] = daysDiff >= 0 ? String(daysDiff) : "";
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
      {columns.map((col) => {
        const colWidth = columnWidths[col.key] || col.width;
        return (
        <ContextMenu key={col.key}>
          <ContextMenuTrigger asChild>
            <TableCell 
              className={cn("p-1", !colWidth && isNarrowColumn(col) && "w-[9ch]")}
              style={colWidth ? { width: `${colWidth}px`, minWidth: '40px' } : undefined}
            >
              {canEdit ? (
                isDateColumn(col.key) ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "h-8 w-full justify-start text-left text-sm font-normal",
                          !localData[col.key] && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {localData[col.key] && parseStoredDate(localData[col.key])
                          ? format(parseStoredDate(localData[col.key])!, "MMM d, yyyy")
                          : col.label}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={parseStoredDate(localData[col.key])}
                        onSelect={(date) => handleDateSelect(col.key, date)}
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                ) : isCurrencyColumn(col) ? (
                  <div className="relative flex items-center">
                    <span className="absolute left-2 text-muted-foreground text-sm">$</span>
                    <Input
                      value={localData[col.key] || ""}
                      onChange={(e) => handleChange(col.key, e.target.value)}
                      onBlur={(e) => {
                        // Format as number on blur (strip non-numeric chars except decimal)
                        const num = parseFloat(e.target.value.replace(/[^0-9.-]/g, ""));
                        if (!isNaN(num)) {
                          handleChange(col.key, String(num));
                        }
                      }}
                      className={cn("h-8 text-sm pl-5", isNarrowColumn(col) && "w-[9ch]")}
                      placeholder={col.label}
                    />
                  </div>
                ) : (
                  <Input
                    value={localData[col.key] || ""}
                    onChange={(e) => handleChange(col.key, e.target.value)}
                    className={cn("h-8 text-sm", isNarrowColumn(col) && "w-[9ch]")}
                    placeholder={col.label}
                  />
                )
              ) : (
                <span className="text-sm">
                  {isDateColumn(col.key) && localData[col.key] && parseStoredDate(localData[col.key])
                    ? format(parseStoredDate(localData[col.key])!, "MMM d, yyyy")
                    : isCurrencyColumn(col)
                    ? formatAsCurrency(localData[col.key])
                    : localData[col.key] || "-"}
                </span>
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
        );
      })}
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
