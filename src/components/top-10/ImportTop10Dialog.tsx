import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileSpreadsheet, Image, FileText, Loader2, X, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";

interface ColumnDefinition {
  key: string;
  label: string;
}

interface ImportTop10DialogProps {
  listId: string;
  columns: ColumnDefinition[];
  onImportComplete: () => void;
}

type ImportFormat = "image" | "excel";

export function ImportTop10Dialog({ listId, columns, onImportComplete }: ImportTop10DialogProps) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ImportFormat>("image");
  const [file, setFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<Record<string, string>[] | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const resetState = () => {
    setFile(null);
    setImagePreview(null);
    setParsedRows(null);
    setError(null);
  };

  const handleClose = () => {
    setOpen(false);
    resetState();
  };

  const handleFormatChange = (value: string) => {
    setFormat(value as ImportFormat);
    resetState();
  };

  const handleFileSelect = async (selectedFile: File) => {
    resetState();
    setFile(selectedFile);

    const isImage = selectedFile.type.startsWith("image/");
    const isPdf = selectedFile.type === "application/pdf";
    const isExcel = selectedFile.type.includes("spreadsheet") || 
                    selectedFile.type.includes("excel") ||
                    selectedFile.name.endsWith(".xlsx") ||
                    selectedFile.name.endsWith(".xls") ||
                    selectedFile.name.endsWith(".csv");

    if (format === "image" && (isImage || isPdf)) {
      if (isImage) {
        // Show image preview
        const reader = new FileReader();
        reader.onload = (e) => {
          setImagePreview(e.target?.result as string);
        };
        reader.readAsDataURL(selectedFile);
      } else if (isPdf) {
        setImagePreview(null); // PDFs won't have a preview
      }
    } else if (format === "excel" && isExcel) {
      // Parse Excel/CSV immediately
      await parseExcelFile(selectedFile);
    } else {
      setError(`Invalid file type for ${format} import`);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  }, [format]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handlePaste = useCallback((e: ClipboardEvent) => {
    if (!open || format !== "image") return;
    
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          handleFileSelect(file);
          break;
        }
      }
    }
  }, [open, format]);

  // Listen for paste events
  useState(() => {
    document.addEventListener("paste", handlePaste as any);
    return () => document.removeEventListener("paste", handlePaste as any);
  });

  const parseExcelFile = async (excelFile: File) => {
    setParsing(true);
    setError(null);

    try {
      const data = await excelFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(firstSheet, { header: 1 });

      if (jsonData.length < 2) {
        setError("Excel file must have a header row and at least one data row");
        return;
      }

      const headers = (jsonData[0] as any[]).map(h => String(h || "").trim().toLowerCase());
      
      // Map headers to column keys
      const columnMapping: Record<number, string> = {};
      for (let i = 0; i < headers.length; i++) {
        const header = headers[i];
        // Find matching column (case-insensitive, partial match)
        const matchedCol = columns.find(col => 
          col.label.toLowerCase().includes(header) || 
          header.includes(col.label.toLowerCase()) ||
          col.key.toLowerCase() === header
        );
        if (matchedCol) {
          columnMapping[i] = matchedCol.key;
        }
      }

      // If no columns mapped, try positional mapping
      if (Object.keys(columnMapping).length === 0) {
        for (let i = 0; i < Math.min(headers.length, columns.length); i++) {
          columnMapping[i] = columns[i].key;
        }
      }

      // Parse data rows (up to 10)
      const rows: Record<string, string>[] = [];
      for (let i = 1; i < Math.min(jsonData.length, 11); i++) {
        const rowData = jsonData[i] as any[];
        if (!rowData || rowData.every(cell => cell === null || cell === undefined || cell === "")) {
          continue;
        }
        
        const row: Record<string, string> = {};
        for (const col of columns) {
          row[col.key] = "";
        }
        
        for (const [colIndex, colKey] of Object.entries(columnMapping)) {
          const value = rowData[parseInt(colIndex)];
          row[colKey] = value !== null && value !== undefined ? String(value) : "";
        }
        
        rows.push(row);
      }

      if (rows.length === 0) {
        setError("No data rows found in Excel file");
        return;
      }

      setParsedRows(rows);
    } catch (err) {
      console.error("Error parsing Excel:", err);
      setError("Failed to parse Excel file");
    } finally {
      setParsing(false);
    }
  };

  const parseImageWithAI = async () => {
    if (!file) return;

    setParsing(true);
    setError(null);

    try {
      // Convert file to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const imageBase64 = await base64Promise;

      const { data, error: fnError } = await supabase.functions.invoke("parse-top10-import", {
        body: { imageBase64, columns },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data.error) {
        setError(data.error);
        return;
      }

      if (data.rows && data.rows.length > 0) {
        setParsedRows(data.rows);
      } else {
        setError("No data could be extracted from the image");
      }
    } catch (err: any) {
      console.error("Error parsing image:", err);
      setError(err.message || "Failed to parse image");
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    if (!parsedRows || parsedRows.length === 0) return;

    setImporting(true);

    try {
      // First, get existing items to update
      const { data: existingItems, error: fetchError } = await supabase
        .from("top_10_items")
        .select("id, rank")
        .eq("list_id", listId)
        .order("rank", { ascending: true });

      if (fetchError) throw fetchError;

      // Update each item with parsed data
      for (let i = 0; i < parsedRows.length; i++) {
        const rank = i + 1;
        const existingItem = existingItems?.find(item => item.rank === rank);
        
        if (existingItem) {
          const { error: updateError } = await supabase
            .from("top_10_items")
            .update({ data: parsedRows[i] })
            .eq("id", existingItem.id);
          
          if (updateError) throw updateError;
        } else {
          // Insert new item if it doesn't exist
          const { error: insertError } = await supabase
            .from("top_10_items")
            .insert({
              list_id: listId,
              rank,
              data: parsedRows[i],
            });
          
          if (insertError) throw insertError;
        }
      }

      toast.success(`Successfully imported ${parsedRows.length} rows`);
      onImportComplete();
      handleClose();
    } catch (err: any) {
      console.error("Error importing data:", err);
      toast.error(err.message || "Failed to import data");
    } finally {
      setImporting(false);
    }
  };

  const acceptTypes = format === "image" 
    ? "image/*,.pdf" 
    : ".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv";

  return (
    <Dialog open={open} onOpenChange={(o) => o ? setOpen(true) : handleClose()}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Import data">
          <Upload className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Top 10 List Data</DialogTitle>
          <DialogDescription>
            Upload an image/screenshot or Excel file to automatically populate the list.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={format} onValueChange={handleFormatChange} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="image" className="flex items-center gap-2">
              <Image className="h-4 w-4" />
              Image / PDF
            </TabsTrigger>
            <TabsTrigger value="excel" className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Excel / CSV
            </TabsTrigger>
          </TabsList>

          <TabsContent value="image" className="mt-4 space-y-4">
            <div
              ref={dropZoneRef}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {imagePreview ? (
                <div className="relative">
                  <img 
                    src={imagePreview} 
                    alt="Preview" 
                    className="max-h-48 mx-auto rounded-md"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-0 right-0 h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      resetState();
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : file && file.type === "application/pdf" ? (
                <div className="flex flex-col items-center gap-2">
                  <FileText className="h-12 w-12 text-muted-foreground" />
                  <p className="text-sm font-medium">{file.name}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      resetState();
                    }}
                  >
                    <X className="h-4 w-4 mr-1" /> Remove
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Image className="h-12 w-12 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Drop an image/PDF here, paste from clipboard, or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Supports PNG, JPG, PDF
                  </p>
                </div>
              )}
            </div>

            {(file || imagePreview) && !parsedRows && (
              <Button 
                onClick={parseImageWithAI} 
                disabled={parsing}
                className="w-full"
              >
                {parsing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing image...
                  </>
                ) : (
                  "Parse Image with AI"
                )}
              </Button>
            )}
          </TabsContent>

          <TabsContent value="excel" className="mt-4 space-y-4">
            <div
              ref={dropZoneRef}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {file ? (
                <div className="flex flex-col items-center gap-2">
                  <FileSpreadsheet className="h-12 w-12 text-muted-foreground" />
                  <p className="text-sm font-medium">{file.name}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      resetState();
                    }}
                  >
                    <X className="h-4 w-4 mr-1" /> Remove
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <FileSpreadsheet className="h-12 w-12 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Drop an Excel or CSV file here, or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Supports XLSX, XLS, CSV
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <input
          ref={fileInputRef}
          type="file"
          accept={acceptTypes}
          onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
          className="hidden"
        />

        {error && (
          <div className="flex items-center gap-2 text-destructive text-sm p-3 bg-destructive/10 rounded-md">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {parsing && (
          <div className="flex items-center justify-center gap-2 py-4">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm text-muted-foreground">Processing file...</span>
          </div>
        )}

        {parsedRows && parsedRows.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Preview ({parsedRows.length} rows)</h4>
            <div className="border rounded-md max-h-64 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    {columns.map((col) => (
                      <TableHead key={col.key} className="min-w-[100px]">
                        {col.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{idx + 1}</TableCell>
                      {columns.map((col) => (
                        <TableCell key={col.key} className="text-sm">
                          {row[col.key] || <span className="text-muted-foreground">-</span>}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={!parsedRows || parsedRows.length === 0 || importing}
          >
            {importing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              `Import ${parsedRows?.length || 0} Rows`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
