import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Upload, X, FileText, Send, Loader2, MousePointer } from "lucide-react";
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setPdfFile(file);
      const url = URL.createObjectURL(file);
      setPdfUrl(url);
      setStep("mark");
      setTitle(file.name.replace(".pdf", ""));
    } else {
      toast({
        variant: "destructive",
        title: "Invalid file",
        description: "Please upload a PDF file",
      });
    }
  };

  const handleDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const handlePdfClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isMarkingMode || !pdfContainerRef.current) return;

    const rect = pdfContainerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const newSpot: SignatureSpot = {
      id: crypto.randomUUID(),
      pageNumber: currentPage,
      xPosition: x,
      yPosition: y,
      width: 150,
      height: 50,
      label: `Signature ${signatureSpots.length + 1}`,
    };

    setSignatureSpots([...signatureSpots, newSpot]);
    setIsMarkingMode(false);
  };

  const removeSpot = (spotId: string) => {
    setSignatureSpots(signatureSpots.filter(s => s.id !== spotId));
  };

  const handleSubmit = async () => {
    if (!pdfFile || !selectedSigner || signatureSpots.length === 0) {
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

      // Upload PDF to storage
      const fileName = `${storeId}/${crypto.randomUUID()}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from("signature-documents")
        .upload(fileName, pdfFile);

      if (uploadError) throw uploadError;

      // Create signature request
      const { data: request, error: requestError } = await supabase
        .from("signature_requests")
        .insert({
          title,
          original_pdf_path: fileName,
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
          <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg border-muted-foreground/25">
            <Upload className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">Drop a PDF file here or click to browse</p>
            <Input
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileUpload}
              className="max-w-xs"
            />
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
                  {isMarkingMode ? "Click on PDF to place" : "Add Signature Spot"}
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
              </div>
            </div>

            <div
              ref={pdfContainerRef}
              className={`relative border rounded-lg overflow-hidden bg-muted/30 ${isMarkingMode ? "cursor-crosshair" : ""}`}
              onClick={handlePdfClick}
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
                  className="absolute border-2 border-primary bg-primary/10 rounded flex items-center justify-center group"
                  style={{
                    left: `${spot.xPosition}%`,
                    top: `${spot.yPosition}%`,
                    width: spot.width,
                    height: spot.height,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <span className="text-xs font-medium text-primary">Sign Here</span>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeSpot(spot.id);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
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
