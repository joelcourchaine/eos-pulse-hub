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
export const fetchCellMappings = async (brand: string): Promise<CellMapping[]> => {
  const { data, error } = await supabase
    .from('financial_cell_mappings')
    .select('*')
    .eq('brand', brand);

  if (error) {
    console.error('Error fetching cell mappings:', error);
    return [];
  }

  return data || [];
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
  
  // If cell has a formula that's a simple cell reference, follow it to get the source value
  if (cell.f && typeof cell.f === 'string') {
    const ref = parseFormulaReference(cell.f);
    if (ref) {
      const refSheet = workbook.Sheets[ref.sheet];
      if (refSheet) {
        const refCell = refSheet[ref.cell] as XLSX.CellObject | undefined;
        if (refCell) {
          console.log(`[Excel Parse] Following formula ${cell.f} → ${ref.sheet}!${ref.cell} = `, refCell.v);
          if (typeof refCell.v === 'number') return refCell.v;
          if (typeof refCell.v === 'string') {
            const parsed = parseFloat(refCell.v.replace(/[,$%]/g, ''));
            return isNaN(parsed) ? null : parsed;
          }
        }
      } else {
        console.warn(`[Excel Parse] Sheet "${ref.sheet}" not found for formula ${cell.f}`);
      }
    }
  }
  
  // Fall back to the cell's own value
  if (typeof cell.v === 'number') return cell.v;
  if (typeof cell.v === 'string') {
    const parsed = parseFloat(cell.v.replace(/[,$%]/g, ''));
    return isNaN(parsed) ? null : parsed;
  }
  return null;
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
        const workbook = XLSX.read(data, { type: 'binary' });
        
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
            
            const cell = sheet[mapping.cell_reference];
            const extractedValue = extractNumericValue(cell, workbook);
            console.log(`[Excel Parse] ${deptName} - ${mapping.metric_key}: Cell ${mapping.cell_reference} on sheet ${mapping.sheet_name} → extracted: ${extractedValue}`);
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
          
          // Sort by metric_key to preserve order (e.g., total_sales_sub_1, total_sales_sub_2, ...)
          const sortedMappings = [...deptSubMappings].sort((a, b) => 
            a.metric_key.localeCompare(b.metric_key, undefined, { numeric: true })
          );
          
          let orderIndex = 0;
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
            
            // Read the metric name from name_cell_reference OR extract from metric_key
            let metricName: string | null = null;
            if (mapping.name_cell_reference) {
              const nameCell = sheet[mapping.name_cell_reference];
              metricName = extractStringValue(nameCell);
              console.log(`[Excel Parse Sub] ${deptName} - Name cell ${mapping.name_cell_reference}: "${metricName}" (cell exists: ${!!nameCell})`);
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
            
            // Read the value from cell_reference
            const valueCell = sheet[mapping.cell_reference];
            const value = extractNumericValue(valueCell, workbook);
            console.log(`[Excel Parse Sub] ${deptName} - Value cell ${mapping.cell_reference}: ${value} (cell exists: ${!!valueCell})`);
            
            // Only include if we have both a name and the parent key
            if (metricName && mapping.parent_metric_key) {
              subMetricsResult[deptName].push({
                parentMetricKey: mapping.parent_metric_key,
                name: metricName,
                value: value,
                orderIndex: orderIndex,
              });
              console.log(`[Excel Parse Sub] Added sub-metric [${orderIndex}]: ${mapping.parent_metric_key} -> "${metricName}" = ${value}`);
              orderIndex++;
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
    reader.readAsBinaryString(file);
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
 * Import parsed Excel data into the database
 * Now also imports sub-metrics
 */
export const importFinancialData = async (
  parsedData: ParsedFinancialData,
  departmentsByName: Record<string, string>,
  monthIdentifier: string,
  userId: string
): Promise<{ success: boolean; importedCount: number; error?: string }> => {
  let importedCount = 0;
  
  // Import regular metrics
  for (const [deptName, metrics] of Object.entries(parsedData.metrics)) {
    const departmentId = departmentsByName[deptName];
    if (!departmentId) continue;
    
    for (const [metricKey, value] of Object.entries(metrics)) {
      if (value === null) continue;
      
      const { error } = await supabase
        .from('financial_entries')
        .upsert({
          department_id: departmentId,
          month: monthIdentifier,
          metric_name: metricKey,
          value: value,
          created_by: userId,
        }, {
          onConflict: 'department_id,month,metric_name'
        });
      
      if (error) {
        console.error('Error upserting financial entry:', error);
      } else {
        importedCount++;
      }
    }
  }
  
  // Import sub-metrics with their dynamic names
  // We store them with a special naming convention: sub:{parent_key}:{name}
  for (const [deptName, subMetrics] of Object.entries(parsedData.subMetrics)) {
    const departmentId = departmentsByName[deptName];
    if (!departmentId) continue;
    
    for (const subMetric of subMetrics) {
      // Import even when value is null so the sub-metric name still appears in the UI.
      // This helps catch missing/blank cells (e.g., formula cells without cached values).

      // Create a metric name that includes the parent key, order index, and sub-metric name
      // Format: sub:{parent_key}:{order_index}:{name}
      // This allows us to group and sort them when displaying
      const metricName = `sub:${subMetric.parentMetricKey}:${String(subMetric.orderIndex).padStart(3, '0')}:${subMetric.name}`;

      const { error } = await supabase
        .from('financial_entries')
        .upsert(
          {
            department_id: departmentId,
            month: monthIdentifier,
            metric_name: metricName,
            value: subMetric.value,
            created_by: userId,
          },
          {
            onConflict: 'department_id,month,metric_name',
          }
        );

      if (error) {
        console.error('Error upserting sub-metric entry:', error);
      } else {
        importedCount++;
      }
    }
  }
  
  return { success: true, importedCount };
};
