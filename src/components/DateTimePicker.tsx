"use client";

import { useState, useRef, useEffect } from "react";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

interface DateTimePickerProps {
  value: string; // "YYYY-MM-DDTHH:mm" or ""
  onChange: (v: string) => void;
  required?: boolean;
}

function parseLocal(s: string) {
  if (!s || !s.includes("T")) return null;
  const [date, time] = s.split("T");
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = (time || "00:00").split(":").map(Number);
  if ([y, mo, d, h, mi].some(isNaN)) return null;
  return { year: y, month: mo - 1, day: d, hour: h, minute: mi };
}

function buildLocalStr(
  year: number, month: number, day: number, hour: number, minute: number
) {
  return [
    `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
  ].join("T");
}

function formatDisplay(s: string): string {
  const p = parseLocal(s);
  if (!p) return "";
  const { year, month, day, hour, minute } = p;
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${MONTH_NAMES[month]} ${day}, ${year}  ·  ${h12}:${String(minute).padStart(2, "0")} ${ampm}`;
}

// Estimated picker height used for flip collision detection.
// Generous enough to cover all 6 calendar rows + time + footer.
const PICKER_EST_HEIGHT = 380;
const PICKER_MIN_WIDTH = 288;
const PICKER_GAP = 4; // px gap between trigger and popover

type PopoverPos = {
  top?: number;    // set when opening below
  bottom?: number; // set when opening above (distance from viewport bottom)
  left: number;
  openAbove: boolean;
};

export default function DateTimePicker({ value, onChange, required }: DateTimePickerProps) {
  const today = new Date();
  const todayY = today.getFullYear();
  const todayM = today.getMonth();
  const todayD = today.getDate();

  const parsed = parseLocal(value);

  const [open, setOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState<PopoverPos | null>(null);
  const [viewYear, setViewYear] = useState(parsed?.year ?? todayY);
  const [viewMonth, setViewMonth] = useState(parsed?.month ?? todayM);

  const containerRef = useRef<HTMLDivElement>(null);

  // Sync view + compute fixed position whenever the picker opens
  function handleOpen() {
    if (!open) {
      const p = parseLocal(value);
      setViewYear(p?.year ?? todayY);
      setViewMonth(p?.month ?? todayM);

      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const spaceBelow = vh - rect.bottom - 8;
        const spaceAbove = rect.top - 8;
        // Flip above when below doesn't fit AND above has more room
        const openAbove = spaceBelow < PICKER_EST_HEIGHT && spaceAbove > spaceBelow;
        // Clamp left so the picker never overflows the right edge
        const left = Math.max(8, Math.min(rect.left, vw - PICKER_MIN_WIDTH - 8));
        setPopoverPos(
          openAbove
            ? { bottom: vh - rect.top + PICKER_GAP, left, openAbove: true }
            : { top: rect.bottom + PICKER_GAP, left, openAbove: false }
        );
      }
    }
    setOpen((o) => !o);
  }

  // Close on outside click, Escape, scroll, or resize
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onScrollOrResize() { setOpen(false); }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScrollOrResize, { capture: true, passive: true });
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScrollOrResize, { capture: true });
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open]);

  // Build 42 calendar cells (6 rows × 7 cols)
  function buildCells() {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInCur = new Date(viewYear, viewMonth + 1, 0).getDate();
    const prevM = viewMonth === 0 ? 11 : viewMonth - 1;
    const prevY = viewMonth === 0 ? viewYear - 1 : viewYear;
    const daysInPrev = new Date(prevY, prevM + 1, 0).getDate();
    const nextM = viewMonth === 11 ? 0 : viewMonth + 1;
    const nextY = viewMonth === 11 ? viewYear + 1 : viewYear;

    type Cell = { y: number; m: number; d: number; cur: boolean };
    const cells: Cell[] = [];
    for (let i = firstDay - 1; i >= 0; i--)
      cells.push({ y: prevY, m: prevM, d: daysInPrev - i, cur: false });
    for (let d = 1; d <= daysInCur; d++)
      cells.push({ y: viewYear, m: viewMonth, d, cur: true });
    for (let d = 1; cells.length < 42; d++)
      cells.push({ y: nextY, m: nextM, d, cur: false });
    return cells;
  }

  function selectDay(y: number, m: number, d: number) {
    const h = parsed?.hour ?? 9;
    const mi = parsed?.minute ?? 0;
    onChange(buildLocalStr(y, m, d, h, mi));
    setViewYear(y);
    setViewMonth(m);
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }

  function adjustHour(delta: number) {
    if (!parsed) return;
    const h = (parsed.hour + delta + 24) % 24;
    onChange(buildLocalStr(parsed.year, parsed.month, parsed.day, h, parsed.minute));
  }

  function adjustMinute(delta: number) {
    if (!parsed) return;
    const mi = (parsed.minute + delta + 60) % 60;
    onChange(buildLocalStr(parsed.year, parsed.month, parsed.day, parsed.hour, mi));
  }

  function setPeriod(period: "AM" | "PM") {
    if (!parsed) return;
    let h = parsed.hour;
    if (period === "AM" && h >= 12) h -= 12;
    if (period === "PM" && h < 12) h += 12;
    onChange(buildLocalStr(parsed.year, parsed.month, parsed.day, h, parsed.minute));
  }

  function goToday() {
    const h = parsed?.hour ?? 9;
    const mi = parsed?.minute ?? 0;
    onChange(buildLocalStr(todayY, todayM, todayD, h, mi));
    setViewYear(todayY);
    setViewMonth(todayM);
  }

  const cells = buildCells();
  const todayKey = `${todayY}-${todayM}-${todayD}`;
  const selKey = parsed ? `${parsed.year}-${parsed.month}-${parsed.day}` : null;
  const hour12 = parsed ? (parsed.hour % 12 || 12) : 12;
  const period = parsed && parsed.hour >= 12 ? "PM" : "AM";
  const minuteVal = parsed?.minute ?? 0;

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={handleOpen}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-brand-400 transition-colors bg-white cursor-pointer"
      >
        <span className={value ? "text-gray-900" : "text-gray-400"}>
          {value ? formatDisplay(value) : "Select date and time"}
        </span>
      </button>

      {/* Invisible input for native form required validation */}
      <input
        type="text"
        value={value}
        required={required}
        readOnly
        tabIndex={-1}
        aria-hidden="true"
        className="absolute opacity-0 pointer-events-none w-0 h-0"
      />

      {/* Picker popover — position: fixed so it never pushes page layout */}
      {open && popoverPos && (
        <div
          role="dialog"
          aria-label="Date and time picker"
          className={[
            "bg-white rounded-xl border border-gray-100 shadow-lg",
            popoverPos.openAbove
              ? "origin-bottom-left animate-picker-in-above"
              : "origin-top-left animate-picker-in",
          ].join(" ")}
          style={{
            position: "fixed",
            top: popoverPos.top,
            bottom: popoverPos.bottom,
            left: popoverPos.left,
            minWidth: `${PICKER_MIN_WIDTH}px`,
            zIndex: 9999,
          }}
        >
          <div className="p-4">

            {/* ── Month navigation ── */}
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={prevMonth}
                aria-label="Previous month"
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <span className="text-sm font-semibold text-gray-800 tracking-tight select-none">
                {MONTH_NAMES[viewMonth]} {viewYear}
              </span>
              <button
                type="button"
                onClick={nextMonth}
                aria-label="Next month"
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            {/* ── Day-of-week headers ── */}
            <div className="grid grid-cols-7 mb-1">
              {DAY_NAMES.map((d) => (
                <div key={d} className="text-center text-[10px] text-gray-400 font-medium py-1 select-none">
                  {d}
                </div>
              ))}
            </div>

            {/* ── Calendar grid ── */}
            <div className="grid grid-cols-7 gap-y-0.5">
              {cells.map((cell, i) => {
                const key = `${cell.y}-${cell.m}-${cell.d}`;
                const isSel = key === selKey;
                const isToday = key === todayKey;
                return (
                  <button
                    key={i}
                    type="button"
                    aria-label={`${MONTH_NAMES[cell.m]} ${cell.d}, ${cell.y}`}
                    aria-pressed={isSel}
                    onClick={() => selectDay(cell.y, cell.m, cell.d)}
                    className={[
                      "w-full aspect-square flex items-center justify-center text-xs rounded-lg transition-colors duration-150 select-none",
                      isSel
                        ? "bg-brand-700 text-white font-semibold"
                        : isToday
                        ? "text-brand-700 font-semibold hover:bg-brand-50"
                        : cell.cur
                        ? "text-gray-700 hover:bg-brand-50"
                        : "text-gray-300 hover:bg-gray-50",
                    ].join(" ")}
                  >
                    {cell.d}
                  </button>
                );
              })}
            </div>

            {/* ── Time picker ── */}
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="flex items-center justify-center gap-3">

                {/* Hour */}
                <div className="flex flex-col items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => adjustHour(1)}
                    disabled={!parsed}
                    aria-label="Increase hour"
                    className="w-7 h-5 flex items-center justify-center text-gray-400 hover:text-brand-700 disabled:opacity-30 transition-colors rounded hover:bg-brand-50 text-[9px] leading-none"
                  >▲</button>
                  <span className="text-sm font-semibold text-gray-800 w-8 text-center tabular-nums select-none">
                    {String(hour12).padStart(2, "0")}
                  </span>
                  <button
                    type="button"
                    onClick={() => adjustHour(-1)}
                    disabled={!parsed}
                    aria-label="Decrease hour"
                    className="w-7 h-5 flex items-center justify-center text-gray-400 hover:text-brand-700 disabled:opacity-30 transition-colors rounded hover:bg-brand-50 text-[9px] leading-none"
                  >▼</button>
                </div>

                <span className="text-gray-400 text-sm font-medium select-none pb-0.5">:</span>

                {/* Minute */}
                <div className="flex flex-col items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => adjustMinute(5)}
                    disabled={!parsed}
                    aria-label="Increase minute"
                    className="w-7 h-5 flex items-center justify-center text-gray-400 hover:text-brand-700 disabled:opacity-30 transition-colors rounded hover:bg-brand-50 text-[9px] leading-none"
                  >▲</button>
                  <span className="text-sm font-semibold text-gray-800 w-8 text-center tabular-nums select-none">
                    {String(minuteVal).padStart(2, "0")}
                  </span>
                  <button
                    type="button"
                    onClick={() => adjustMinute(-5)}
                    disabled={!parsed}
                    aria-label="Decrease minute"
                    className="w-7 h-5 flex items-center justify-center text-gray-400 hover:text-brand-700 disabled:opacity-30 transition-colors rounded hover:bg-brand-50 text-[9px] leading-none"
                  >▼</button>
                </div>

                {/* AM / PM */}
                <div className="flex flex-col gap-0.5 ml-1">
                  {(["AM", "PM"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPeriod(p)}
                      disabled={!parsed}
                      aria-pressed={period === p}
                      className={[
                        "text-xs px-2.5 py-1 rounded-md transition-colors font-medium disabled:opacity-30 select-none",
                        period === p && parsed
                          ? "bg-brand-700 text-white"
                          : "text-gray-500 hover:bg-brand-50 hover:text-brand-700",
                      ].join(" ")}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Footer actions ── */}
            <div className="mt-3 flex justify-between items-center">
              <button
                type="button"
                onClick={goToday}
                className="text-xs text-gray-400 hover:text-brand-700 transition-colors"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => { onChange(""); setOpen(false); }}
                className="text-xs text-gray-400 hover:text-brand-700 transition-colors"
              >
                Clear
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
