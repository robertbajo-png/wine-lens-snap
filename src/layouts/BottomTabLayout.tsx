import { type CSSProperties } from "react";
import { Outlet } from "react-router-dom";
import BottomTabBar from "@/components/navigation/BottomTabBar";

const contentPadding: CSSProperties = {
  paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 6.5rem)",
};

const BottomTabLayout = () => {
  return (
    <div className="flex min-h-screen flex-col bg-theme-canvas text-theme-secondary">
      <main className="flex-1" style={contentPadding}>
        <Outlet />
      </main>
      <BottomTabBar />
    </div>
  );
};

export default BottomTabLayout;
