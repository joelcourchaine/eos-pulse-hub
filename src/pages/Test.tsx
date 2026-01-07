import * as Sentry from "@sentry/react";
import { Button } from "@/components/ui/button";

function ErrorButton() {
  return (
    <Button
      variant="destructive"
      onClick={() => {
        throw new Error("This is your first error!");
      }}
    >
      Break the world
    </Button>
  );
}

const Test = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold">Sentry Error Test</h1>
        <p className="text-muted-foreground">Click the button below to trigger a test error</p>
        <ErrorButton />
      </div>
    </div>
  );
};

export default Test;
