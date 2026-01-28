import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertCircle, RefreshCw, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface LoadingTimeoutProps {
  isLoading: boolean;
  timeoutSeconds?: number;
  onRetry?: () => void;
  context?: string;
  diagnostics?: Record<string, unknown>;
}

/**
 * A component that displays a loading spinner, and after a timeout shows
 * an error state with diagnostic information and retry/logout options.
 */
export function LoadingTimeout({
  isLoading,
  timeoutSeconds = 15,
  onRetry,
  context = "Loading",
  diagnostics = {},
}: LoadingTimeoutProps) {
  const navigate = useNavigate();
  const [showTimeout, setShowTimeout] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!isLoading) {
      setShowTimeout(false);
      setElapsedSeconds(0);
      return;
    }

    const intervalId = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    const timeoutId = setTimeout(() => {
      console.error(`[LoadingTimeout] ${context} exceeded ${timeoutSeconds}s timeout`, diagnostics);
      setShowTimeout(true);
    }, timeoutSeconds * 1000);

    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, [isLoading, timeoutSeconds, context, diagnostics]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleClearStorageAndRetry = () => {
    // Clear potentially stale localStorage values that might cause loading issues
    localStorage.removeItem("selectedStore");
    localStorage.removeItem("selectedDepartment");
    localStorage.removeItem("showMobileTasksView");
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  };

  if (showTimeout) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Loading Taking Too Long
            </CardTitle>
            <CardDescription>
              The page is taking longer than expected to load. This might be a temporary issue or a problem with your session.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md space-y-1">
              <p><strong>What you can try:</strong></p>
              <ul className="list-disc list-inside space-y-1">
                <li>Clear cached data and reload</li>
                <li>Sign out and sign back in</li>
                <li>Try using an incognito/private window</li>
              </ul>
            </div>
            
            {Object.keys(diagnostics).length > 0 && (
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer hover:text-foreground">
                  Diagnostic Information
                </summary>
                <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-32">
                  {JSON.stringify(diagnostics, null, 2)}
                </pre>
              </details>
            )}
            
            <div className="flex flex-col sm:flex-row gap-2">
              <Button 
                variant="default" 
                onClick={handleClearStorageAndRetry}
                className="flex-1"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Clear & Reload
              </Button>
              <Button 
                variant="outline" 
                onClick={handleSignOut}
                className="flex-1"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Normal loading state
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">{context}...</p>
        {elapsedSeconds > 5 && (
          <p className="text-xs text-muted-foreground mt-2">
            This is taking a bit longer than usual ({elapsedSeconds}s)
          </p>
        )}
      </div>
    </div>
  );
}
