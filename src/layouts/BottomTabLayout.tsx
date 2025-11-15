import { Outlet } from "react-router-dom";
import { BottomTabBar } from "@/components/BottomTabBar";

export const BottomTabLayout = () => {
  return (
    <div className="relative min-h-screen bg-theme-canvas text-theme-primary">
      <div className="pb-[calc(env(safe-area-inset-bottom)+5.5rem)]">
        <Outlet />
      </div>
      <BottomTabBar />
    </div>
  );
};

export default BottomTabLayout;
