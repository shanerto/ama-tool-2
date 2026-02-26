"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ThemeProvider, usePresenterTheme } from "./ThemeContext";

function PresenterLayoutInner({ children }: { children: ReactNode }) {
  const params = useParams();
  const eventId = params?.eventId as string | undefined;
  const { theme, setTheme } = usePresenterTheme();

  const dark = theme === "dark";

  return (
    <div
      className={`min-h-screen transition-colors duration-200 ${
        dark ? "bg-gray-950 text-white" : "bg-white text-gray-900"
      }`}
    >
      <header
        className={`border-b px-6 py-2 flex items-center gap-4 transition-colors duration-200 ${
          dark
            ? "bg-gray-900 border-gray-800"
            : "bg-gray-50 border-gray-200"
        }`}
      >
        <span
          className={`text-sm font-semibold tracking-wide ${
            dark ? "text-gray-100" : "text-gray-700"
          }`}
        >
          Presenter Mode
        </span>

        {eventId && (
          <Link
            href={`/events/${eventId}`}
            className={`text-xs transition-colors ${
              dark
                ? "text-gray-400 hover:text-gray-200"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            ← Back to event
          </Link>
        )}

        {/* Theme toggle — top-right, icon-only */}
        <div className="ml-auto flex items-center gap-0.5 rounded-md p-0.5">
          {(["light", "dark"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              aria-label={t === "light" ? "Switch to light mode" : "Switch to dark mode"}
              className={`rounded px-1.5 py-0.5 text-base leading-none transition-all duration-150 ${
                theme === t
                  ? dark
                    ? "bg-gray-700 opacity-100"
                    : "bg-gray-200 opacity-100"
                  : "opacity-35 hover:opacity-65"
              }`}
            >
              {t === "light" ? "🌞" : "🌙"}
            </button>
          ))}
        </div>
      </header>

      {children}
    </div>
  );
}

export default function PresenterLayout({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <PresenterLayoutInner>{children}</PresenterLayoutInner>
    </ThemeProvider>
  );
}
