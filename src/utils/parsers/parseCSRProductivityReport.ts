import * as XLSX from "xlsx";

/**
 * CSR Service Productivity Report Parser
 * Parses Excel reports from DMS systems with per-advisor data
 */

export interface PayTypeMetrics {
  customer: Record<string, number>;
  warranty: Record<string, number>;
  internal: Record<string, number>;
  total: Record<string, number>;
}

// Metrics indexed by column index for Visual Mapper integration
export interface PayTypeMetricsByIndex {
  customer: Record<number, number>;
  warranty: Record<number, number>;
  internal: Record<number, number>;
  total: Record<number, number>;
}

export interface AdvisorData {
  rawName: string; // "Advisor 1099 - Kayla Bender"
  displayName: string; // "Kayla Bender"
  employeeId: string; // "1099"
  metrics: PayTypeMetrics;
  metricsByIndex: PayTypeMetricsByIndex; // Same data but keyed by column index
}

export interface CSRParseResult {
  storeName: string;
  dateRange: { start: Date; end: Date } | null;
  month: string; // "2026-01"
  advisors: AdvisorData[];
  departmentTotals: PayTypeMetrics;
  departmentTotalsByIndex: PayTypeMetricsByIndex; // Same data but keyed by column index
  columnHeaders: string[];
  columnHeadersWithIndex: Array<{ header: string; index: number }>; // Headers with their column indices
}

/**
 * Extract advisor name and ID from header like "Advisor 1099 - Kayla Bender"
 */
const parseAdvisorHeader = (header: string): { displayName: string; employeeId: string } | null => {
  // Match pattern: "Advisor XXXX - Name"
  const match = header.match(/Advisor\s+(\d+)\s*-\s*(.+)/i);
  if (match) {
    return {
      employeeId: match[1],
      displayName: match[2].trim()
    };
  }
  return null;
};

/**
 * Determine the pay type from a row
 */
const getPayType = (row: any[], payTypeIndex: number): string | null => {
  const payType = String(row[payTypeIndex] || "").trim().toLowerCase();
  if (payType.includes("customer") || payType === "cp") return "customer";
  if (payType.includes("warranty")) return "warranty";
  if (payType.includes("internal")) return "internal";
  if (payType.includes("total")) return "total";
  return null;
};

/**
 * Parse numeric value from cell
 */
const parseNumericValue = (value: any): number | null => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    // Remove currency symbols, commas, spaces
    const cleaned = value.replace(/[$,\s]/g, "").trim();
    if (cleaned === "" || cleaned === "-") return null;
    // Handle parentheses for negative numbers
    const isNegative = cleaned.startsWith("(") && cleaned.endsWith(")");
    const numStr = isNegative ? cleaned.slice(1, -1) : cleaned;
    const parsed = parseFloat(numStr);
    return isNaN(parsed) ? null : (isNegative ? -parsed : parsed);
  }
  return null;
};

/**
 * Try to extract date range from the report
 */
const extractDateRange = (rows: any[][]): { start: Date; end: Date; month: string } | null => {
  // Look for date patterns in first few rows
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i];
    for (const cell of row) {
      if (typeof cell === "string") {
        // Look for date range like "01/01/2026 - 01/31/2026" or "January 2026"
        const rangeMatch = cell.match(/(\d{1,2}\/\d{1,2}\/\d{4})\s*[-–]\s*(\d{1,2}\/\d{1,2}\/\d{4})/);
        if (rangeMatch) {
          const start = new Date(rangeMatch[1]);
          const end = new Date(rangeMatch[2]);
          if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
            const month = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
            return { start, end, month };
          }
        }
        
        // Look for month/year like "January 2026"
        const monthMatch = cell.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i);
        if (monthMatch) {
          const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
          const monthIndex = monthNames.indexOf(monthMatch[1].toLowerCase());
          const year = parseInt(monthMatch[2]);
          if (monthIndex !== -1) {
            const start = new Date(year, monthIndex, 1);
            const end = new Date(year, monthIndex + 1, 0);
            const month = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
            return { start, end, month };
          }
        }
      }
    }
  }
  return null;
};

/**
 * Extract store name from the report
 */
const extractStoreName = (rows: any[][]): string => {
  // Store name is often in the first few rows
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const row = rows[i];
    for (const cell of row) {
      if (typeof cell === "string" && cell.length > 5 && cell.length < 100) {
        // Look for common dealership name patterns
        if (cell.match(/chevrolet|ford|toyota|honda|dodge|chrysler|jeep|ram|gmc|buick|cadillac|nissan|hyundai|kia|mazda|subaru|volkswagen|bmw|mercedes|audi|lexus|infiniti|acura|volvo|lincoln|mitsubishi|fiat|alfa|maserati|porsche|jaguar|land rover|mini|smart|dealership|motors|automotive|auto group/i)) {
          return cell.trim();
        }
      }
    }
  }
  return "Unknown Store";
};

/**
 * Find header row with column labels
 */
const findHeaderRow = (rows: any[][]): { rowIndex: number; headers: string[]; payTypeIndex: number } | null => {
  // Common column headers in CSR reports
  const expectedHeaders = ["pay type", "#so", "sold hrs", "lab sold", "e.l.r.", "parts sold", "elr"];
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !Array.isArray(row) || row.length < 3) continue;
    
    const rowStrings = row.map(cell => String(cell ?? "").toLowerCase().trim());
    
    // Check if this row has at least 2 expected headers
    const matchCount = expectedHeaders.filter(h => 
      rowStrings.some(rs => rs && typeof rs === 'string' && rs.includes(h))
    ).length;
    
    if (matchCount >= 2) {
      const payTypeIndex = rowStrings.findIndex(rs => 
        rs && typeof rs === 'string' && (rs.includes("pay type") || rs === "type")
      );
      return {
        rowIndex: i,
        headers: row.map(cell => String(cell ?? "").trim()),
        payTypeIndex: payTypeIndex >= 0 ? payTypeIndex : 0
      };
    }
  }
  return null;
};

/**
 * Parse a CSR Productivity Report Excel file
 */
export const parseCSRProductivityReport = (
  file: File
): Promise<CSRParseResult> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        
        console.log("[CSR Parse] Available sheets:", workbook.SheetNames);
        
        // Look for relevant sheet - prefer "All Repair Orders" or similar
        let sheetName = workbook.SheetNames[0];
        const preferredSheets = ["All Repair Orders", "Summary", "Service Advisor", "Data"];
        for (const preferred of preferredSheets) {
          const match = workbook.SheetNames.find(s => 
            s.toLowerCase().includes(preferred.toLowerCase())
          );
          if (match) {
            sheetName = match;
            break;
          }
        }
        
        const sheet = workbook.Sheets[sheetName];
        console.log("[CSR Parse] Using sheet:", sheetName);
        
        if (!sheet) {
          reject(new Error("No sheets found in workbook"));
          return;
        }
        
        // Convert sheet to array of arrays
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        console.log("[CSR Parse] Total rows:", rows.length);
        
        // Extract metadata
        const storeName = extractStoreName(rows);
        const dateInfo = extractDateRange(rows);
        const headerInfo = findHeaderRow(rows);
        
        if (!headerInfo) {
          reject(new Error("Could not find header row with column labels"));
          return;
        }
        
        console.log("[CSR Parse] Header row index:", headerInfo.rowIndex);
        console.log("[CSR Parse] Headers:", headerInfo.headers);
        
        // Build column index map
        const columnIndices: Record<string, number> = {};
        headerInfo.headers.forEach((header, index) => {
          const normalized = header.toLowerCase().trim();
          columnIndices[normalized] = index;
        });
        
        // Parse advisor sections
        const advisors: AdvisorData[] = [];
        let currentAdvisor: AdvisorData | null = null;
        let departmentTotals: PayTypeMetrics = {
          customer: {},
          warranty: {},
          internal: {},
          total: {}
        };
        // Also track metrics by column index for Visual Mapper integration
        let departmentTotalsByIndex: PayTypeMetricsByIndex = {
          customer: {},
          warranty: {},
          internal: {},
          total: {}
        };
        let inDepartmentTotals = false;
        
        for (let i = headerInfo.rowIndex + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;
          
          // Check multiple columns for advisor headers (not just first column)
          // Some reports have advisor names in column 0, others in different columns
          let advisorInfo: { displayName: string; employeeId: string } | null = null;
          let advisorCellValue = "";
          
          for (let colIdx = 0; colIdx < Math.min(5, row.length); colIdx++) {
            const cellValue = String(row[colIdx] || "").trim();
            if (cellValue) {
              advisorInfo = parseAdvisorHeader(cellValue);
              if (advisorInfo) {
                advisorCellValue = cellValue;
                break;
              }
              // Also check for "All Repair Orders" or similar markers
              if (cellValue.toLowerCase().includes("all repair orders") || 
                  cellValue.toLowerCase().includes("department total") ||
                  cellValue.toLowerCase().includes("grand total")) {
                advisorCellValue = cellValue;
                break;
              }
            }
          }
          
          if (advisorInfo) {
            // Save previous advisor
            if (currentAdvisor) {
              advisors.push(currentAdvisor);
            }
            
            currentAdvisor = {
              rawName: advisorCellValue,
              displayName: advisorInfo.displayName,
              employeeId: advisorInfo.employeeId,
              metrics: {
                customer: {},
                warranty: {},
                internal: {},
                total: {}
              },
              metricsByIndex: {
                customer: {},
                warranty: {},
                internal: {},
                total: {}
              }
            };
            inDepartmentTotals = false;
            console.log(`[CSR Parse] Found advisor: ${advisorInfo.displayName} (${advisorInfo.employeeId})`);
            continue;
          }
          
          // Check if we're entering department totals section
          if (advisorCellValue.toLowerCase().includes("all repair orders") || 
              advisorCellValue.toLowerCase().includes("department total") ||
              advisorCellValue.toLowerCase().includes("grand total")) {
            if (currentAdvisor) {
              advisors.push(currentAdvisor);
              currentAdvisor = null;
            }
            inDepartmentTotals = true;
            console.log(`[CSR Parse] Entering department totals section`);
            continue;
          }
          
          // Parse data row
          const payType = getPayType(row, headerInfo.payTypeIndex);
          if (payType) {
            const metrics = inDepartmentTotals ? departmentTotals : currentAdvisor?.metrics;
            const metricsByIdx = inDepartmentTotals ? departmentTotalsByIndex : currentAdvisor?.metricsByIndex;
            if (metrics && metricsByIdx) {
              // Extract values for each column
              headerInfo.headers.forEach((header, colIndex) => {
                if (colIndex === headerInfo.payTypeIndex) return;
                
                const value = parseNumericValue(row[colIndex]);
                if (value !== null) {
                  const normalizedHeader = header.toLowerCase().trim();
                  // Skip empty headers
                  if (!normalizedHeader || normalizedHeader === "pay type") return;
                  
                  // Store by header name (original behavior)
                  (metrics[payType as keyof PayTypeMetrics] as Record<string, number>)[header] = value;
                  // Also store by column index (for Visual Mapper integration)
                  (metricsByIdx[payType as keyof PayTypeMetricsByIndex] as Record<number, number>)[colIndex] = value;
                }
              });
            }
          }
        }
        
        // Add last advisor if exists
        if (currentAdvisor) {
          advisors.push(currentAdvisor);
        }
        
        console.log("[CSR Parse] Found", advisors.length, "advisors");
        console.log("[CSR Parse] Department totals:", Object.keys(departmentTotals.total).length, "metrics");
        
        // Determine month - use date info or default to current month
        const month = dateInfo?.month || 
          `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
        
        // Build column headers with index for Visual Mapper integration
        const columnHeadersWithIndex = headerInfo.headers
          .map((header, index) => ({ header, index }))
          .filter(h => h.header.toLowerCase().trim() !== "pay type" && h.header.trim() !== "");
        
        resolve({
          storeName,
          dateRange: dateInfo ? { start: dateInfo.start, end: dateInfo.end } : null,
          month,
          advisors,
          departmentTotals,
          departmentTotalsByIndex,
          columnHeaders: headerInfo.headers.filter(h => 
            h.toLowerCase().trim() !== "pay type" && h.trim() !== ""
          ),
          columnHeadersWithIndex
        });
        
      } catch (error) {
        console.error("[CSR Parse] Error:", error);
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsBinaryString(file);
  });
};

/**
 * Check if a file appears to be a CSR productivity report
 */
export const isCSRProductivityReport = async (file: File): Promise<boolean> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        
        // Check sheet names
        const hasRelevantSheet = workbook.SheetNames.some(name =>
          name.toLowerCase().includes("repair order") ||
          name.toLowerCase().includes("service advisor") ||
          name.toLowerCase().includes("productivity")
        );
        
        if (hasRelevantSheet) {
          resolve(true);
          return;
        }
        
        // Check content of first sheet
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        
        // Look for CSR-specific patterns
        for (let i = 0; i < Math.min(50, rows.length); i++) {
          const rowText = rows[i]?.join(" ").toLowerCase() || "";
          if (
            (rowText.includes("advisor") && rowText.includes("sold hrs")) ||
            rowText.includes("e.l.r.") ||
            rowText.includes("repair order") ||
            rowText.includes("pay type")
          ) {
            resolve(true);
            return;
          }
        }
        
        resolve(false);
      } catch {
        resolve(false);
      }
    };
    
    reader.onerror = () => resolve(false);
    reader.readAsBinaryString(file);
  });
};
