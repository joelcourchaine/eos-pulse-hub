import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { z } from "zod";
import { User } from "@supabase/supabase-js";
import { Loader2, AlertCircle, CheckCircle, Mail } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const passwordSchema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type FlowState = 'loading' | 'ready' | 'expired' | 'success' | 'error';

const SetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<{ full_name?: string } | null>(null);
  const [flowState, setFlowState] = useState<FlowState>('loading');
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [resendingEmail, setResendingEmail] = useState(false);
  const [userEmail, setUserEmail] = useState<string>("");
  const [continueUrl, setContinueUrl] = useState<string | null>(null);

  useEffect(() => {
    const checkInvite = async () => {
      try {
        // If the email client pre-opens links, it can consume one-time tokens.
        // Our emails link to /set-password?continue=<encoded_direct_link> and we only
        // navigate to the direct link after a user click.
        const searchParams = new URLSearchParams(window.location.search);
        const continueParam = searchParams.get('continue');
        if (continueParam) {
          const decoded = decodeURIComponent(continueParam);
          if (decoded.startsWith('http')) {
            setContinueUrl(decoded);
            setFlowState('error');
            setErrorMessage('Click Continue to open your secure setup link.');
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

        // Check if this is a valid invite flow
        if (type !== 'invite' && type !== 'signup' && type !== 'recovery') {
          // No valid type - might be a direct visit without token
          // Check if there's a session anyway
          const { data: { session } } = await supabase.auth.getSession();

          if (session?.user) {
            // User has a session, maybe they refreshed after clicking the link
            setUser(session.user);
            setUserEmail(session.user.email || "");

            const { data: profileData } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', session.user.id)
              .single();

            if (profileData) {
              setProfile(profileData);
            }

            setFlowState('ready');
          } else {
            // No session, no valid invite - redirect
            navigate("/auth");
          }
          return;
        }

        // Wait a moment for Supabase to process the token
        await new Promise(resolve => setTimeout(resolve, 500));

        // Try to get the session multiple times (token exchange can be slow)
        let attempts = 0;
        const maxAttempts = 5;

        while (attempts < maxAttempts) {
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();

          if (sessionError) {
            console.error("Session error:", sessionError);
          }

          if (session?.user) {
            setUser(session.user);
            setUserEmail(session.user.email || "");

            // Get profile info
            const { data: profileData } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', session.user.id)
              .single();

            if (profileData) {
              setProfile(profileData);
            }

            setFlowState('ready');
            return;
          }

          attempts++;
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }

        // If we get here, we couldn't establish a session
        setFlowState('expired');
        setErrorMessage("Your invitation link has expired or was already used. Please request a new one from your administrator.");

      } catch (err: any) {
        console.error("Error checking invite:", err);
        setFlowState('error');
        setErrorMessage(err.message || "An unexpected error occurred.");
      }
    };

    checkInvite();
  }, [navigate]);

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

      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;

      setFlowState('success');
      toast.success("Password created successfully!");
      
      // Sign out and redirect after a brief delay
      setTimeout(async () => {
        await supabase.auth.signOut();
        navigate("/auth");
      }, 2000);
    } catch (error: any) {
      toast.error(error.message || "Failed to create password");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestNewInvite = async () => {
    setResendingEmail(true);
    try {
      // Try to send a password reset email if we have the user's email
      if (userEmail) {
        const { error } = await supabase.functions.invoke('send-password-reset', {
          body: { email: userEmail }
        });
        
        if (error) throw error;
        
        toast.success("A new password reset link has been sent to your email.");
      } else {
        toast.error("Please contact your administrator to resend your invitation.");
      }
    } catch (err: any) {
      toast.error("Unable to send a new link. Please contact your administrator.");
    } finally {
      setResendingEmail(false);
    }
  };

  // Loading state
  if (flowState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Verifying your invitation...</p>
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
                Invitation links expire after 1 hour and can only be used once. If you've already clicked the link,
                try using the "Forgot password" option on the login page.
              </p>

              {continueUrl && (
                <Button
                  onClick={() => (window.location.href = continueUrl)}
                  className="w-full"
                >
                  Continue
                </Button>
              )}

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
            <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
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
          {user && (
            <div className="mt-4 p-4 bg-muted rounded-md space-y-1">
              {profile?.full_name && (
                <p className="text-sm">
                  <span className="font-medium">Name:</span> {profile.full_name}
                </p>
              )}
              <p className="text-sm">
                <span className="font-medium">Email:</span> {user.email}
              </p>
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
