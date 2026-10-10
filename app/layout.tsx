import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Somentm HR Portal",
  description: "Intern and Employee Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable}`}>
      <body className="flex h-full min-h-screen font-sans antialiased bg-[#090a0c] text-white">
        <ClerkProvider>
          {/* Film grain and ambient glow to match landing page UI */}
          <div
          className="pointer-events-none fixed inset-0 opacity-[0.05] mix-blend-overlay z-0"
          style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "160px 160px"
          }}
          />
          <div
          className="pointer-events-none fixed inset-0 z-0"
          style={{
          background: "radial-gradient(circle at 40% -20%, rgba(255, 59, 59, 0.25), transparent 50%), radial-gradient(circle at 100% 40%, rgba(255, 77, 109, 0.15), transparent 50%)"
          }}
          />

          <div className="flex w-full relative z-10 h-screen">
          <Sidebar />
          <main className="flex-1 overflow-y-auto">
          {children}
          </main>
          </div>
        </ClerkProvider>
      </body>
    </html>
  );
}