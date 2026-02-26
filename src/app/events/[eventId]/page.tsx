"use client";

import { useEffect, useState, useCallback, useRef, useMemo, useLayoutEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type Question = {
  id: string;
  text: string;
  submittedName: string | null;
  isAnonymous: boolean;
  status: "OPEN" | "ANSWERED";
  isHidden: boolean;
  pinnedAt: string | null;
  isOwn: boolean;
  createdAt: string;
  score: number;
  myVote: 1 | -1 | null;
};

type Event = {
  id: string;
  title: string;
  description: string | null;
  isVotingOpen: boolean;
  status: "OPEN" | "CLOSED";
  startsAt: string | null;
  type: "company" | "team";
  hostName: string | null;
};

type SortMode = "score" | "newest";

const EDIT_WINDOW_MS = 2 * 60 * 1000;

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  a.forEach((w) => { if (b.has(w)) intersection++; });
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export default function EventPage() {
  const { eventId } = useParams<{ eventId: string }>();

  const [event, setEvent] = useState<Event | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [metrics, setMetrics] = useState<{ questionCount: number; voteCount: number } | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("score");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Per-question in-flight tracking. State drives button disabled UI;
  // ref is readable inside async callbacks without stale-closure issues.
  const [votingIds, setVotingIds] = useState<Set<string>>(new Set());
  const votingIdsRef = useRef<Set<string>>(new Set());
  function markVoting(id: string) {
    votingIdsRef.current.add(id);
    setVotingIds(new Set(votingIdsRef.current));
  }
  function clearVoting(id: string) {
    votingIdsRef.current.delete(id);
    setVotingIds(new Set(votingIdsRef.current));
  }

  // Submission form state
  const [formText, setFormText] = useState("");
  const [formName, setFormName] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Tick to re-evaluate edit windows
  const [, setTick] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Track new question IDs for entry animation
  const seenIdsRef = useRef<Set<string>>(new Set());
  const [newIds, setNewIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 5000);
    return () => clearInterval(id);
  }, []);

  // Detect newly appeared questions and flag them for entry animation
  useEffect(() => {
    const fresh = new Set<string>();
    for (const q of questions) {
      if (!seenIdsRef.current.has(q.id)) {
        // Only animate if we've already seen at least one batch (skip initial load)
        if (seenIdsRef.current.size > 0) fresh.add(q.id);
        seenIdsRef.current.add(q.id);
      }
    }
    if (fresh.size === 0) return;
    setNewIds((prev) => new Set(Array.from(prev).concat(Array.from(fresh))));
    const timer = setTimeout(() => {
      setNewIds((prev) => {
        const next = new Set(prev);
        fresh.forEach((id) => next.delete(id));
        return next;
      });
    }, 900);
    return () => clearTimeout(timer);
  }, [questions]);

  const fetchQuestions = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/questions?sort=${sortMode}`);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to load questions");
        return;
      }
      const data = await res.json();
      setEvent(data.event);
      // Merge poll results: preserve local optimistic state for any question
      // whose vote request is still in flight so the UI doesn't flicker back.
      setQuestions((local) => {
        const localMap = new Map(local.map((q) => [q.id, q]));
        return (data.questions as Question[]).map((serverQ) => {
          if (votingIdsRef.current.has(serverQ.id)) {
            return localMap.get(serverQ.id) ?? serverQ;
          }
          return serverQ;
        });
      });
      setMetrics(data.metrics ?? null);
      setError(null);
    } catch {
      setError("Network error. Retrying...");
    } finally {
      setLoading(false);
    }
  }, [eventId, sortMode]);

  useEffect(() => {
    setLoading(true);
    fetchQuestions();
  }, [fetchQuestions]);

  useEffect(() => {
    pollRef.current = setInterval(fetchQuestions, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchQuestions]);

  async function handleVote(questionId: string, clicked: 1 | -1) {
    // Guard: only one request per question at a time.
    if (votingIdsRef.current.has(questionId)) return;

    // ── Single source of truth: read current vote from rendered state ──────────
    // Because we block re-entry above, `questions` is always current here.
    const q = questions.find((q) => q.id === questionId);
    if (!q) return;

    const prev: -1 | 0 | 1 = (q.myVote ?? 0) as -1 | 0 | 1;
    const next: -1 | 0 | 1 = clicked === prev ? 0 : clicked; // toggle or switch
    const delta = next - prev;

    console.log("[vote]", {
      questionId,
      prev,
      next,
      delta,
      displayedScoreBefore: q.score,
      displayedScoreAfter: q.score + delta,
    });

    // Disable buttons for this question while request is in flight.
    markVoting(questionId);

    // Optimistic update — applied exactly once with the correct delta.
    setQuestions((prev) =>
      prev.map((q) =>
        q.id !== questionId
          ? q
          : { ...q, score: q.score + delta, myVote: next === 0 ? null : next }
      )
    );

    try {
      const res = await fetch(`/api/questions/${questionId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: next }), // resolved state, not raw click
      });
      if (res.ok) {
        const data = await res.json();
        setQuestions((prev) =>
          prev.map((q) =>
            q.id === questionId ? { ...q, score: data.score, myVote: data.myVote } : q
          )
        );
      }
    } catch {
      // Revert optimistic update on error; poll will reconcile next cycle.
      const revertVote = prev === 0 ? null : prev;
      setQuestions((qs) =>
        qs.map((q) =>
          q.id !== questionId ? q : { ...q, score: q.score - delta, myVote: revertVote }
        )
      );
    } finally {
      clearVoting(questionId);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    const text = formText.trim();
    const name = formName.trim();
    if (!text) {
      setSubmitError("Question text is required.");
      return;
    }
    if (!isAnonymous && !name) {
      setSubmitError("Please enter your name, or submit anonymously.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/events/${eventId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, isAnonymous, submittedName: isAnonymous ? null : name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? "Failed to submit question.");
        return;
      }
      setFormText("");
      setFormName("");
      await fetchQuestions();
    } catch {
      setSubmitError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEditSave(questionId: string) {
    const text = editText.trim();
    if (!text) {
      setEditError("Question text is required.");
      return;
    }
    setEditSaving(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/questions/${questionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error ?? "Failed to save edit.");
        return;
      }
      setEditingId(null);
      setEditText("");
      await fetchQuestions();
    } catch {
      setEditError("Network error. Please try again.");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleRetract(questionId: string) {
    try {
      const res = await fetch(`/api/questions/${questionId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? "Failed to retract question.");
        return;
      }
      await fetchQuestions();
    } catch {
      alert("Network error. Please try again.");
    }
  }

  // Fuzzy duplicate detection
  const duplicateWarnings = useMemo(() => {
    const trimmed = formText.trim();
    if (trimmed.length < 15) return [];
    const inputTokens = tokenize(trimmed);
    if (inputTokens.size === 0) return [];
    return questions
      .filter((q) => jaccardSimilarity(inputTokens, tokenize(q.text)) > 0.4)
      .slice(0, 2);
  }, [formText, questions]);

  const sortedQuestions =
    sortMode === "newest"
      ? [...questions].sort((a, b) => {
          const aPinned = a.pinnedAt ? 1 : 0;
          const bPinned = b.pinnedAt ? 1 : 0;
          if (bPinned !== aPinned) return bPinned - aPinned;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        })
      : questions; // already sorted by server

  if (loading) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-12 text-center text-gray-400">
        Loading...
      </main>
    );
  }

  if (error && !event) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-12 text-center text-red-500">
        {error}
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link href="/" className="text-sm text-brand-700 hover:underline">
          ← All Events
        </Link>

        {event?.type === "team" ? (
          /* ── Team event header ── */
          <div className="flex items-start justify-between gap-4 mt-4 flex-wrap">
            {/* Left: title, host, description, date + inline stats */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold">{event.title}</h1>
                {event.status === "CLOSED" && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500 border border-gray-200">
                    Closed
                  </span>
                )}
                <ShareButton />
              </div>
              {event.hostName && (
                <p className="text-sm text-gray-400 mt-1.5">Hosted by {event.hostName}</p>
              )}
              {event.description && (
                <p className="text-gray-500 text-sm mt-1">{event.description}</p>
              )}
              {event.startsAt && (
                <div className="mt-4">
                  <EventTime startsAt={event.startsAt} />
                </div>
              )}
            </div>
            {/* Right: Present (primary) + Manage (secondary) */}
            <div className="shrink-0 self-start flex items-center gap-2 pt-1">
              <Link
                href={`/events/${eventId}/edit`}
                className="px-3.5 py-1.5 text-sm font-medium rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
              >
                Manage
              </Link>
              <a
                href={`/presenter/${eventId}`}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-1.5 text-sm font-medium rounded-lg bg-brand-700 text-white hover:bg-brand-800 transition-colors"
              >
                Present
              </a>
            </div>
          </div>
        ) : (
          /* ── Company event header (no controls, stats in right column) ── */
          <div className="flex items-start justify-between gap-4 mt-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold">{event?.title}</h1>
                {event?.status === "CLOSED" && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500 border border-gray-200">
                    Closed
                  </span>
                )}
                <ShareButton />
              </div>
              {event?.description && (
                <p className="text-gray-500 text-sm mt-1">{event.description}</p>
              )}
              {event?.startsAt && (
                <div className="mt-2">
                  <EventTime startsAt={event.startsAt} />
                </div>
              )}
            </div>
            {metrics && metrics.questionCount > 0 && (
              <div className="shrink-0 self-start pt-1 space-y-0.5 text-right">
                <div className="flex items-baseline gap-1.5 whitespace-nowrap">
                  <span className="text-sm font-semibold text-gray-900 tabular-nums">{metrics.questionCount}</span>
                  <span className="text-sm font-semibold text-gray-900">questions</span>
                </div>
                <div className="flex items-baseline gap-1.5 whitespace-nowrap">
                  <span className="text-xs text-gray-600 tabular-nums">{metrics.voteCount}</span>
                  <span className="text-xs text-gray-600">votes</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Submit Form — hidden when event is closed */}
      {event?.status === "CLOSED" && (
        <div className="mb-8 rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 text-sm text-gray-500">
          This event is closed. New questions are no longer accepted.
        </div>
      )}
      <form
        onSubmit={handleSubmit}
        className={`bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-8${event?.status === "CLOSED" ? " hidden" : ""}`}
      >
        <h2 className="font-semibold mb-3">Ask a Question</h2>
        <div className="relative">
          <textarea
            className="w-full border border-gray-300 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-400"
            rows={3}
            placeholder="What's your question?"
            value={formText}
            onChange={(e) => setFormText(e.target.value.slice(0, 280))}
            maxLength={280}
          />
          <span
            className={`absolute bottom-2 right-3 text-xs tabular-nums ${
              formText.length >= 261
                ? formText.length >= 280
                  ? "text-red-500 font-semibold"
                  : "text-orange-500"
                : "text-gray-400"
            }`}
          >
            {formText.length} / 280
          </span>
        </div>

        {/* Duplicate warning */}
        {duplicateWarnings.length > 0 && (
          <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
            <p className="font-medium mb-1">Similar question{duplicateWarnings.length > 1 ? "s" : ""} already asked — consider voting instead:</p>
            <ul className="space-y-1">
              {duplicateWarnings.map((q) => (
                <li key={q.id} className="text-amber-700 italic truncate">
                  &ldquo;{q.text.slice(0, 100)}{q.text.length > 100 ? "…" : ""}&rdquo;
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center gap-2 mt-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              className="rounded"
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
            />
            Submit anonymously
          </label>
        </div>

        {!isAnonymous && (
          <input
            type="text"
            className="mt-2 w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            placeholder="Your name (required)"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            maxLength={100}
          />
        )}

        {submitError && (
          <p className="text-red-500 text-sm mt-2">{submitError}</p>
        )}

        <button
          type="submit"
          disabled={submitting || formText.length === 0 || formText.length > 280}
          className="mt-3 bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-800 disabled:opacity-50 transition-colors"
        >
          {submitting ? "Submitting..." : "Submit Question"}
        </button>
      </form>

      {/* Sort toggle */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-gray-700">
          {sortedQuestions.length} question{sortedQuestions.length !== 1 ? "s" : ""}
          {event?.type === "team" && metrics && metrics.voteCount > 0 && (
            <span className="text-gray-400 font-normal"> · {metrics.voteCount} vote{metrics.voteCount !== 1 ? "s" : ""}</span>
          )}
        </span>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setSortMode("score")}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              sortMode === "score"
                ? "bg-white shadow text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Top
          </button>
          <button
            onClick={() => setSortMode("newest")}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              sortMode === "newest"
                ? "bg-white shadow text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Newest
          </button>
        </div>
      </div>

      {error && (
        <p className="text-yellow-600 text-xs mb-3">{error}</p>
      )}

      {event && (event.status === "CLOSED" || !event.isVotingOpen) && (
        <div className="mb-4 rounded-lg bg-gray-100 border border-gray-200 px-4 py-2 text-sm text-gray-600">
          Voting is closed for this event.
        </div>
      )}

      {/* Question list */}
      {sortedQuestions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-gray-400">
          No questions yet. Be the first to ask!
        </div>
      ) : (
        <ul className="space-y-3">
          {sortedQuestions.map((q) => (
            <QuestionCard
              key={q.id}
              question={q}
              isNew={newIds.has(q.id)}
              onVote={handleVote}
              votingOpen={(event?.isVotingOpen ?? true) && event?.status !== "CLOSED"}
              voteInFlight={votingIds.has(q.id)}
              isEditing={editingId === q.id}
              editText={editText}
              editError={editError}
              editSaving={editSaving}
              onEditStart={() => {
                setEditingId(q.id);
                setEditText(q.text);
                setEditError(null);
              }}
              onEditTextChange={setEditText}
              onEditSave={() => handleEditSave(q.id)}
              onEditCancel={() => {
                setEditingId(null);
                setEditText("");
                setEditError(null);
              }}
              onRetract={() => handleRetract(q.id)}
            />
          ))}
        </ul>
      )}
    </main>
  );
}

// ── ShareButton ───────────────────────────────────────────────────────────────

function ShareButton() {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 1500);
    } catch {
      setCopyState("error");
      setTimeout(() => setCopyState("idle"), 2000);
    }
  }

  return (
    <div className="relative shrink-0">
      <button
        onClick={handleCopy}
        title="Copy link"
        aria-label="Copy link"
        className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${
          copyState === "copied"
            ? "bg-green-100 text-green-600"
            : copyState === "error"
            ? "bg-red-100 text-red-500"
            : "bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
        }`}
      >
        {copyState === "copied" ? (
          /* Checkmark */
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
            <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
          </svg>
        ) : (
          /* Share icon — arrow pointing up out of a tray */
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
            <path d="M8 2L5.25 5.5H7V11H9V5.5H10.75L8 2Z" />
            <path d="M2.5 9.5V14H13.5V9.5H12V13H4V9.5Z" />
          </svg>
        )}
      </button>
      {copyState !== "idle" && (
        <p className={`absolute top-full left-1/2 -translate-x-1/2 mt-1.5 text-xs whitespace-nowrap z-10 rounded-md px-2 py-1 pointer-events-none ${
          copyState === "copied"
            ? "bg-gray-800 text-white"
            : "bg-red-50 text-red-600 border border-red-100"
        }`}>
          {copyState === "copied" ? "Link copied" : "Couldn\u2019t copy link"}
        </p>
      )}
    </div>
  );
}

function ChevronUp() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 8L6 4L10 8" />
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 4L6 8L10 4" />
    </svg>
  );
}

function QuestionCard({
  question,
  isNew,
  onVote,
  votingOpen,
  voteInFlight,
  isEditing,
  editText,
  editError,
  editSaving,
  onEditStart,
  onEditTextChange,
  onEditSave,
  onEditCancel,
  onRetract,
}: {
  question: Question;
  isNew: boolean;
  onVote: (id: string, value: 1 | -1) => void;
  votingOpen: boolean;
  voteInFlight: boolean;
  isEditing: boolean;
  editText: string;
  editError: string | null;
  editSaving: boolean;
  onEditStart: () => void;
  onEditTextChange: (text: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  onRetract: () => void;
}) {
  const { id, text, submittedName, isAnonymous, score, myVote, createdAt, isOwn, pinnedAt } = question;
  const withinEditWindow = isOwn && Date.now() - new Date(createdAt).getTime() < EDIT_WINDOW_MS;

  // Entry animation: new cards slide up from 6px and fade in
  const [entered, setEntered] = useState(!isNew);
  const [highlight, setHighlight] = useState(isNew);
  const [hovered, setHovered] = useState(false);

  useLayoutEffect(() => {
    if (!isNew) return;
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => setEntered(true))
    );
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!highlight) return;
    const id = setTimeout(() => setHighlight(false), 80);
    return () => clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cardTransform = !entered
    ? "translateY(6px)"
    : hovered
    ? "translateY(-1px)"
    : "translateY(0)";

  // Meta line: "Anonymous · Mar 14 · 9:49 PM"
  const date = new Date(createdAt);
  const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const timeStr = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  const authorName = isAnonymous ? "Anonymous" : (submittedName ?? "Unknown");

  return (
    <li
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        opacity: entered ? 1 : 0,
        transform: cardTransform,
        backgroundColor: highlight ? "#f0fdf4" : "#ffffff",
        boxShadow: hovered
          ? "0 4px 14px rgba(0,0,0,0.09)"
          : "0 1px 3px rgba(0,0,0,0.06)",
        transition:
          "opacity 250ms ease, transform 200ms ease, background-color 800ms ease, box-shadow 200ms ease",
      }}
      className="rounded-xl border border-gray-200 px-4 py-3.5 flex items-center gap-4"
    >
      {/* Vote column — top-aligned with question text */}
      <div className="flex flex-col items-center gap-0.5 min-w-[1.75rem]">
        <button
          onClick={() => votingOpen && !voteInFlight && onVote(id, 1)}
          disabled={!votingOpen || voteInFlight}
          aria-label={myVote === 1 ? "Remove upvote" : "Upvote"}
          title={myVote === 1 ? "Click to remove your upvote" : undefined}
          className={`p-1 flex items-center justify-center rounded transition-colors disabled:cursor-not-allowed ${
            !votingOpen || voteInFlight
              ? "text-gray-200"
              : myVote === 1
              ? "text-brand-700 hover:text-brand-300"
              : "text-gray-300 hover:text-brand-700"
          }`}
        >
          <ChevronUp />
        </button>

        <span
          className={`text-[13px] font-semibold tabular-nums leading-none ${
            score > 0
              ? "text-brand-500"
              : score < 0
              ? "text-red-400"
              : "text-gray-400"
          }`}
        >
          {score}
        </span>

        <button
          onClick={() => votingOpen && !voteInFlight && onVote(id, -1)}
          disabled={!votingOpen || voteInFlight}
          aria-label={myVote === -1 ? "Remove downvote" : "Downvote"}
          title={myVote === -1 ? "Click to remove your downvote" : undefined}
          className={`p-1 flex items-center justify-center rounded transition-colors disabled:cursor-not-allowed ${
            !votingOpen || voteInFlight
              ? "text-gray-200"
              : myVote === -1
              ? "text-red-400 hover:text-red-200"
              : "text-gray-300 hover:text-red-400"
          }`}
        >
          <ChevronDown />
        </button>
      </div>

      {/* Content column */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div>
            <div className="relative">
              <textarea
                className="w-full border border-gray-300 rounded-lg p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-400"
                rows={3}
                value={editText}
                onChange={(e) => onEditTextChange(e.target.value.slice(0, 280))}
                maxLength={280}
                autoFocus
              />
              <span className={`absolute bottom-2 right-3 text-xs tabular-nums ${
                editText.length >= 261 ? "text-orange-500" : "text-gray-400"
              }`}>
                {editText.length} / 280
              </span>
            </div>
            {editError && <p className="text-red-500 text-xs mt-1">{editError}</p>}
            <div className="flex gap-2 mt-2">
              <button
                onClick={onEditSave}
                disabled={editSaving || editText.trim().length === 0}
                className="px-3 py-1 text-xs bg-brand-700 text-white rounded-lg hover:bg-brand-800 disabled:opacity-50 font-medium transition-colors"
              >
                {editSaving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={onEditCancel}
                className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-[18px] font-medium leading-snug text-gray-900">
              {pinnedAt && (
                <span className="inline-block mr-1.5 text-brand-700" title="Pinned by host">📌</span>
              )}
              {text}
            </p>
            <p className="text-xs text-gray-400 mt-1.5">
              {authorName} · {dateStr} · {timeStr}
            </p>
          </>
        )}
      </div>

      {/* Edit / retract buttons for own questions within window */}
      {withinEditWindow && !isEditing && (
        <div className="shrink-0 flex flex-col gap-1">
          <button
            onClick={onEditStart}
            className="w-7 h-7 flex items-center justify-center rounded-md bg-gray-100 text-gray-500 hover:bg-brand-100 hover:text-brand-700 transition-colors"
            title="Edit question"
            aria-label="Edit question"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L6.75 6.774a2.75 2.75 0 0 0-.596.892l-.848 2.047a.75.75 0 0 0 .98.98l2.047-.848a2.75 2.75 0 0 0 .892-.596l4.263-4.263a1.75 1.75 0 0 0 0-2.473ZM2.75 8a.75.75 0 0 1 .75.75v2h2a.75.75 0 0 1 0 1.5h-2v2a.75.75 0 0 1-1.5 0v-2h-2a.75.75 0 0 1 0-1.5h2v-2A.75.75 0 0 1 2.75 8Z" />
            </svg>
          </button>
          <button
            onClick={onRetract}
            className="w-7 h-7 flex items-center justify-center rounded-md bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600 transition-colors"
            title="Retract question"
            aria-label="Retract question"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
              <path fillRule="evenodd" d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5a.75.75 0 0 1 .786-.711Z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}
    </li>
  );
}

// ── EventTime ────────────────────────────────────────────────────────────────

function EventTime({
  startsAt,
  questionCount,
  voteCount,
}: {
  startsAt: string;
  questionCount?: number;
  voteCount?: number;
}) {
  const date = new Date(startsAt);

  const etDateStr = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);

  const etTimeStr = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);

  const [localTime, setLocalTime] = useState<string | null>(null);
  const [viewerIsET, setViewerIsET] = useState(false);

  useEffect(() => {
    const viewerTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setViewerIsET(viewerTz === "America/New_York");
    setLocalTime(
      new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(date)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startsAt]);

  // Build inline stats suffix — only when there are questions to show
  const hasStats = questionCount !== undefined && questionCount > 0;
  const statsStr = hasStats
    ? ` · ${questionCount} ${questionCount === 1 ? "question" : "questions"} · ${voteCount ?? 0} ${(voteCount ?? 0) === 1 ? "vote" : "votes"}`
    : "";

  return (
    <div>
      <p className="text-sm font-medium text-gray-600">
        {etDateStr} · {etTimeStr} ET{viewerIsET && localTime ? " (your local time)" : ""}{statsStr}
      </p>
      {localTime && !viewerIsET && (
        <p className="text-xs text-gray-400 mt-0.5">{localTime} local time</p>
      )}
    </div>
  );
}
