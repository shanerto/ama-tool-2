"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

// ── Types ──────────────────────────────────────────────────────────────────

type Question = {
  id: string;
  text: string;
  submittedName: string | null;
  isAnonymous: boolean;
  status: "OPEN" | "ANSWERED";
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

  const [event, setEvent] = useState<EventInfo | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const [sortMode, setSortMode] = useState<SortMode>("top");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [intervalSec, setIntervalSec] = useState<IntervalSec>(5);

  // Index-based keyboard navigation
  const [selectedIdx, setSelectedIdx] = useState(0);

  // undoQueue: questionId -> { question, deadline }
  const [undoQueue, setUndoQueue] = useState<Record<string, UndoEntry>>({});

  // Force re-render every 500ms to update relative times + undo countdowns
  const [, setTick] = useState(0);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cardRefs = useRef<Record<string, HTMLLIElement | null>>({});

  // ── Derived: sorted open questions ──────────────────────────────────────

  const openQuestions = questions
    .filter((q) => q.status === "OPEN")
    .sort((a, b) => {
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
      // (they're optimistically hidden; don't let the poll re-show them
      //  until undo window has expired or undo was clicked).
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
    if (pollRef.current) clearInterval(pollRef.current);
    if (autoRefresh) {
      pollRef.current = setInterval(fetchQuestions, intervalSec * 1000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
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

      // Optimistic: hide immediately
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

  const undoAnswered = useCallback(async (questionId: string) => {
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
      // Refetch on error to get consistent state
      fetchQuestions();
    }
  }, [fetchQuestions]);

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
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openQuestions, selectedIdx, markAnswered, fetchQuestions]);

  // Scroll selected card into view
  useEffect(() => {
    const q = openQuestions[selectedIdx];
    if (q?.id) {
      cardRefs.current[q.id]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIdx]);

  // ── Render ───────────────────────────────────────────────────────────────

  const undoEntries = Object.entries(undoQueue);

  return (
    <main className="max-w-3xl mx-auto px-6 py-8">
      {/* Event header */}
      <div className="mb-6">
        <h1 className="text-4xl font-bold text-white leading-tight">
          {event?.title ?? (loading ? "Loading…" : "Event")}
        </h1>
        {event?.description && (
          <p className="text-gray-400 mt-1 text-lg">{event.description}</p>
        )}
      </div>

      {/* Controls bar — host-only, hidden during screen share via details/summary */}
      <details className="mb-6 group">
        <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-300 transition-colors select-none w-fit list-none flex items-center gap-1">
          <span className="group-open:hidden">⚙ Controls</span>
          <span className="hidden group-open:inline">⚙ Controls</span>
        </summary>
        <div className="flex flex-wrap items-center gap-3 mt-3">
          {/* Sort toggle */}
          <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
            {(["top", "newest"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setSortMode(mode)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  sortMode === mode
                    ? "bg-brand-700 text-white shadow"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                {mode === "top" ? "Top" : "Newest"}
              </button>
            ))}
          </div>

          {/* Auto-refresh toggle */}
          <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
            {([true, false] as const).map((on) => (
              <button
                key={String(on)}
                onClick={() => setAutoRefresh(on)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  autoRefresh === on
                    ? "bg-gray-600 text-white shadow"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                {on ? "Auto" : "Manual"}
              </button>
            ))}
          </div>

          {/* Interval selector */}
          {autoRefresh && (
            <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
              {([3, 5, 10] as IntervalSec[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setIntervalSec(s)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    intervalSec === s
                      ? "bg-gray-600 text-white shadow"
                      : "text-gray-400 hover:text-gray-200"
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
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
            title="Refresh (r)"
          >
            ↺ Refresh
          </button>

          {/* Status */}
          <span className="text-xs text-gray-500">
            {openQuestions.length} open
            {lastRefreshed && (
              <> · {relativeTime(lastRefreshed.toISOString())}</>
            )}
          </span>
        </div>
      </details>

      {/* Undo toasts */}
      {undoEntries.length > 0 && (
        <div className="space-y-2 mb-6">
          {undoEntries.map(([qid, entry]) => {
            const secs = undoSecondsLeft(entry.deadline);
            return (
              <div
                key={qid}
                className="flex items-center justify-between bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm"
              >
                <span className="text-gray-300 truncate mr-4 max-w-[70%]">
                  Marked answered:{" "}
                  <span className="text-gray-400 italic">
                    &ldquo;{entry.question.text.slice(0, 60)}
                    {entry.question.text.length > 60 ? "…" : ""}&rdquo;
                  </span>
                </span>
                <button
                  onClick={() => undoAnswered(qid)}
                  className="shrink-0 text-brand-400 hover:text-brand-300 font-medium transition-colors"
                >
                  Undo ({secs}s)
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Question list */}
      {loading ? (
        <p className="text-gray-500 text-lg py-12 text-center">Loading…</p>
      ) : openQuestions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-700 py-16 text-center">
          <p className="text-gray-500 text-lg">No open questions.</p>
          <p className="text-gray-600 text-sm mt-1">
            New questions will appear automatically.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {openQuestions.map((q, idx) => {
            const isSelected = idx === selectedIdx;
            return (
              <li
                key={q.id}
                ref={(el) => {
                  cardRefs.current[q.id] = el;
                }}
                onClick={() => setSelectedIdx(idx)}
                className={`rounded-xl p-5 flex gap-5 cursor-pointer transition-all ${
                  isSelected
                    ? "bg-gray-800 ring-2 ring-brand-700 shadow-lg"
                    : "bg-gray-900 border border-gray-800 hover:border-gray-600"
                }`}
              >
                {/* Score */}
                <div className="flex flex-col items-center min-w-[3.5rem] pt-1">
                  <span
                    className={`text-3xl font-bold tabular-nums leading-none ${
                      q.score > 0
                        ? "text-brand-400"
                        : q.score < 0
                        ? "text-red-400"
                        : "text-gray-500"
                    }`}
                  >
                    {q.score}
                  </span>
                  <span className="text-xs text-gray-600 mt-1">pts</span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-xl font-medium text-white leading-snug">
                    {q.text}
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    {q.isAnonymous
                      ? "Anonymous"
                      : (q.submittedName ?? "Unknown")}{" "}
                    · {relativeTime(q.createdAt)}
                  </p>
                </div>

                {/* Action */}
                <div className="shrink-0 flex items-start pt-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      markAnswered(q.id);
                    }}
                    className="w-10 h-10 rounded-full flex items-center justify-center bg-brand-700 text-white hover:bg-brand-800 transition-colors"
                    title="Mark answered (Enter)"
                    aria-label="Mark answered"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Keyboard hint */}
      {openQuestions.length > 0 && (
        <p className="mt-8 text-xs text-gray-600 text-center">
          <kbd className="bg-gray-800 px-1.5 py-0.5 rounded text-gray-400">j</kbd>
          {" / "}
          <kbd className="bg-gray-800 px-1.5 py-0.5 rounded text-gray-400">k</kbd>
          {" navigate · "}
          <kbd className="bg-gray-800 px-1.5 py-0.5 rounded text-gray-400">Enter</kbd>
          {" mark answered · "}
          <kbd className="bg-gray-800 px-1.5 py-0.5 rounded text-gray-400">r</kbd>
          {" refresh"}
        </p>
      )}
    </main>
  );
}
