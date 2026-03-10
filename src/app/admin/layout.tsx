import { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import LogoutButton from "./LogoutButton";
import SiteFooter from "@/components/SiteFooter";

// Middleware already protects /admin/* routes — this layout just provides
// a consistent admin shell.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen">
      <Image
        src="/askbg.jpg"
        alt=""
        fill
        className="object-cover -z-10"
        priority
      />
      <header className="sticky top-0 z-50 bg-brand-700 text-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="font-semibold text-sm tracking-wide">
            PAXQ - Admin
          </span>
          <Link href="/" className="text-xs text-brand-200 hover:text-white transition-colors">
            ← Back to events
          </Link>
        </div>
        <LogoutButton />
      </header>
      {children}
      <div className="max-w-2xl mx-auto px-6">
        <SiteFooter />
      </div>
    </div>
  );
}
