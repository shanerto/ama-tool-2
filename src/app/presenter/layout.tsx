import { ReactNode } from "react";
import Link from "next/link";

// Presenter mode uses its own minimal layout — no admin sidebar, no heavy chrome.
// The header is thin and dark so it doesn't compete with the content during screen sharing.
export default function PresenterLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold text-gray-100 tracking-wide">
            Presenter Mode
          </span>
          <Link
            href="/presenter"
            className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
          >
            ← Switch event
          </Link>
        </div>
        <Link
          href="/admin"
          className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
        >
          Admin
        </Link>
      </header>
      {children}
    </div>
  );
}
