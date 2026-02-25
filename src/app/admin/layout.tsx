import { ReactNode } from "react";
import LogoutButton from "./LogoutButton";

// Middleware already protects /admin/* routes — this layout just provides
// a consistent admin shell.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="bg-brand-700 text-white px-6 py-3 flex items-center justify-between">
        <span className="font-semibold text-sm tracking-wide">
          AMA Board — Admin
        </span>
        <LogoutButton />
      </header>
      {children}
    </div>
  );
}
