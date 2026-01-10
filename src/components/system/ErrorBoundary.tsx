import { Component, type ErrorInfo, type ReactNode } from "react";
import { logEvent } from "@/lib/logger";
import { Button } from "@/components/ui/button";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const stack = error.stack ?? errorInfo.componentStack;

    void logEvent("ui_crash", {
      message: error.message,
      name: error.name,
      stack,
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-theme-canvas px-6 text-theme-primary">
          <div className="w-full max-w-md rounded-2xl border border-theme-card bg-theme-surface p-6 text-center shadow-theme-card">
            <h1 className="text-2xl font-semibold">Something went wrong</h1>
            <p className="mt-2 text-theme-secondary">Reload to get back to the app.</p>
            <Button type="button" className="mt-6 w-full" onClick={this.handleReload}>
              Reload
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
