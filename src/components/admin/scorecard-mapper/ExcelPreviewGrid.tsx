import { useRef, useEffect, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { Check, User, BarChart3, MousePointerClick } from "lucide-react";

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
  /**
   * For absolute mappings (legacy): the absolute row index.
   * For relative mappings: the row offset from the owner anchor row (can be 0, 1, 2, ...).
   */
  rowIndex?: number;
  colIndex: number;
  kpiId: string;
  kpiName: string;
  userId?: string; // User ID for relative mappings
  isRelative?: boolean;
}

export interface ColumnTemplate {
  id: string;
  col_index: number;
  kpi_name: string;
  row_offset: number;
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
  onFirstColClick?: (rowIndex: number, cellValue: string) => void; // Click any first column cell
  selectedColumn: number | null;
  selectedRow: number | null;
  selectedCell: { rowIndex: number; colIndex: number } | null;
  headerRowIndex?: number;
  canClickCells?: boolean;
  activeOwnerId?: string | null;
  columnTemplates?: ColumnTemplate[]; // Full template data for highlighting mapped cells
  dateRowIndices?: number[]; // Rows containing only date ranges (non-mappable)
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
  onFirstColClick,
  selectedColumn,
  selectedRow,
  selectedCell,
  headerRowIndex = -1,
  canClickCells = false,
  activeOwnerId = null,
  columnTemplates = [],
  dateRowIndices = [],
}: ExcelPreviewGridProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Group templates by col_index for lookup (multiple templates per column possible)
  const templatesByColIndex = new Map<number, ColumnTemplate[]>();
  columnTemplates.forEach(t => {
    const existing = templatesByColIndex.get(t.col_index) || [];
    existing.push(t);
    templatesByColIndex.set(t.col_index, existing);
  });
  const templateColSet = new Set(columnTemplates.map(t => t.col_index));

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

  // For relative mappings, we match by userId + colIndex
  // The owning user's row is determined dynamically from userMappings
  const getCellMapping = (rowIndex: number, colIndex: number) => {
    // First check for legacy absolute mappings (with explicit rowIndex)
    const absoluteMatch = cellKpiMappings?.find(
      (m) => !m?.isRelative && m?.rowIndex === rowIndex && m?.colIndex === colIndex
    );
    if (absoluteMatch) return absoluteMatch;
    
    // For relative mappings, find the owner of this row and match by userId + colIndex + rowOffset
    const owningAdvisorIdx = getOwningAdvisorRowIndex(rowIndex);
    if (owningAdvisorIdx !== null) {
      const userMapping = userMappings?.find(m => m?.rowIndex === owningAdvisorIdx);
      if (userMapping?.userId) {
        const currentOffset = rowIndex - owningAdvisorIdx;
        return cellKpiMappings?.find(
          (m) =>
            m?.isRelative &&
            m?.userId === userMapping.userId &&
            m?.colIndex === colIndex &&
            m?.rowIndex === currentOffset
        );
      }
    }
    
    return undefined;
  };
  
  // Check if a cell should show template-based mapping (column template applies to all advisors)
  // Uses row_offset: the template's offset from the owner's anchor row
  const getTemplateMapping = (rowIndex: number, colIndex: number): { kpiName: string; rowOffset: number } | null => {
    const templates = templatesByColIndex.get(colIndex);
    if (!templates || templates.length === 0) return null;
    
    // Find the owning advisor for this row
    const owningAdvisorIdx = getOwningAdvisorRowIndex(rowIndex);
    // If this is the advisor row itself, treat it as offset 0
    const effectiveOwnerIdx = advisorRowIndices.includes(rowIndex) ? rowIndex : owningAdvisorIdx;
    
    if (effectiveOwnerIdx === null) return null;
    if (!isUserMapped(effectiveOwnerIdx)) return null;
    
    // Calculate the offset from the owner's anchor row
    const currentOffset = rowIndex - effectiveOwnerIdx;
    
    // Find a template that matches this exact offset
    for (const template of templates) {
      if (template.row_offset === currentOffset) {
        return { kpiName: template.kpi_name, rowOffset: template.row_offset };
      }
    }
    
    return null;
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
  const containerRef = useRef<HTMLDivElement>(null);
  const stickyScrollRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState(0);
  const [containerLeft, setContainerLeft] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [showStickyScroll, setShowStickyScroll] = useState(false);
  const isSyncing = useRef(false);

  // Measure content width and container position for sticky scrollbar
  useEffect(() => {
    const mainEl = mainScrollRef.current;
    const containerEl = containerRef.current;
    if (!mainEl || !containerEl) return;
    
    const updateMeasurements = () => {
      setContentWidth(mainEl.scrollWidth);
      const rect = containerEl.getBoundingClientRect();
      setContainerLeft(rect.left);
      setContainerWidth(rect.width);
      // Show sticky scroll only if content overflows
      setShowStickyScroll(mainEl.scrollWidth > mainEl.clientWidth);
    };
    
    updateMeasurements();
    const observer = new ResizeObserver(updateMeasurements);
    observer.observe(mainEl);
    observer.observe(containerEl);
    window.addEventListener("resize", updateMeasurements);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateMeasurements);
    };
  }, [rows, headers]);

  // Sync scrollbars
  const handleMainScroll = useCallback(() => {
    if (isSyncing.current) return;
    isSyncing.current = true;
    if (stickyScrollRef.current && mainScrollRef.current) {
      stickyScrollRef.current.scrollLeft = mainScrollRef.current.scrollLeft;
    }
    requestAnimationFrame(() => { isSyncing.current = false; });
  }, []);

  const handleStickyScroll = useCallback(() => {
    if (isSyncing.current) return;
    isSyncing.current = true;
    if (mainScrollRef.current && stickyScrollRef.current) {
      mainScrollRef.current.scrollLeft = stickyScrollRef.current.scrollLeft;
    }
    requestAnimationFrame(() => { isSyncing.current = false; });
  }, []);

  return (
    <div ref={containerRef} className="w-full border rounded-lg bg-card flex flex-col">
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
              const headerStr = String(header ?? "").trim();
              const isMapped = isColumnMapped(colIndex);
              const mappingInfo = getColumnMappingInfo(colIndex);
              const isSelected = selectedColumn === colIndex;
              const isClickable = headerStr.toLowerCase() !== "pay type" && headerStr !== "";
              
              return (
                <div
                  key={colIndex}
                  className={cn(
                    "min-w-[120px] max-w-[180px] p-2 border-r transition-all",
                    isClickable && "cursor-pointer hover:bg-primary/10",
                    isMapped && "bg-green-100 dark:bg-green-900/30",
                    isSelected && "ring-2 ring-primary ring-inset",
                  )}
                  onClick={() => isClickable && onColumnClick(colIndex, headerStr)}
                >
                  <div className="flex items-center gap-1.5">
                    {isMapped ? (
                      <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400 shrink-0" />
                    ) : isClickable ? (
                      <BarChart3 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    ) : null}
                    <span className="text-xs font-semibold truncate">{headerStr}</span>
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
            const isActiveOwnerRow = isAdvisorRow && userInfo?.userId === activeOwnerId;
            const isDateRow = dateRowIndices.includes(rowIndex);
            
            return (
              <div
                key={rowIndex}
                className={cn(
                  "flex border-b hover:bg-muted/30 transition-colors",
                  isHeaderRow && "bg-amber-100 dark:bg-amber-900/30 font-semibold sticky top-10 z-[5]",
                  isMetadataRow && !isDateRow && "bg-slate-50 dark:bg-slate-800/30 text-muted-foreground",
                  isDateRow && "bg-slate-200/50 dark:bg-slate-700/30 text-muted-foreground/60 italic",
                  isAdvisorRow && !isHeaderRow && !isActiveOwnerRow && "bg-blue-50 dark:bg-blue-900/20",
                  isActiveOwnerRow && "bg-green-100 dark:bg-green-900/30 ring-2 ring-green-500 ring-inset",
                  isUserRowMapped && !isHeaderRow && !isActiveOwnerRow && "bg-green-50 dark:bg-green-900/20",
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
                  const templateMapping = getTemplateMapping(rowIndex, colIndex);
                  const isCellMapped = !!cellMapping;
                  const isTemplateMapped = !!templateMapping && !isCellMapped; // Template applies but no specific cell mapping
                  const isSelectedCell = selectedCell?.rowIndex === rowIndex && selectedCell?.colIndex === colIndex;
                  
                  // Check if this cell is on a template column (will be auto-mapped)
                  const isTemplateColumn = templateColSet.has(colIndex);
                  // Highlight template cells on advisor rows that are NOT yet mapped to a user
                  const isTemplatePreviewCell = isTemplateColumn && isAdvisorRow && !isHeaderRow && !isUserRowMapped && !isCellMapped;
                  
                  // Detect owner/advisor name cells.
                  // Primary: Use advisorRowIndices from the parser (most reliable)
                  // Fallback: Pattern matching for cells that may have been missed by the parser
                  const cellStr = String(cell ?? "");
                  const normalized = cellStr.replace(/\s+/g, " ").trim();
                  
                  // Pattern-based detection as fallback
                  const hasAdvisorWord = /\badvisor\b/i.test(normalized);
                  const hasSeparator = /[-–—:]/.test(normalized);
                  const hasNameAfterSeparator = hasSeparator
                    ? /\S/.test(normalized.split(/[-–—:]/).slice(1).join("-").trim())
                    : false;
                  const isTotalsRow = isFirstCol && (
                    /\ball\s+repair\s+orders\b/i.test(normalized) || 
                    /\btotal\s+repair\s+orders?\b/i.test(normalized)
                  );
                  const patternBasedAdvisorCell = (hasAdvisorWord && hasSeparator && hasNameAfterSeparator) || isTotalsRow;
                  
                  // A cell is an advisor cell if:
                  // 1. It's in the first column AND the row is in advisorRowIndices (from parser), OR
                  // 2. It matches the advisor pattern (fallback for edge cases)
                  const isAdvisorCell = (isFirstCol && isAdvisorRow) || patternBasedAdvisorCell;
                  
                  // Allow clicking any data cell (no need to pre-select an advisor)
                  // But NOT on advisor cells, header row, or date rows
                  const canMapCell = !isHeaderRow && !isAdvisorCell && !isDateRow && !isMetadataRow;
                  
                  // Advisor cells are ALWAYS clickable to select as owner (unless it's a date row)
                  // Use both parser-detected rows AND pattern-matched cells
                  const canSelectAsOwner = isAdvisorCell && !isDateRow;
                  
                  return (
                    <div
                      key={colIndex}
                      className={cn(
                        "p-2 border-r text-sm relative min-h-[44px] flex flex-col justify-center",
                        isAdvisorCell ? "min-w-[280px] max-w-[320px]" : "min-w-[120px] max-w-[180px] truncate",
                        isMappedCol && "bg-green-50/50 dark:bg-green-900/10",
                        isSelectedCol && "bg-primary/5",
                        canSelectAsOwner && "cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-800/40",
                        canMapCell && "cursor-pointer hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:ring-1 hover:ring-purple-200 dark:hover:ring-purple-800",
                        // Template-based mapping (from column templates) - solid purple
                        isTemplateMapped && "bg-purple-100 dark:bg-purple-900/30 ring-1 ring-purple-300 dark:ring-purple-700",
                        // Direct cell mapping - also solid purple
                        isCellMapped && "bg-purple-100 dark:bg-purple-900/30 ring-1 ring-purple-300 dark:ring-purple-700",
                        isSelectedCell && "ring-2 ring-primary ring-inset",
                        // Template preview highlighting - shows cells that WILL be auto-mapped when user is linked
                        isTemplatePreviewCell && "bg-amber-100/70 dark:bg-amber-900/40 ring-2 ring-amber-400 dark:ring-amber-600 ring-dashed",
                      )}
                      onClick={() => {
                        if (canSelectAsOwner && onFirstColClick) {
                          onFirstColClick(rowIndex, cellStr);
                        } else if (canMapCell) {
                          onCellClick(rowIndex, colIndex, cell, headers[colIndex] || "");
                        }
                      }}
                    >
                      {canSelectAsOwner ? (
                        <div className="flex items-center gap-1.5">
                          {isActiveOwnerRow ? (
                            <MousePointerClick className="h-3.5 w-3.5 text-green-600 dark:text-green-400 shrink-0" />
                          ) : isUserRowMapped ? (
                            <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400 shrink-0" />
                          ) : (
                            <User className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                          )}
                          <div className="flex flex-col min-w-0">
                            <span className={cn(
                              "truncate font-medium",
                              isActiveOwnerRow && "text-green-800 dark:text-green-300"
                            )}>
                              {formatCellValue(cell)}
                            </span>
                            {userInfo?.matchedProfileName && (
                              <span className={cn(
                                "text-[10px] truncate",
                                isActiveOwnerRow 
                                  ? "text-green-600 dark:text-green-400 font-medium" 
                                  : "text-green-700 dark:text-green-300"
                              )}>
                                → {userInfo.matchedProfileName}
                                {isActiveOwnerRow && " (active)"}
                              </span>
                            )}
                            {!isUserRowMapped && !isActiveOwnerRow && (
                              <span className="text-[10px] text-muted-foreground italic">
                                Click to select owner
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
                      ) : isTemplateMapped ? (
                        <div className="flex flex-col min-w-0">
                          <span className={cn(typeof cell === "number" && "font-mono")}>
                            {formatCellValue(cell)}
                          </span>
                          <span className="text-[10px] text-purple-700 dark:text-purple-300 truncate">
                            → {templateMapping.kpiName}
                            {templateMapping.rowOffset !== 0 && (
                              <span className="text-muted-foreground ml-1">(+{templateMapping.rowOffset})</span>
                            )}
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col min-w-0">
                          <span className={cn(
                            typeof cell === "number" && "font-mono"
                          )}>
                            {formatCellValue(cell)}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Sticky bottom scrollbar - portalled to body */}
      {showStickyScroll && createPortal(
        <div
          ref={stickyScrollRef}
          onScroll={handleStickyScroll}
          className="fixed bottom-0 overflow-x-auto overflow-y-hidden bg-background/95 backdrop-blur-sm border-t z-50"
          style={{
            left: containerLeft,
            width: containerWidth,
            height: 16,
          }}
        >
          <div style={{ width: contentWidth, height: 1 }} />
        </div>,
        document.body
      )}
    </div>
  );
};
