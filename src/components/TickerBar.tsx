"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Ticker, { type TickerItem } from "./Ticker";

const TICKER_MAX_CHARS = 80;
const REFRESH_INTERVAL_MS = 60_000;

function isAdminRoute(pathname: string): boolean {
  return (
    pathname.startsWith("/admin") ||
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
  const hasLoadedRef = useRef(false);

  const fetchItems = useCallback(async () => {
    if (excluded) return;
    try {
      const r = await fetch("/api/ticker");
      const data = await r.json();
      if (!Array.isArray(data.items) || data.items.length === 0) return;
      const items = processItems(data.items);
      if (!hasLoadedRef.current) {
        // First load — show immediately
        hasLoadedRef.current = true;
        setDisplayedItems(items);
      } else {
        // Subsequent loads — stage for next animation cycle
        pendingRef.current = items;
      }
    } catch {
      // silently ignore network errors
    }
  }, [excluded]);

  useEffect(() => {
    fetchItems();
    const id = setInterval(fetchItems, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchItems]);

  // Called by Ticker at the end of each scroll cycle
  const handleCycleComplete = useCallback(() => {
    if (pendingRef.current) {
      setDisplayedItems(pendingRef.current);
      pendingRef.current = null;
    }
  }, []);

  if (excluded || displayedItems.length === 0) return null;

  return (
    <div className="bg-gray-950 text-white">
      <Ticker items={displayedItems} onCycleComplete={handleCycleComplete} />
    </div>
  );
}
