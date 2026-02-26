"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { usePresenterTheme } from "../ThemeContext";

// ── Types ──────────────────────────────────────────────────────────────────

type Question = {
  id: string;
  text: string;
  submittedName: string | null;
  isAnonymous: boolean;
  status: "OPEN" | "ANSWERED";
  isHidden: boolean;
  pinnedAt: string | null;
  createdAt: string;
  score: number;
  myVote: 1 | -1 | null;
};

type EventInfo = {
  id: string;
  title: string;
  description: string | null;
};

type SortMode = "top" | "newest";
type IntervalSec = 3 | 5 | 10;

type UndoEntry = { question: Question; deadline: number };

// ── Helpers ────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  const diffSec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

function undoSecondsLeft(deadline: number): number {
  return Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
}

// ── Component ──────────────────────────────────────────────────────────────

export default function PresenterEventPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { theme } = usePresenterTheme();
  const dark = theme === "dark";

  const [event, setEvent] = useState<EventInfo | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const [sortMode, setSortMode] = useState<SortMode>("top");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [intervalSec, setIntervalSec] = useState<IntervalSec>(5);

  // Index-based keyboard navigation (determines which question is on screen)
  const [selectedIdx, setSelectedIdx] = useState(0);

  // IDs currently fading out before being removed
  const [fadingIds, setFadingIds] = useState<Set<string>>(new Set());

  // undoQueue: questionId -> { question, deadline }
  const [undoQueue, setUndoQueue] = useState<Record<string, UndoEntry>>({});

  // Keyboard hint panel visibility (toggled with ?)
  const [showHints, setShowHints] = useState(false);

  // Force re-render every 500ms to update relative times + undo countdowns
  const [, setTick] = useState(0);

  // ── Theme tokens ─────────────────────────────────────────────────────────

  const T = {
    eventTitle:     dark ? "text-gray-500"  : "text-gray-500",
    loadingText:    dark ? "text-gray-500"  : "text-gray-500",
    emptyText:      dark ? "text-gray-400"  : "text-gray-500",
    pinned:         dark ? "text-brand-400" : "text-brand-600",
    questionText:   dark ? "text-white"     : "text-gray-900",
    questionCard:   dark ? ""               : "bg-white rounded-2xl shadow-md px-6 py-6 -mx-6",
    metaText:       dark ? "text-gray-500"  : "text-gray-500",
    undoToast:      dark ? "bg-gray-800 border-gray-700"         : "bg-white border-gray-200 shadow-sm",
    undoText:       dark ? "text-gray-300"  : "text-gray-700",
    undoItalic:     dark ? "text-gray-400"  : "text-gray-500",
    undoBtn:        dark ? "text-brand-400 hover:text-brand-300" : "text-brand-600 hover:text-brand-700",
    footerBorder:   dark ? "border-gray-800" : "border-gray-200",
    summary:        dark ? "text-gray-600 hover:text-gray-400"   : "text-gray-400 hover:text-gray-600",
    controlsBg:     dark ? "bg-gray-800"    : "bg-gray-100",
    sortActive:     "bg-brand-700 text-white shadow",
    sortInactive:   dark ? "text-gray-400 hover:text-gray-200"   : "text-gray-500 hover:text-gray-800",
    toggleActive:   dark ? "bg-gray-600 text-white shadow"       : "bg-gray-300 text-gray-900 shadow",
    toggleInactive: dark ? "text-gray-400 hover:text-gray-200"   : "text-gray-500 hover:text-gray-800",
    manualRefresh:  dark
      ? "bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white"
      : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900",
    statusText:     dark ? "text-gray-500"  : "text-gray-500",
    hintPanel:      dark ? "bg-gray-900 border-gray-700 text-gray-400" : "bg-white border-gray-200 text-gray-600",
    hintTitle:      dark ? "text-gray-300"  : "text-gray-700",
    hintKbd:        dark ? "bg-gray-800 text-gray-300" : "bg-gray-100 text-gray-700",
  };

  // ── Derived: sorted open questions ──────────────────────────────────────

  const openQuestions = questions
    .filter((q) => q.status === "OPEN" && !q.isHidden)
    .sort((a, b) => {
      // Pinned questions always float to top
      const aPinned = a.pinnedAt ? 1 : 0;
      const bPinned = b.pinnedAt ? 1 : 0;
      if (bPinned !== aPinned) return bPinned - aPinned;
      if (sortMode === "top") {
        return (
          b.score - a.score ||
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  // ── Data fetching ────────────────────────────────────────────────────────

  const fetchQuestions = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/questions?sort=score`);
      if (!res.ok) return;
      const data = await res.json();
      setEvent(data.event);
      // Preserve local ANSWERED status for questions in the undo queue
      setQuestions((prev) => {
        const prevById: Record<string, Question> = {};
        for (const q of prev) prevById[q.id] = q;
        return (data.questions as Question[]).map((q) =>
          prevById[q.id]?.status === "ANSWERED" && q.status === "OPEN"
            ? prevById[q.id]
            : q
        );
      });
      setLastRefreshed(new Date());
    } catch {
      // silently retry on next poll
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  // Initial load
  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  // Polling
  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null;
    if (autoRefresh) {
      id = setInterval(fetchQuestions, intervalSec * 1000);
    }
    return () => {
      if (id) clearInterval(id);
    };
  }, [autoRefresh, intervalSec, fetchQuestions]);

  // ── Ticker: relative times + undo countdowns ─────────────────────────────

  useEffect(() => {
    const id = setInterval(() => {
      setTick((n) => n + 1);
      // Prune expired undo entries
      setUndoQueue((prev) => {
        const now = Date.now();
        const next: Record<string, UndoEntry> = {};
        for (const [id, entry] of Object.entries(prev)) {
          if (now <= entry.deadline) next[id] = entry;
        }
        return Object.keys(next).length === Object.keys(prev).length
          ? prev
          : next;
      });
    }, 500);
    return () => clearInterval(id);
  }, []);

  // ── Clamp selectedIdx when list shrinks ──────────────────────────────────

  useEffect(() => {
    if (openQuestions.length > 0 && selectedIdx >= openQuestions.length) {
      setSelectedIdx(openQuestions.length - 1);
    }
  }, [openQuestions.length, selectedIdx]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const markAnswered = useCallback(
    async (questionId: string) => {
      const question = questions.find(
        (q) => q.id === questionId && q.status === "OPEN"
      );
      if (!question) return;

      // Start fade-out animation
      setFadingIds((prev) => new Set(prev).add(questionId));

      // Wait for CSS transition to complete (~350ms), then hide
      await new Promise((resolve) => setTimeout(resolve, 350));

      setFadingIds((prev) => {
        const next = new Set(prev);
        next.delete(questionId);
        return next;
      });

      // Optimistic: hide immediately after fade
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === questionId ? { ...q, status: "ANSWERED" as const } : q
        )
      );

      // Add undo entry (10 s window)
      setUndoQueue((prev) => ({
        ...prev,
        [questionId]: { question, deadline: Date.now() + 10_000 },
      }));

      try {
        await fetch(`/api/questions/${questionId}/answer`, { method: "POST" });
      } catch {
        // Revert optimistic update on network error
        setQuestions((prev) =>
          prev.map((q) =>
            q.id === questionId ? { ...q, status: "OPEN" as const } : q
          )
        );
        setUndoQueue((prev) => {
          const next = { ...prev };
          delete next[questionId];
          return next;
        });
      }
    },
    [questions]
  );

  const undoAnswered = useCallback(
    async (questionId: string) => {
      setUndoQueue((prev) => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });

      // Optimistic: restore to OPEN
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === questionId ? { ...q, status: "OPEN" as const } : q
        )
      );

      try {
        await fetch(`/api/questions/${questionId}/answer`, { method: "DELETE" });
      } catch {
        fetchQuestions();
      }
    },
    [fetchQuestions]
  );

  // ── Keyboard shortcuts ───────────────────────────────────────────────────

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (["INPUT", "TEXTAREA", "BUTTON", "SELECT"].includes(tag)) return;

      if (e.key === "j") {
        e.preventDefault();
        setSelectedIdx((prev) =>
          Math.min(prev + 1, Math.max(0, openQuestions.length - 1))
        );
      } else if (e.key === "k") {
        e.preventDefault();
        setSelectedIdx((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const q = openQuestions[selectedIdx];
        if (q) markAnswered(q.id);
      } else if (e.key === "r") {
        e.preventDefault();
        fetchQuestions();
      } else if (e.key === "?") {
        e.preventDefault();
        setShowHints((prev) => !prev);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openQuestions, selectedIdx, markAnswered, fetchQuestions]);

  // ── Render ───────────────────────────────────────────────────────────────

  const activeQuestion = openQuestions[selectedIdx] ?? null;
  const isFading = activeQuestion ? fadingIds.has(activeQuestion.id) : false;
  const undoEntries = Object.entries(undoQueue);

  return (
    <main className="min-h-[calc(100vh-3rem)] flex flex-col max-w-5xl mx-auto px-12 py-14">

      {/* Event title — secondary, muted */}
      <p className={`text-xs font-semibold uppercase tracking-widest mb-12 ${T.eventTitle}`}>
        {event?.title ?? (loading ? "Loading…" : "Event")}
      </p>

      {/* Single-question focal area */}
      <div className="flex-1 flex flex-col justify-center min-h-0">
        {loading ? (
          <p className={`text-2xl py-24 text-center ${T.loadingText}`}>Loading…</p>
        ) : !activeQuestion ? (
          <div className="py-24 text-center">
            <p className={`text-2xl ${T.emptyText}`}>No active question selected yet.</p>
          </div>
        ) : (
          <div
            className={`transition-all duration-300 ${
              isFading ? "opacity-0 scale-[0.98]" : "opacity-100 scale-100"
            }`}
          >
            {/* Question card — gains subtle shadow in light mode */}
            <div className={`transition-all duration-200 ${T.questionCard}`}>
              {activeQuestion.pinnedAt && (
                <p className={`text-sm font-medium mb-5 flex items-center gap-1.5 ${T.pinned}`}>
                  <span>📌</span> Pinned
                </p>
              )}

              {/* Question text — focal point */}
              <p className={`text-5xl font-bold leading-snug tracking-tight ${T.questionText}`}>
                {activeQuestion.text}
              </p>

              <p className={`text-base mt-6 ${T.metaText}`}>
                {activeQuestion.isAnonymous
                  ? "Anonymous"
                  : (activeQuestion.submittedName ?? "Unknown")}
                {" · "}
                {relativeTime(activeQuestion.createdAt)}
              </p>

              <button
                onClick={() => markAnswered(activeQuestion.id)}
                className="mt-8 px-5 py-2 rounded-lg bg-brand-700 text-white text-sm font-medium hover:bg-brand-800 transition-colors"
                title="Mark answered (Enter)"
              >
                ✓ Mark answered
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Undo toasts */}
      {undoEntries.length > 0 && (
        <div className="space-y-2 mt-8">
          {undoEntries.map(([qid, entry]) => {
            const secs = undoSecondsLeft(entry.deadline);
            return (
              <div
                key={qid}
                className={`flex items-center justify-between border rounded-lg px-4 py-2.5 text-sm ${T.undoToast}`}
              >
                <span className={`truncate mr-4 max-w-[70%] ${T.undoText}`}>
                  Marked answered:{" "}
                  <span className={`italic ${T.undoItalic}`}>
                    &ldquo;{entry.question.text.slice(0, 60)}
                    {entry.question.text.length > 60 ? "…" : ""}&rdquo;
                  </span>
                </span>
                <button
                  onClick={() => undoAnswered(qid)}
                  className={`shrink-0 font-medium transition-colors ${T.undoBtn}`}
                >
                  Undo ({secs}s)
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer — host controls only, hidden by default */}
      <footer className={`mt-10 pt-4 border-t ${T.footerBorder}`}>
        <details className="group">
          <summary className={`cursor-pointer text-xs transition-colors select-none list-none w-fit ${T.summary}`}>
            ⚙ Controls
          </summary>
          <div className="flex flex-wrap items-center gap-3 mt-3">
            {/* Sort toggle */}
            <div className={`flex gap-1 rounded-lg p-1 ${T.controlsBg}`}>
              {(["top", "newest"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setSortMode(mode)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    sortMode === mode ? T.sortActive : T.sortInactive
                  }`}
                >
                  {mode === "top" ? "Top" : "Newest"}
                </button>
              ))}
            </div>

            {/* Auto-refresh toggle */}
            <div className={`flex gap-1 rounded-lg p-1 ${T.controlsBg}`}>
              {([true, false] as const).map((on) => (
                <button
                  key={String(on)}
                  onClick={() => setAutoRefresh(on)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    autoRefresh === on ? T.toggleActive : T.toggleInactive
                  }`}
                >
                  {on ? "Auto" : "Manual"}
                </button>
              ))}
            </div>

            {/* Interval selector */}
            {autoRefresh && (
              <div className={`flex gap-1 rounded-lg p-1 ${T.controlsBg}`}>
                {([3, 5, 10] as IntervalSec[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setIntervalSec(s)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      intervalSec === s ? T.toggleActive : T.toggleInactive
                    }`}
                  >
                    {s}s
                  </button>
                ))}
              </div>
            )}

            {/* Manual refresh */}
            <button
              onClick={fetchQuestions}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${T.manualRefresh}`}
              title="Refresh (r)"
            >
              ↺ Refresh
            </button>

            {/* Status */}
            <span className={`text-xs ${T.statusText}`}>
              {openQuestions.length} open
              {lastRefreshed && (
                <> · {relativeTime(lastRefreshed.toISOString())}</>
              )}
            </span>
          </div>
        </details>
      </footer>

      {/* Keyboard hint panel — toggled with ? key, hidden by default */}
      {showHints && (
        <div className={`fixed bottom-8 right-8 border rounded-xl px-5 py-4 text-xs shadow-2xl space-y-2 z-50 ${T.hintPanel}`}>
          <p className={`font-medium mb-1 ${T.hintTitle}`}>Keyboard shortcuts</p>
          <p>
            <kbd className={`px-1.5 py-0.5 rounded ${T.hintKbd}`}>j</kbd>
            {" / "}
            <kbd className={`px-1.5 py-0.5 rounded ${T.hintKbd}`}>k</kbd>
            {" — navigate questions"}
          </p>
          <p>
            <kbd className={`px-1.5 py-0.5 rounded ${T.hintKbd}`}>Enter</kbd>
            {" — mark answered"}
          </p>
          <p>
            <kbd className={`px-1.5 py-0.5 rounded ${T.hintKbd}`}>r</kbd>
            {" — refresh"}
          </p>
          <p>
            <kbd className={`px-1.5 py-0.5 rounded ${T.hintKbd}`}>?</kbd>
            {" — hide this panel"}
          </p>
        </div>
      )}
    </main>
  );
}
