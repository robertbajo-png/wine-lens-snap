import { useEffect, useMemo } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider, MutationCache, QueryCache } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { ErrorBanner } from "@/components/ErrorBanner";
import { ErrorHandlingProvider, useErrorHandling } from "@/contexts/ErrorHandlingContext";
import { getLatestSupabaseInitError, subscribeToSupabaseInitFailure } from "@/lib/supabaseClient";
import { router } from "@/router";
import { SettingsProvider } from "@/settings/SettingsContext";
import { ThemeProvider } from "@/ui/ThemeProvider";
import { AuthProvider } from "@/auth/AuthProvider";

const AppShell = () => {
  const { showError, showErrorFromError } = useErrorHandling();

  useEffect(() => {
    const handleInitFailure = (error: Error) => {
      showError("Kan inte ansluta till tjänsten just nu.", {
        details: error.message,
        source: "Supabase",
      });
    };

    const latestError = getLatestSupabaseInitError();
    if (latestError) {
      handleInitFailure(latestError);
    }

    return subscribeToSupabaseInitFailure(handleInitFailure);
  }, [showError]);

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
    </QueryClientProvider>
  );
};

const App = () => (
  <AuthProvider>
    <ErrorHandlingProvider>
      <AppShell />
    </ErrorHandlingProvider>
  </AuthProvider>
);

export default App;
