import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const emailSchema = z.object({
  email: z.string().email("Invalid email address"),
});

const passwordSchema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Password must be at least 6 characters"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type FlowState = 'loading' | 'validating-token' | 'request' | 'email-sent' | 'set-password' | 'success' | 'expired';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [flowState, setFlowState] = useState<FlowState>('loading');
  const [userEmail, setUserEmail] = useState<string>("");
  const [customToken, setCustomToken] = useState<string | null>(null);

  useEffect(() => {
    const checkRecoveryFlow = async () => {
      // Check for custom token first (new flow)
      const tokenParam = searchParams.get('token');
      if (tokenParam) {
        console.log('Found custom token, validating...');
        setFlowState('validating-token');
        setCustomToken(tokenParam);
        
        // Validate the custom token
        const { data, error } = await supabase.functions.invoke('validate-auth-token', {
          body: { token: tokenParam }
        });

        if (error) {
          console.error('Error validating token:', error);
          setFlowState('expired');
          return;
        }

        if (!data.valid) {
          console.log('Token validation failed:', data.error);
          setFlowState('expired');
          return;
        }

        // Token is valid - redirect to the Supabase action_link
        if (data.action_link) {
          console.log('Token valid, redirecting to Supabase action link...');
          window.location.href = data.action_link;
          return;
        } else {
          setFlowState('expired');
          return;
        }
      }

      // Legacy flow: Check for ?continue= parameter (for backwards compatibility)
      const continueParam = searchParams.get('continue');
      if (continueParam) {
        const decoded = decodeURIComponent(continueParam);
        if (decoded.startsWith('http')) {
          // Redirect directly to the Supabase link
          console.log('Found continue parameter, redirecting...');
          window.location.href = decoded;
          return;
        }
      }

      // Check if this is a password recovery flow from email link
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const type = hashParams.get('type');
      const error = hashParams.get('error');
      const errorDescription = hashParams.get('error_description');

      // Handle errors in the URL
      if (error) {
        console.error("Auth error:", error, errorDescription);
        setFlowState('expired');
        return;
      }

      if (type === 'recovery') {
        // Wait for Supabase to process the recovery token
        let attempts = 0;
        const maxAttempts = 10;

        while (attempts < maxAttempts) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            setUserEmail(session.user.email || "");
            setFlowState('set-password');
            // Clear the hash to prevent issues on refresh
            window.history.replaceState(null, '', window.location.pathname);
            return;
          }
          await new Promise(resolve => setTimeout(resolve, 500));
          attempts++;
        }

        // Session never established
        setFlowState('expired');
        return;
      }

      // Not a recovery flow - check if user already has a session (maybe they refreshed)
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // User has a session, they might have refreshed during reset flow
        setUserEmail(session.user.email || "");
        setFlowState('set-password');
        return;
      }

      // Normal password reset request flow
      setFlowState('request');
    };

    checkRecoveryFlow();
  }, [searchParams]);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validation = emailSchema.parse({ email });

      const response = await supabase.functions.invoke('send-password-reset', {
        body: { email: validation.email }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to send password reset email');
      }

      setFlowState('email-sent');
      toast({
        title: "Check your email",
        description: "If an account exists with this email, we've sent you a password reset link.",
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast({
          variant: "destructive",
          title: "Validation error",
          description: error.errors[0].message,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validation = passwordSchema.parse({ password, confirmPassword });

      // Verify we have an active session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Your session has expired. Please request a new password reset link.");
      }

      const { error } = await supabase.auth.updateUser({
        password: validation.password,
      });

      if (error) throw error;
      
      // Verify the update
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Password update could not be verified. Please try again.");
      }
      
      // Record that password was successfully set (used for invite vs reset flow detection)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ password_set_at: new Date().toISOString() })
        .eq('id', user.id);

      if (profileError) {
        console.error('Failed to update password_set_at:', profileError);
        // Non-blocking - password was still set successfully
      }

      // Mark the custom token as used if we have one
      if (customToken) {
        await supabase.functions.invoke('mark-token-used', {
          body: { token: customToken }
        });
      }
      
      console.log("Password successfully updated for user:", user.email);
      setFlowState('success');

      toast({
        title: "Password updated!",
        description: "Your password has been successfully updated.",
      });

      // Sign out and redirect after delay
      setTimeout(async () => {
        await supabase.auth.signOut();
        navigate("/auth");
      }, 2000);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast({
          variant: "destructive",
          title: "Validation error",
          description: error.errors[0].message,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message,
        });
        // If session expired, show the expired state
        if (error.message.includes("expired") || error.message.includes("session")) {
          setFlowState('expired');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (flowState === 'loading' || flowState === 'validating-token') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">
              {flowState === 'validating-token' ? 'Validating your reset link...' : 'Verifying your reset link...'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (flowState === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Password Updated!</h2>
            <p className="text-muted-foreground text-center mb-4">
              Your password has been set successfully. Redirecting you to login...
            </p>
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Expired state - improved UX
  if (flowState === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-2xl font-bold">
              Link Expired
            </CardTitle>
            <CardDescription className="text-base">
              Your password reset link has expired or was already used.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-muted bg-muted/50">
              <AlertDescription className="text-sm">
                Reset links expire after 24 hours and can only be used once. If your link was opened by email security software, it may have been consumed.
              </AlertDescription>
            </Alert>
            
            <div className="space-y-3">
              <Button 
                onClick={() => setFlowState('request')} 
                className="w-full"
                size="lg"
              >
                Request New Reset Link
              </Button>
              <Button 
                onClick={() => navigate("/auth")} 
                variant="ghost"
                className="w-full"
              >
                Back to Sign In
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Request state - visually distinct from login page
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          {flowState === 'set-password' ? (
            <>
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Loader2 className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl font-bold">Set New Password</CardTitle>
              <CardDescription className="text-base">
                {userEmail 
                  ? `Create a new password for ${userEmail}` 
                  : "Enter your new password below"}
              </CardDescription>
            </>
          ) : flowState === 'email-sent' ? (
            <>
              <div className="mx-auto w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="h-8 w-8 text-success" />
              </div>
              <CardTitle className="text-2xl font-bold">Check Your Email</CardTitle>
              <CardDescription className="text-base">
                We've sent a reset link to your email
              </CardDescription>
            </>
          ) : (
            <>
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <AlertCircle className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl font-bold">Reset Password</CardTitle>
              <CardDescription className="text-base">
                Enter your email to receive a password reset link
              </CardDescription>
            </>
          )}
        </CardHeader>
        <CardContent>
          {flowState === 'set-password' ? (
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <p className="text-xs text-muted-foreground">
                  Must be at least 6 characters
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Password"
                )}
              </Button>
            </form>
          ) : flowState === 'email-sent' ? (
            <div className="text-center space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  We've sent a password reset link to <strong>{email}</strong>.
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                Click the link in your email to set a new password. The link will expire in 24 hours.
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate("/auth")}
              >
                Back to Sign In
              </Button>
            </div>
          ) : (
            <form onSubmit={handleRequestReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send Reset Link"
                )}
              </Button>
              <div className="text-center">
                <button
                  onClick={() => navigate("/auth")}
                  className="text-sm text-primary hover:underline"
                  type="button"
                >
                  Back to Sign In
                </button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
