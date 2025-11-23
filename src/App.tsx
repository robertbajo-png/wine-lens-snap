import { useMemo } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider, MutationCache, QueryCache } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { AuthProvider } from "@/auth/AuthProvider";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { ErrorBanner } from "@/components/ErrorBanner";
import { ErrorHandlingProvider, useErrorHandling } from "@/contexts/ErrorHandlingContext";
import { router } from "@/router";
import { SettingsProvider } from "@/settings/SettingsContext";
import { ThemeProvider } from "@/ui/ThemeProvider";

const AppShell = () => {
  const { showErrorFromError } = useErrorHandling();

  const queryClient = useMemo(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error) => showErrorFromError(error, { source: "React Query" }),
        }),
        mutationCache: new MutationCache({
          onError: (error) => showErrorFromError(error, { source: "React Mutation" }),
        }),
      }),
    [showErrorFromError],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SettingsProvider>
          <ThemeProvider>
            <AppErrorBoundary>
              <ErrorBanner />
              <Toaster />
              <Sonner />
              <RouterProvider router={router} />
            </AppErrorBoundary>
          </ThemeProvider>
        </SettingsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

const App = () => (
  <ErrorHandlingProvider>
    <AppShell />
  </ErrorHandlingProvider>
);

export default App;
