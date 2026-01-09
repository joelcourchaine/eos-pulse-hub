import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, FileText, Check, X, AlertCircle, ChevronLeft, ChevronRight, Eraser, CheckCircle2 } from "lucide-react";
import { Document, Page, pdfjs } from 'react-pdf';
import { format } from "date-fns";

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface SignatureSpot {
  id: string;
  page_number: number;
  x_position: number;
  y_position: number;
  width: number;
  height: number;
  label: string;
}

interface SignatureRequest {
  id: string;
  title: string;
  original_pdf_path: string;
  message: string | null;
  status: string;
  expires_at: string;
  created_at: string;
  signer_email: string | null;
  signer_name: string | null;
  store_id: string;
}

const SignDocumentByToken = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<SignatureRequest | null>(null);
  const [signatureSpots, setSignatureSpots] = useState<SignatureSpot[]>([]);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 400, height: 150 });

  useEffect(() => {
    if (token) {
      fetchRequest();
    }
  }, [token]);

  const fetchRequest = async () => {
    try {
      setLoading(true);
      
      // Fetch the signature request by token using RPC function
      const { data: requestData, error: fetchError } = await supabase
        .rpc('get_signature_request_by_token', { p_token: token });

      if (fetchError || !requestData || requestData.length === 0) {
        console.error('Error fetching request:', fetchError);
        setError("This signature link is invalid or has expired");
        return;
      }

      const reqData = requestData[0];

      // Check if already signed
      if (reqData.status === "signed") {
        setError("This document has already been signed");
        return;
      }

      // Check if expired
      if (new Date(reqData.expires_at) < new Date()) {
        setError("This signature request has expired");
        return;
      }

      setRequest(reqData as SignatureRequest);

      // Fetch signature spots
      const { data: spots, error: spotsError } = await supabase
        .rpc('get_signature_spots_by_request', { p_request_id: reqData.id });

      if (!spotsError && spots) {
        setSignatureSpots(spots as SignatureSpot[]);
      }

      // Mark as viewed if still pending
      if (reqData.status === "pending") {
        // Update viewed status - we need to use a different approach since we don't have direct access
        // The edge function will handle this if needed
      }

      // Download the PDF using a public URL approach
      // Since we're accessing without auth, we need to use the storage API carefully
      const { data: pdfData, error: downloadError } = await supabase.storage
        .from("signature-documents")
        .download(reqData.original_pdf_path);

      if (downloadError || !pdfData) {
        console.error('Error downloading PDF:', downloadError);
        setError("Failed to load document");
        return;
      }

      const url = URL.createObjectURL(pdfData);
      setPdfUrl(url);
    } catch (err: any) {
      console.error("Error fetching signature request:", err);
      setError("An error occurred while loading the document");
    } finally {
      setLoading(false);
    }
  };

  // Resize canvas to fit container (keep a comfortably large signing area)
  useEffect(() => {
    const updateCanvasSize = () => {
      if (!canvasContainerRef.current) return;

      // Fill the available width of the signature box
      const containerWidth = canvasContainerRef.current.clientWidth - 16; // account for padding
      const width = Math.max(320, containerWidth);

      // Use a fixed-ish height so the signing area isn't too short
      const height = 220;

      setCanvasSize({ width, height });
    };

    updateCanvasSize();
    window.addEventListener("resize", updateCanvasSize);
    return () => window.removeEventListener("resize", updateCanvasSize);
  }, [request]);

  // Canvas setup for signature
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set up canvas
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [canvasSize]);

  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const getTouchPos = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    };
  };

  const startDrawing = (pos: { x: number; y: number }) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    // Set stroke style each time to ensure it's applied
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    
    setIsDrawing(true);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (pos: { x: number; y: number }) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleSubmit = async () => {
    if (!canvasRef.current || !request || !token) return;

    setIsSubmitting(true);

    try {
      // Get signature as data URL
      const dataUrl = canvasRef.current.toDataURL("image/png");
      
      // Submit signature using token (no auth required)
      const { error: submitError } = await supabase.functions.invoke("submit-signature", {
        body: {
          accessToken: token,
          signatureDataUrl: dataUrl,
        },
      });

      if (submitError) throw submitError;

      setIsComplete(true);
      toast({
        title: "Document signed",
        description: "Your signature has been successfully submitted",
      });
    } catch (err: any) {
      console.error("Error submitting signature:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message || "Failed to submit signature",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cleanup URL on unmount
  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">Loading document...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <p className="text-lg font-medium mb-2">Unable to Sign</p>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => window.close()}>
              Close Window
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="h-16 w-16 mx-auto text-green-600 mb-4" />
            <p className="text-2xl font-medium mb-2">Document Signed!</p>
            <p className="text-muted-foreground mb-6">
              Thank you for signing. The document owner has been notified.
            </p>
            <p className="text-sm text-muted-foreground">
              You can close this window now.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!request) return null;

  const spotsOnCurrentPage = signatureSpots.filter(s => s.page_number === currentPage);

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-5xl mx-auto py-6 px-4">
        {/* Header */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <FileText className="h-8 w-8 text-primary mt-1" />
                <div>
                  <CardTitle>{request.title}</CardTitle>
                  <CardDescription>
                    Signature requested for: {request.signer_name}
                  </CardDescription>
                  <p className="text-sm text-muted-foreground mt-1">
                    Requested: {format(new Date(request.created_at), "MMMM d, yyyy")}
                  </p>
                </div>
              </div>
            </div>
            {request.message && (
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <p className="text-sm italic">"{request.message}"</p>
              </div>
            )}
          </CardHeader>
        </Card>

        {/* PDF Viewer */}
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Document Preview</CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm px-2">
                  Page {currentPage} of {numPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= numPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div 
              ref={pdfContainerRef}
              className="relative border rounded-lg overflow-hidden bg-muted/30 flex justify-center"
            >
              {pdfUrl && (
                <div className="relative">
                  <Document
                    file={pdfUrl}
                    onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                  >
                    <Page
                      pageNumber={currentPage}
                      width={Math.min(600, window.innerWidth - 80)}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                    />
                  </Document>

                  {/* Highlight signature spots */}
                  {spotsOnCurrentPage.map((spot) => (
                    <div
                      key={spot.id}
                      className="absolute border-2 border-primary bg-primary/10 rounded animate-pulse pointer-events-none"
                      style={{
                        left: `${spot.x_position}%`,
                        top: `${spot.y_position}%`,
                        width: spot.width,
                        height: spot.height,
                        transform: "translate(-50%, -50%)",
                      }}
                    >
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-primary">
                        Sign Here
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Signature Pad */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your Signature</CardTitle>
            <CardDescription>
              Draw your signature in the box below. Your signature will be applied to all marked spots.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div ref={canvasContainerRef} className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-2 bg-white mb-4">
              <canvas
                ref={canvasRef}
                width={canvasSize.width}
                height={canvasSize.height}
                className="block w-full touch-none cursor-crosshair"
                style={{ height: canvasSize.height }}
                onMouseDown={(e) => startDrawing(getMousePos(e))}
                onMouseMove={(e) => draw(getMousePos(e))}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={(e) => {
                  e.preventDefault();
                  startDrawing(getTouchPos(e));
                }}
                onTouchMove={(e) => {
                  e.preventDefault();
                  draw(getTouchPos(e));
                }}
                onTouchEnd={stopDrawing}
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <Button variant="outline" onClick={clearSignature} disabled={!hasSignature}>
                <Eraser className="h-4 w-4 mr-2" />
                Clear
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!hasSignature || isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Signing...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Sign Document
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SignDocumentByToken;
