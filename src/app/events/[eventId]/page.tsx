"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
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

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 5000);
    return () => clearInterval(id);
  }, []);

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
      setQuestions(data.questions);
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

  async function handleVote(questionId: string, value: 1 | -1 | 0) {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== questionId) return q;
        const oldVote = q.myVote ?? 0;
        const newVote = value === oldVote ? 0 : value;
        const scoreDelta = newVote - oldVote;
        return { ...q, score: q.score + scoreDelta, myVote: newVote === 0 ? null : (newVote as 1 | -1) };
      })
    );

    const question = questions.find((q) => q.id === questionId);
    const currentVote = question?.myVote ?? 0;
    const finalValue = value === currentVote ? 0 : value;

    try {
      const res = await fetch(`/api/questions/${questionId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: finalValue }),
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
      // Let poll reconcile
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
              <h1 className="text-2xl font-bold">{event.title}</h1>
              {event.hostName && (
                <p className="text-sm text-gray-400 mt-1.5">Hosted by {event.hostName}</p>
              )}
              {event.description && (
                <p className="text-gray-500 text-sm mt-1">{event.description}</p>
              )}
              {event.startsAt && (
                <div className="mt-4">
                  <EventTime
                    startsAt={event.startsAt}
                    questionCount={metrics?.questionCount}
                    voteCount={metrics?.voteCount}
                  />
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
              <h1 className="text-2xl font-bold">{event?.title}</h1>
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

      {/* Submit Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-8"
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

      {event && !event.isVotingOpen && (
        <div className="mb-4 rounded-lg bg-gray-100 border border-gray-200 px-4 py-2 text-sm text-gray-600">
          Voting is closed.
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
              onVote={handleVote}
              votingOpen={event?.isVotingOpen ?? true}
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

function QuestionCard({
  question,
  onVote,
  votingOpen,
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
  onVote: (id: string, value: 1 | -1 | 0) => void;
  votingOpen: boolean;
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

  return (
    <li className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex gap-4">
      {/* Vote column */}
      <div className="flex flex-col items-center gap-1 min-w-[2.5rem]">
        <button
          onClick={() => votingOpen && onVote(id, 1)}
          disabled={!votingOpen}
          className={`w-8 h-8 rounded-md flex items-center justify-center text-sm font-bold transition-colors disabled:cursor-not-allowed ${
            !votingOpen
              ? "bg-gray-100 text-gray-300"
              : myVote === 1
              ? "bg-brand-700 text-white"
              : "bg-gray-100 text-gray-500 hover:bg-brand-100 hover:text-brand-700"
          }`}
          aria-label="Upvote"
        >
          ▲
        </button>
        <span
          className={`text-sm font-bold transition-score ${
            score > 0
              ? "text-brand-700"
              : score < 0
              ? "text-red-500"
              : "text-gray-500"
          }`}
        >
          {score}
        </span>
        <button
          onClick={() => votingOpen && onVote(id, -1)}
          disabled={!votingOpen}
          className={`w-8 h-8 rounded-md flex items-center justify-center text-sm font-bold transition-colors disabled:cursor-not-allowed ${
            !votingOpen
              ? "bg-gray-100 text-gray-300"
              : myVote === -1
              ? "bg-red-500 text-white"
              : "bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-500"
          }`}
          aria-label="Downvote"
        >
          ▼
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
            <p className="text-sm text-gray-800 leading-relaxed">
              {pinnedAt && (
                <span className="inline-block mr-1.5 text-brand-700" title="Pinned by host">📌</span>
              )}
              {text}
            </p>
            <p className="text-xs text-gray-400 mt-2">
              {isAnonymous ? "Anonymous" : submittedName ?? "Unknown"} ·{" "}
              {new Date(createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
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
