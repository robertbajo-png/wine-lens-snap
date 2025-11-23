import { Navigate, Outlet, createBrowserRouter, useLocation } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import BottomTabLayout from "@/layouts/BottomTabLayout";
import ForYou from "@/pages/ForYou";
import Explore from "@/pages/Explore";
import WineSnap from "@/pages/WineSnap";
import Following from "@/pages/Following";
import History from "@/pages/History";
import About from "@/pages/About";
import NotFound from "@/pages/NotFound";
import Login from "@/pages/Login";
import LoginCallback from "@/pages/LoginCallback";
import Me from "@/pages/Me";

const LoadingScreen = () => (
  <div className="flex min-h-[50vh] items-center justify-center text-theme-secondary">
    Laddar...
  </div>
);

const ProtectedRoute = () => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    const params = new URLSearchParams();
    const target = `${location.pathname}${location.search}${location.hash}`;
    if (target && target !== "/") {
      params.set("redirectTo", target);
    }

    const to = params.size > 0 ? `/login?${params.toString()}` : "/login";
    return <Navigate to={to} replace />;
  }

  return <Outlet />;
};

const StartRedirect = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  const target = user ? "/for-you" : "/scan";
  return <Navigate to={target} replace />;
};

export const router = createBrowserRouter([
  {
    path: "/",
    element: <BottomTabLayout />,
    children: [
      { index: true, element: <StartRedirect /> },
      { path: "for-you", element: <ForYou /> },
      { path: "explore", element: <Explore /> },
      { path: "scan", element: <WineSnap /> },
      { path: "following", element: <Following /> },
      {
        element: <ProtectedRoute />,
        children: [
          { path: "me", element: <Me /> },
          { path: "me/wines", element: <History /> },
        ],
      },
    ],
  },
  { path: "/login", element: <Login /> },
  { path: "/login/callback", element: <LoginCallback /> },
  { path: "/om", element: <About /> },
  { path: "/skanna", element: <Navigate to="/scan" replace /> },
  { path: "/historik", element: <Navigate to="/me/wines" replace /> },
  { path: "*", element: <NotFound /> },
]);
