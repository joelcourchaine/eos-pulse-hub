import { useRef, useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Check, User, BarChart3 } from "lucide-react";

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

export interface CellKpiMapping {
  rowIndex: number;
  colIndex: number;
  kpiId: string;
  kpiName: string;
}

interface ExcelPreviewGridProps {
  headers: string[];
  rows: (string | number | null)[][];
  advisorRowIndices: number[];
  columnMappings: ColumnMapping[];
  userMappings: UserMapping[];
  cellKpiMappings: CellKpiMapping[];
  onColumnClick: (colIndex: number, header: string) => void;
  onAdvisorClick: (rowIndex: number, advisorName: string) => void;
  onCellClick: (rowIndex: number, colIndex: number, cellValue: string | number | null, header: string) => void;
  selectedColumn: number | null;
  selectedRow: number | null;
  selectedCell: { rowIndex: number; colIndex: number } | null;
  headerRowIndex?: number;
  canClickCells?: boolean; // New prop to control if cells are clickable
}

export const ExcelPreviewGrid = ({
  headers,
  rows,
  advisorRowIndices,
  columnMappings,
  userMappings,
  cellKpiMappings,
  onColumnClick,
  onAdvisorClick,
  onCellClick,
  selectedColumn,
  selectedRow,
  selectedCell,
  headerRowIndex = -1,
  canClickCells = false,
}: ExcelPreviewGridProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const isColumnMapped = (colIndex: number) => {
    return columnMappings?.some(m => m?.columnIndex === colIndex && m?.targetKpiName) ?? false;
  };

  const getColumnMappingInfo = (colIndex: number) => {
    return columnMappings?.find(m => m?.columnIndex === colIndex);
  };

  const isUserMapped = (rowIndex: number) => {
    return userMappings?.some(m => m?.rowIndex === rowIndex && m?.userId) ?? false;
  };

  const getUserMappingInfo = (rowIndex: number) => {
    return userMappings?.find(m => m?.rowIndex === rowIndex);
  };

  const getCellMapping = (rowIndex: number, colIndex: number) => {
    return cellKpiMappings?.find(m => m?.rowIndex === rowIndex && m?.colIndex === colIndex);
  };

  // Find which advisor "owns" a given data row (the advisor row that precedes it)
  const getOwningAdvisorRowIndex = (rowIndex: number): number | null => {
    // Find the closest advisor row that comes before this row
    const precedingAdvisorRows = advisorRowIndices.filter(idx => idx < rowIndex);
    return precedingAdvisorRows.length > 0 ? precedingAdvisorRows[precedingAdvisorRows.length - 1] : null;
  };

  const isDataRowForMappedUser = (rowIndex: number): boolean => {
    const owningAdvisorIdx = getOwningAdvisorRowIndex(rowIndex);
    if (owningAdvisorIdx === null) return false;
    return isUserMapped(owningAdvisorIdx);
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

  const mainScrollRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState(0);
  const isSyncing = useRef(false);

  // Measure content width for top scrollbar
  useEffect(() => {
    const mainEl = mainScrollRef.current;
    if (!mainEl) return;
    
    const updateWidth = () => {
      setContentWidth(mainEl.scrollWidth);
    };
    
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(mainEl);
    return () => observer.disconnect();
  }, [rows, headers]);

  // Sync scrollbars
  const handleMainScroll = useCallback(() => {
    if (isSyncing.current) return;
    isSyncing.current = true;
    if (topScrollRef.current && mainScrollRef.current) {
      topScrollRef.current.scrollLeft = mainScrollRef.current.scrollLeft;
    }
    requestAnimationFrame(() => { isSyncing.current = false; });
  }, []);

  const handleTopScroll = useCallback(() => {
    if (isSyncing.current) return;
    isSyncing.current = true;
    if (mainScrollRef.current && topScrollRef.current) {
      mainScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
    requestAnimationFrame(() => { isSyncing.current = false; });
  }, []);

  return (
    <div className="w-full border rounded-lg bg-card flex flex-col">
      {/* Top scrollbar */}
      <div
        ref={topScrollRef}
        onScroll={handleTopScroll}
        className="w-full overflow-x-auto overflow-y-hidden h-3 border-b bg-muted/30"
        style={{ minHeight: '12px' }}
      >
        <div style={{ width: contentWidth, height: 1 }} />
      </div>
      
      {/* Main scrollable content */}
      <div
        ref={mainScrollRef}
        onScroll={handleMainScroll}
        className="w-full overflow-auto flex-1"
      >
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
            const isHeaderRow = rowIndex === headerRowIndex;
            const isMetadataRow = headerRowIndex > 0 && rowIndex < headerRowIndex;
            
            return (
              <div
                key={rowIndex}
                className={cn(
                  "flex border-b hover:bg-muted/30 transition-colors",
                  isHeaderRow && "bg-amber-100 dark:bg-amber-900/30 font-semibold sticky top-10 z-[5]",
                  isMetadataRow && "bg-slate-50 dark:bg-slate-800/30 text-muted-foreground",
                  isAdvisorRow && !isHeaderRow && "bg-blue-50 dark:bg-blue-900/20",
                  isUserRowMapped && !isHeaderRow && "bg-green-50 dark:bg-green-900/20",
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
                  const cellMapping = getCellMapping(rowIndex, colIndex);
                  const isCellMapped = !!cellMapping;
                  const isSelectedCell = selectedCell?.rowIndex === rowIndex && selectedCell?.colIndex === colIndex;
                  
                  // Allow clicking any cell when canClickCells is true (KPI owner is selected)
                  const canMapCell = canClickCells && !isAdvisorRow && !isHeaderRow && !isMetadataRow;
                  
                  return (
                    <div
                      key={colIndex}
                      className={cn(
                        "min-w-[120px] max-w-[180px] p-2 border-r text-sm truncate",
                        isMappedCol && "bg-green-50/50 dark:bg-green-900/10",
                        isSelectedCol && "bg-primary/5",
                        isFirstCol && isAdvisorRow && "cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-800/40",
                        canMapCell && "cursor-pointer hover:bg-purple-50 dark:hover:bg-purple-900/20",
                        isCellMapped && "bg-purple-100 dark:bg-purple-900/30 ring-1 ring-purple-300 dark:ring-purple-700",
                        isSelectedCell && "ring-2 ring-primary ring-inset",
                      )}
                      onClick={() => {
                        if (isFirstCol && isAdvisorRow) {
                          onAdvisorClick(rowIndex, String(cell));
                        } else if (canMapCell) {
                          onCellClick(rowIndex, colIndex, cell, headers[colIndex] || "");
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
                      ) : isCellMapped ? (
                        <div className="flex flex-col min-w-0">
                          <span className={cn(typeof cell === "number" && "font-mono")}>
                            {formatCellValue(cell)}
                          </span>
                          <span className="text-[10px] text-purple-700 dark:text-purple-300 truncate">
                            → {cellMapping.kpiName}
                          </span>
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
      </div>
    </div>
  );
};
