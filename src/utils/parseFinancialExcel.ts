import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";

export interface CellMapping {
  id: string;
  brand: string;
  department_name: string;
  metric_key: string;
  sheet_name: string;
  cell_reference: string;
  // New fields for sub-metric support
  name_cell_reference?: string | null;
  parent_metric_key?: string | null;
  is_sub_metric?: boolean;
  effective_year?: number | null;
  // Unit count cell (e.g., number of vehicles sold)
  unit_cell_reference?: string | null;
}

export interface ParsedDepartmentData {
  departmentName: string;
  departmentId: string;
  metrics: Record<string, number | null>;
}

// Sub-metric data with dynamic name from Excel
export interface SubMetricData {
  parentMetricKey: string;
  name: string;
  value: number | null;
  orderIndex: number; // Preserves Excel row order
  unitValue?: number | null; // Unit count (e.g., vehicles sold)
}

export interface ValidationResult {
  departmentName: string;
  departmentId: string;
  status: 'match' | 'mismatch' | 'imported' | 'error';
  discrepancies?: Array<{
    metric: string;
    excelValue: number | null;
    dbValue: number | null;
  }>;
  error?: string;
}

/**
 * Fetch cell mappings for a specific brand
 */
export const fetchCellMappings = async (brand: string, year?: number): Promise<CellMapping[]> => {
  const { data, error } = await supabase
    .from('financial_cell_mappings')
    .select('*')
    .eq('brand', brand);

  if (error) {
    console.error('Error fetching cell mappings:', error);
    return [];
  }

  if (!data) return [];

  if (year) {
    // For each metric_key + department combo, prefer year-specific
    // mapping over NULL (universal) mapping
    const grouped = new Map<string, CellMapping[]>();
    for (const m of data) {
      const key = `${m.department_name}::${m.metric_key}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(m);
    }
    const result: CellMapping[] = [];
    for (const entries of grouped.values()) {
      const yearMatch = entries.find(e => e.effective_year === year);
      const universal = entries.find(e => e.effective_year === null);
      result.push(yearMatch || universal || entries[0]);
    }
    return result;
  }

  return data;
};

/**
 * Parse cell reference (e.g., "D6") into column and row
 */
const parseCellReference = (ref: string): { col: string; row: number } | null => {
  const match = ref.match(/^([A-Z]+)(\d+)$/i);
  if (!match) return null;
  return { col: match[1].toUpperCase(), row: parseInt(match[2], 10) };
};

/**
 * Parse a formula reference like "Nissan5!D70" or "Sheet1!A1"
 */
const parseFormulaReference = (formula: string): { sheet: string; cell: string } | null => {
  // Match patterns like "SheetName!CellRef" or "'Sheet Name'!CellRef"
  const match = formula.match(/^'?([^'!]+)'?!([A-Z]+\d+)$/i);
  if (!match) return null;
  return { sheet: match[1], cell: match[2].toUpperCase() };
};

/**
 * Extract numeric value from a cell, following simple formula references to get the source value
 */
const extractNumericValue = (
  cell: XLSX.CellObject | undefined,
  workbook: XLSX.WorkBook
): number | null => {
  if (!cell) return null;

  const parseNumeric = (raw: unknown): number | null => {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'number') return raw;
    if (typeof raw === 'string') {
      const cleaned = raw.replace(/[,$%\s]/g, '');
      if (!cleaned) return null;
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  };

  // If cell has a formula that's a simple cell reference, follow it to get the source value
  if (cell.f && typeof cell.f === 'string') {
    const ref = parseFormulaReference(cell.f);
    if (ref) {
      const refSheet = workbook.Sheets[ref.sheet];
      if (refSheet) {
        const refCell = refSheet[ref.cell] as XLSX.CellObject | undefined;
        if (refCell) {
          console.log(`[Excel Parse] Following formula ${cell.f} → ${ref.sheet}!${ref.cell} = `, refCell.v ?? refCell.w);
          return parseNumeric(refCell.v ?? refCell.w);
        }
      } else {
        console.warn(`[Excel Parse] Sheet "${ref.sheet}" not found for formula ${cell.f}`);
      }
    } else {
      // We cannot evaluate complex formulas in-browser; rely on cached value if present.
      console.log(`[Excel Parse] Non-reference formula in cell; using cached value if present:`, cell.f);
    }
  }

  // Prefer the cached raw value, then formatted string (w) when v is missing.
  return parseNumeric((cell as any).v ?? (cell as any).w);
};

/**
 * Extract string value from a cell (for reading metric names)
 */
const extractStringValue = (
  cell: XLSX.CellObject | undefined
): string | null => {
  if (!cell) return null;
  if (typeof cell.v === 'string') return cell.v.trim();
  if (typeof cell.v === 'number') return String(cell.v);
  return null;
};

/**
 * Result type for parseFinancialExcel that includes sub-metrics
 */
export interface ParsedFinancialData {
  metrics: Record<string, Record<string, number | null>>;
  subMetrics: Record<string, SubMetricData[]>; // keyed by department name
}

/**
 * Parse Excel file and extract data for all mapped departments
 * Now also extracts sub-metrics with dynamic names from Excel
 */
export const parseFinancialExcel = (
  file: File,
  mappings: CellMapping[]
): Promise<ParsedFinancialData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(new Uint8Array(data as ArrayBuffer), { type: 'array' });
        
        console.log('[Excel Parse] Available sheets:', workbook.SheetNames);
        console.log('[Excel Parse] Total mappings:', mappings.length);
        
        // Separate regular mappings from sub-metric mappings
        const regularMappings = mappings.filter(m => !m.is_sub_metric);
        const subMetricMappings = mappings.filter(m => m.is_sub_metric);
        
        console.log('[Excel Parse] Regular mappings:', regularMappings.length, ', Sub-metric mappings:', subMetricMappings.length);
        
        // Group regular mappings by department
        const mappingsByDept = regularMappings.reduce((acc, mapping) => {
          if (!acc[mapping.department_name]) {
            acc[mapping.department_name] = [];
          }
          acc[mapping.department_name].push(mapping);
          return acc;
        }, {} as Record<string, CellMapping[]>);
        
        const result: Record<string, Record<string, number | null>> = {};
        const subMetricsResult: Record<string, SubMetricData[]> = {};
        
        // Process regular metrics
        for (const [deptName, deptMappings] of Object.entries(mappingsByDept)) {
          result[deptName] = {};
          
          for (const mapping of deptMappings) {
            // Prefer the mapped sheet name, but fall back to the first sheet (helps with CSV exports)
            const sheet = workbook.Sheets[mapping.sheet_name] || workbook.Sheets[workbook.SheetNames[0]];
            if (!sheet) {
              console.warn(`No sheets found in workbook. Available sheets:`, workbook.SheetNames);
              result[deptName][mapping.metric_key] = null;
              continue;
            }
            if (!workbook.Sheets[mapping.sheet_name]) {
              console.warn(`Sheet "${mapping.sheet_name}" not found; using "${workbook.SheetNames[0]}" instead.`);
            }
            
            const cellRef = parseCellReference(mapping.cell_reference);
            if (!cellRef) {
              console.warn(`Invalid cell reference: ${mapping.cell_reference}`);
              result[deptName][mapping.metric_key] = null;
              continue;
            }
            
            // Excel cell references must be uppercase (e.g., "BC41" not "bc41")
            const uppercaseCellRef = mapping.cell_reference.toUpperCase();
            const cell = sheet[uppercaseCellRef] as XLSX.CellObject | undefined;
            const extractedValue = extractNumericValue(cell, workbook);
            console.log(
              `[Excel Parse] ${deptName} - ${mapping.metric_key}: Sheet ${mapping.sheet_name} Cell ${uppercaseCellRef} ` +
                `v=${(cell as any)?.v}, w=${(cell as any)?.w}, f=${(cell as any)?.f} → extracted: ${extractedValue}`
            );
            result[deptName][mapping.metric_key] = extractedValue;
          }
        }
        
        // Process sub-metrics (grouped by department)
        const subMetricsByDept = subMetricMappings.reduce((acc, mapping) => {
          if (!acc[mapping.department_name]) {
            acc[mapping.department_name] = [];
          }
          acc[mapping.department_name].push(mapping);
          return acc;
        }, {} as Record<string, CellMapping[]>);
        
        for (const [deptName, deptSubMappings] of Object.entries(subMetricsByDept)) {
          subMetricsResult[deptName] = [];
          console.log(`[Excel Parse Sub] Processing ${deptSubMappings.length} sub-metric mappings for ${deptName}`);
          
          // Sort by cell_reference row number to preserve Excel spreadsheet order
          // This ensures sub-metrics appear in the same order as the original statement
          const getRowFromCellRef = (ref: string): number => {
            const match = ref.match(/\d+$/);
            return match ? parseInt(match[0], 10) : 9999;
          };
          const sortedMappings = [...deptSubMappings].sort((a, b) => {
            // First sort by sheet name to group by sheet
            const sheetCmp = a.sheet_name.localeCompare(b.sheet_name);
            if (sheetCmp !== 0) return sheetCmp;
            // Then sort by cell row number within the sheet
            return getRowFromCellRef(a.cell_reference) - getRowFromCellRef(b.cell_reference);
          });
          
          // Extract order index from the metric_key if it has an explicit order number.
          // metric_key format: "sub:parent_key:order" (3 parts) e.g., "sub:total_sales:01"
          // or with name: "sub:parent_key:order:Name" (4+ parts) e.g., "sub:total_sales:001:Repair Shop"
          // Fallback uses incrementing index based on cell_reference row order (spreadsheet order).
          let fallbackOrderIndex = 0;
          const extractOrderFromMetricKey = (metricKey: string): number => {
            const parts = metricKey.split(':');
            // Format with 3 parts: sub:parent:order (e.g., "sub:total_sales:01")
            if (parts.length === 3) {
              const orderPart = parts[2];
              const parsed = parseInt(orderPart, 10);
              if (!isNaN(parsed)) return parsed;
            }
            // Format with 4+ parts: sub:parent:order:name (e.g., "sub:total_sales:001:Repair Shop")
            if (parts.length >= 4) {
              const orderPart = parts[2];
              const parsed = parseInt(orderPart, 10);
              if (!isNaN(parsed)) return parsed;
            }
            return fallbackOrderIndex++;
          };

          for (const mapping of sortedMappings) {
            // Try exact match first, then case-insensitive match, then fall back to first sheet
            let sheet = workbook.Sheets[mapping.sheet_name];
            let actualSheetName = mapping.sheet_name;

            if (!sheet) {
              // Try case-insensitive match
              const sheetNameLower = mapping.sheet_name.toLowerCase();
              const foundSheetName = workbook.SheetNames.find(
                s => s.toLowerCase() === sheetNameLower
              );
              if (foundSheetName) {
                sheet = workbook.Sheets[foundSheetName];
                actualSheetName = foundSheetName;
                console.log(`[Excel Parse Sub] Sheet "${mapping.sheet_name}" matched (case-insensitive) to "${foundSheetName}"`);
              } else {
                // Fall back to first sheet
                sheet = workbook.Sheets[workbook.SheetNames[0]];
                actualSheetName = workbook.SheetNames[0];
                console.warn(`[Excel Parse Sub] Sheet "${mapping.sheet_name}" not found; using "${actualSheetName}" instead. Available sheets:`, workbook.SheetNames);
              }
            }

            if (!sheet) {
              console.warn(`[Excel Parse Sub] No sheets found in workbook.`);
              continue;
            }

            // Extract order index from the metric_key in the mapping
            const orderIndex = extractOrderFromMetricKey(mapping.metric_key);

            // Read the metric name from name_cell_reference OR extract from metric_key
            let metricName: string | null = null;
            if (mapping.name_cell_reference) {
              // Uppercase the cell reference for Excel lookup
              const upperNameCellRef = mapping.name_cell_reference.toUpperCase();
              const nameCell = sheet[upperNameCellRef];
              metricName = extractStringValue(nameCell);
              console.log(`[Excel Parse Sub] ${deptName} - Name cell ${upperNameCellRef}: "${metricName}" (cell exists: ${!!nameCell})`);
            }

            // If no name_cell_reference or it returned garbage (single char), extract name from metric_key
            // metric_key format: "sub:parent_key:order:Name" e.g., "sub:total_sales:01:Repair Shop"
            // or legacy format: "sub:parent_key:Name" e.g., "sub:total_sales:Repair Shop"
            if (!metricName || metricName.length <= 2) {
              const parts = mapping.metric_key.split(':');
              if (parts.length >= 4) {
                // New format with order: sub:parent:order:name - take everything after the 3rd colon
                metricName = parts.slice(3).join(':');
                console.log(`[Excel Parse Sub] ${deptName} - Using name from metric_key (with order): "${metricName}"`);
              } else if (parts.length >= 3) {
                // Legacy format: sub:parent:name - take everything after the 2nd colon
                metricName = parts.slice(2).join(':');
                console.log(`[Excel Parse Sub] ${deptName} - Using name from metric_key (legacy): "${metricName}"`);
              }
            }

            // Read the value from cell_reference (uppercase for Excel lookup)
            const upperValueCellRef = mapping.cell_reference.toUpperCase();
            const valueCell = sheet[upperValueCellRef];
            let value = extractNumericValue(valueCell, workbook);
            
            // For percentage sub-metrics (gp_percent), Excel stores as decimals (0.28 = 28%)
            // Convert to percentage format (multiply by 100) if value is in decimal range
            if (value !== null && mapping.parent_metric_key === 'gp_percent' && Math.abs(value) <= 1) {
              value = value * 100;
              console.log(`[Excel Parse Sub] ${deptName} - Converted gp_percent from decimal ${value/100} to ${value}%`);
            }
            
            console.log(`[Excel Parse Sub] ${deptName} - Sheet "${actualSheetName}" Cell ${upperValueCellRef}: v=${(valueCell as any)?.v}, w=${(valueCell as any)?.w}, extracted=${value}`);

            // Read unit value if unit_cell_reference is present
            let unitValue: number | null = null;
            if (mapping.unit_cell_reference) {
              const upperUnitCellRef = mapping.unit_cell_reference.toUpperCase();
              const unitCell = sheet[upperUnitCellRef];
              unitValue = extractNumericValue(unitCell, workbook);
              console.log(`[Excel Parse Sub] ${deptName} - Unit cell ${upperUnitCellRef}: ${unitValue}`);
            }

            // Only include if we have both a name and the parent key
            if (metricName && mapping.parent_metric_key) {
              subMetricsResult[deptName].push({
                parentMetricKey: mapping.parent_metric_key,
                name: metricName,
                value: value,
                orderIndex,
                unitValue,
              });
              console.log(`[Excel Parse Sub] Added sub-metric [${orderIndex}]: ${mapping.parent_metric_key} -> "${metricName}" = ${value}${unitValue !== null ? ` (units: ${unitValue})` : ''}`);
            } else {
              console.log(`[Excel Parse Sub] Skipped: metricName="${metricName}", parent_metric_key="${mapping.parent_metric_key}"`);
            }
          }
        }
        
        resolve({ metrics: result, subMetrics: subMetricsResult });
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Validate parsed Excel data against existing database entries
 * Now accepts ParsedFinancialData structure
 */
export const validateAgainstDatabase = async (
  parsedData: ParsedFinancialData,
  departmentsByName: Record<string, string>, // department_name -> department_id
  monthIdentifier: string
): Promise<ValidationResult[]> => {
  const results: ValidationResult[] = [];
  
  for (const [deptName, metrics] of Object.entries(parsedData.metrics)) {
    const departmentId = departmentsByName[deptName];
    if (!departmentId) {
      results.push({
        departmentName: deptName,
        departmentId: '',
        status: 'error',
        error: `Department "${deptName}" not found in store`,
      });
      continue;
    }
    
    // Fetch existing entries for this department and month
    const { data: existingEntries, error } = await supabase
      .from('financial_entries')
      .select('metric_name, value')
      .eq('department_id', departmentId)
      .eq('month', monthIdentifier);
    
    if (error) {
      results.push({
        departmentName: deptName,
        departmentId,
        status: 'error',
        error: error.message,
      });
      continue;
    }
    
    const existingMap: Record<string, number | null> = {};
    existingEntries?.forEach(entry => {
      existingMap[entry.metric_name] = entry.value;
    });
    
    // Check if any data exists for the metrics we're importing
    const hasExistingData = Object.keys(metrics).some(
      metricKey => existingMap[metricKey] !== undefined && existingMap[metricKey] !== null
    );
    
    if (!hasExistingData) {
      // No existing data - will be imported
      results.push({
        departmentName: deptName,
        departmentId,
        status: 'imported',
      });
    } else {
      // Compare values
      const discrepancies: ValidationResult['discrepancies'] = [];
      
      for (const [metricKey, excelValue] of Object.entries(metrics)) {
        const dbValue = existingMap[metricKey] ?? null;
        
        // Compare with $1 tolerance
        const excelRounded = excelValue !== null ? Math.round(excelValue * 100) / 100 : null;
        const dbRounded = dbValue !== null ? Math.round(dbValue * 100) / 100 : null;
        
        const isMatch = (excelRounded === null && dbRounded === null) ||
          (excelRounded !== null && dbRounded !== null && Math.abs(excelRounded - dbRounded) <= 1);
        
        if (!isMatch) {
          discrepancies.push({
            metric: metricKey,
            excelValue: excelRounded,
            dbValue: dbRounded,
          });
        }
      }
      
      results.push({
        departmentName: deptName,
        departmentId,
        status: discrepancies.length > 0 ? 'mismatch' : 'match',
        discrepancies: discrepancies.length > 0 ? discrepancies : undefined,
      });
    }
  }
  
  return results;
};

/**
 * Convert Ford YTD sub-metric values to monthly values
 * Ford financial statements display YTD totals, so we need to subtract the previous month's YTD
 */
const convertFordYTDToMonthly = async (
  departmentId: string,
  monthIdentifier: string,
  ytdSubMetrics: SubMetricData[],
  parentMetricKey: string
): Promise<{ monthlySubMetrics: SubMetricData[]; ytdEntries: Array<{ metric_name: string; value: number | null }> }> => {
  const [year, month] = monthIdentifier.split('-').map(Number);
  
  // Store the YTD values for reference (ytd:parent:order:name format)
  const ytdEntries = ytdSubMetrics.map(sm => ({
    metric_name: `ytd:${parentMetricKey}:${String(sm.orderIndex).padStart(3, '0')}:${sm.name}`,
    value: sm.value,
  }));
  
  // January - YTD equals monthly (no previous month to subtract)
  if (month === 1) {
    console.log('[Ford YTD] January detected - using YTD values as monthly values');
    return { monthlySubMetrics: ytdSubMetrics, ytdEntries };
  }
  
  // Calculate previous month identifier
  const prevMonth = month - 1;
  const prevYear = prevMonth === 0 ? year - 1 : year;
  const actualPrevMonth = prevMonth === 0 ? 12 : prevMonth;
  const prevMonthId = `${prevYear}-${String(actualPrevMonth).padStart(2, '0')}`;
  
  console.log(`[Ford YTD] Converting ${monthIdentifier} - fetching previous YTD from ${prevMonthId}`);
  
  // Fetch previous month's YTD values from database
  const { data: prevYTDEntries, error } = await supabase
    .from('financial_entries')
    .select('metric_name, value')
    .eq('department_id', departmentId)
    .eq('month', prevMonthId)
    .like('metric_name', `ytd:${parentMetricKey}:%`);
  
  if (error) {
    console.error('[Ford YTD] Error fetching previous YTD:', error);
    // Fall back to using YTD as monthly if we can't get previous month
    return { monthlySubMetrics: ytdSubMetrics, ytdEntries };
  }
  
  // Build lookup map from previous YTD entries
  const prevYTDMap = new Map<string, number | null>();
  prevYTDEntries?.forEach(entry => {
    // Extract the name from the metric_name (ytd:parent:order:name -> name)
    const parts = entry.metric_name.split(':');
    if (parts.length >= 4) {
      const name = parts.slice(3).join(':');
      prevYTDMap.set(name, entry.value);
    }
  });
  
  console.log(`[Ford YTD] Found ${prevYTDMap.size} previous YTD entries for subtraction`);
  
  // Convert each sub-metric: monthly = current_ytd - previous_ytd
  const monthlySubMetrics = ytdSubMetrics.map(sm => {
    const prevYTD = prevYTDMap.get(sm.name) ?? 0;
    const monthlyValue = (sm.value ?? 0) - prevYTD;
    console.log(`[Ford YTD] ${sm.name}: ${sm.value} (YTD) - ${prevYTD} (prev YTD) = ${monthlyValue} (monthly)`);
    return {
      ...sm,
      value: monthlyValue,
    };
  });
  
  return { monthlySubMetrics, ytdEntries };
};

/**
 * Import parsed Excel data into the database
 * Now also imports sub-metrics - OPTIMIZED with batch operations
 * Ford brand sub-metrics are converted from YTD to monthly values
 */
export const importFinancialData = async (
  parsedData: ParsedFinancialData,
  departmentsByName: Record<string, string>,
  monthIdentifier: string,
  userId: string,
  brand?: string
): Promise<{ success: boolean; importedCount: number; error?: string }> => {
  let importedCount = 0;
  const errors: string[] = [];

  // Build batch arrays for regular metrics
  const regularEntries: Array<{
    department_id: string;
    month: string;
    metric_name: string;
    value: number;
    created_by: string;
  }> = [];

  console.log('[Excel Import] departmentsByName keys:', Object.keys(departmentsByName));
  console.log('[Excel Import] parsedData.metrics keys:', Object.keys(parsedData.metrics));
  
  for (const [deptName, metrics] of Object.entries(parsedData.metrics)) {
    const departmentId = departmentsByName[deptName];
    console.log(`[Excel Import] Looking up dept "${deptName}" -> found: ${departmentId || 'NOT FOUND'}`);
    if (!departmentId) continue;

    for (const [metricKey, value] of Object.entries(metrics)) {
      if (value === null) continue;
      regularEntries.push({
        department_id: departmentId,
        month: monthIdentifier,
        metric_name: metricKey,
        value,
        created_by: userId,
      });
    }
  }

  // Batch upsert regular metrics (single DB call)
  console.log('[Excel Import] Regular entries to upsert:', regularEntries.length, regularEntries);
  if (regularEntries.length > 0) {
    const { error, data } = await supabase
      .from('financial_entries')
      .upsert(regularEntries, {
        onConflict: 'department_id,month,metric_name',
      })
      .select();

    if (error) {
      console.error('Error batch upserting financial entries:', error);
      errors.push(`Regular metrics upsert failed: ${error.message}`);
    } else {
      console.log('[Excel Import] Upserted regular entries:', data?.length);
      importedCount += regularEntries.length;
    }
  }

  // Import sub-metrics with their dynamic names
  // For Ford brand, convert YTD values to monthly values
  const deptIdsWithSubMetrics = new Set<string>();
  const subMetricEntries: Array<{
    department_id: string;
    month: string;
    metric_name: string;
    value: number | null;
    created_by: string;
  }> = [];
  const ytdEntriesToStore: Array<{
    department_id: string;
    month: string;
    metric_name: string;
    value: number | null;
    created_by: string;
  }> = [];

  const isFord = brand?.toLowerCase() === 'ford';
  console.log(`[Excel Import] Processing sub-metrics. Brand: ${brand}, isFord: ${isFord}`);

  for (const [deptName, subMetrics] of Object.entries(parsedData.subMetrics)) {
    const departmentId = departmentsByName[deptName];
    if (!departmentId || subMetrics.length === 0) continue;

    deptIdsWithSubMetrics.add(departmentId);

    // Group sub-metrics by parent key for Ford YTD conversion
    const subMetricsByParent = new Map<string, SubMetricData[]>();
    for (const sm of subMetrics) {
      if (!subMetricsByParent.has(sm.parentMetricKey)) {
        subMetricsByParent.set(sm.parentMetricKey, []);
      }
      subMetricsByParent.get(sm.parentMetricKey)!.push(sm);
    }

    for (const [parentKey, parentSubMetrics] of subMetricsByParent) {
      let processedSubMetrics = parentSubMetrics;

      // For Ford brand and total_fixed_expense, convert YTD to monthly
      if (isFord && parentKey === 'total_fixed_expense') {
        console.log(`[Excel Import] Ford total_fixed_expense detected - converting YTD to monthly for ${deptName}`);
        const { monthlySubMetrics, ytdEntries } = await convertFordYTDToMonthly(
          departmentId,
          monthIdentifier,
          parentSubMetrics,
          parentKey
        );
        processedSubMetrics = monthlySubMetrics;

        // Store YTD entries for reference/auditing
        for (const ytdEntry of ytdEntries) {
          ytdEntriesToStore.push({
            department_id: departmentId,
            month: monthIdentifier,
            metric_name: ytdEntry.metric_name,
            value: ytdEntry.value,
            created_by: userId,
          });
        }
      }

      // Add processed sub-metrics to entries
      for (const subMetric of processedSubMetrics) {
        const metricName = `sub:${subMetric.parentMetricKey}:${String(subMetric.orderIndex).padStart(3, '0')}:${subMetric.name}`;
        const normalizedValue = subMetric.value;
        subMetricEntries.push({
          department_id: departmentId,
          month: monthIdentifier,
          metric_name: metricName,
          value: normalizedValue,
          created_by: userId,
        });

        // Store unit value if present
        if (subMetric.unitValue !== null && subMetric.unitValue !== undefined) {
          const unitMetricName = `units:${subMetric.parentMetricKey}:${String(subMetric.orderIndex).padStart(3, '0')}:${subMetric.name}`;
          subMetricEntries.push({
            department_id: departmentId,
            month: monthIdentifier,
            metric_name: unitMetricName,
            value: subMetric.unitValue,
            created_by: userId,
          });
        }
      }
    }
  }

  // Only delete and insert sub-metrics for departments that have NEW entries to insert
  // This prevents data loss when parsing fails to find sub-metrics in the Excel file
  if (subMetricEntries.length > 0) {
    // Group entries by department
    const entriesByDept = new Map<string, typeof subMetricEntries>();
    for (const entry of subMetricEntries) {
      if (!entriesByDept.has(entry.department_id)) {
        entriesByDept.set(entry.department_id, []);
      }
      entriesByDept.get(entry.department_id)!.push(entry);
    }

    // For each department with new entries, delete old and insert new atomically
    for (const [deptId, entries] of entriesByDept) {
      // Delete existing sub-metrics and unit entries for this dept/month
      const { error: deleteError } = await supabase
        .from('financial_entries')
        .delete()
        .eq('department_id', deptId)
        .eq('month', monthIdentifier)
        .or('metric_name.like.sub:%,metric_name.like.units:%');

      if (deleteError) {
        console.error('Error deleting sub-metrics for dept:', deptId, deleteError);
        errors.push(`Sub-metric delete failed for dept ${deptId}: ${deleteError.message}`);
        continue;
      }

      // Insert new sub-metrics for this department
      const { error: insertError } = await supabase
        .from('financial_entries')
        .insert(entries);

      if (insertError) {
        console.error('Error inserting sub-metrics for dept:', deptId, insertError);
        errors.push(`Sub-metrics insert failed for dept ${deptId}: ${insertError.message}`);
      } else {
        importedCount += entries.length;
      }
    }
  } else {
    // No sub-metrics parsed - preserve existing data (don't delete anything)
    console.log('[Excel Import] No sub-metrics parsed from Excel - existing sub-metric data preserved');
  }

  // Store YTD entries for Ford (for future months' conversion)
  if (ytdEntriesToStore.length > 0) {
    console.log(`[Excel Import] Storing ${ytdEntriesToStore.length} YTD entries for Ford`);
    
    // Delete existing YTD entries first
    const deptIds = [...new Set(ytdEntriesToStore.map(e => e.department_id))];
    for (const deptId of deptIds) {
      await supabase
        .from('financial_entries')
        .delete()
        .eq('department_id', deptId)
        .eq('month', monthIdentifier)
        .like('metric_name', 'ytd:%');
    }

    // Insert new YTD entries
    const { error: ytdError } = await supabase
      .from('financial_entries')
      .insert(ytdEntriesToStore);

    if (ytdError) {
      console.error('Error storing YTD entries:', ytdError);
      errors.push(`YTD entries insert failed: ${ytdError.message}`);
    } else {
      importedCount += ytdEntriesToStore.length;
    }
  }

  if (errors.length > 0) {
    return { success: false, importedCount, error: errors.join(' | ') };
  }

  return { success: true, importedCount };
};
