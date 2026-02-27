"use client";

import { useState, useEffect, useRef, useCallback, FormEvent } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import VotingToggle from "@/components/VotingToggle";

// Convert a datetime-local string (treated as America/New_York) to UTC ISO string.
function etLocalToUtcIso(dtLocalStr: string): string {
  const [datePart, timePart] = dtLocalStr.split("T");
  const [y, mo, d] = datePart.split("-").map(Number);
  const [h, m] = timePart.split(":").map(Number);

  for (const offsetH of [4, 5]) {
    const candidate = new Date(Date.UTC(y, mo - 1, d, h + offsetH, m));
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(candidate);
    const ch = Number(parts.find((p) => p.type === "hour")?.value) % 24;
    const cm = Number(parts.find((p) => p.type === "minute")?.value);
    if (ch === h && cm === m) return candidate.toISOString();
  }
  return new Date(Date.UTC(y, mo - 1, d, h + 5, m)).toISOString();
}

// Convert a UTC ISO string to a datetime-local string in America/New_York.
function utcIsoToEtLocal(iso: string): string {
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}

export default function EditEventPage() {
  const router = useRouter();
  const { eventId } = useParams<{ eventId: string }>();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [hostName, setHostName] = useState("");
  const [isVotingOpen, setIsVotingOpen] = useState(true);
  const [eventStatus, setEventStatus] = useState<"OPEN" | "CLOSED">("OPEN");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closing, setClosing] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);

  function openDatePicker() {
    const el = dateInputRef.current;
    if (!el) return;
    el.focus();
    try { (el as HTMLInputElement & { showPicker?: () => void }).showPicker?.(); } catch { /* unsupported */ }
  }

  useEffect(() => {
    async function loadEvent() {
      try {
        const res = await fetch(`/api/events/${eventId}/questions?sort=score`);
        if (!res.ok) {
          setNotFound(true);
          return;
        }
        const data = await res.json();
        const event = data.event;
        if (event.type !== "team") {
          setNotFound(true);
          return;
        }
        setTitle(event.title ?? "");
        setDescription(event.description ?? "");
        setHostName(event.hostName ?? "");
        setStartsAt(event.startsAt ? utcIsoToEtLocal(event.startsAt) : "");
        setIsVotingOpen(event.isVotingOpen ?? true);
        setEventStatus(event.status ?? "OPEN");
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    loadEvent();
  }, [eventId]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/events/${eventId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? "Failed to delete event.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setDeleting(false);
    }
  }, [eventId, router]);

  const handleClose = useCallback(async () => {
    setClosing(true);
    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CLOSED" }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? "Failed to close event.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setClosing(false);
    }
  }, [eventId, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const t = title.trim();
    if (!t) { setError("Title is required."); return; }
    if (!startsAt) { setError("Event date/time is required."); return; }
    if (!hostName.trim()) { setError("Host name is required."); return; }

    setSaving(true);
    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: t,
          description: description.trim() || null,
          startsAt: etLocalToUtcIso(startsAt),
          hostName: hostName.trim(),
          isVotingOpen,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save changes.");
        return;
      }
      router.push(`/events/${eventId}`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-12 text-center text-gray-400">
        Loading...
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-12 text-center text-red-500">
        Event not found or cannot be edited.
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-6 py-16">
      <div className="mb-6">
        <Link href={`/events/${eventId}`} className="text-sm text-brand-700 hover:underline">
          ← Back to event
        </Link>
        <h1 className="text-2xl font-bold mt-2">Edit Event</h1>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-gray-200 shadow-sm p-5"
      >
        <input
          type="text"
          placeholder="Event title (required)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
        <input
          type="text"
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
        <div className="mb-2">
          <label className="block text-xs text-gray-500 mb-1">
            Date &amp; Time <span className="text-gray-400">(Eastern Time)</span>
          </label>
          <div className="relative">
            <input
              ref={dateInputRef}
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              required
              onClick={openDatePicker}
              onKeyDown={(e) => {
                if (e.key === "Tab" || e.key === "Escape") return;
                if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDatePicker(); return; }
                e.preventDefault();
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 cursor-pointer"
            />
            {!startsAt && (
              <span className="pointer-events-none absolute inset-px flex items-center px-3 text-sm text-gray-400 bg-white rounded-lg">
                Select date and time
              </span>
            )}
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-xs text-gray-500 mb-1">Full Name (host)</label>
          <input
            type="text"
            placeholder="Your full name (required)"
            value={hostName}
            onChange={(e) => setHostName(e.target.value)}
            maxLength={100}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </div>

        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-800 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <Link
            href={`/events/${eventId}`}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>

      {/* Voting toggle */}
      <div className="mt-6">
        <VotingToggle isOpen={isVotingOpen} onChange={setIsVotingOpen} />
      </div>

      {/* Event actions */}
      <div className="mt-10 border-t border-gray-200 pt-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-gray-200 rounded-xl overflow-hidden">
          {/* Close event */}
          <div className="bg-white px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-1">Close this event</h2>
            <p className="text-xs text-gray-400 mb-4">
              Disables new questions and voting. Data is preserved.
            </p>
            {eventStatus === "OPEN" ? (
              <button
                type="button"
                onClick={() => setShowCloseModal(true)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Close Event
              </button>
            ) : (
              <span className="inline-block px-4 py-2 rounded-lg text-sm font-medium text-gray-400 bg-gray-50 border border-gray-200 cursor-not-allowed">
                Event is closed
              </span>
            )}
          </div>

          {/* Delete event */}
          <div className="bg-white px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-1">Delete this event</h2>
            <p className="text-xs text-gray-400 mb-4">
              Permanently removes the event, questions, and votes.
            </p>
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="px-4 py-2 rounded-lg text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
            >
              Delete Event
            </button>
          </div>
        </div>
      </div>

      {showCloseModal && (
        <CloseModal
          onCancel={() => setShowCloseModal(false)}
          onConfirm={handleClose}
          closing={closing}
        />
      )}

      {showDeleteModal && (
        <DeleteModal
          onCancel={() => setShowDeleteModal(false)}
          onConfirm={handleDelete}
          deleting={deleting}
        />
      )}
    </main>
  );
}

// ── CloseModal ────────────────────────────────────────────────────────────────

function CloseModal({
  onCancel,
  onConfirm,
  closing,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  closing: boolean;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      aria-modal="true"
      role="dialog"
      aria-labelledby="close-modal-title"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h2 id="close-modal-title" className="text-base font-semibold text-gray-900">
          Close event?
        </h2>
        <p className="mt-2 text-sm text-gray-600 leading-relaxed">
          Closing this event will disable new questions and voting. This cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={closing}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 transition-colors"
            autoFocus
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={closing}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gray-800 hover:bg-gray-900 disabled:opacity-50 transition-colors"
          >
            {closing ? "Closing..." : "Close Event"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── DeleteModal ───────────────────────────────────────────────────────────────

function DeleteModal({
  onCancel,
  onConfirm,
  deleting,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  deleting: boolean;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      aria-modal="true"
      role="dialog"
      aria-labelledby="delete-modal-title"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h2 id="delete-modal-title" className="text-base font-semibold text-gray-900">
          Delete event?
        </h2>
        <p className="mt-2 text-sm text-gray-600 leading-relaxed">
          This will permanently remove the event and all associated questions and votes. This action cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 transition-colors"
            autoFocus
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {deleting ? "Deleting..." : "Delete Event"}
          </button>
        </div>
      </div>
    </div>
  );
}
