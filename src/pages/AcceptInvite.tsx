import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertCircle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

const AcceptInvite = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"validating" | "error">("validating");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    const validateToken = async () => {
      const token = searchParams.get("token");

      if (!token) {
        setStatus("error");
        setErrorMessage("No invitation token found in the URL.");
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke("validate-auth-token", {
          body: { token },
        });

        if (error) {
          console.error("Token validation error:", error);
          setStatus("error");
          setErrorMessage(error.message || "This link is invalid or has expired.");
          return;
        }

        if (data?.redirect_url) {
          // Redirect to the fresh Supabase auth link
          window.location.href = data.redirect_url;
        } else if (data?.error) {
          setStatus("error");
          setErrorMessage(data.error);
        } else {
          setStatus("error");
          setErrorMessage("An unexpected error occurred. Please try again.");
        }
      } catch (err) {
        console.error("Error validating token:", err);
        setStatus("error");
        setErrorMessage("Failed to validate the invitation link. Please try again.");
      }
    };

    validateToken();
  }, [searchParams]);

  if (status === "validating") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <h1 className="text-2xl font-semibold text-foreground">
            Validating your invitation...
          </h1>
          <p className="text-muted-foreground">
            Please wait while we prepare your account setup.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full space-y-6 text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">
            Link Invalid or Expired
          </h1>
          <p className="text-muted-foreground">
            {errorMessage}
          </p>
        </div>

        <div className="bg-muted/50 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Mail className="h-4 w-4" />
            <span>Need a new invitation?</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Contact your administrator to resend the invitation link.
          </p>
        </div>

        <Button
          variant="outline"
          onClick={() => window.location.href = "/auth"}
          className="w-full"
        >
          Go to Login
        </Button>
      </div>
    </div>
  );
};

export default AcceptInvite;
