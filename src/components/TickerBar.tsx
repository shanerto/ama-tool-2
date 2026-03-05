"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Ticker, { type TickerItem } from "./Ticker";

const TICKER_MAX_CHARS = 80;
const TICKER_MIN_ITEMS = 5;
const REFRESH_INTERVAL_MS = 60_000;

function isAdminRoute(pathname: string): boolean {
  return (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/presenter") ||
    pathname === "/login" ||
    pathname === "/events/new" ||
    /^\/events\/[^/]+\/edit(\/|$)/.test(pathname)
  );
}

function truncate(text: string): string {
  if (text.length <= TICKER_MAX_CHARS) return text;
  const cut = text.slice(0, TICKER_MAX_CHARS);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut) + "…";
}

function processItems(raw: TickerItem[]): TickerItem[] {
  return raw.map((item) => ({ ...item, text: truncate(item.text) }));
}

export default function TickerBar() {
  const pathname = usePathname();
  const excluded = isAdminRoute(pathname);

  const [displayedItems, setDisplayedItems] = useState<TickerItem[]>([]);
  // Buffer incoming data between animation cycles so scrolling never jumps
  const pendingRef = useRef<TickerItem[] | null>(null);
  // Track whether the ticker is currently visible (animation is running).
  // When hidden, there's no animation cycle, so pending data must be applied
  // immediately instead of waiting for onCycleComplete.
  const isVisibleRef = useRef(false);

  const applyItems = useCallback((items: TickerItem[]) => {
    isVisibleRef.current = items.length >= TICKER_MIN_ITEMS;
    setDisplayedItems(items);
  }, []);

  const fetchItems = useCallback(async () => {
    if (excluded) return;
    try {
      const r = await fetch("/api/ticker");
      const data = await r.json();
      if (!Array.isArray(data.items)) return;

      // Only show the ticker when there are enough questions to feel live
      const items =
        data.items.length >= TICKER_MIN_ITEMS ? processItems(data.items) : [];

      if (!isVisibleRef.current) {
        // Ticker is hidden (first load or dropped below threshold) — apply now
        applyItems(items);
      } else {
        // Ticker is scrolling — stage for the next animation cycle
        pendingRef.current = items;
      }
    } catch {
      // silently ignore network errors
    }
  }, [excluded, applyItems]);

  useEffect(() => {
    fetchItems();
    const id = setInterval(fetchItems, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchItems]);

  // Called by Ticker at the end of each scroll cycle
  const handleCycleComplete = useCallback(() => {
    if (pendingRef.current !== null) {
      applyItems(pendingRef.current);
      pendingRef.current = null;
    }
  }, [applyItems]);

  if (excluded || displayedItems.length < TICKER_MIN_ITEMS) return null;

  return (
    <div className="bg-gray-950 text-white">
      <Ticker items={displayedItems} onCycleComplete={handleCycleComplete} />
    </div>
  );
}
