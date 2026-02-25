"use client";

import { useState, useEffect } from "react";

export function LocalTime({ iso }: { iso: string }) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    const d = new Date(iso);
    const formatted = d.toLocaleString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
    setLabel(formatted);
  }, [iso]);

  if (!label) return null;
  return <span> / {label} local</span>;
}
