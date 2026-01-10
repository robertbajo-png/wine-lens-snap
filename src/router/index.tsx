import { Suspense, lazy, useEffect, useState } from "react";
import { Navigate, Outlet, createBrowserRouter, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/auth/AuthProvider";
import { useTranslation } from "@/hooks/useTranslation";
import BottomTabLayout from "@/layouts/BottomTabLayout";

const ForYou = lazy(() => import("@/pages/ForYou"));
const Explore = lazy(() => import("@/pages/Explore"));
const WineSnap = lazy(() => import("@/pages/WineSnap"));
const History = lazy(() => import("@/pages/History"));
const About = lazy(() => import("@/pages/About"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const Login = lazy(() => import("@/pages/Login"));
const LoginCallback = lazy(() => import("@/pages/LoginCallback"));
const Me = lazy(() => import("@/pages/Me"));
const DevEventsPage = lazy(() => import("@/pages/dev/Events"));
const DevFeedbackPage = lazy(() => import("@/pages/dev/Feedback"));
const WineDetail = lazy(() => import("@/pages/WineDetail"));

const LoadingScreen = () => {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-theme-secondary">
      {t("common.loading")}
    </div>
  );
};

const withSuspense = (node: JSX.Element) => (
  <Suspense fallback={<LoadingScreen />}>{node}</Suspense>
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

const LoginPrompt = ({ to }: { to: string }) => {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="space-y-2">
        <p className="text-sm uppercase tracking-[0.2em] text-theme-secondary">{t("router.restrictedPage")}</p>
        <h1 className="text-2xl font-semibold text-theme-primary">{t("router.loginRequired")}</h1>
        <p className="text-theme-secondary">{t("router.loginRequiredDesc")}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Button asChild size="lg">
          <a href={to}>{t("router.login")}</a>
        </Button>
        <Button asChild variant="secondary" size="lg">
          <a href="/scan">{t("router.continueToScan")}</a>
        </Button>
      </div>
    </div>
  );
};

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
      { path: "for-you", element: withSuspense(<ForYou />) },
      { path: "explore", element: withSuspense(<Explore />) },
      { path: "scan", element: withSuspense(<WineSnap />) },
      { path: "wine/:scanId", element: withSuspense(<WineDetail />) },
      {
        element: <ProtectedRoute />,
        children: [
          { path: "me", element: withSuspense(<Me />) },
          { path: "me/wines", element: withSuspense(<History />) },
        ],
      },
    ],
  },
  { path: "/login", element: withSuspense(<Login />) },
  { path: "/login/callback", element: withSuspense(<LoginCallback />) },
  ...(import.meta.env.DEV
    ? [
        {
          element: <ProtectedRoute />,
          children: [
            { path: "/dev/events", element: withSuspense(<DevEventsPage />) },
            { path: "/dev/feedback", element: withSuspense(<DevFeedbackPage />) },
          ],
        },
      ]
    : []),
  { path: "/om", element: withSuspense(<About />) },
  { path: "/skanna", element: <Navigate to="/scan" replace /> },
  { path: "/historik", element: <Navigate to="/me/wines" replace /> },
  { path: "*", element: withSuspense(<NotFound />) },
]);
