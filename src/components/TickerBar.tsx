"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Ticker, { type TickerItem } from "./Ticker";

function isAdminRoute(pathname: string): boolean {
  return (
    pathname.startsWith("/admin") ||
    pathname === "/login" ||
    pathname === "/events/new" ||
    /^\/events\/[^/]+\/edit(\/|$)/.test(pathname)
  );
}

export default function TickerBar() {
  const pathname = usePathname();
  const excluded = isAdminRoute(pathname);

  const [items, setItems] = useState<TickerItem[]>([]);

  useEffect(() => {
    if (excluded) return;
    fetch("/api/ticker")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.items) && data.items.length > 0) {
          setItems(data.items);
        }
      })
      .catch(() => {});
  }, [excluded]);

  if (excluded || items.length === 0) return null;

  return (
    <div className="bg-gray-950 text-white">
      <Ticker items={items} />
    </div>
  );
}
