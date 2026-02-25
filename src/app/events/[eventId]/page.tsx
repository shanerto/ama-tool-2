"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

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

type Event = {
  id: string;
  title: string;
  description: string | null;
  isVotingOpen: boolean;
};

type SortMode = "score" | "newest";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}

export default function EventPage() {
  const { eventId } = useParams<{ eventId: string }>();

  const [event, setEvent] = useState<Event | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>("score");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Submission form state
  const [formText, setFormText] = useState("");
  const [formName, setFormName] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      setError(null);
    } catch {
      setError("Network error. Retrying...");
    } finally {
      setLoading(false);
    }
  }, [eventId, sortMode]);

  // Initial load + sort-change fetch
  useEffect(() => {
    setLoading(true);
    fetchQuestions();
  }, [fetchQuestions]);

  // Polling every 3 seconds
  useEffect(() => {
    pollRef.current = setInterval(fetchQuestions, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchQuestions]);

  async function handleVote(questionId: string, value: 1 | -1 | 0) {
    // Optimistic update
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
        // Reconcile with server truth
        setQuestions((prev) =>
          prev.map((q) =>
            q.id === questionId ? { ...q, score: data.score, myVote: data.myVote } : q
          )
        );
      }
    } catch {
      // Let poll reconcile on next tick
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
      // Refresh immediately
      await fetchQuestions();
    } catch {
      setSubmitError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const sortedQuestions =
    sortMode === "newest"
      ? [...questions].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
      : questions; // already sorted by score from server

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
        <h1 className="text-2xl font-bold mt-2">{event?.title}</h1>
        {event?.description && (
          <p className="text-gray-500 text-sm mt-1">{event.description}</p>
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
}: {
  question: Question;
  onVote: (id: string, value: 1 | -1 | 0) => void;
  votingOpen: boolean;
}) {
  const { id, text, submittedName, isAnonymous, score, myVote, createdAt } = question;

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
        <p className="text-sm text-gray-800 leading-relaxed">{text}</p>
        <p className="text-xs text-gray-400 mt-2">
          {isAnonymous ? "Anonymous" : submittedName ?? "Unknown"} ·{" "}
          {new Date(createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </li>
  );
}
