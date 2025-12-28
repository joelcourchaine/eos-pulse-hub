import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";

export interface CellMapping {
  id: string;
  brand: string;
  department_name: string;
  metric_key: string;
  sheet_name: string;
  cell_reference: string;
}

export interface ParsedDepartmentData {
  departmentName: string;
  departmentId: string;
  metrics: Record<string, number | null>;
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
 * Extract numeric value from a cell
 */
const extractNumericValue = (cell: XLSX.CellObject | undefined): number | null => {
  if (!cell) return null;
  if (typeof cell.v === 'number') return cell.v;
  if (typeof cell.v === 'string') {
    const parsed = parseFloat(cell.v.replace(/[,$%]/g, ''));
    return isNaN(parsed) ? null : parsed;
  }
  return null;
};

/**
 * Parse Excel file and extract data for all mapped departments
 */
export const parseFinancialExcel = (
  file: File,
  mappings: CellMapping[]
): Promise<Record<string, Record<string, number | null>>> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        
        // Group mappings by department
        const mappingsByDept = mappings.reduce((acc, mapping) => {
          if (!acc[mapping.department_name]) {
            acc[mapping.department_name] = [];
          }
          acc[mapping.department_name].push(mapping);
          return acc;
        }, {} as Record<string, CellMapping[]>);
        
        const result: Record<string, Record<string, number | null>> = {};
        
        for (const [deptName, deptMappings] of Object.entries(mappingsByDept)) {
          result[deptName] = {};
          
          for (const mapping of deptMappings) {
            const sheet = workbook.Sheets[mapping.sheet_name];
            if (!sheet) {
              console.warn(`Sheet "${mapping.sheet_name}" not found in workbook. Available sheets:`, workbook.SheetNames);
              result[deptName][mapping.metric_key] = null;
              continue;
            }
            
            const cellRef = parseCellReference(mapping.cell_reference);
            if (!cellRef) {
              console.warn(`Invalid cell reference: ${mapping.cell_reference}`);
              result[deptName][mapping.metric_key] = null;
              continue;
            }
            
            const cell = sheet[mapping.cell_reference];
            const extractedValue = extractNumericValue(cell);
            console.log(`[Excel Parse] ${deptName} - ${mapping.metric_key}: Cell ${mapping.cell_reference} on sheet ${mapping.sheet_name} = `, cell, '→ extracted:', extractedValue);
            result[deptName][mapping.metric_key] = extractedValue;
          }
        }
        
        resolve(result);
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
 */
export const validateAgainstDatabase = async (
  parsedData: Record<string, Record<string, number | null>>,
  departmentsByName: Record<string, string>, // department_name -> department_id
  monthIdentifier: string
): Promise<ValidationResult[]> => {
  const results: ValidationResult[] = [];
  
  for (const [deptName, metrics] of Object.entries(parsedData)) {
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
 */
export const importFinancialData = async (
  parsedData: Record<string, Record<string, number | null>>,
  departmentsByName: Record<string, string>,
  monthIdentifier: string,
  userId: string
): Promise<{ success: boolean; importedCount: number; error?: string }> => {
  let importedCount = 0;
  
  for (const [deptName, metrics] of Object.entries(parsedData)) {
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
  
  return { success: true, importedCount };
};
