"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";

type Event = {
  id: string;
  title: string;
  description: string | null;
  isActive: boolean;
  startsAt: string | null;
  createdAt: string;
  _count: { questions: number };
};

// Convert a datetime-local string (e.g. "2026-03-06T10:30") treated as
// America/New_York time into a UTC ISO string.
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

// Convert a UTC ISO string to a datetime-local value in ET for form pre-fill
function utcIsoToEtLocal(isoStr: string): string {
  const date = new Date(isoStr);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  const h = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${h}:${get("minute")}`;
}

export default function AdminHomePage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  // New event form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Edit event form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStartsAt, setEditStartsAt] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  async function fetchEvents() {
    const res = await fetch("/api/admin/events");
    if (res.ok) setEvents(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    fetchEvents();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    const t = title.trim();
    if (!t) {
      setCreateError("Title is required.");
      return;
    }
    if (!startsAt) {
      setCreateError("Event date/time is required.");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: t,
          description: description.trim() || undefined,
          startsAt: etLocalToUtcIso(startsAt),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error ?? "Failed to create event.");
        return;
      }
      setTitle("");
      setDescription("");
      setStartsAt("");
      await fetchEvents();
    } catch {
      setCreateError("Network error.");
    } finally {
      setCreating(false);
    }
  }

  function startEdit(event: Event) {
    setEditingId(event.id);
    setEditTitle(event.title);
    setEditDescription(event.description ?? "");
    setEditStartsAt(event.startsAt ? utcIsoToEtLocal(event.startsAt) : "");
    setEditError(null);
  }

  async function handleEditSave() {
    if (!editingId) return;
    const t = editTitle.trim();
    if (!t) {
      setEditError("Title is required.");
      return;
    }

    setEditSaving(true);
    setEditError(null);
    try {
      const res = await fetch("/api/admin/events", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          title: t,
          description: editDescription.trim() || null,
          startsAt: editStartsAt ? etLocalToUtcIso(editStartsAt) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error ?? "Failed to save changes.");
        return;
      }
      setEditingId(null);
      await fetchEvents();
    } catch {
      setEditError("Network error.");
    } finally {
      setEditSaving(false);
    }
  }

  async function toggleActive(event: Event) {
    await fetch("/api/admin/events", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: event.id, isActive: !event.isActive }),
    });
    await fetchEvents();
  }

  async function deleteEvent(id: string) {
    setDeleting(true);
    try {
      await fetch("/api/admin/events", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setConfirmDeleteId(null);
      await fetchEvents();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Events</h1>

      {/* Create event form */}
      <form
        onSubmit={handleCreate}
        className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-8"
      >
        <h2 className="font-semibold mb-3">Create New Event</h2>
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
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </div>
        {createError && <p className="text-red-500 text-sm mb-2">{createError}</p>}
        <button
          type="submit"
          disabled={creating}
          className="bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-800 disabled:opacity-50 transition-colors"
        >
          {creating ? "Creating..." : "Create Event"}
        </button>
      </form>

      {/* Event list */}
      {loading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : events.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-gray-400">
          No events yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {events.map((event) => (
            <li
              key={event.id}
              className="bg-white rounded-xl border border-gray-200 shadow-sm p-4"
            >
              {editingId === event.id ? (
                /* ── Inline edit form ── */
                <div>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    maxLength={200}
                    placeholder="Event title (required)"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
                    autoFocus
                  />
                  <input
                    type="text"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    maxLength={500}
                    placeholder="Description (optional)"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                  <div className="mb-2">
                    <label className="block text-xs text-gray-500 mb-1">
                      Date &amp; Time <span className="text-gray-400">(Eastern Time)</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={editStartsAt}
                      onChange={(e) => setEditStartsAt(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                    />
                  </div>
                  {editError && <p className="text-red-500 text-sm mb-2">{editError}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={handleEditSave}
                      disabled={editSaving}
                      className="px-3 py-1.5 text-xs bg-brand-700 text-white rounded-lg hover:bg-brand-800 font-medium disabled:opacity-50 transition-colors"
                    >
                      {editSaving ? "Saving..." : "Save Changes"}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Normal event row ── */
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{event.title}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          event.isActive
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {event.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    {event.description && (
                      <p className="text-sm text-gray-500 mt-0.5">{event.description}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {event._count.questions} question{event._count.questions !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                    {confirmDeleteId === event.id ? (
                      <>
                        <button
                          onClick={() => deleteEvent(event.id)}
                          disabled={deleting}
                          className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50 transition-colors whitespace-nowrap"
                        >
                          {deleting ? "Deleting..." : "Yes, delete"}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <Link
                          href={`/admin/events/${event.id}`}
                          className="px-3 py-1.5 text-xs bg-brand-50 text-brand-700 rounded-lg hover:bg-brand-100 font-medium transition-colors"
                        >
                          Manage
                        </Link>
                        <button
                          onClick={() => startEdit(event)}
                          className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => toggleActive(event)}
                          className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors"
                        >
                          {event.isActive ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(event.id)}
                          className="px-3 py-1.5 text-xs bg-red-50 text-red-600 rounded-lg hover:bg-red-100 font-medium transition-colors"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
