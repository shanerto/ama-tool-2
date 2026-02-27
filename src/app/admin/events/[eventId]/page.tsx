"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import VotingToggle from "@/components/VotingToggle";

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
  const [openMenu, setOpenMenu] = useState<string | null>(null);

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

  useEffect(() => {
    if (!openMenu) return;
    function handleClick() { setOpenMenu(null); }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [openMenu]);

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
      <div className="mb-6">
        <VotingToggle
          isOpen={event?.isVotingOpen ?? true}
          onChange={toggleVoting}
          disabled={votingToggling || !event}
        />
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
                className={`rounded-xl border border-gray-200 shadow-sm p-4 flex gap-4 relative ${
                  tab === "hidden" ? "bg-gray-50 opacity-60" : "bg-white"
                }`}
              >
                {/* Score */}
                <div className="flex flex-col items-center justify-start pt-0.5 min-w-[2rem] text-center">
                  <span
                    className={`text-xl font-bold leading-none tabular-nums ${
                      q.score > 0
                        ? "text-brand-700"
                        : q.score < 0
                        ? "text-red-500"
                        : "text-gray-400"
                    }`}
                  >
                    {q.score}
                  </span>
                  <span className="text-[10px] text-gray-400 mt-0.5 leading-none">votes</span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {tab === "open" && q.pinnedAt && (
                    <span className="inline-flex items-center text-[10px] font-medium text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded-full mb-1.5">
                      Pinned
                    </span>
                  )}
                  <p className="text-sm font-semibold text-gray-900 leading-snug">{q.text}</p>
                  <p className="text-[11px] text-gray-400 mt-1.5 leading-none">
                    {q.isAnonymous ? "Anonymous" : q.submittedName ?? "Unknown"} ·{" "}
                    {new Date(q.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>

                {/* Actions */}
                <div className="shrink-0 flex flex-col items-end gap-2">
                  {tab === "open" && (
                    <>
                      <button
                        onClick={() => markAnswered(q.id)}
                        disabled={actionLoading === q.id}
                        className="px-2.5 py-1 text-xs bg-green-600 text-white rounded-md hover:bg-green-700 font-medium disabled:opacity-50 transition-colors whitespace-nowrap"
                      >
                        {actionLoading === q.id ? "…" : "Mark Answered"}
                      </button>
                      <div className="relative">
                        <button
                          onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === q.id ? null : q.id); }}
                          className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                          title="More actions"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                            <path fillRule="evenodd" d="M4.5 12a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm6 0a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm6 0a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0z" clipRule="evenodd" />
                          </svg>
                        </button>
                        {openMenu === q.id && (
                          <div className="absolute right-0 top-8 z-20 bg-white border border-gray-200 rounded-lg shadow-md py-1 min-w-[130px]">
                            <button
                              onClick={() => { q.pinnedAt ? unpinQuestion(q.id) : pinQuestion(q.id); setOpenMenu(null); }}
                              disabled={actionLoading === q.id}
                              className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            >
                              {q.pinnedAt ? "Unpin" : "Pin to top"}
                            </button>
                            <button
                              onClick={() => { hideQuestion(q.id); setOpenMenu(null); }}
                              disabled={actionLoading === q.id}
                              className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            >
                              Hide
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                  {tab === "answered" && (
                    <>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full whitespace-nowrap">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                        </svg>
                        Answered
                      </span>
                      <div className="relative">
                        <button
                          onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === q.id ? null : q.id); }}
                          className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                          title="More actions"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                            <path fillRule="evenodd" d="M4.5 12a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm6 0a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm6 0a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0z" clipRule="evenodd" />
                          </svg>
                        </button>
                        {openMenu === q.id && (
                          <div className="absolute right-0 top-8 z-20 bg-white border border-gray-200 rounded-lg shadow-md py-1 min-w-[150px]">
                            <button
                              onClick={() => { markOpen(q.id); setOpenMenu(null); }}
                              disabled={actionLoading === q.id}
                              className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            >
                              Mark Unanswered
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                  {tab === "hidden" && (
                    <div className="relative">
                      <button
                        onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === q.id ? null : q.id); }}
                        className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                        title="More actions"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                          <path fillRule="evenodd" d="M4.5 12a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm6 0a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm6 0a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                      {openMenu === q.id && (
                        <div className="absolute right-0 top-8 z-20 bg-white border border-gray-200 rounded-lg shadow-md py-1 min-w-[130px]">
                          <button
                            onClick={() => { unhideQuestion(q.id); setOpenMenu(null); }}
                            disabled={actionLoading === q.id}
                            className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                          >
                            Unhide
                          </button>
                        </div>
                      )}
                    </div>
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
