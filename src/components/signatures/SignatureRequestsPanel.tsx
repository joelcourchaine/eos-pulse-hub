import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  FileSignature, 
  Plus, 
  Download, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Eye,
  RefreshCw,
  Mail,
  Loader2
} from "lucide-react";
import { SignatureRequestDialog } from "./SignatureRequestDialog";
import { format } from "date-fns";

interface SignatureRequest {
  id: string;
  title: string;
  original_pdf_path: string;
  signed_pdf_path: string | null;
  signer_id: string | null;
  signer_email: string | null;
  signer_name: string | null;
  message: string | null;
  status: "pending" | "viewed" | "signed" | "expired";
  created_by: string;
  expires_at: string;
  viewed_at: string | null;
  signed_at: string | null;
  created_at: string;
  signer?: {
    full_name: string;
    email: string;
  } | null;
}

interface SignatureRequestsPanelProps {
  storeId: string;
  storeName?: string;
  isSuperAdmin: boolean;
}

export const SignatureRequestsPanel = ({
  storeId,
  storeName,
  isSuperAdmin,
}: SignatureRequestsPanelProps) => {
  const { toast } = useToast();
  const [requests, setRequests] = useState<SignatureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);

  useEffect(() => {
    if (storeId) {
      fetchRequests();
    }
  }, [storeId]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("signature_requests")
        .select(`
          *,
          signer:profiles!signature_requests_signer_id_fkey(full_name, email)
        `)
        .eq("store_id", storeId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Check for expired requests and update them
      const now = new Date();
      const updatedRequests = (data || []).map(req => {
        if (req.status === "pending" && new Date(req.expires_at) < now) {
          return { ...req, status: "expired" as const };
        }
        return req;
      });

      setRequests(updatedRequests as SignatureRequest[]);
    } catch (error: any) {
      console.error("Error fetching signature requests:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load signature requests",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (pdfPath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("signature-documents")
        .download(pdfPath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error("Error downloading PDF:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to download document",
      });
    }
  };

  const handleResend = async (request: SignatureRequest) => {
    setResendingId(request.id);
    try {
      // Use external signer info if available, otherwise fall back to linked profile
      const signerEmail = request.signer_email || request.signer?.email;
      const signerName = request.signer_name || request.signer?.full_name;

      if (!signerEmail || !signerName) {
        throw new Error("No signer information available");
      }

      const { error } = await supabase.functions.invoke("send-signature-request", {
        body: {
          requestId: request.id,
          signerEmail,
          signerName,
          title: request.title,
          message: request.message,
          storeName,
        },
      });

      if (error) throw error;

      toast({
        title: "Email resent",
        description: `Reminder sent to ${signerName}`,
      });
    } catch (error: any) {
      console.error("Error resending email:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to resend email",
      });
    } finally {
      setResendingId(null);
    }
  };

  // Get display name: prefer external signer fields, fall back to linked profile
  const getSignerDisplay = (request: SignatureRequest) => {
    if (request.signer_name && request.signer_email) {
      return `${request.signer_name} (${request.signer_email})`;
    }
    if (request.signer?.full_name) {
      return request.signer.full_name;
    }
    return "Unknown signer";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Pending</Badge>;
      case "viewed":
        return <Badge variant="secondary" className="gap-1"><Eye className="h-3 w-3" /> Viewed</Badge>;
      case "signed":
        return <Badge className="gap-1 bg-green-600"><CheckCircle2 className="h-3 w-3" /> Signed</Badge>;
      case "expired":
        return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" /> Expired</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5" />
            Signature Requests
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchRequests}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Request
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileSignature className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No signature requests yet</p>
            <p className="text-sm">Create a request to get documents signed</p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((request) => (
              <div
                key={request.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium truncate">{request.title}</p>
                    {getStatusBadge(request.status)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    To: {getSignerDisplay(request)} • {format(new Date(request.created_at), "MMM d, yyyy")}
                  </p>
                  {request.signed_at && (
                    <p className="text-sm text-green-600">
                      Signed: {format(new Date(request.signed_at), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-4">
                  {request.status === "signed" && request.signed_pdf_path && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(request.signed_pdf_path!, `${request.title}_signed.pdf`)}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Signed
                    </Button>
                  )}
                  {(request.status === "pending" || request.status === "viewed") && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleResend(request)}
                      disabled={resendingId === request.id}
                    >
                      {resendingId === request.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Mail className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(request.original_pdf_path, `${request.title}.pdf`)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <SignatureRequestDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        storeId={storeId}
        storeName={storeName}
      />
    </Card>
  );
};
