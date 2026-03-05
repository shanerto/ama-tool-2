import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { IBM_Plex_Mono } from "next/font/google";
import TickerBar from "@/components/TickerBar";
import "./globals.css";

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: "500",
  variable: "--font-ibm-plex-mono",
});

export const metadata: Metadata = {
  title: "AMA Board",
  description: "Ask Me Anything — submit and vote on questions for live events",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${ibmPlexMono.variable}`}>
      <body className="font-sans min-h-screen text-gray-900 antialiased">
        <TickerBar />
        {children}
      </body>
    </html>
  );
}
