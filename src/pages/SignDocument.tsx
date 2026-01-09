import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, FileText, Check, X, AlertCircle, ChevronLeft, ChevronRight, Eraser } from "lucide-react";
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
  signature_spots: SignatureSpot[];
  store?: {
    name: string;
  };
  creator?: {
    full_name: string;
  };
}

const SignDocument = () => {
  const { requestId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<SignatureRequest | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [renderedPageWidth, setRenderedPageWidth] = useState(0);
  const [renderedPageHeight, setRenderedPageHeight] = useState(0);

  useEffect(() => {
    if (requestId) {
      fetchRequest();
    }
  }, [requestId]);

  const fetchRequest = async () => {
    try {
      setLoading(true);
      
      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Fetch the signature request with spots
      const { data, error: fetchError } = await supabase
        .from("signature_requests")
        .select(`
          *,
          signature_spots(*),
          store:stores(name),
          creator:profiles!signature_requests_created_by_fkey(full_name)
        `)
        .eq("id", requestId)
        .single();

      if (fetchError || !data) {
        setError("Signature request not found");
        return;
      }

      // Verify user is the signer
      if (data.signer_id !== user.id) {
        setError("You are not authorized to sign this document");
        return;
      }

      // Check if already signed
      if (data.status === "signed") {
        setError("This document has already been signed");
        return;
      }

      // Check if expired
      if (new Date(data.expires_at) < new Date()) {
        setError("This signature request has expired");
        return;
      }

      setRequest(data as SignatureRequest);

      // Mark as viewed if still pending
      if (data.status === "pending") {
        await supabase
          .from("signature_requests")
          .update({ status: "viewed", viewed_at: new Date().toISOString() })
          .eq("id", requestId);
      }

      // Download the PDF
      const { data: pdfData, error: downloadError } = await supabase.storage
        .from("signature-documents")
        .download(data.original_pdf_path);

      if (downloadError || !pdfData) {
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
  }, [request]);

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
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    setIsDrawing(true);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (pos: { x: number; y: number }) => {
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext("2d");
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
    setSignatureDataUrl(null);
  };

  const handleSubmit = async () => {
    if (!canvasRef.current || !request) return;

    setIsSubmitting(true);

    try {
      // Get signature as data URL
      const dataUrl = canvasRef.current.toDataURL("image/png");
      
      // Submit signature
      const { error: submitError } = await supabase.functions.invoke("submit-signature", {
        body: {
          requestId: request.id,
          signatureDataUrl: dataUrl,
        },
      });

      if (submitError) throw submitError;

      toast({
        title: "Document signed",
        description: "Your signature has been successfully submitted",
      });

      // Redirect to dashboard after short delay
      setTimeout(() => {
        navigate("/dashboard");
      }, 2000);
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
            <Button onClick={() => navigate("/dashboard")}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!request) return null;

  const spotsOnCurrentPage = request.signature_spots.filter(s => s.page_number === currentPage);

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
                    From: {request.creator?.full_name} • {request.store?.name}
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
                      onRenderSuccess={(page) => {
                        // Store the rendered page dimensions for spot positioning
                        if (pdfContainerRef.current) {
                          const canvas = pdfContainerRef.current.querySelector('canvas');
                          if (canvas) {
                            setRenderedPageHeight(canvas.height);
                            setRenderedPageWidth(canvas.width);
                          }
                        }
                      }}
                    />
                  </Document>

                  {/* Highlight signature spots - positioned relative to the PDF page */}
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
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-2 bg-white mb-4">
              <canvas
                ref={canvasRef}
                width={400}
                height={150}
                className="w-full max-w-[400px] mx-auto touch-none cursor-crosshair"
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
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => navigate("/dashboard")}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
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
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SignDocument;
