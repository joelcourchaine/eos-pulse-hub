import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { z } from "zod";
import { Loader2, AlertCircle, CheckCircle, Mail } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const passwordSchema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type FlowState = 'loading' | 'validating-token' | 'ready' | 'expired' | 'success' | 'error';

const SetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [flowState, setFlowState] = useState<FlowState>('loading');
  const [errorMessage, setErrorMessage] = useState("");
  const [resendingEmail, setResendingEmail] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [customToken, setCustomToken] = useState<string | null>(null);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const checkInvite = async () => {
      try {
        // Check for custom token (our token system with 7-day expiry)
        const tokenParam = searchParams.get('token');
        if (tokenParam) {
          console.log('Found custom token, validating...');
          setFlowState('validating-token');
          setCustomToken(tokenParam);
          
          // Validate the custom token via our edge function
          const { data, error } = await supabase.functions.invoke('validate-auth-token', {
            body: { token: tokenParam }
          });

          if (error) {
            console.error('Error validating token:', error);
            setFlowState('error');
            setErrorMessage('Unable to validate your invitation link. Please try again or request a new link.');
            return;
          }

          if (!data.valid) {
            console.log('Token validation failed:', data.error);
            if (data.error === 'expired') {
              setFlowState('expired');
              setErrorMessage('Your invitation link has expired. Please request a new one from your administrator.');
            } else if (data.error === 'already_used') {
              setFlowState('expired');
              setErrorMessage('This invitation link has already been used. If you need to reset your password, use the "Forgot Password" option.');
            } else {
              setFlowState('error');
              setErrorMessage('Invalid invitation link. Please request a new one from your administrator.');
            }
            return;
          }

          // Token is valid - store user info and show password form directly
          // NO redirect to action_link - we handle password setting ourselves
          console.log('Token valid for user:', data.user_id);
          setUserId(data.user_id);
          setUserEmail(data.email || '');
          
          // Try to get the user's name from profiles
          if (data.user_id) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', data.user_id)
              .single();
            
            if (profileData?.full_name) {
              setUserName(profileData.full_name);
            }
          }
          
          // Go directly to ready state - user can set password
          setFlowState('ready');
          return;
        }

        // Legacy flow: Check for ?continue= parameter (for backwards compatibility)
        const continueParam = searchParams.get('continue');
        if (continueParam) {
          const decoded = decodeURIComponent(continueParam);
          if (decoded.startsWith('http')) {
            console.log('Found continue parameter, redirecting...');
            window.location.href = decoded;
            return;
          }
        }

        // Check for error in hash (Supabase puts errors here)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const error = hashParams.get('error');
        const errorDescription = hashParams.get('error_description');
        const type = hashParams.get('type');

        // Handle explicit errors from Supabase
        if (error) {
          console.error("Auth error:", error, errorDescription);
          if (error === 'access_denied' || errorDescription?.includes('expired')) {
            setFlowState('expired');
            setErrorMessage("Your invitation link has expired. Please request a new one.");
          } else {
            setFlowState('error');
            setErrorMessage(errorDescription || "There was a problem with your invitation link.");
          }
          return;
        }

        // Check if this is a valid invite flow from Supabase redirect
        if (type === 'invite' || type === 'signup' || type === 'recovery') {
          // Wait a moment for Supabase to process the token
          await new Promise(resolve => setTimeout(resolve, 500));

          // Try to get the session
          const { data: { session } } = await supabase.auth.getSession();

          if (session?.user) {
            setUserId(session.user.id);
            setUserEmail(session.user.email || "");

            // Get profile info
            const { data: profileData } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', session.user.id)
              .single();

            if (profileData?.full_name) {
              setUserName(profileData.full_name);
            }

            setFlowState('ready');
            return;
          }
        }

        // No valid token or session - redirect to auth
        navigate("/auth");

      } catch (err: unknown) {
        console.error("Error checking invite:", err);
        setFlowState('error');
        setErrorMessage(err instanceof Error ? err.message : "An unexpected error occurred.");
      }
    };

    checkInvite();
  }, [navigate, searchParams]);

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validation = passwordSchema.safeParse({ password, confirmPassword });
      
      if (!validation.success) {
        toast.error(validation.error.errors[0].message);
        setLoading(false);
        return;
      }

      // If we have a custom token, use our edge function to set password
      // This bypasses Supabase's 1-hour token expiry completely
      if (customToken) {
        console.log('Setting password via custom token...');
        const { data, error } = await supabase.functions.invoke('set-password-with-token', {
          body: { token: customToken, password: password }
        });

        if (error) {
          console.error('Error setting password:', error);
          throw new Error(error.message || 'Failed to set password');
        }

        if (!data.success) {
          throw new Error(data.error || 'Failed to set password');
        }

        console.log('Password set successfully via custom token');
        setFlowState('success');
        toast.success("Password created successfully!");
        
        // Redirect to login after a brief delay
        setTimeout(() => {
          navigate("/auth");
        }, 2000);
      } else {
        // Fallback: If we have an active session (legacy flow), use updateUser
        const { error } = await supabase.auth.updateUser({
          password: password,
        });

        if (error) throw error;

        // Record that password was successfully set
        if (userId) {
          await supabase
            .from('profiles')
            .update({ password_set_at: new Date().toISOString() })
            .eq('id', userId);
        }

        setFlowState('success');
        toast.success("Password created successfully!");
        
        // Sign out and redirect after a brief delay
        setTimeout(async () => {
          await supabase.auth.signOut();
          navigate("/auth");
        }, 2000);
      }
    } catch (error: unknown) {
      console.error('Password set error:', error);
      toast.error(error instanceof Error ? error.message : "Failed to create password");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestNewInvite = async () => {
    setResendingEmail(true);
    try {
      if (userEmail) {
        const { error } = await supabase.functions.invoke('send-password-reset', {
          body: { email: userEmail }
        });
        
        if (error) throw error;
        
        toast.success("A new password reset link has been sent to your email.");
      } else {
        toast.error("Please contact your administrator to resend your invitation.");
      }
    } catch {
      toast.error("Unable to send a new link. Please contact your administrator.");
    } finally {
      setResendingEmail(false);
    }
  };

  // Loading state
  if (flowState === 'loading' || flowState === 'validating-token') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">
              {flowState === 'validating-token' ? 'Validating your invitation...' : 'Verifying your invitation...'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Expired/Error state
  if (flowState === 'expired' || flowState === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold flex items-center gap-2">
              <AlertCircle className="h-6 w-6 text-destructive" />
              {flowState === 'expired' ? "Link Expired" : "Something Went Wrong"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Unable to continue</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
            
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Invitation links expire after 7 days and can only be used once. If you've already clicked the link,
                try using the "Forgot password" option on the login page.
              </p>

              {userEmail && (
                <Button
                  onClick={handleRequestNewInvite}
                  disabled={resendingEmail}
                  className="w-full"
                  variant="outline"
                >
                  {resendingEmail ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="mr-2 h-4 w-4" />
                      Send New Password Reset Link
                    </>
                  )}
                </Button>
              )}
              
              <Button 
                onClick={() => navigate("/auth")} 
                className="w-full"
              >
                Go to Login
              </Button>
              
              <Button 
                onClick={() => navigate("/reset-password")} 
                variant="ghost"
                className="w-full"
              >
                Forgot Password?
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (flowState === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle className="h-12 w-12 text-emerald-500 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Password Created!</h2>
            <p className="text-muted-foreground text-center mb-4">
              Your password has been set successfully. Redirecting you to login...
            </p>
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Ready state - show password form
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Create Your Password</CardTitle>
          <CardDescription>
            Welcome! Please create a password for your new account.
          </CardDescription>
          {(userEmail || userName) && (
            <div className="mt-4 p-4 bg-muted rounded-md space-y-1">
              {userName && (
                <p className="text-sm">
                  <span className="font-medium">Name:</span> {userName}
                </p>
              )}
              {userEmail && (
                <p className="text-sm">
                  <span className="font-medium">Email:</span> {userEmail}
                </p>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSetPassword} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                New Password
              </label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Must be at least 6 characters
              </p>
            </div>
            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-sm font-medium">
                Confirm Password
              </label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Password"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default SetPassword;
