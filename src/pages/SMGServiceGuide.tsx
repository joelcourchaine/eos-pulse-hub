import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock } from "lucide-react";

const ACCESS_PASSWORD = "tricare";
const SESSION_KEY = "smg_service_guide_auth";

const SMGServiceGuide = () => {
  const navigate = useNavigate();
  const hostname = window.location.hostname;
  const isSMGDomain = hostname === "smggrowth.ca" || hostname === "www.smggrowth.ca";

  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!isSMGDomain) {
      navigate("/", { replace: true });
      return;
    }
    if (sessionStorage.getItem(SESSION_KEY) === "true") {
      setAuthenticated(true);
    }
  }, [isSMGDomain, navigate]);

  if (!isSMGDomain) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.toLowerCase() === ACCESS_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, "true");
      setAuthenticated(true);
      setError(false);
    } else {
      setError(true);
    }
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <Lock className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <CardTitle className="text-lg">Protected Document</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(false);
                }}
                autoFocus
              />
              {error && (
                <p className="text-sm text-destructive">Incorrect password</p>
              )}
              <Button type="submit" className="w-full">
                View Guide
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <iframe
      src="/assessments/smg-service-guide.html"
      title="SMG Service Guide — Tricare Claims Reference"
      style={{ width: "100%", height: "100vh", border: "none" }}
    />
  );
};

export default SMGServiceGuide;
