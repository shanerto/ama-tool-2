"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ThemeProvider, usePresenterTheme } from "./ThemeContext";

function SunIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = usePresenterTheme();
  const dark = theme === "dark";
  const [rotating, setRotating] = useState(false);

  const handleToggle = () => {
    setRotating(true);
    setTheme(dark ? "light" : "dark");
    setTimeout(() => setRotating(false), 180);
  };

  return (
    <button
      onClick={handleToggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      style={{
        transform: rotating ? "rotate(180deg)" : "rotate(0deg)",
        transition: "transform 180ms ease, opacity 150ms",
      }}
      className={`rounded p-1.5 ${
        dark
          ? "text-white hover:bg-gray-700"
          : "text-gray-900 hover:bg-gray-200"
      }`}
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function PresenterLayoutInner({ children }: { children: ReactNode }) {
  const params = useParams();
  const eventId = params?.eventId as string | undefined;
  const { theme } = usePresenterTheme();

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
          Ask Paxos
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

        {/* Theme toggle — top-right, single icon */}
        <div className="ml-auto">
          <ThemeToggle />
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
