import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from 'xlsx';

interface ImportRow {
  storeName: string;
  departmentName: string;
  month: string;
  metricName: string;
  value: number;
  status: 'pending' | 'success' | 'error';
  error?: string;
}

interface FinancialDataImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

export const FinancialDataImport = ({ open, onOpenChange, onImportComplete }: FinancialDataImportProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [parsing, setParsing] = useState(false);
  const { toast } = useToast();

  const normalizeMetricName = (name: string): string => {
    // Normalize metric names to match database format
    return name
      .toLowerCase()
      .trim()
      .replace(/[%$]/g, '')
      .replace(/\s+/g, '_')
      .replace(/\(.*?\)/g, '')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  };

  const downloadTemplate = () => {
    const templateData = [
      ['Store', 'Department', 'Month', 'Metric', 'Value'],
      ['Example Store', 'Service', '2024-01', 'total_sales', '150000'],
      ['Example Store', 'Service', '2024-01', 'gp_net', '45000'],
      ['Example Store', 'Service', '2024-02', 'total_sales', '160000'],
      ['', '', '', '', ''],
      ['Available Metrics:', '', '', '', ''],
      ['total_sales', 'gp_net', 'gp_percent', 'sales_expense', ''],
      ['personnel_expense', 'semi_fixed_expense', 'total_fixed_expense', '', ''],
      ['department_profit', 'parts_transfer', 'net', '', ''],
    ];

    const ws = XLSX.utils.aoa_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'financial_import_template.xlsx');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setParsedData([]);
    setParsing(true);

    try {
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      // Expected format:
      // Row 1: Headers - Store | Department | Month | MetricName | Value
      // Or: Store | Department | Jan-2024 | Feb-2024 | ... (with metric names in rows)
      
      const rows: ImportRow[] = [];
      
      // Try format 1: Simple row format (Store, Department, Month, MetricName, Value)
      if (jsonData.length > 1) {
        const headers = jsonData[0].map(h => String(h).toLowerCase().trim());
        
        if (headers.includes('store') && headers.includes('department') && headers.includes('month')) {
          // Simple format
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || row.length === 0) continue;
            
            const storeIdx = headers.indexOf('store');
            const deptIdx = headers.indexOf('department');
            const monthIdx = headers.indexOf('month');
            const metricIdx = headers.indexOf('metric') || headers.indexOf('metricname') || headers.indexOf('metric_name');
            const valueIdx = headers.indexOf('value');

            if (storeIdx === -1 || deptIdx === -1 || monthIdx === -1 || metricIdx === -1 || valueIdx === -1) {
              continue;
            }

            rows.push({
              storeName: String(row[storeIdx] || '').trim(),
              departmentName: String(row[deptIdx] || '').trim(),
              month: String(row[monthIdx] || '').trim(),
              metricName: normalizeMetricName(String(row[metricIdx] || '')),
              value: parseFloat(row[valueIdx]) || 0,
              status: 'pending'
            });
          }
        } else {
          // Pivot format: Store | Department | Jan-2024 | Feb-2024 | ...
          // Each row represents a metric
          const monthCols = headers.slice(2); // Assume first 2 cols are Store, Department
          
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || row.length === 0) continue;
            
            const storeName = String(row[0] || '').trim();
            const departmentName = String(row[1] || '').trim();
            
            // Each subsequent column is a month with metric name in first column
            for (let j = 2; j < row.length && j < headers.length; j++) {
              const monthHeader = headers[j];
              const value = parseFloat(row[j]) || 0;
              
              if (value !== 0) {
                rows.push({
                  storeName,
                  departmentName,
                  month: monthHeader,
                  metricName: '', // Will need to specify
                  value,
                  status: 'pending'
                });
              }
            }
          }
        }
      }

      setParsedData(rows);
      
      if (rows.length === 0) {
        toast({
          title: "No data found",
          description: "Please ensure your file has the correct format: Store, Department, Month, Metric, Value",
          variant: "destructive"
        });
      } else {
        toast({
          title: "File parsed",
          description: `Found ${rows.length} entries to import`
        });
      }
    } catch (error) {
      console.error('Error parsing file:', error);
      toast({
        title: "Error parsing file",
        description: "Please ensure your file is a valid CSV or Excel file",
        variant: "destructive"
      });
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    if (parsedData.length === 0) return;

    setImporting(true);
    const updatedData = [...parsedData];
    let successCount = 0;
    let errorCount = 0;

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Error", description: "Not authenticated", variant: "destructive" });
        return;
      }

      // Process each row
      for (let i = 0; i < updatedData.length; i++) {
        const row = updatedData[i];
        
        try {
          // Find store by name
          const { data: stores } = await supabase
            .from('stores')
            .select('id, name')
            .ilike('name', `%${row.storeName}%`)
            .limit(1);

          if (!stores || stores.length === 0) {
            throw new Error(`Store not found: ${row.storeName}`);
          }

          // Find department by name and store
          const { data: departments } = await supabase
            .from('departments')
            .select('id')
            .eq('store_id', stores[0].id)
            .ilike('name', `%${row.departmentName}%`)
            .limit(1);

          if (!departments || departments.length === 0) {
            throw new Error(`Department not found: ${row.departmentName}`);
          }

          // Normalize month format to YYYY-MM
          let normalizedMonth = row.month;
          if (!/^\d{4}-\d{2}$/.test(normalizedMonth)) {
            // Try to parse various date formats
            const date = new Date(normalizedMonth);
            if (!isNaN(date.getTime())) {
              normalizedMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            } else {
              throw new Error(`Invalid month format: ${row.month}`);
            }
          }

          // Upsert the entry
          const { error } = await supabase
            .from('financial_entries')
            .upsert({
              department_id: departments[0].id,
              metric_name: row.metricName,
              month: normalizedMonth,
              value: row.value,
              created_by: user.id
            }, {
              onConflict: 'department_id,metric_name,month'
            });

          if (error) throw error;

          updatedData[i].status = 'success';
          successCount++;
        } catch (error: any) {
          updatedData[i].status = 'error';
          updatedData[i].error = error.message;
          errorCount++;
        }

        setParsedData([...updatedData]);
      }

      toast({
        title: "Import complete",
        description: `Successfully imported ${successCount} entries. ${errorCount} errors.`,
        variant: errorCount > 0 ? "destructive" : "default"
      });

      if (successCount > 0) {
        onImportComplete();
      }
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setParsedData([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Financial Data
          </DialogTitle>
          <DialogDescription>
            Upload a CSV or Excel file with your financial data. Format: Store, Department, Month (YYYY-MM), Metric, Value
            <Button 
              variant="link" 
              size="sm" 
              className="ml-2 h-auto p-0" 
              onClick={downloadTemplate}
            >
              <Download className="h-3 w-3 mr-1" />
              Download Template
            </Button>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-auto">
          <div className="space-y-2">
            <Label htmlFor="file">Select File</Label>
            <Input
              id="file"
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              disabled={parsing || importing}
            />
          </div>

          {parsing && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription>Parsing file...</AlertDescription>
            </Alert>
          )}

          {parsedData.length > 0 && (
            <>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Preview of {parsedData.length} entries. Review and click Import to proceed.
                </AlertDescription>
              </Alert>

              <div className="border rounded-lg overflow-auto max-h-96">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Store</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Month</TableHead>
                      <TableHead>Metric</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.slice(0, 100).map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          {row.status === 'success' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                          {row.status === 'error' && <AlertCircle className="h-4 w-4 text-red-600" />}
                          {row.status === 'pending' && <div className="h-4 w-4" />}
                        </TableCell>
                        <TableCell>{row.storeName}</TableCell>
                        <TableCell>{row.departmentName}</TableCell>
                        <TableCell>{row.month}</TableCell>
                        <TableCell>{row.metricName}</TableCell>
                        <TableCell>{row.value}</TableCell>
                        <TableCell className="text-red-600 text-xs">{row.error}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClose} disabled={importing}>
            Cancel
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={parsedData.length === 0 || importing}
          >
            {importing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Import {parsedData.length} Entries
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
