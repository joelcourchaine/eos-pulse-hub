import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Smartphone, Check, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const Install = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    // Check if iOS
    const ua = window.navigator.userAgent;
    const isIOSDevice = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // Listen for install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-primary flex items-center justify-center">
            <Smartphone className="h-8 w-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Install EOS Pulse Hub</CardTitle>
          <CardDescription>
            Add this app to your home screen for quick access and a native app experience
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isInstalled ? (
            <div className="text-center space-y-4">
              <div className="mx-auto h-12 w-12 rounded-full bg-accent/20 flex items-center justify-center">
                <Check className="h-6 w-6 text-accent" />
              </div>
              <p className="text-muted-foreground">
                App is already installed! You can find it on your home screen.
              </p>
              <Button onClick={() => navigate("/auth")} className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Go to App
              </Button>
            </div>
          ) : isIOS ? (
            <div className="space-y-4">
              <div className="bg-muted rounded-lg p-4 space-y-3">
                <p className="font-medium text-sm">To install on iOS:</p>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Tap the <strong>Share</strong> button in Safari</li>
                  <li>Scroll down and tap <strong>Add to Home Screen</strong></li>
                  <li>Tap <strong>Add</strong> in the top right</li>
                </ol>
              </div>
              <Button variant="outline" onClick={() => navigate("/auth")} className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Continue in Browser
              </Button>
            </div>
          ) : deferredPrompt ? (
            <div className="space-y-4">
              <Button onClick={handleInstall} className="w-full" size="lg">
                <Download className="mr-2 h-4 w-4" />
                Install App
              </Button>
              <Button variant="outline" onClick={() => navigate("/auth")} className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Continue in Browser
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-muted rounded-lg p-4">
                <p className="text-sm text-muted-foreground">
                  To install this app, open it in Chrome or Edge and look for the install option in your browser's menu.
                </p>
              </div>
              <Button variant="outline" onClick={() => navigate("/auth")} className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Continue in Browser
              </Button>
            </div>
          )}

          <div className="pt-4 border-t">
            <h4 className="font-medium text-sm mb-2">Benefits of installing:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Quick access from your home screen</li>
              <li>• Works offline for viewing cached data</li>
              <li>• Full-screen experience without browser UI</li>
              <li>• Faster loading times</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Install;