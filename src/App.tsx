import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Navigate, RouterProvider, createBrowserRouter } from "react-router-dom";
import { readAuthState } from "./lib/mockAuth";
import ForYou from "./pages/ForYou";
import Explore from "./pages/Explore";
import WineSnap from "./pages/WineSnap";
import Following from "./pages/Following";
import History from "./pages/History";
import About from "./pages/About";
import NotFound from "./pages/NotFound";
import Profile from "./pages/Profile";
import BottomTabLayout from "./layouts/BottomTabLayout";

const queryClient = new QueryClient();

const StartRedirect = () => {
  const target = readAuthState() === "authenticated" ? "/for-you" : "/scan";
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
      { path: "me", element: <Profile /> },
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
    <Toaster />
    <Sonner />
    <RouterProvider router={router} />
  </QueryClientProvider>
);

export default App;
