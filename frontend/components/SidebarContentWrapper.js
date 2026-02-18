"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useSidebar } from "@/context/SidebarContext";

export default function SidebarContentWrapper({ children }) {
  const { sidebarOpen } = useSidebar();
  const pathname = usePathname();
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [pathname]);

  return (
    <div
      ref={ref}
      data-sidebar-content
      className={`flex flex-1 flex-col min-h-0 min-w-0 overflow-y-auto overflow-x-hidden pt-14 safe-top safe-left safe-right md:pt-0 border-t border-border bg-background transition-[margin-left] duration-300 ease-out ${
        sidebarOpen ? "md:ml-[72px] lg:ml-[88px] xl:ml-[100px]" : "md:ml-12"
      }`}
      style={{ overscrollBehavior: "contain" }}
    >
      {children}
    </div>
  );
}
