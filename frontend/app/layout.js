import { Suspense } from "react";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import SidebarContentWrapper from "@/components/SidebarContentWrapper";
import FooterOrHidden from "@/components/FooterOrHidden";
import { SavedProvider } from "@/context/SavedContext";
import { SidebarProvider } from "@/context/SidebarContext";
import AuthProviderWrapper from "@/components/AuthProviderWrapper";
import { ChosenAgentProvider } from "@/context/ChosenAgentContext";
import { LinkedAgentProvider } from "@/context/LinkedAgentContext";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Kozi | Find Your Next Home in Canada",
  description: "Canada-based real estate. Search listings and find your next home across Canada.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full overflow-hidden">
      <body className={`${inter.variable} ${geistMono.variable} h-full overflow-hidden antialiased bg-background text-foreground selection:bg-primary selection:text-white`}>
          <AuthProviderWrapper>
          <SavedProvider>
          <ChosenAgentProvider>
          <LinkedAgentProvider>
          <SidebarProvider>
          <div className="flex h-screen min-h-0">
            <Sidebar />
            <SidebarContentWrapper>
              <div className="flex-1 min-w-0 w-full">
                {children}
              </div>
              <footer id="site-footer" className="shrink-0 w-full border-t border-border bg-background">
                <Suspense>
                  <FooterOrHidden />
                </Suspense>
              </footer>
            </SidebarContentWrapper>
          </div>
          </SidebarProvider>
          </LinkedAgentProvider>
          </ChosenAgentProvider>
          </SavedProvider>
          </AuthProviderWrapper>
      </body>
    </html>
  );
}
