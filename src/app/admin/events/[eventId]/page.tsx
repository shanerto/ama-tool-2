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
  isHidden: boolean;
  pinnedAt: string | null;
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

type Tab = "open" | "answered" | "hidden" | "analytics";

export default function AdminEventPage() {
  const { eventId } = useParams<{ eventId: string }>();

  const [event, setEvent] = useState<Event | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [tab, setTab] = useState<Tab>("open");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [votingToggling, setVotingToggling] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchQuestions = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/questions?sort=score`);
      if (!res.ok) return;
      const data = await res.json();
      setEvent(data.event);
      setQuestions(data.questions);
    } catch {
      // silently retry on next poll
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchQuestions();
    pollRef.current = setInterval(fetchQuestions, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchQuestions]);

  async function markAnswered(questionId: string) {
    setActionLoading(questionId);
    try {
      await fetch(`/api/questions/${questionId}/answer`, { method: "POST" });
      await fetchQuestions();
    } finally {
      setActionLoading(null);
    }
  }

  async function markOpen(questionId: string) {
    setActionLoading(questionId);
    try {
      await fetch(`/api/questions/${questionId}/answer`, { method: "DELETE" });
      await fetchQuestions();
    } finally {
      setActionLoading(null);
    }
  }

  async function hideQuestion(questionId: string) {
    setActionLoading(questionId);
    try {
      await fetch(`/api/questions/${questionId}/hide`, { method: "POST" });
      await fetchQuestions();
    } finally {
      setActionLoading(null);
    }
  }

  async function unhideQuestion(questionId: string) {
    setActionLoading(questionId);
    try {
      await fetch(`/api/questions/${questionId}/hide`, { method: "DELETE" });
      await fetchQuestions();
    } finally {
      setActionLoading(null);
    }
  }

  async function pinQuestion(questionId: string) {
    setActionLoading(questionId);
    try {
      await fetch(`/api/questions/${questionId}/pin`, { method: "POST" });
      await fetchQuestions();
    } finally {
      setActionLoading(null);
    }
  }

  async function unpinQuestion(questionId: string) {
    setActionLoading(questionId);
    try {
      await fetch(`/api/questions/${questionId}/pin`, { method: "DELETE" });
      await fetchQuestions();
    } finally {
      setActionLoading(null);
    }
  }

  async function toggleVoting() {
    if (!event) return;
    setVotingToggling(true);
    const next = !event.isVotingOpen;
    setEvent((prev) => prev ? { ...prev, isVotingOpen: next } : prev);
    try {
      await fetch("/api/admin/events", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: eventId, isVotingOpen: next }),
      });
    } catch {
      setEvent((prev) => prev ? { ...prev, isVotingOpen: !next } : prev);
    } finally {
      setVotingToggling(false);
    }
  }

  const openQuestions = questions
    .filter((q) => q.status === "OPEN" && !q.isHidden)
    .sort((a, b) => {
      const aPinned = a.pinnedAt ? 1 : 0;
      const bPinned = b.pinnedAt ? 1 : 0;
      if (bPinned !== aPinned) return bPinned - aPinned;
      return b.score - a.score || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const answeredQuestions = questions
    .filter((q) => q.status === "ANSWERED" && !q.isHidden)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const hiddenQuestions = questions
    .filter((q) => q.isHidden)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const displayedQuestions =
    tab === "open" ? openQuestions : tab === "answered" ? answeredQuestions : hiddenQuestions;

  // Analytics stats
  const totalQuestions = questions.length;
  const openCount = openQuestions.length;
  const answeredCount = answeredQuestions.length;
  const hiddenCount = hiddenQuestions.length;
  const totalVotes = questions.reduce((sum, q) => sum + Math.abs(q.score), 0);
  const anonymousCount = questions.filter((q) => q.isAnonymous).length;
  const namedCount = questions.filter((q) => !q.isAnonymous).length;
  const anonPct = totalQuestions > 0 ? Math.round((anonymousCount / totalQuestions) * 100) : 0;

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      {/* Back link */}
      <Link href="/admin" className="text-sm text-brand-700 hover:underline">
        ← All Events
      </Link>

      {/* Header */}
      <div className="mt-3 mb-6">
        <h1 className="text-2xl font-bold">{event?.title ?? "Loading..."}</h1>
        {event?.description && (
          <p className="text-gray-500 text-sm mt-1">{event.description}</p>
        )}
        <div className="flex items-center gap-4 mt-1">
          <a
            href={`/events/${eventId}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-brand-700 hover:underline"
          >
            Open public board ↗
          </a>
          <a
            href={`/presenter/${eventId}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-white bg-brand-700 hover:bg-brand-800 px-2.5 py-1 rounded-md font-medium transition-colors"
          >
            Presenter Mode ↗
          </a>
        </div>
      </div>

      {/* Voting toggle */}
      <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white shadow-sm px-4 py-3 mb-6">
        <div>
          <p className="text-sm font-semibold text-gray-800">Voting</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {event?.isVotingOpen
              ? "Participants can currently vote on questions."
              : "Voting is frozen — participants cannot vote."}
          </p>
        </div>
        <button
          onClick={toggleVoting}
          disabled={votingToggling || !event}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
            event?.isVotingOpen ? "bg-brand-700" : "bg-gray-300"
          }`}
          role="switch"
          aria-checked={event?.isVotingOpen ?? true}
          title={event?.isVotingOpen ? "Click to close voting" : "Click to open voting"}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
              event?.isVotingOpen ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
        <span
          className={`ml-3 text-xs font-semibold shrink-0 ${
            event?.isVotingOpen ? "text-brand-700" : "text-gray-500"
          }`}
        >
          {event?.isVotingOpen ? "OPEN" : "CLOSED"}
        </span>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 w-fit">
        <button
          onClick={() => setTab("open")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === "open" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Open
          <span className="ml-1.5 bg-brand-100 text-brand-700 text-xs px-1.5 py-0.5 rounded-full">
            {openQuestions.length}
          </span>
        </button>
        <button
          onClick={() => setTab("answered")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === "answered" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Answered
          <span className="ml-1.5 bg-gray-200 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">
            {answeredQuestions.length}
          </span>
        </button>
        <button
          onClick={() => setTab("hidden")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === "hidden" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Hidden
          {hiddenQuestions.length > 0 && (
            <span className="ml-1.5 bg-gray-200 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">
              {hiddenQuestions.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("analytics")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === "analytics" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Analytics
        </button>
      </div>

      {/* Analytics tab */}
      {tab === "analytics" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { label: "Total Questions", value: totalQuestions },
            { label: "Open", value: openCount },
            { label: "Answered", value: answeredCount },
            { label: "Hidden", value: hiddenCount },
            { label: "Total Votes Cast", value: totalVotes },
            { label: "Anonymous", value: `${anonymousCount} (${anonPct}%)` },
            { label: "Named", value: `${namedCount} (${100 - anonPct}%)` },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="bg-white rounded-xl border border-gray-200 shadow-sm p-4"
            >
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500 mt-1">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Question list (open / answered / hidden tabs) */}
      {tab !== "analytics" && (
        loading ? (
          <p className="text-gray-400 text-sm">Loading...</p>
        ) : displayedQuestions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-gray-400">
            {tab === "open"
              ? "No open questions yet."
              : tab === "answered"
              ? "No answered questions yet."
              : "No hidden questions."}
          </div>
        ) : (
          <ul className="space-y-3">
            {displayedQuestions.map((q) => (
              <li
                key={q.id}
                className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex gap-4"
              >
                {/* Score badge */}
                <div className="flex flex-col items-center min-w-[2.5rem]">
                  <span
                    className={`text-lg font-bold ${
                      q.score > 0
                        ? "text-brand-700"
                        : q.score < 0
                        ? "text-red-500"
                        : "text-gray-400"
                    }`}
                  >
                    {q.score}
                  </span>
                  <span className="text-xs text-gray-400">votes</span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 leading-relaxed">
                    {q.pinnedAt && (
                      <span className="inline-block mr-1.5 text-brand-700" title="Pinned">📌</span>
                    )}
                    {q.text}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {q.isAnonymous ? "Anonymous" : q.submittedName ?? "Unknown"} ·{" "}
                    {new Date(q.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>

                {/* Actions */}
                <div className="shrink-0 flex flex-col gap-1.5 items-end">
                  {tab === "open" && (
                    <>
                      <button
                        onClick={() => markAnswered(q.id)}
                        disabled={actionLoading === q.id}
                        className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50 transition-colors whitespace-nowrap"
                      >
                        {actionLoading === q.id ? "..." : "Mark Answered"}
                      </button>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => q.pinnedAt ? unpinQuestion(q.id) : pinQuestion(q.id)}
                          disabled={actionLoading === q.id}
                          className={`px-2.5 py-1 text-xs rounded-lg font-medium disabled:opacity-50 transition-colors whitespace-nowrap ${
                            q.pinnedAt
                              ? "bg-brand-100 text-brand-700 hover:bg-brand-200"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                          title={q.pinnedAt ? "Unpin" : "Pin to top"}
                        >
                          {q.pinnedAt ? "📌 Unpin" : "Pin"}
                        </button>
                        <button
                          onClick={() => hideQuestion(q.id)}
                          disabled={actionLoading === q.id}
                          className="px-2.5 py-1 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 font-medium disabled:opacity-50 transition-colors whitespace-nowrap"
                          title="Hide from public without answering"
                        >
                          Hide
                        </button>
                      </div>
                    </>
                  )}
                  {tab === "answered" && (
                    <button
                      onClick={() => markOpen(q.id)}
                      disabled={actionLoading === q.id}
                      className="px-3 py-1.5 text-xs bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium disabled:opacity-50 transition-colors whitespace-nowrap"
                    >
                      {actionLoading === q.id ? "..." : "Reopen"}
                    </button>
                  )}
                  {tab === "hidden" && (
                    <button
                      onClick={() => unhideQuestion(q.id)}
                      disabled={actionLoading === q.id}
                      className="px-3 py-1.5 text-xs bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium disabled:opacity-50 transition-colors whitespace-nowrap"
                    >
                      {actionLoading === q.id ? "..." : "Unhide"}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )
      )}
    </main>
  );
}
