import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Session } from "@supabase/supabase-js";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { getDomainForStoreGroup } from "@/utils/getDomainForStoreGroup";

const authSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  useEffect(() => {
    // Check for cross-domain session transfer tokens in URL
    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (accessToken && refreshToken) {
      // Clean the tokens from the URL immediately
      window.history.replaceState({}, "", window.location.pathname);
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ data: { session } }) => {
          if (session) {
            setSession(session);
            navigate("/dashboard");
          }
        });
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        if (session) {
          navigate("/dashboard");
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        navigate("/dashboard");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validation = authSchema.parse({
        email: formData.email,
        password: formData.password,
      });

      const { error } = await supabase.auth.signInWithPassword({
        email: validation.email,
        password: validation.password,
      });

      if (error) throw error;

      // After successful login, check if user should be on a branded domain
      const { data: { user: signedInUser, session: currentSession } } = await supabase.auth.getUser().then(async (userRes) => {
        const sessionRes = await supabase.auth.getSession();
        return { data: { user: userRes.data.user, session: sessionRes.data.session } };
      });
      if (signedInUser) {
        const { data: profileForDomain } = await supabase
          .from('profiles')
          .select('store_group_id, store_id')
          .eq('id', signedInUser.id)
          .single();

        const targetDomain = await getDomainForStoreGroup(profileForDomain?.store_group_id, profileForDomain?.store_id);
        const currentOrigin = window.location.origin;

        if (targetDomain !== currentOrigin && currentSession) {
          setRedirecting(true);
          // Pass session tokens so the branded domain can pick up the session
          const redirectUrl = new URL("/auth", targetDomain);
          redirectUrl.searchParams.set("access_token", currentSession.access_token);
          redirectUrl.searchParams.set("refresh_token", currentSession.refresh_token);
          window.location.href = redirectUrl.toString();
          return;
        }
      }

      toast({
        title: "Welcome back!",
        description: "Successfully signed in.",
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

  if (session || redirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Redirecting to your dealership portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            Sign In
          </CardTitle>
          <CardDescription className="text-center">
            Enter your credentials to access your scorecard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Loading..." : "Sign In"}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            <button
              onClick={() => navigate("/reset-password")}
              className="text-primary hover:underline"
              type="button"
            >
              Forgot password?
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
