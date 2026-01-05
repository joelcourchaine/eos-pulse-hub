import { useState, useCallback, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";

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
}

export function Top10ItemRow({
  rank,
  data,
  columns,
  onUpdate,
  onDelete,
  canEdit,
}: Top10ItemRowProps) {
  const [localData, setLocalData] = useState<Record<string, string>>(data);
  const [isHovered, setIsHovered] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync local data when props change
  useEffect(() => {
    setLocalData(data);
  }, [data]);

  const handleChange = useCallback(
    (key: string, value: string) => {
      const newData = { ...localData, [key]: value };
      setLocalData(newData);

      // Debounced auto-save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        onUpdate(newData);
      }, 500);
    },
    [localData, onUpdate]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return (
    <TableRow
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group"
    >
      <TableCell className="w-12 text-center font-medium text-muted-foreground">
        {rank}
      </TableCell>
      {columns.map((col) => (
        <TableCell key={col.key} className="p-1">
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
      ))}
      {canEdit && (
        <TableCell className="w-10 p-1">
          <Button
            variant="ghost"
            size="icon"
            className={`h-7 w-7 text-destructive opacity-0 transition-opacity ${
              isHovered ? "opacity-100" : ""
            }`}
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </TableCell>
      )}
    </TableRow>
  );
}
