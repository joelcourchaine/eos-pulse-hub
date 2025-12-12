import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

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

const ResetPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  // Check if we're in password update mode (user clicked email link)
  // Supabase puts auth params in the hash, not query params
  const [isUpdateMode, setIsUpdateMode] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    // Check if this is a password recovery flow from email link
    const checkRecoveryFlow = async () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const type = hashParams.get('type');
      
      if (type === 'recovery') {
        setIsUpdateMode(true);
        
        // Wait for Supabase to process the recovery token and establish session
        // The hash contains access_token which Supabase client will auto-process
        let attempts = 0;
        const maxAttempts = 10;
        
        const checkSession = async (): Promise<boolean> => {
          const { data: { session } } = await supabase.auth.getSession();
          return session !== null;
        };
        
        // Poll for session establishment (Supabase processes the token async)
        while (attempts < maxAttempts) {
          const hasSession = await checkSession();
          if (hasSession) {
            setSessionReady(true);
            return;
          }
          await new Promise(resolve => setTimeout(resolve, 500));
          attempts++;
        }
        
        // If session never established, show error
        toast({
          variant: "destructive",
          title: "Session expired",
          description: "Your password reset link has expired. Please request a new one.",
        });
        navigate("/auth");
      }
    };
    
    checkRecoveryFlow();
  }, [navigate, toast]);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validation = emailSchema.parse({ email });

      // Call the edge function directly to bypass the broken auth hook
      const response = await supabase.functions.invoke('send-password-reset', {
        body: { email: validation.email }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to send password reset email');
      }

      setEmailSent(true);
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

      // Verify we have an active session before attempting update
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Your session has expired. Please request a new password reset link.");
      }

      const { error } = await supabase.auth.updateUser({
        password: validation.password,
      });

      if (error) throw error;
      
      // Verify the update was successful by checking we can still get the user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Password update could not be verified. Please try again.");
      }
      
      console.log("Password successfully updated for user:", user.email);

      toast({
        title: "Password updated!",
        description: "Your password has been successfully updated.",
      });

      // Sign out and redirect to login
      await supabase.auth.signOut();
      navigate("/auth");
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            {isUpdateMode ? "Set New Password" : "Reset Password"}
          </CardTitle>
          <CardDescription className="text-center">
            {isUpdateMode
              ? "Enter your new password below"
              : emailSent
              ? "Check your email for the reset link"
              : "Enter your email to receive a password reset link"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isUpdateMode ? (
            !sessionReady ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">Verifying your reset link...</p>
              </div>
            ) : (
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
                  {loading ? "Updating..." : "Update Password"}
                </Button>
              </form>
            )
          ) : emailSent ? (
            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                We've sent a password reset link to <strong>{email}</strong>.
                Please check your email and click the link to reset your password.
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
                {loading ? "Sending..." : "Send Reset Link"}
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
