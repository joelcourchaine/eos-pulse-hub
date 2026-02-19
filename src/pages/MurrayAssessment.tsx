import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock } from "lucide-react";

const ACCESS_PASSWORD = "murray_growth_2026";
const SESSION_KEY = "murray_assessment_auth";

const MurrayAssessment = () => {
  const navigate = useNavigate();
  const hostname = window.location.hostname;
  const isMurrayDomain =
    hostname === "murraygrowth.ca" ||
    hostname === "www.murraygrowth.ca" ||
    hostname === "localhost";

  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!isMurrayDomain) {
      navigate("/", { replace: true });
      return;
    }
    if (sessionStorage.getItem(SESSION_KEY) === "true") {
      setAuthenticated(true);
    }
  }, [isMurrayDomain, navigate]);

  if (!isMurrayDomain) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ACCESS_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, "true");
      setAuthenticated(true);
      setError(false);
    } else {
      setError(true);
    }
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1a2744]">
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
                View Assessment
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <iframe
      src="/assessments/murray-hyundai-winnipeg.html"
      title="Murray Hyundai Winnipeg — Service Assessment"
      style={{
        width: "100%",
        height: "100vh",
        border: "none",
      }}
    />
  );
};

export default MurrayAssessment;
