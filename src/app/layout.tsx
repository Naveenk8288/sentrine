import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SentinelAI — Customer Sentiment & Anomaly Intelligence",
  description:
    "Detect customer sentiment shifts, isolate root-cause topics and emerging terms, and investigate feedback anomalies across products in real time.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SentinelAI",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0e0a07",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="dark h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#0e0a07] text-[#faf5ee] selection:bg-[#e6b86e]/25 selection:text-[#f8deb0]">
        {children}
      </body>
    </html>
  );
}
