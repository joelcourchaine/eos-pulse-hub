import { useRef, useCallback, useState } from "react";
import { TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface ColumnDefinition {
  key: string;
  label: string;
  width?: number;
}

interface ResizableTableHeaderProps {
  columns: ColumnDefinition[];
  columnWidths: Record<string, number>;
  onResize: (key: string, width: number) => void;
  onResizeEnd: () => void;
  canEdit: boolean;
  showActions: boolean;
}

const MIN_WIDTH = 60;
const DEFAULT_WIDTH = 150;

export function ResizableTableHeader({
  columns,
  columnWidths,
  onResize,
  onResizeEnd,
  canEdit,
  showActions,
}: ResizableTableHeaderProps) {
  const [resizingCol, setResizingCol] = useState<string | null>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleMouseDown = useCallback(
    (colKey: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      setResizingCol(colKey);
      startXRef.current = e.clientX;
      startWidthRef.current = columnWidths[colKey] || DEFAULT_WIDTH;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startXRef.current;
        const newWidth = Math.max(MIN_WIDTH, startWidthRef.current + delta);
        onResize(colKey, newWidth);
      };

      const handleMouseUp = () => {
        setResizingCol(null);
        onResizeEnd();
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [columnWidths, onResize, onResizeEnd]
  );

  return (
    <TableHeader>
      <TableRow>
        <TableHead className="w-12 text-center">#</TableHead>
        {columns.map((col, index) => {
          const width = columnWidths[col.key] || col.width || DEFAULT_WIDTH;
          const isLast = index === columns.length - 1;
          
          return (
            <TableHead
              key={col.key}
              className="relative select-none"
              style={{ width: `${width}px`, minWidth: `${MIN_WIDTH}px` }}
            >
              <span className="truncate block pr-2">{col.label}</span>
              {/* Resize handle */}
              {canEdit && !isLast && (
                <div
                  className={cn(
                    "absolute right-0 top-0 h-full w-1 cursor-col-resize",
                    "hover:bg-primary/30 active:bg-primary/50",
                    "transition-colors",
                    resizingCol === col.key && "bg-primary/50"
                  )}
                  onMouseDown={(e) => handleMouseDown(col.key, e)}
                  title="Drag to resize"
                />
              )}
            </TableHead>
          );
        })}
        {showActions && <TableHead className="w-10" />}
      </TableRow>
    </TableHeader>
  );
}

export { DEFAULT_WIDTH, MIN_WIDTH };
