"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

// Presenter mode uses its own minimal layout — no admin sidebar, no heavy chrome.
// The header is thin and dark so it doesn't compete with the content during screen sharing.
export default function PresenterLayout({ children }: { children: ReactNode }) {
  const params = useParams();
  const eventId = params?.eventId as string | undefined;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-2 flex items-center gap-4">
        <span className="text-sm font-semibold text-gray-100 tracking-wide">
          Presenter Mode
        </span>
        {eventId && (
          <Link
            href={`/events/${eventId}`}
            className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
          >
            ← Back to event
          </Link>
        )}
      </header>
      {children}
    </div>
  );
}
