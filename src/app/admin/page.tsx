"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";

type Event = {
  id: string;
  title: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  _count: { questions: number };
};

export default function AdminHomePage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  // New event form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

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
    setCreating(true);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: t, description: description.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error ?? "Failed to create event.");
        return;
      }
      setTitle("");
      setDescription("");
      await fetchEvents();
    } catch {
      setCreateError("Network error.");
    } finally {
      setCreating(false);
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
              className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center gap-4"
            >
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
              <div className="flex gap-2 shrink-0">
                <Link
                  href={`/admin/events/${event.id}`}
                  className="px-3 py-1.5 text-xs bg-brand-50 text-brand-700 rounded-lg hover:bg-brand-100 font-medium transition-colors"
                >
                  Manage
                </Link>
                <button
                  onClick={() => toggleActive(event)}
                  className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors"
                >
                  {event.isActive ? "Deactivate" : "Activate"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
