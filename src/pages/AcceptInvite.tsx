import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CheckCircle2, XCircle, AlertCircle, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type FlowState = 'validating' | 'success' | 'expired' | 'used' | 'error';

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [flowState, setFlowState] = useState<FlowState>('validating');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [isRequestingNewLink, setIsRequestingNewLink] = useState(false);

  useEffect(() => {
    const token = searchParams.get('token');
    
    if (!token) {
      setFlowState('error');
      setErrorMessage('No invitation token provided. Please check your email link.');
      return;
    }

    validateToken(token);
  }, [searchParams]);

  const validateToken = async (token: string) => {
    try {
      console.log('Validating invitation token...');
      
      const { data, error } = await supabase.functions.invoke('validate-auth-token', {
        body: { token },
      });

      if (error) {
        console.error('Function invoke error:', error);
        setFlowState('error');
        setErrorMessage('Failed to validate your invitation. Please try again or request a new link.');
        return;
      }

      if (!data.success) {
        console.log('Token validation failed:', data.code, data.error);
        
        if (data.email) {
          setEmail(data.email);
        }

        switch (data.code) {
          case 'TOKEN_EXPIRED':
            setFlowState('expired');
            setErrorMessage('This invitation link has expired.');
            break;
          case 'TOKEN_ALREADY_USED':
            setFlowState('used');
            setErrorMessage('This invitation link has already been used.');
            break;
          case 'TOKEN_NOT_FOUND':
            setFlowState('error');
            setErrorMessage('Invalid invitation link. Please check your email for the correct link.');
            break;
          default:
            setFlowState('error');
            setErrorMessage(data.error || 'An unknown error occurred.');
        }
        return;
      }

      // Success - redirect to the fresh auth URL
      console.log('Token valid, redirecting to:', data.redirectUrl);
      setFlowState('success');
      
      // Small delay to show success state before redirect
      setTimeout(() => {
        window.location.href = data.redirectUrl;
      }, 1000);
      
    } catch (err) {
      console.error('Error validating token:', err);
      setFlowState('error');
      setErrorMessage('An unexpected error occurred. Please try again.');
    }
  };

  const handleRequestNewLink = async () => {
    if (!email) {
      toast({
        title: "Email not available",
        description: "Please contact your administrator to resend your invitation.",
        variant: "destructive",
      });
      return;
    }

    setIsRequestingNewLink(true);
    try {
      const { error } = await supabase.functions.invoke('send-password-reset', {
        body: { email },
      });

      if (error) throw error;

      toast({
        title: "New link sent!",
        description: "Check your email for a new invitation link.",
      });
    } catch (err) {
      console.error('Error requesting new link:', err);
      toast({
        title: "Failed to send new link",
        description: "Please contact your administrator for assistance.",
        variant: "destructive",
      });
    } finally {
      setIsRequestingNewLink(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">
            {flowState === 'validating' && 'Verifying Invitation'}
            {flowState === 'success' && 'Welcome!'}
            {flowState === 'expired' && 'Link Expired'}
            {flowState === 'used' && 'Link Already Used'}
            {flowState === 'error' && 'Invalid Link'}
          </CardTitle>
          <CardDescription>
            {flowState === 'validating' && 'Please wait while we verify your invitation...'}
            {flowState === 'success' && 'Redirecting you to set your password...'}
            {flowState === 'expired' && 'Your invitation link has expired after 7 days.'}
            {flowState === 'used' && 'This invitation has already been used to set up an account.'}
            {flowState === 'error' && 'There was a problem with your invitation link.'}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {flowState === 'validating' && (
            <div className="flex flex-col items-center py-8">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="mt-4 text-muted-foreground">Validating your invitation...</p>
            </div>
          )}

          {flowState === 'success' && (
            <div className="flex flex-col items-center py-8">
              <CheckCircle2 className="h-12 w-12 text-primary" />
              <p className="mt-4 text-muted-foreground">Taking you to set your password...</p>
              <Loader2 className="h-6 w-6 animate-spin text-primary mt-4" />
            </div>
          )}

          {flowState === 'expired' && (
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Invitation Expired</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
              
              {email && (
                <Button 
                  onClick={handleRequestNewLink} 
                  disabled={isRequestingNewLink}
                  className="w-full"
                >
                  {isRequestingNewLink ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="mr-2 h-4 w-4" />
                      Request New Link
                    </>
                  )}
                </Button>
              )}
              
              <p className="text-sm text-muted-foreground text-center">
                Or contact your administrator to resend your invitation.
              </p>
            </div>
          )}

          {flowState === 'used' && (
            <div className="space-y-4">
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Already Activated</AlertTitle>
                <AlertDescription>
                  This invitation has already been used. If you've already set up your account, you can log in below.
                </AlertDescription>
              </Alert>
              
              <Button asChild className="w-full">
                <Link to="/auth">Go to Login</Link>
              </Button>
              
              <div className="text-center">
                <Link 
                  to="/reset-password" 
                  className="text-sm text-primary hover:underline"
                >
                  Forgot your password?
                </Link>
              </div>
            </div>
          )}

          {flowState === 'error' && (
            <div className="space-y-4">
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
              
              <Button asChild variant="outline" className="w-full">
                <Link to="/auth">Go to Login</Link>
              </Button>
              
              <p className="text-sm text-muted-foreground text-center">
                If you continue to have issues, please contact your administrator.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
