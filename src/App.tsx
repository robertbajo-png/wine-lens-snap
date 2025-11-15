import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Navigate, RouterProvider, createBrowserRouter } from "react-router-dom";
import ForYou from "./pages/ForYou";
import Explore from "./pages/Explore";
import WineSnap from "./pages/WineSnap";
import Following from "./pages/Following";
import History from "./pages/History";
import About from "./pages/About";
import NotFound from "./pages/NotFound";
import BottomTabLayout from "./layouts/BottomTabLayout";

const queryClient = new QueryClient();

const AUTH_STORAGE_KEY = "wineSnap:auth-state";

const readMockAuthState = () => {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(AUTH_STORAGE_KEY) === "authenticated";
};

const StartRedirect = () => {
  const target = readMockAuthState() ? "/for-you" : "/scan";
  return <Navigate to={target} replace />;
};

const router = createBrowserRouter([
  {
    path: "/",
    element: <BottomTabLayout />,
    children: [
      { index: true, element: <StartRedirect /> },
      { path: "for-you", element: <ForYou /> },
      { path: "explore", element: <Explore /> },
      { path: "scan", element: <WineSnap /> },
      { path: "following", element: <Following /> },
      { path: "me/wines", element: <History /> },
    ],
  },
  { path: "/om", element: <About /> },
  { path: "/skanna", element: <Navigate to="/scan" replace /> },
  { path: "/historik", element: <Navigate to="/me/wines" replace /> },
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
