import { useEffect, useState } from "react";
import { Navigate, Outlet, createBrowserRouter, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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

const GuardSkeleton = () => (
  <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-12 text-theme-secondary">
    <div className="space-y-3 text-center">
      <Skeleton className="mx-auto h-4 w-24" />
      <Skeleton className="mx-auto h-6 w-48" />
      <Skeleton className="mx-auto h-3 w-64" />
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      {[...Array(4)].map((_, index) => (
        <div key={index} className="space-y-3 rounded-2xl border border-theme-card bg-theme-elevated p-4 shadow-sm">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-40" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-11/12" />
            <Skeleton className="h-3 w-10/12" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

const LoginPrompt = ({ to }: { to: string }) => (
  <div className="mx-auto flex min-h-[50vh] max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
    <div className="space-y-2">
      <p className="text-sm uppercase tracking-[0.2em] text-theme-secondary">Begränsad sida</p>
      <h1 className="text-2xl font-semibold text-theme-primary">Du behöver logga in</h1>
      <p className="text-theme-secondary">
        Logga in för att se din profil och historik. Vi sparar din destination så att du kommer rätt efteråt.
      </p>
    </div>
    <div className="flex flex-wrap justify-center gap-3">
      <Button asChild className="rounded-full bg-gradient-to-r from-[#7B3FE4] via-[#8451ED] to-[#B095FF] px-6 text-theme-primary shadow-[0_18px_45px_-18px_rgba(123,63,228,1)]">
        <a href={to}>Logga in</a>
      </Button>
      <Button asChild variant="ghost" className="rounded-full border border-theme-card bg-theme-elevated text-theme-primary hover:bg-theme-elevated/80">
        <a href="/scan">Fortsätt till skanning</a>
      </Button>
    </div>
  </div>
);

const ProtectedRoute = () => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [showSkeleton, setShowSkeleton] = useState(true);

  useEffect(() => {
    if (!loading) {
      setShowSkeleton(false);
      return;
    }

    const timer = window.setTimeout(() => setShowSkeleton(false), 1000);
    return () => window.clearTimeout(timer);
  }, [loading]);

  if (loading) {
    return showSkeleton ? <GuardSkeleton /> : <LoadingScreen />;
  }

  if (!user) {
    const params = new URLSearchParams();
    const target = `${location.pathname}${location.search}${location.hash}`;
    if (target && target !== "/") {
      params.set("redirectTo", target);
    }

    const to = params.size > 0 ? `/login?${params.toString()}` : "/login";
    return <LoginPrompt to={to} />;
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
