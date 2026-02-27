import { ReactNode } from "react";
import Link from "next/link";
import LogoutButton from "./LogoutButton";

// Middleware already protects /admin/* routes — this layout just provides
// a consistent admin shell.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="bg-brand-700 text-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="font-semibold text-sm tracking-wide">
            Ask Paxos - Admin
          </span>
          <Link href="/" className="text-xs text-brand-200 hover:text-white transition-colors">
            ← Back to events
          </Link>
        </div>
        <LogoutButton />
      </header>
      {children}
    </div>
  );
}
