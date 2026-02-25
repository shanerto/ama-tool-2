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
};

type Tab = "open" | "answered";

export default function AdminEventPage() {
  const { eventId } = useParams<{ eventId: string }>();

  const [event, setEvent] = useState<Event | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [tab, setTab] = useState<Tab>("open");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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

  const openQuestions = questions
    .filter((q) => q.status === "OPEN")
    .sort((a, b) => b.score - a.score || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const answeredQuestions = questions
    .filter((q) => q.status === "ANSWERED")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const displayedQuestions = tab === "open" ? openQuestions : answeredQuestions;

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      {/* Back link */}
      <Link href="/admin" className="text-sm text-indigo-600 hover:underline">
        ← All Events
      </Link>

      {/* Header */}
      <div className="mt-3 mb-6">
        <h1 className="text-2xl font-bold">{event?.title ?? "Loading..."}</h1>
        {event?.description && (
          <p className="text-gray-500 text-sm mt-1">{event.description}</p>
        )}
        <a
          href={`/events/${eventId}`}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-indigo-600 hover:underline mt-1 inline-block"
        >
          Open public board ↗
        </a>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 w-fit">
        <button
          onClick={() => setTab("open")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === "open"
              ? "bg-white shadow text-gray-900"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Open
          <span className="ml-1.5 bg-indigo-100 text-indigo-700 text-xs px-1.5 py-0.5 rounded-full">
            {openQuestions.length}
          </span>
        </button>
        <button
          onClick={() => setTab("answered")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === "answered"
              ? "bg-white shadow text-gray-900"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Answered
          <span className="ml-1.5 bg-gray-200 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">
            {answeredQuestions.length}
          </span>
        </button>
      </div>

      {/* Question list */}
      {loading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : displayedQuestions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-gray-400">
          {tab === "open" ? "No open questions yet." : "No answered questions yet."}
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
                      ? "text-indigo-600"
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
                <p className="text-sm text-gray-800 leading-relaxed">{q.text}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {q.isAnonymous ? "Anonymous" : q.submittedName ?? "Unknown"} ·{" "}
                  {new Date(q.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>

              {/* Action */}
              <div className="shrink-0">
                {q.status === "OPEN" ? (
                  <button
                    onClick={() => markAnswered(q.id)}
                    disabled={actionLoading === q.id}
                    className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50 transition-colors whitespace-nowrap"
                  >
                    {actionLoading === q.id ? "..." : "Mark Answered"}
                  </button>
                ) : (
                  <button
                    onClick={() => markOpen(q.id)}
                    disabled={actionLoading === q.id}
                    className="px-3 py-1.5 text-xs bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium disabled:opacity-50 transition-colors whitespace-nowrap"
                  >
                    {actionLoading === q.id ? "..." : "Reopen"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
