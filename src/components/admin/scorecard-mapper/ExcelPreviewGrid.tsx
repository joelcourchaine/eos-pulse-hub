import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Check, AlertCircle, User, BarChart3 } from "lucide-react";

export interface CellData {
  value: string | number | null;
  rowIndex: number;
  colIndex: number;
}

export interface ColumnMapping {
  columnIndex: number;
  columnHeader: string;
  targetKpiName: string | null;
  payTypeFilter: string | null;
  isPerUser: boolean;
}

export interface UserMapping {
  rowIndex: number;
  advisorName: string;
  userId: string | null;
  matchedProfileName: string | null;
}

interface ExcelPreviewGridProps {
  headers: string[];
  rows: (string | number | null)[][];
  advisorRowIndices: number[];
  columnMappings: ColumnMapping[];
  userMappings: UserMapping[];
  onColumnClick: (colIndex: number, header: string) => void;
  onAdvisorClick: (rowIndex: number, advisorName: string) => void;
  selectedColumn: number | null;
  selectedRow: number | null;
}

export const ExcelPreviewGrid = ({
  headers,
  rows,
  advisorRowIndices,
  columnMappings,
  userMappings,
  onColumnClick,
  onAdvisorClick,
  selectedColumn,
  selectedRow,
}: ExcelPreviewGridProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const isColumnMapped = (colIndex: number) => {
    return columnMappings.some(m => m.columnIndex === colIndex && m.targetKpiName);
  };

  const getColumnMappingInfo = (colIndex: number) => {
    return columnMappings.find(m => m.columnIndex === colIndex);
  };

  const isUserMapped = (rowIndex: number) => {
    return userMappings.some(m => m.rowIndex === rowIndex && m.userId);
  };

  const getUserMappingInfo = (rowIndex: number) => {
    return userMappings.find(m => m.rowIndex === rowIndex);
  };

  const formatCellValue = (value: string | number | null): string => {
    if (value === null || value === undefined) return "";
    if (typeof value === "number") {
      // Format numbers nicely
      if (value % 1 === 0) return value.toLocaleString();
      return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return String(value);
  };

  return (
    <ScrollArea className="w-full border rounded-lg bg-card" ref={scrollRef}>
      <div className="min-w-max">
        {/* Header Row */}
        <div className="flex border-b bg-muted/50 sticky top-0 z-10">
          {/* Row indicator column */}
          <div className="w-12 shrink-0 p-2 border-r bg-muted/80 flex items-center justify-center">
            <span className="text-xs font-medium text-muted-foreground">#</span>
          </div>
          
          {headers.map((header, colIndex) => {
            const isMapped = isColumnMapped(colIndex);
            const mappingInfo = getColumnMappingInfo(colIndex);
            const isSelected = selectedColumn === colIndex;
            const isClickable = header.toLowerCase() !== "pay type" && header.trim() !== "";
            
            return (
              <div
                key={colIndex}
                className={cn(
                  "min-w-[120px] max-w-[180px] p-2 border-r transition-all",
                  isClickable && "cursor-pointer hover:bg-primary/10",
                  isMapped && "bg-green-100 dark:bg-green-900/30",
                  isSelected && "ring-2 ring-primary ring-inset",
                )}
                onClick={() => isClickable && onColumnClick(colIndex, header)}
              >
                <div className="flex items-center gap-1.5">
                  {isMapped ? (
                    <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400 shrink-0" />
                  ) : isClickable ? (
                    <BarChart3 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  ) : null}
                  <span className="text-xs font-semibold truncate">{header}</span>
                </div>
                {mappingInfo?.targetKpiName && (
                  <div className="text-[10px] text-green-700 dark:text-green-300 mt-0.5 truncate">
                    → {mappingInfo.targetKpiName}
                    {mappingInfo.payTypeFilter && (
                      <span className="text-muted-foreground ml-1">
                        ({mappingInfo.payTypeFilter})
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Data Rows */}
        {rows.map((row, rowIndex) => {
          const isAdvisorRow = advisorRowIndices.includes(rowIndex);
          const isUserRowMapped = isUserMapped(rowIndex);
          const userInfo = getUserMappingInfo(rowIndex);
          const isSelectedRow = selectedRow === rowIndex;
          
          return (
            <div
              key={rowIndex}
              className={cn(
                "flex border-b hover:bg-muted/30 transition-colors",
                isAdvisorRow && "bg-blue-50 dark:bg-blue-900/20",
                isUserRowMapped && "bg-green-50 dark:bg-green-900/20",
                isSelectedRow && "ring-2 ring-primary ring-inset",
              )}
            >
              {/* Row number indicator */}
              <div className="w-12 shrink-0 p-2 border-r bg-muted/30 flex items-center justify-center">
                <span className="text-xs text-muted-foreground">{rowIndex + 1}</span>
              </div>
              
              {row.map((cell, colIndex) => {
                const isFirstCol = colIndex === 0;
                const isMappedCol = isColumnMapped(colIndex);
                const isSelectedCol = selectedColumn === colIndex;
                
                return (
                  <div
                    key={colIndex}
                    className={cn(
                      "min-w-[120px] max-w-[180px] p-2 border-r text-sm truncate",
                      isMappedCol && "bg-green-50/50 dark:bg-green-900/10",
                      isSelectedCol && "bg-primary/5",
                      isFirstCol && isAdvisorRow && "cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-800/40",
                    )}
                    onClick={() => {
                      if (isFirstCol && isAdvisorRow) {
                        onAdvisorClick(rowIndex, String(cell));
                      }
                    }}
                  >
                    {isFirstCol && isAdvisorRow ? (
                      <div className="flex items-center gap-1.5">
                        {isUserRowMapped ? (
                          <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400 shrink-0" />
                        ) : (
                          <User className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                        )}
                        <div className="flex flex-col min-w-0">
                          <span className="truncate font-medium">{formatCellValue(cell)}</span>
                          {userInfo?.matchedProfileName && (
                            <span className="text-[10px] text-green-700 dark:text-green-300 truncate">
                              → {userInfo.matchedProfileName}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className={cn(
                        typeof cell === "number" && "font-mono"
                      )}>
                        {formatCellValue(cell)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
};
