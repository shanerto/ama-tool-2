"use client";

import Link from "next/link";
import { useState } from "react";

export interface TickerItem {
  text: string;
  eventId: string;
}

interface TickerProps {
  items: TickerItem[];
  /** Full scroll cycle in seconds. Defaults to 40. */
  duration?: number;
}

export default function Ticker({ items, duration = 44 }: TickerProps) {
  const [paused, setPaused] = useState(false);
  // Duplicate so the second copy seamlessly follows the first
  const allItems = [...items, ...items];

  return (
    <div
      className="overflow-hidden h-8 flex items-center"
      aria-label="Question ticker"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="animate-ticker flex whitespace-nowrap"
        style={
          {
            "--ticker-duration": `${duration}s`,
            animationPlayState: paused ? "paused" : "running",
          } as React.CSSProperties
        }
      >
        {allItems.map((item, i) => (
          <span key={i} className="shrink-0 inline-flex items-center">
            <Link
              href={`/events/${item.eventId}`}
              className="font-ticker text-[12px] font-medium tracking-[-0.01em] uppercase hover:text-brand-700 transition-colors duration-150"
            >
              {item.text}
            </Link>
            <span
              className="mx-[17px] opacity-45 font-ticker text-[12px] select-none"
              aria-hidden="true"
            >
              •
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
