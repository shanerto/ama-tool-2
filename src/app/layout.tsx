import type { Metadata } from "next";
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
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
