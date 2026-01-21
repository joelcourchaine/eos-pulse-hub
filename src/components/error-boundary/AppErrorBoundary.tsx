import React from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type Props = {
  title?: string;
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  error?: unknown;
};

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown) {
    // Keep console error for debugging; avoid crashing the whole app.
    // eslint-disable-next-line no-console
    console.error("[AppErrorBoundary]", error);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <Alert>
          <AlertTitle>{this.props.title ?? "Something went wrong"}</AlertTitle>
          <AlertDescription className="mt-2 space-y-3">
            <p>
              The page hit an error while rendering. Try reloading or resetting this view.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => window.location.reload()}>
                Reload
              </Button>
              <Button onClick={this.handleReset}>Reset</Button>
            </div>
          </AlertDescription>
        </Alert>
      );
    }

    return this.props.children;
  }
}
