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

// Main metric account codes for DATA DUMP format
// Data dumps use codes like SALESS36M (Sales-Service-Line36-Monthly)
// These map the formatted statement cell positions to data dump code patterns
const MAIN_METRIC_CODES_DATA_DUMP: Record<string, Record<string, string[]>> = {
  // New Vehicle Department - codes use N suffix
  'New Vehicle Department': {
    'total_sales': ['SALESN04', 'P04N'],
    'gp_net': ['SALESN19', 'R19N'],
    'sales_expense': ['EXPN05', 'K05N'],
    'total_fixed_expense': ['EXPN791', 'E791N'],
    'department_profit': ['EXPN14', 'K14N'],
    'net': ['EXPN821', 'E821N'],
  },
  // Used Vehicle Department - codes use U suffix
  'Used Vehicle Department': {
    'total_sales': ['SALESU13', 'P13U'],
    'gp_net': ['SALESU09', 'S09U'],
    'sales_expense': ['EXPU20', 'K20U'],
    'total_fixed_expense': ['EXPU792', 'E792U'],
    'department_profit': ['EXPU05', 'L05U'],
    'net': ['EXPU822', 'E822U'],
  },
  // Service/Mechanical Department - codes use S suffix
  'Service Department': {
    'total_sales': ['SALESS36', 'SALESS04', 'P04S'],
    'gp_net': ['SALESS37', 'SALESS11', 'X11S'],
    'sales_expense': ['EXPS14', 'EXPS60', 'L14S'],
    'total_fixed_expense': ['EXPS793', 'EXPS60', 'E793S'],
    'department_profit': ['EXPS61', 'EXPS15', 'L15S'],
    'net': ['EXPS63', 'EXPS823', 'E823S'],
    'parts_transfer': ['EXPS62'],
  },
  // Parts Department - codes use P suffix
  'Parts Department': {
    'total_sales': ['SALESP23', 'W23P'],
    'gp_net': ['SALESP10', 'Y10P'],
    'sales_expense': ['EXPP24', 'L24P'],
    'total_fixed_expense': ['EXPP794', 'E794P'],
    'department_profit': ['EXPP01', 'M01P'],
    'net': ['EXPP824', 'E824P'],
  },
  // Body Shop Department - codes use B suffix
  'Body Shop Department': {
    'total_sales': ['SALESB11', 'W11B'],
    'gp_net': ['SALESB19', 'X19B'],
    'sales_expense': ['EXPB21', 'J21B'],
    'total_fixed_expense': ['EXPB795', 'E795B'],
    'department_profit': ['EXPB22', 'J22B'],
    'net': ['EXPB825', 'E825B'],
  },
};

// Legacy main metric codes (for backward compatibility with formatted statement references)
const MAIN_METRIC_CODES: Record<string, Record<string, string>> = {
  'New Vehicle Department': {
    'P04': 'total_sales',
    'R19': 'gp_net',
    'K05': 'total_variable_expense',
    'K13': 'total_semi_fixed_expense',
    'K14': 'department_profit',
    'E791': 'fixed_expense',
    'E821': 'net',
  },
  'Used Vehicle Department': {
    'P13': 'total_sales',
    'S09': 'gp_net',
    'K20': 'total_variable_expense',
    'L04': 'total_semi_fixed_expense',
    'L05': 'department_profit',
    'E792': 'fixed_expense',
    'E822': 'net',
  },
  'Service Department': {
    'P04': 'total_sales',
    'X11': 'gp_net',
    'L14': 'total_variable_expense',
    'L15': 'department_profit',
    'E793': 'fixed_expense',
    'E823': 'net',
  },
  'Parts Department': {
    'W23': 'total_sales',
    'Y10': 'gp_net',
    'L24': 'total_variable_expense',
    'M01': 'department_profit',
    'E794': 'fixed_expense',
    'E824': 'net',
  },
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
        const uint8 = new Uint8Array(data as ArrayBuffer);
        let workbook: XLSX.WorkBook;
        const attemptReadStellantis = (bytes: Uint8Array): XLSX.WorkBook => {
          try { return XLSX.read(bytes, { type: 'array', password: '' }); } catch (e1: any) { console.warn('[Stellantis] Attempt 1:', e1.message); }
          try { return XLSX.read(bytes, { type: 'array' }); } catch (e2: any) { console.warn('[Stellantis] Attempt 2:', e2.message); }
          try {
            const cfb = XLSX.CFB.read(bytes, { type: 'array' });
            const entry = XLSX.CFB.find(cfb, '/Workbook') || XLSX.CFB.find(cfb, '/Book');
            if (entry && entry.content) {
              const stream = new Uint8Array(entry.content as ArrayBuffer);
              let i = 0; let stripped = false;
              while (i < stream.length - 4) {
                const rt = stream[i] | (stream[i + 1] << 8);
                const rl = stream[i + 2] | (stream[i + 3] << 8);
                if (rt === 0x002F || rt === 0x0086 || rt === 0x005C) {
                  stream[i] = 0x3C; stream[i + 1] = 0x00;
                  for (let j = 4; j < 4 + rl; j++) stream[i + j] = 0x00;
                  stripped = true;
                }
                i += 4 + Math.max(0, rl); if (rl === 0 && rt === 0) break;
              }
              if (stripped) {
                entry.content = stream;
                const rebuilt = XLSX.CFB.write(cfb, { type: 'array' });
                return XLSX.read(new Uint8Array(rebuilt as ArrayBuffer), { type: 'array' });
              }
            }
          } catch (e3: any) { console.warn('[Stellantis] Attempt 3 (CFB strip):', e3.message); }
          throw new Error('File is password-protected. Please open in Excel, unprotect, then re-import.');
        };
        workbook = attemptReadStellantis(uint8);
        
        console.log('[Stellantis Parse] Available sheets:', workbook.SheetNames);
        
        // Look for the data dump sheet - prefer "dload" or "Data", fallback to first sheet
        let sheetName = workbook.SheetNames[0];
        const preferredDataDumpSheets = ['dload', 'Data'];
        for (const preferred of preferredDataDumpSheets) {
          if (workbook.SheetNames.includes(preferred)) {
            sheetName = preferred;
            break;
          }
        }
        
        const sheet = workbook.Sheets[sheetName];
        console.log('[Stellantis Parse] Using sheet:', sheetName);
        
        if (!sheet) {
          reject(new Error('No sheets found in workbook'));
          return;
        }
        
        // Convert sheet to array of arrays for easier parsing
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        
        console.log('[Stellantis Parse] Total rows in data dump sheet:', rows.length);
        
        // Build a map of account codes to values
        // Data dump format: |value|code|...
        const codeValues: Record<string, number> = {};
        const errorCells: Record<string, string> = {}; // Track cells with errors
        
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
              const valueStr = value.trim();
              // Check for Excel error values
              if (valueStr.startsWith('#')) {
                errorCells[cleanCode] = valueStr;
                console.warn(`[Stellantis Parse] Cell error for ${cleanCode}: ${valueStr}`);
                // Skip error cells - they don't have usable data
                continue;
              }
              
              const cleaned = valueStr.replace(/[,$%\s]/g, '');
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
        
        // Log error summary
        if (Object.keys(errorCells).length > 0) {
          console.warn(`[Stellantis Parse] Found ${Object.keys(errorCells).length} cells with errors:`, errorCells);
        }
        
        console.log('[Stellantis Parse] Found', Object.keys(codeValues).length, 'code-value pairs');
        
        // Initialize result structures
        const metrics: Record<string, Record<string, number | null>> = {};
        const subMetrics: Record<string, SubMetricData[]> = {};
        
        // Filter to only departments we're importing for
        const targetDepts = departmentNames.filter(name => 
          Object.keys(MAIN_METRIC_CODES_DATA_DUMP).includes(name) || 
          Object.keys(MAIN_METRIC_CODES).includes(name)
        );
        
        console.log('[Stellantis Parse] Target departments:', targetDepts);
        console.log('[Stellantis Parse] Sample codes from file:', Object.keys(codeValues).slice(0, 20));
        
        for (const deptName of targetDepts) {
          metrics[deptName] = {};
          subMetrics[deptName] = [];
          
          // First, try to extract main metrics using data dump code patterns (new method)
          const deptDataDumpCodes = MAIN_METRIC_CODES_DATA_DUMP[deptName];
          if (deptDataDumpCodes) {
            for (const [metricKey, codePatternsArray] of Object.entries(deptDataDumpCodes)) {
              let foundValue: number | null = null;
              let matchedCode: string | null = null;
              
              // Try each code pattern until we find a match
              for (const codePattern of codePatternsArray) {
                // Try with M suffix (monthly), Y suffix (YTD), and without suffix
                const codesToTry = [
                  codePattern + 'M',
                  codePattern,
                  codePattern + 'Y',
                ];
                
                for (const code of codesToTry) {
                  if (codeValues[code] !== undefined) {
                    foundValue = codeValues[code];
                    matchedCode = code;
                    break;
                  }
                }
                if (foundValue !== null) break;
              }
              
              if (foundValue !== null && matchedCode) {
                // Sales/revenue are typically negative in data dumps (credits), so negate them
                const adjustedValue = matchedCode.startsWith('SALES') ? -foundValue : foundValue;
                metrics[deptName][metricKey] = adjustedValue;
                console.log(`[Stellantis Parse] ${deptName} - ${metricKey}: ${matchedCode} = ${foundValue} → ${adjustedValue}`);
              }
            }
          }
          
          // Fallback: try legacy formatted cell code patterns if no data dump codes matched
          const deptMainCodes = MAIN_METRIC_CODES[deptName];
          if (deptMainCodes) {
            for (const [code, metricKey] of Object.entries(deptMainCodes)) {
              // Skip if we already found this metric via data dump codes
              if (metrics[deptName][metricKey] !== undefined) continue;
              
              // Try the code with M suffix for monthly
              const monthlyCode = code + 'M';
              const value = codeValues[monthlyCode] ?? codeValues[code] ?? null;
              
              if (value !== null) {
                // Sales are typically negative in the data dump (credits), so negate them
                const adjustedValue = code.startsWith('SALES') ? -value : value;
                metrics[deptName][metricKey] = adjustedValue;
                console.log(`[Stellantis Parse] ${deptName} - ${metricKey} (legacy): ${code} = ${value} → ${adjustedValue}`);
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
                  value: Math.abs(value),
                  orderIndex: orderIndex++,
                });
                console.log(`[Stellantis Parse] ${deptName} - total_fixed_expense sub: ${subMetricName} = ${value} -> ${Math.abs(value)}`);
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
                  value: Math.abs(value),
                  orderIndex: orderIndex++,
                });
                console.log(`[Stellantis Parse] ${deptName} - total_fixed_expense sub (alt): ${subMetricName} = ${value} -> ${Math.abs(value)} (code: ${code})`);
              }
            }
          }
        }
        
        // Log detailed summary including missing metrics
        const expectedMainMetrics = ['total_sales', 'gp_net', 'sales_expense', 'total_fixed_expense', 'department_profit', 'net'];
        for (const [deptName, deptMetrics] of Object.entries(metrics)) {
          const foundMetrics = Object.keys(deptMetrics);
          const missingMetrics = expectedMainMetrics.filter(m => !foundMetrics.includes(m));
          
          console.log(`[Stellantis Parse] ${deptName}: ${foundMetrics.length} metrics found: [${foundMetrics.join(', ')}]`);
          if (missingMetrics.length > 0) {
            console.warn(`[Stellantis Parse] ${deptName}: MISSING metrics: [${missingMetrics.join(', ')}]`);
          }
          console.log(`[Stellantis Parse] ${deptName}: ${subMetrics[deptName]?.length || 0} sub-metrics`);
        }
        
        // Log any error cells that might be causing missing data
        if (Object.keys(errorCells).length > 0) {
          console.warn(`[Stellantis Parse] Some cells had Excel errors - these values could not be imported:`, Object.keys(errorCells).slice(0, 20));
        }
        
        resolve({ metrics, subMetrics });
      } catch (error) {
        console.error('[Stellantis Parse] Error:', error);
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Check if a file appears to be a Stellantis data dump format
 * (vs traditional formatted statement with standard cell references)
 * 
 * IMPORTANT: Some files are "hybrid" - they have Chrysler sheets (templates) 
 * AND a data dump sheet (dload/Data). In these cases, we should check if
 * the data dump sheet has actual data, as the Chrysler sheets may have stale values.
 */
export const isStellantisDataDump = (file: File): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(new Uint8Array(data as ArrayBuffer), { type: 'array', password: '' });
        
        // Check for data dump sheet (usually "dload" or first sheet in pure data dumps)
        const dataDumpSheetNames = ['dload', 'Data'];
        let dataDumpSheet = null;
        let dataDumpSheetName = '';
        
        for (const name of dataDumpSheetNames) {
          if (workbook.Sheets[name]) {
            dataDumpSheet = workbook.Sheets[name];
            dataDumpSheetName = name;
            break;
          }
        }
        
        // If no specific data dump sheet, try first sheet
        if (!dataDumpSheet) {
          dataDumpSheet = workbook.Sheets[workbook.SheetNames[0]];
          dataDumpSheetName = workbook.SheetNames[0];
        }
        
        if (!dataDumpSheet) {
          resolve(false);
          return;
        }
        
        const rows: any[][] = XLSX.utils.sheet_to_json(dataDumpSheet, { header: 1 });
        
        // Check for Stellantis data dump code patterns
        let stellantisCodeCount = 0;
        const matchedCodes: string[] = [];
        const stellantisPatterns = [
          /^EXP[NUSPB]\d+M$/i,  // EXPN37M, EXPS38M, etc.
          /^SALES[NUSPB]\d+M$/i, // SALESN24M, etc.
          /^COST[NUSPBF]\d+M$/i, // COSTN24M, COSTF30M, etc.
          /^ASSET\d+M$/i,       // ASSET10M, etc.
          /^LIAB\d+M$/i,        // LIAB11M, etc.
        ];
        
        for (let i = 0; i < Math.min(100, rows.length); i++) {
          const row = rows[i];
          if (row && row[1] && typeof row[1] === 'string') {
            const code = row[1].trim().toUpperCase();
            if (stellantisPatterns.some(pattern => pattern.test(code))) {
              stellantisCodeCount++;
              if (matchedCodes.length < 10) matchedCodes.push(code);
            }
          }
        }
        
        console.log(`[Stellantis Check] Sheet "${dataDumpSheetName}": Found ${stellantisCodeCount} data dump codes:`, matchedCodes);
        
        // If we found data dump codes, this IS a data dump (even if it has Chrysler sheets)
        if (stellantisCodeCount >= 10) {
          console.log('[Stellantis Check] File contains data dump format - using data dump parser');
          resolve(true);
          return;
        }
        
        // Check if this has Chrysler sheets (standard formatted Excel)
        const hasStandardSheetNames = workbook.SheetNames.some(name => 
          /^Chrysler\d+$/i.test(name)
        );
        
        if (hasStandardSheetNames) {
          console.log('[Stellantis Check] File has Chrysler sheets and no data dump - using cell mappings');
          resolve(false);
          return;
        }
        
        // Default to not a data dump if we can't determine
        console.log('[Stellantis Check] Could not determine format, defaulting to cell mappings');
        resolve(false);
      } catch (error) {
        console.error('[Stellantis Check] Error:', error);
        resolve(false);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
};
