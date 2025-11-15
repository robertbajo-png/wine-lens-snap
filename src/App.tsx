import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Navigate,
  RouterProvider,
  createBrowserRouter,
  useNavigate,
} from "react-router-dom";
import About from "./pages/About";
import ForYou from "./pages/ForYou";
import Explore from "./pages/Explore";
import Following from "./pages/Following";
import WineSnap from "./pages/WineSnap";
import NotFound from "./pages/NotFound";
import History from "./pages/History";
import BottomTabLayout from "./layouts/BottomTabLayout";

const queryClient = new QueryClient();
const MOCK_AUTH_KEY = "ws-authenticated";

const getMockAuthState = () => {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(MOCK_AUTH_KEY) === "true";
};

const StartupRedirect = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const isAuthenticated = getMockAuthState();
    navigate(isAuthenticated ? "/for-you" : "/scan", { replace: true });
  }, [navigate]);

  return null;
};

const router = createBrowserRouter([
  {
    path: "/",
    element: <StartupRedirect />,
  },
  {
    element: <BottomTabLayout />,
    children: [
      { path: "/for-you", element: <ForYou /> },
      { path: "/explore", element: <Explore /> },
      { path: "/scan", element: <WineSnap /> },
      { path: "/following", element: <Following /> },
      { path: "/me/wines", element: <History /> },
    ],
  },
  { path: "/om", element: <About /> },
  { path: "/historik", element: <Navigate to="/me/wines" replace /> },
  { path: "/skanna", element: <Navigate to="/scan" replace /> },
  { path: "*", element: <NotFound /> },
]);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <RouterProvider router={router} />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
