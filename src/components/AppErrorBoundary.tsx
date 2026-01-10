import { Component, type ErrorInfo, type ReactNode, useCallback } from "react";
import { DEFAULT_ERROR_MESSAGE, useErrorHandling } from "@/contexts/ErrorHandlingContext";
import { logError } from "@/lib/errorLogger";
import { Button } from "@/components/ui/button";

class ErrorBoundaryInner extends Component<{
  onError: (error: Error, errorInfo: ErrorInfo) => void;
  onReset: () => void;
  children: ReactNode;
}> {
  state: { hasError: boolean } = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.props.onError(error, errorInfo);
  }

  handleRestart = () => {
    window.location.reload();
  };

  handleTryAgain = () => {
    this.setState({ hasError: false });
    this.props.onReset();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-theme-canvas px-6 text-theme-primary">
          <div className="w-full max-w-lg rounded-2xl border border-theme-card bg-theme-surface p-6 shadow-theme-card">
            <h1 className="text-2xl font-semibold text-theme-primary">Hoppsan! Något gick fel.</h1>
            <p className="mt-2 text-theme-secondary">
              Appen stötte på ett oväntat fel. Försök igen eller starta om appen.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button type="button" onClick={this.handleRestart}>
                Starta om appen
              </Button>
              <Button type="button" variant="outline" onClick={this.handleTryAgain}>
                Försök igen
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export const AppErrorBoundary = ({ children }: { children: ReactNode }) => {
  const { showError, hideError } = useErrorHandling();

  const handleError = useCallback(
    (error: Error, errorInfo: ErrorInfo) => {
      logError(error, "React error boundary");
      logError(errorInfo.componentStack, "Component stack");
      showError(DEFAULT_ERROR_MESSAGE, {
        error,
        source: "ErrorBoundary",
        details: errorInfo.componentStack,
        isCritical: true,
      });
    },
    [showError],
  );

  const reset = useCallback(() => {
    hideError();
  }, [hideError]);

  return (
    <ErrorBoundaryInner onError={handleError} onReset={reset}>
      {children}
    </ErrorBoundaryInner>
  );
};
