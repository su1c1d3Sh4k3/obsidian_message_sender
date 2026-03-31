import type { ReactNode } from "react";
import SideNavBar from "./SideNavBar";
import TopNavBar from "./TopNavBar";
import BottomNavBar from "./BottomNavBar";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex">
      <SideNavBar />
      <main className="flex-1 md:ml-64 flex flex-col min-h-screen pb-16 md:pb-0">
        <TopNavBar />
        <div className="p-6 md:p-8 max-w-7xl mx-auto w-full flex-1">{children}</div>
      </main>
      <BottomNavBar />
    </div>
  );
}
