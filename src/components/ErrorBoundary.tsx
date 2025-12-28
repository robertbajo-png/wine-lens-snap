import { Component, type ErrorInfo, type ReactNode } from "react";
import { logEvent } from "@/lib/logger";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

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
            <h1 className="text-2xl font-semibold">Något gick fel</h1>
            <p className="mt-2 text-theme-secondary">Appen stötte på ett oväntat fel. Ladda om och försök igen.</p>
            <button
              type="button"
              className="mt-6 w-full rounded-xl bg-theme-accent px-4 py-2 text-sm font-semibold text-theme-on-accent shadow-theme-card transition hover:opacity-90"
              onClick={this.handleReload}
            >
              Ladda om
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
