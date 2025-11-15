import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { AuthProvider } from "@/auth/AuthProvider";
import { router } from "@/router";
import { SettingsProvider } from "@/settings/SettingsContext";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <SettingsProvider>
        <Toaster />
        <Sonner />
        <RouterProvider router={router} />
      </SettingsProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
