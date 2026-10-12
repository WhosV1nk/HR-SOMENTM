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
    <html lang="en" className={inter.variable}>
      <body className="flex h-full min-h-screen bg-bg font-sans text-text antialiased">
        <ClerkProvider
          appearance={{
            variables: {
              colorPrimary: "#ffffff",
              colorPrimaryForeground: "#090a0c",
              colorBackground: "#0f1115",
              colorForeground: "#ffffff",
              colorMuted: "#14171c",
              colorMutedForeground: "#8b929d",
              colorInput: "#14171c",
              colorInputForeground: "#ffffff",
              colorBorder: "rgba(255, 255, 255, 0.12)",
              colorRing: "rgba(255, 59, 59, 0.35)",
              colorDanger: "#ff4d6d",
              colorSuccess: "#34d399",
              colorNeutral: "#ffffff",
              borderRadius: "14px",
              fontFamily: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
            },
          }}
        >
          {/* film grain + a single soft ember bloom, as on somentm.com */}
          <div
            aria-hidden
            className="pointer-events-none fixed inset-0 z-0 opacity-[0.04] mix-blend-overlay"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
              backgroundSize: "160px 160px",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none fixed inset-0 z-0"
            style={{ background: "radial-gradient(40% 35% at 55% -5%, rgba(255, 59, 59, 0.10), transparent 70%)" }}
          />

          <div className="relative z-10 flex h-screen w-full">
            <Sidebar />
            <main className="flex-1 overflow-y-auto">{children}</main>
          </div>
        </ClerkProvider>
      </body>
    </html>
  );
}
