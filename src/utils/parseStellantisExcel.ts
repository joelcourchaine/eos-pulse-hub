import * as XLSX from "xlsx";
import type { ParsedFinancialData, SubMetricData } from "./parseFinancialExcel";

/**
 * Stellantis account code to metric mapping
 * Account codes end with M (Monthly) or Y (YTD)
 * The prefix indicates department:
 * - N/NEW = New Vehicle
 * - U/USED = Used Vehicle  
 * - S/SERVICE = Mechanical/Service
 * - P/PARTS = Parts
 * - B/BODY = Body Shop
 */

// Department prefix patterns
const DEPARTMENT_PREFIXES: Record<string, string> = {
  // New Vehicle
  'EXPN': 'New Vehicle Department',
  'SALESN': 'New Vehicle Department',
  'COSTN': 'New Vehicle Department',
  'NEW': 'New Vehicle Department',
  // Used Vehicle
  'EXPU': 'Used Vehicle Department',
  'SALESU': 'Used Vehicle Department',
  'COSTU': 'Used Vehicle Department',
  // Service/Mechanical
  'EXPS': 'Service Department',
  'SALESS': 'Service Department',
  'COSTS': 'Service Department',
  'SERVICE': 'Service Department',
  // Parts
  'EXPP': 'Parts Department',
  'SALESP': 'Parts Department',
  'COSTP': 'Parts Department',
  'PARTS': 'Parts Department',
  // Body Shop
  'EXPB': 'Body Shop Department',
  'BODY': 'Body Shop Department',
  'COSTF': 'Body Shop Department', // Fixed costs - body
};

// Metric code mappings - maps account codes to our metric keys
// Format: { codeNumber: { metricKey: string, isFixedExpenseSub?: boolean, subMetricName?: string } }
interface MetricMapping {
  metricKey: string;
  isFixedExpenseSub?: boolean;
  subMetricName?: string;
}

// Fixed expense sub-metric mappings (expense codes 37-55 for each department)
const FIXED_EXPENSE_CODES: Record<number, string> = {
  37: 'SALARIES & WAGES - ADMIN & GENERAL',
  38: 'EMPLOYEE BENEFITS',
  39: 'PAYROLL TAXES',
  40: 'ADVERTISING GENERAL & INSTITUTIONAL',
  41: 'STATIONARY, OFFICE SUPPLIES & POSTAGE',
  42: 'LEGAL AUDITING, COLLECTION',
  43: 'COMPANY CAR EXPENSE',
  44: 'DUES, SUBSCRIPTIONS & CONTRIBUTIONS',
  45: 'DATA PROCESSING SERVICES / E-TOOLS',
  46: 'TRAVEL & ENTERTAINMENT',
  47: 'BAD DEBTS',
  48: 'MISCELLANEOUS',
  50: 'MAINTENANCE & REPAIRS - REAL ESTATE',
  51: 'INTEREST',
  52: 'INSURANCE, TAXES & LICENCES',
  54: 'HEAT, LIGHT, POWER & WATER',
  55: 'TELEPHONE',
};

// Main metric account codes (from Page 7 of the statement)
const MAIN_METRIC_CODES: Record<string, Record<string, string>> = {
  // New Vehicle Department
  'New Vehicle Department': {
    'P04': 'total_sales',           // Total Department Sales
    'R19': 'gp_net',                // Total Department Gross Profit  
    'K05': 'total_variable_expense', // Total Variable Sales Expense
    'K13': 'total_semi_fixed_expense', // Total Semi-Fixed Sales Expense
    'K14': 'department_profit',     // Net Department Profit (before fixed)
    'E791': 'fixed_expense',        // Total Department Fixed Expense
    'E821': 'net',                  // Department Profit/Loss (after fixed)
  },
  // Used Vehicle Department
  'Used Vehicle Department': {
    'P13': 'total_sales',
    'S09': 'gp_net',
    'K20': 'total_variable_expense',
    'L04': 'total_semi_fixed_expense',
    'L05': 'department_profit',
    'E792': 'fixed_expense',
    'E822': 'net',
  },
  // Service/Mechanical Department  
  'Service Department': {
    'P04': 'total_sales',           // Note: Same code, different context
    'X11': 'gp_net',
    'L14': 'total_variable_expense', // Actually "Total Sales Expense"
    'L15': 'department_profit',      // Net Department Profit (before fixed)
    'E793': 'fixed_expense',
    'E823': 'net',
  },
  // Parts Department
  'Parts Department': {
    'W23': 'total_sales',
    'Y10': 'gp_net',
    'L24': 'total_variable_expense',
    'M01': 'department_profit',
    'E794': 'fixed_expense',
    'E824': 'net',
  },
  // Body Shop Department
  'Body Shop Department': {
    'W11': 'total_sales',
    'X19': 'gp_net',
    'J21': 'total_variable_expense',
    'J22': 'department_profit',
    'E795': 'fixed_expense',
    'E825': 'net',
  },
};

// Fixed expense cell codes per department (E6xx pattern where last digit is department)
const FIXED_EXPENSE_CELL_CODES: Record<string, Record<string, number>> = {
  'New Vehicle Department': {
    'E601': 37, 'E611': 38, 'E621': 39, 'E631': 40, 'E641': 41,
    'E651': 42, 'E661': 43, 'E671': 44, 'E681': 45, 'E691': 46,
    'E701': 47, 'E711': 48, 'E721': 49, 'E731': 50, 'E741': 51,
    'E751': 52, 'E761': 53, 'E771': 54, 'E781': 55,
  },
  'Used Vehicle Department': {
    'E602': 37, 'E612': 38, 'E622': 39, 'E632': 40, 'E642': 41,
    'E652': 42, 'E662': 43, 'E672': 44, 'E682': 45, 'E692': 46,
    'E702': 47, 'E712': 48, 'E722': 49, 'E732': 50, 'E742': 51,
    'E752': 52, 'E762': 53, 'E772': 54, 'E782': 55,
  },
  'Service Department': {
    'E603': 37, 'E613': 38, 'E623': 39, 'E633': 40, 'E643': 41,
    'E653': 42, 'E663': 43, 'E673': 44, 'E683': 45, 'E693': 46,
    'E703': 47, 'E713': 48, 'E723': 49, 'E733': 50, 'E743': 51,
    'E753': 52, 'E763': 53, 'E773': 54, 'E783': 55,
  },
  'Parts Department': {
    'E604': 37, 'E614': 38, 'E624': 39, 'E634': 40, 'E644': 41,
    'E654': 42, 'E664': 43, 'E674': 44, 'E684': 45, 'E694': 46,
    'E704': 47, 'E714': 48, 'E724': 49, 'E734': 50, 'E744': 51,
    'E754': 52, 'E764': 53, 'E774': 54, 'E784': 55,
  },
  'Body Shop Department': {
    'E605': 37, 'E615': 38, 'E625': 39, 'E635': 40, 'E645': 41,
    'E655': 42, 'E665': 43, 'E675': 44, 'E685': 45, 'E695': 46,
    'E705': 47, 'E715': 48, 'E725': 49, 'E735': 50, 'E745': 51,
    'E755': 52, 'E765': 53, 'E775': 54, 'E785': 55,
  },
};

// Alternative: Map from data dump codes (EXPB37M format) 
const DATA_DUMP_DEPT_SUFFIX: Record<string, string> = {
  'N': 'New Vehicle Department',
  'U': 'Used Vehicle Department', 
  'S': 'Service Department',
  'P': 'Parts Department',
  'B': 'Body Shop Department',
};

/**
 * Parse a Stellantis data dump Excel file using account codes
 */
export const parseStellantisExcel = (
  file: File,
  departmentNames: string[] // List of department names to import for
): Promise<ParsedFinancialData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        
        console.log('[Stellantis Parse] Available sheets:', workbook.SheetNames);
        
        // Get first sheet (data dump is typically on first sheet)
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        if (!sheet) {
          reject(new Error('No sheets found in workbook'));
          return;
        }
        
        // Convert sheet to array of arrays for easier parsing
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        
        console.log('[Stellantis Parse] Total rows:', rows.length);
        
        // Build a map of account codes to values
        // Data dump format: |value|code|...
        const codeValues: Record<string, number> = {};
        
        for (const row of rows) {
          if (!row || row.length < 2) continue;
          
          const value = row[0];
          const code = row[1];
          
          if (typeof code === 'string' && code.length > 0) {
            const cleanCode = code.trim().toUpperCase();
            let numValue: number | null = null;
            
            if (typeof value === 'number') {
              numValue = value;
            } else if (typeof value === 'string') {
              const cleaned = value.replace(/[,$%\s]/g, '');
              if (cleaned) {
                const parsed = parseFloat(cleaned);
                if (!isNaN(parsed)) numValue = parsed;
              }
            }
            
            if (numValue !== null) {
              codeValues[cleanCode] = numValue;
            }
          }
        }
        
        console.log('[Stellantis Parse] Found', Object.keys(codeValues).length, 'code-value pairs');
        
        // Initialize result structures
        const metrics: Record<string, Record<string, number | null>> = {};
        const subMetrics: Record<string, SubMetricData[]> = {};
        
        // Filter to only departments we're importing for
        const targetDepts = departmentNames.filter(name => 
          Object.keys(MAIN_METRIC_CODES).includes(name)
        );
        
        console.log('[Stellantis Parse] Target departments:', targetDepts);
        
        for (const deptName of targetDepts) {
          metrics[deptName] = {};
          subMetrics[deptName] = [];
          
          // Extract main metrics using formatted cell codes
          const deptMainCodes = MAIN_METRIC_CODES[deptName];
          if (deptMainCodes) {
            for (const [code, metricKey] of Object.entries(deptMainCodes)) {
              // Try the code with M suffix for monthly
              const monthlyCode = code + 'M';
              const value = codeValues[monthlyCode] ?? codeValues[code] ?? null;
              
              if (value !== null) {
                // Sales are typically negative in the data dump (credits), so negate them
                const adjustedValue = code.startsWith('SALES') ? -value : value;
                metrics[deptName][metricKey] = adjustedValue;
                console.log(`[Stellantis Parse] ${deptName} - ${metricKey}: ${code} = ${value} → ${adjustedValue}`);
              }
            }
          }
          
          // Extract fixed expense sub-metrics from EXP* codes
          const fixedExpenseCodes = FIXED_EXPENSE_CELL_CODES[deptName];
          if (fixedExpenseCodes) {
            let orderIndex = 1;
            for (const [cellCode, expenseNum] of Object.entries(fixedExpenseCodes)) {
              const monthlyCode = cellCode + 'M';
              const value = codeValues[monthlyCode] ?? null;
              const subMetricName = FIXED_EXPENSE_CODES[expenseNum];
              
              if (value !== null && subMetricName) {
                subMetrics[deptName].push({
                  parentMetricKey: 'total_fixed_expense',
                  name: subMetricName,
                  value: value,
                  orderIndex: orderIndex++,
                });
                console.log(`[Stellantis Parse] ${deptName} - total_fixed_expense sub: ${subMetricName} = ${value}`);
              }
            }
          }
          
          // Also try to extract from data dump format (EXPB37M, EXPS37M, etc.)
          const deptSuffixMap: Record<string, string> = {
            'New Vehicle Department': 'N',
            'Used Vehicle Department': 'U',
            'Service Department': 'S',
            'Parts Department': 'P',
            'Body Shop Department': 'B',
          };
          
          const suffix = deptSuffixMap[deptName];
          if (suffix && subMetrics[deptName].length === 0) {
            // Try EXP{suffix}{num}M format
            let orderIndex = 1;
            for (const [expenseNum, subMetricName] of Object.entries(FIXED_EXPENSE_CODES)) {
              const code = `EXP${suffix}${expenseNum}M`;
              const value = codeValues[code] ?? null;
              
              if (value !== null) {
                subMetrics[deptName].push({
                  parentMetricKey: 'total_fixed_expense',
                  name: subMetricName,
                  value: value,
                  orderIndex: orderIndex++,
                });
                console.log(`[Stellantis Parse] ${deptName} - total_fixed_expense sub (alt): ${subMetricName} = ${value} (code: ${code})`);
              }
            }
          }
        }
        
        // Log summary
        for (const [deptName, deptMetrics] of Object.entries(metrics)) {
          console.log(`[Stellantis Parse] ${deptName}: ${Object.keys(deptMetrics).length} metrics, ${subMetrics[deptName]?.length || 0} sub-metrics`);
        }
        
        resolve({ metrics, subMetrics });
      } catch (error) {
        console.error('[Stellantis Parse] Error:', error);
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsBinaryString(file);
  });
};

/**
 * Check if a file appears to be a Stellantis data dump format
 * (vs traditional formatted statement with standard cell references)
 */
export const isStellantisDataDump = (file: File): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        
        if (!sheet) {
          resolve(false);
          return;
        }
        
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        
        // Check first 50 rows for Stellantis code patterns
        // These are very specific data dump codes like "EXPN37M", "EXPS38M"
        let stellantisCodeCount = 0;
        const matchedCodes: string[] = [];
        const stellantisPatterns = [
          /^EXP[NUSPB]\d+M$/i,  // EXPN37M, EXPS38M, etc.
          /^SALES[NUSPB]\d+M$/i, // SALESN24M, etc.
          /^COST[NUSPBF]\d+M$/i, // COSTN24M, COSTF30M, etc.
          /^ASSET\d+M$/i,       // ASSET10M, etc.
          /^LIAB\d+M$/i,        // LIAB11M, etc.
        ];
        
        // Also check if this looks like a standard formatted Excel (with sheet names like Chrysler1, Chrysler2, etc.)
        const hasStandardSheetNames = workbook.SheetNames.some(name => 
          /^Chrysler\d+$/i.test(name) || /^Data$/i.test(name) || /^Stats$/i.test(name)
        );
        
        if (hasStandardSheetNames) {
          console.log('[Stellantis Check] File has standard Chrysler sheet names - NOT a data dump');
          resolve(false);
          return;
        }
        
        for (let i = 0; i < Math.min(50, rows.length); i++) {
          const row = rows[i];
          if (row && row[1] && typeof row[1] === 'string') {
            const code = row[1].trim().toUpperCase();
            if (stellantisPatterns.some(pattern => pattern.test(code))) {
              stellantisCodeCount++;
              matchedCodes.push(code);
            }
          }
        }
        
        console.log('[Stellantis Check] Found', stellantisCodeCount, 'Stellantis codes in first 50 rows:', matchedCodes);
        // Require more matches and ensure they look like actual data dump codes
        resolve(stellantisCodeCount >= 10);
      } catch (error) {
        console.error('[Stellantis Check] Error:', error);
        resolve(false);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsBinaryString(file);
  });
};
