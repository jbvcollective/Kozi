import { Suspense } from "react";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import FooterOrHidden from "@/components/FooterOrHidden";
import { SavedProvider } from "@/context/SavedContext";
import AuthProviderWrapper from "@/components/AuthProviderWrapper";
import { ChosenAgentProvider } from "@/context/ChosenAgentContext";

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
  title: "LUMINA Realty | Find Your Next Home in Canada",
  description: "Canada-based real estate. Search listings and find your next home across Canada.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full overflow-hidden">
      <body className={`${inter.variable} ${geistMono.variable} h-full overflow-hidden antialiased bg-background text-foreground selection:bg-primary selection:text-white`}>
        <SavedProvider>
          <AuthProviderWrapper>
          <ChosenAgentProvider>
          <div className="flex h-screen min-h-0">
            <Sidebar />
            <div className="flex flex-1 flex-col min-h-0 overflow-y-auto overflow-x-hidden pl-[100px]" style={{ overscrollBehavior: "contain" }}>
              <main className="overflow-visible bg-background transition-premium">
                {children}
              </main>
              <Suspense fallback={null}>
                <FooterOrHidden />
              </Suspense>
            </div>
          </div>
          </ChosenAgentProvider>
          </AuthProviderWrapper>
        </SavedProvider>
      </body>
    </html>
  );
}
