import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Upload, X, FileText, Send, Loader2, MousePointer, Trash2 } from "lucide-react";
import { Document, Page, pdfjs } from 'react-pdf';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface SignatureSpot {
  id: string;
  pageNumber: number;
  xPosition: number;
  yPosition: number;
  width: number;
  height: number;
  label: string;
}

type DragMode = "none" | "draw" | "move" | "resize";
type ResizeHandle = "se" | "sw" | "ne" | "nw";

interface Signer {
  id: string;
  full_name: string;
  email: string;
  role?: string;
}

interface SignatureRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  storeName?: string;
}

export const SignatureRequestDialog = ({
  open,
  onOpenChange,
  storeId,
  storeName,
}: SignatureRequestDialogProps) => {
  const { toast } = useToast();
  const [step, setStep] = useState<"upload" | "mark" | "details">("upload");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [signatureSpots, setSignatureSpots] = useState<SignatureSpot[]>([]);
  const [signers, setSigners] = useState<Signer[]>([]);
  const [selectedSigner, setSelectedSigner] = useState<string>("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMarkingMode, setIsMarkingMode] = useState(false);
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const [pageWidth, setPageWidth] = useState(500);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFilePath, setUploadedFilePath] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  
  // Drag/resize state
  const [dragMode, setDragMode] = useState<DragMode>("none");
  const [activeSpotId, setActiveSpotId] = useState<string | null>(null);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle | null>(null);
  const [initialSpot, setInitialSpot] = useState<SignatureSpot | null>(null);

  // Fetch eligible signers (GMs and executives) for the store
  useEffect(() => {
    if (open && storeId) {
      fetchSigners();
    }
  }, [open, storeId]);

  const fetchSigners = async () => {
    try {
      // Get users with store_gm role who have access to this store
      const { data: gmRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "store_gm");

      const gmUserIds = gmRoles?.map(r => r.user_id) || [];

      if (gmUserIds.length === 0) {
        setSigners([]);
        return;
      }

      // Get profiles for these users
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, store_id")
        .in("id", gmUserIds);

      if (error) throw error;

      // Filter to users who have access to this store (either direct or through store access)
      const { data: storeAccess } = await supabase
        .from("user_store_access")
        .select("user_id")
        .eq("store_id", storeId);

      const usersWithStoreAccess = storeAccess?.map(a => a.user_id) || [];

      const eligibleSigners = (profiles || []).filter(p => 
        p.store_id === storeId || usersWithStoreAccess.includes(p.id)
      );

      setSigners(eligibleSigners);
    } catch (error) {
      console.error("Error fetching signers:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load eligible signers",
      });
    }
  };

  const processFile = async (file: File) => {
    if (!file || file.type !== "application/pdf") {
      toast({
        variant: "destructive",
        title: "Invalid file",
        description: "Please upload a PDF file",
      });
      return;
    }

    setIsUploading(true);
    setPdfFile(file);
    setTitle(file.name.replace(".pdf", ""));
    
    try {
      // Immediately upload to storage
      const fileName = `${storeId}/${crypto.randomUUID()}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from("signature-documents")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      setUploadedFilePath(fileName);
      
      // Get signed URL for viewing
      const { data: signedData } = await supabase.storage
        .from("signature-documents")
        .createSignedUrl(fileName, 3600); // 1 hour expiry

      if (signedData?.signedUrl) {
        setPdfUrl(signedData.signedUrl);
      } else {
        // Fallback to local URL
        const url = URL.createObjectURL(file);
        setPdfUrl(url);
      }
      
      setStep("mark");
      
      toast({
        title: "PDF uploaded",
        description: "Document saved. You can now mark signature spots.",
      });
    } catch (error: any) {
      console.error("Error uploading PDF:", error);
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error.message || "Failed to upload document",
      });
      setPdfFile(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processFile(file);
    }
  };


  const handleDeletePdf = async () => {
    if (!uploadedFilePath) return;
    
    try {
      const { error } = await supabase.storage
        .from("signature-documents")
        .remove([uploadedFilePath]);

      if (error) throw error;

      toast({
        title: "Document deleted",
        description: "The PDF has been removed",
      });
      
      resetDialog();
    } catch (error: any) {
      console.error("Error deleting PDF:", error);
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: error.message || "Failed to delete document",
      });
    }
  };

  const handleDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const getRelativePosition = (e: React.MouseEvent | MouseEvent) => {
    if (!pdfContainerRef.current) return { x: 0, y: 0 };
    const rect = pdfContainerRef.current.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!pdfContainerRef.current) return;
    
    // Only start drawing if in marking mode and clicking on the PDF (not on a spot)
    if (isMarkingMode && (e.target as HTMLElement).closest('.signature-spot') === null) {
      const pos = getRelativePosition(e);
      setDrawStart(pos);
      setDragMode("draw");
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!pdfContainerRef.current) return;
    
    const pos = getRelativePosition(e);
    
    if (dragMode === "draw" && drawStart) {
      // Create or update temporary spot while drawing
      const minX = Math.min(drawStart.x, pos.x);
      const minY = Math.min(drawStart.y, pos.y);
      const width = Math.abs(pos.x - drawStart.x);
      const height = Math.abs(pos.y - drawStart.y);
      
      // Convert percentage to pixels for width/height
      const rect = pdfContainerRef.current.getBoundingClientRect();
      const widthPx = (width / 100) * rect.width;
      const heightPx = (height / 100) * rect.height;
      
      const existingIndex = signatureSpots.findIndex(s => s.id === "temp-drawing");
      const tempSpot: SignatureSpot = {
        id: "temp-drawing",
        pageNumber: currentPage,
        xPosition: minX + width / 2,
        yPosition: minY + height / 2,
        width: Math.max(widthPx, 40),
        height: Math.max(heightPx, 20),
        label: `Signature ${signatureSpots.filter(s => s.id !== "temp-drawing").length + 1}`,
      };
      
      if (existingIndex >= 0) {
        setSignatureSpots(spots => spots.map(s => s.id === "temp-drawing" ? tempSpot : s));
      } else {
        setSignatureSpots(spots => [...spots, tempSpot]);
      }
    } else if (dragMode === "move" && activeSpotId && initialSpot) {
      const deltaX = pos.x - dragOffset.x;
      const deltaY = pos.y - dragOffset.y;
      
      setSignatureSpots(spots => spots.map(s => 
        s.id === activeSpotId 
          ? { ...s, xPosition: initialSpot.xPosition + deltaX, yPosition: initialSpot.yPosition + deltaY }
          : s
      ));
    } else if (dragMode === "resize" && activeSpotId && resizeHandle && initialSpot) {
      const rect = pdfContainerRef.current.getBoundingClientRect();
      const deltaX = pos.x - dragOffset.x;
      const deltaY = pos.y - dragOffset.y;
      
      let newWidth = initialSpot.width;
      let newHeight = initialSpot.height;
      let newX = initialSpot.xPosition;
      let newY = initialSpot.yPosition;
      
      const deltaXPx = (deltaX / 100) * rect.width;
      const deltaYPx = (deltaY / 100) * rect.height;
      
      switch (resizeHandle) {
        case "se":
          newWidth = Math.max(60, initialSpot.width + deltaXPx);
          newHeight = Math.max(30, initialSpot.height + deltaYPx);
          newX = initialSpot.xPosition + (deltaXPx / rect.width * 100) / 2;
          newY = initialSpot.yPosition + (deltaYPx / rect.height * 100) / 2;
          break;
        case "sw":
          newWidth = Math.max(60, initialSpot.width - deltaXPx);
          newHeight = Math.max(30, initialSpot.height + deltaYPx);
          newX = initialSpot.xPosition + (deltaXPx / rect.width * 100) / 2;
          newY = initialSpot.yPosition + (deltaYPx / rect.height * 100) / 2;
          break;
        case "ne":
          newWidth = Math.max(60, initialSpot.width + deltaXPx);
          newHeight = Math.max(30, initialSpot.height - deltaYPx);
          newX = initialSpot.xPosition + (deltaXPx / rect.width * 100) / 2;
          newY = initialSpot.yPosition + (deltaYPx / rect.height * 100) / 2;
          break;
        case "nw":
          newWidth = Math.max(60, initialSpot.width - deltaXPx);
          newHeight = Math.max(30, initialSpot.height - deltaYPx);
          newX = initialSpot.xPosition + (deltaXPx / rect.width * 100) / 2;
          newY = initialSpot.yPosition + (deltaYPx / rect.height * 100) / 2;
          break;
      }
      
      setSignatureSpots(spots => spots.map(s => 
        s.id === activeSpotId 
          ? { ...s, width: newWidth, height: newHeight, xPosition: newX, yPosition: newY }
          : s
      ));
    }
  };

  const handleMouseUp = () => {
    if (dragMode === "draw") {
      // Finalize the drawn spot
      setSignatureSpots(spots => spots.map(s => 
        s.id === "temp-drawing" 
          ? { ...s, id: crypto.randomUUID() }
          : s
      ));
      setIsMarkingMode(false);
    }
    
    setDragMode("none");
    setDrawStart(null);
    setActiveSpotId(null);
    setResizeHandle(null);
    setInitialSpot(null);
  };

  const startMove = (e: React.MouseEvent, spot: SignatureSpot) => {
    e.stopPropagation();
    const pos = getRelativePosition(e);
    setDragMode("move");
    setActiveSpotId(spot.id);
    setDragOffset(pos);
    setInitialSpot({ ...spot });
  };

  const startResize = (e: React.MouseEvent, spot: SignatureSpot, handle: ResizeHandle) => {
    e.stopPropagation();
    const pos = getRelativePosition(e);
    setDragMode("resize");
    setActiveSpotId(spot.id);
    setResizeHandle(handle);
    setDragOffset(pos);
    setInitialSpot({ ...spot });
  };

  const removeSpot = (spotId: string) => {
    setSignatureSpots(signatureSpots.filter(s => s.id !== spotId));
  };

  const handleSubmit = async () => {
    if (!uploadedFilePath || !selectedSigner || signatureSpots.length === 0) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Please upload a PDF, mark signature spots, and select a signer",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create signature request using already-uploaded file
      const { data: request, error: requestError } = await supabase
        .from("signature_requests")
        .insert({
          title,
          original_pdf_path: uploadedFilePath,
          store_id: storeId,
          signer_id: selectedSigner,
          message,
          status: "pending",
          created_by: user.id,
        })
        .select()
        .single();

      if (requestError) throw requestError;

      // Create signature spots
      const spotsToInsert = signatureSpots.map(spot => ({
        request_id: request.id,
        page_number: spot.pageNumber,
        x_position: spot.xPosition,
        y_position: spot.yPosition,
        width: spot.width,
        height: spot.height,
        label: spot.label,
      }));

      const { error: spotsError } = await supabase
        .from("signature_spots")
        .insert(spotsToInsert);

      if (spotsError) throw spotsError;

      // Send email notification
      const signer = signers.find(s => s.id === selectedSigner);
      const { error: emailError } = await supabase.functions.invoke("send-signature-request", {
        body: {
          requestId: request.id,
          signerId: selectedSigner,
          signerEmail: signer?.email,
          signerName: signer?.full_name,
          title,
          message,
          storeName,
        },
      });

      if (emailError) {
        console.error("Email error:", emailError);
        // Don't throw - request was created successfully
      }

      toast({
        title: "Signature request sent",
        description: `${signer?.full_name} will receive an email to sign the document`,
      });

      // Reset and close
      resetDialog();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error creating signature request:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create signature request",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetDialog = () => {
    setStep("upload");
    setPdfFile(null);
    setPdfUrl(null);
    setUploadedFilePath(null);
    setNumPages(0);
    setCurrentPage(1);
    setSignatureSpots([]);
    setSelectedSigner("");
    setTitle("");
    setMessage("");
    setIsMarkingMode(false);
  };

  useEffect(() => {
    if (!open) {
      resetDialog();
    }
  }, [open]);

  // Cleanup URL on unmount
  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  const spotsOnCurrentPage = signatureSpots.filter(s => s.pageNumber === currentPage);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request Signature</DialogTitle>
          <DialogDescription>
            {step === "upload" && "Upload a PDF document to request a signature"}
            {step === "mark" && "Click on the document to mark where signatures are needed"}
            {step === "details" && "Enter details and select who should sign"}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Upload */}
        {step === "upload" && (
          <div 
            className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg transition-colors ${
              isDragOver 
                ? "border-primary bg-primary/5" 
                : "border-muted-foreground/25"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-12 w-12 text-primary mb-4 animate-spin" />
                <p className="text-muted-foreground">Uploading document...</p>
              </>
            ) : (
              <>
                <Upload className={`h-12 w-12 mb-4 ${isDragOver ? "text-primary" : "text-muted-foreground"}`} />
                <p className={`mb-4 ${isDragOver ? "text-primary font-medium" : "text-muted-foreground"}`}>
                  {isDragOver ? "Drop PDF here" : "Drop a PDF file here or click to browse"}
                </p>
                <Input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFileUpload}
                  className="max-w-xs"
                />
              </>
            )}
          </div>
        )}

        {/* Step 2: Mark signature spots */}
        {step === "mark" && pdfUrl && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Button
                  variant={isMarkingMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsMarkingMode(!isMarkingMode)}
                >
                  <MousePointer className="h-4 w-4 mr-2" />
                  {isMarkingMode ? "Drag to draw box" : "Add Signature Spot"}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {signatureSpots.length} spot{signatureSpots.length !== 1 ? "s" : ""} marked
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm">
                  Page {currentPage} of {numPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= numPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                >
                  Next
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeletePdf}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete PDF
                </Button>
              </div>
            </div>

            <div
              ref={pdfContainerRef}
              className={`relative border rounded-lg overflow-hidden bg-muted/30 select-none ${isMarkingMode ? "cursor-crosshair" : ""}`}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <Document
                file={pdfUrl}
                onLoadSuccess={handleDocumentLoadSuccess}
                className="flex justify-center"
              >
                <Page
                  pageNumber={currentPage}
                  width={pageWidth}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                />
              </Document>

              {/* Render signature spots for current page */}
              {spotsOnCurrentPage.map((spot) => (
                <div
                  key={spot.id}
                  className={`signature-spot absolute border-2 border-primary bg-primary/10 rounded flex items-center justify-center group ${
                    dragMode === "none" ? "cursor-move" : ""
                  } ${activeSpotId === spot.id ? "ring-2 ring-primary ring-offset-2" : ""}`}
                  style={{
                    left: `${spot.xPosition}%`,
                    top: `${spot.yPosition}%`,
                    width: spot.width,
                    height: spot.height,
                    transform: "translate(-50%, -50%)",
                  }}
                  onMouseDown={(e) => startMove(e, spot)}
                >
                  <span className="text-xs font-medium text-primary pointer-events-none">Sign Here</span>
                  
                  {/* Delete button */}
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeSpot(spot.id);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                  
                  {/* Resize handles */}
                  <div
                    className="absolute -bottom-1 -right-1 w-3 h-3 bg-primary rounded-sm cursor-se-resize opacity-0 group-hover:opacity-100 transition-opacity"
                    onMouseDown={(e) => startResize(e, spot, "se")}
                  />
                  <div
                    className="absolute -bottom-1 -left-1 w-3 h-3 bg-primary rounded-sm cursor-sw-resize opacity-0 group-hover:opacity-100 transition-opacity"
                    onMouseDown={(e) => startResize(e, spot, "sw")}
                  />
                  <div
                    className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-sm cursor-ne-resize opacity-0 group-hover:opacity-100 transition-opacity"
                    onMouseDown={(e) => startResize(e, spot, "ne")}
                  />
                  <div
                    className="absolute -top-1 -left-1 w-3 h-3 bg-primary rounded-sm cursor-nw-resize opacity-0 group-hover:opacity-100 transition-opacity"
                    onMouseDown={(e) => startResize(e, spot, "nw")}
                  />
                </div>
              ))}
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("upload")}>
                Back
              </Button>
              <Button
                onClick={() => setStep("details")}
                disabled={signatureSpots.length === 0}
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Details */}
        {step === "details" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <FileText className="h-8 w-8 text-primary" />
              <div>
                <p className="font-medium">{pdfFile?.name}</p>
                <p className="text-sm text-muted-foreground">
                  {signatureSpots.length} signature spot{signatureSpots.length !== 1 ? "s" : ""} marked
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Document Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter a title for this document"
              />
            </div>

            <div className="space-y-2">
              <Label>Select Signer</Label>
              <Select value={selectedSigner} onValueChange={setSelectedSigner}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose who should sign" />
                </SelectTrigger>
                <SelectContent>
                  {signers.map((signer) => (
                    <SelectItem key={signer.id} value={signer.id}>
                      {signer.full_name} ({signer.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {signers.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No eligible signers found for this store
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Message (optional)</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Add a message to include in the email notification"
                rows={3}
              />
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep("mark")}>
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !selectedSigner || !title}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Request
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
