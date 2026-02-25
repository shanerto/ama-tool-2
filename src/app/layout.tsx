import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

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
    <html lang="en" className={GeistSans.variable}>
      <body className="font-sans min-h-screen bg-gradient-to-br from-gray-50 to-slate-100 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
