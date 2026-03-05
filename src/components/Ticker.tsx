"use client";

interface TickerProps {
  items: string[];
  /** Full scroll cycle in seconds. Defaults to 40. */
  duration?: number;
}

export default function Ticker({ items, duration = 40 }: TickerProps) {
  // Duplicate so the second copy seamlessly follows the first
  const allItems = [...items, ...items];

  return (
    <div className="overflow-hidden" aria-label="Question ticker">
      <div
        className="animate-ticker flex whitespace-nowrap"
        style={{ "--ticker-duration": `${duration}s` } as React.CSSProperties}
      >
        {allItems.map((item, i) => (
          <span
            key={i}
            className="font-ticker text-[13px] font-medium tracking-[-0.01em] uppercase shrink-0 inline-flex items-center"
          >
            {item}
            <span className="mx-5 opacity-40" aria-hidden="true">→</span>
          </span>
        ))}
      </div>
    </div>
  );
}
