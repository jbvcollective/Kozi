"use client";

import { usePathname, useSearchParams } from "next/navigation";
import Footer from "@/components/Footer";

/**
 * Hide the layout footer on Explore "View all" (search view) so the footer
 * is shown only at the end of the listings scroll inside the Explore page.
 */
export default function FooterOrHidden() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const seeAll = searchParams.get("seeAll");
  const q = searchParams.get("q");
  const isExploreViewAll = pathname === "/explore" && (seeAll || q);
  if (isExploreViewAll) return null;
  return <Footer />;
}
