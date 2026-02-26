"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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

export default function CreateEventForm({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();

  const [type, setType] = useState<"team" | "company">("team");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [hostName, setHostName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveType = isAdmin ? type : "team";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const t = title.trim();
    if (!t) { setError("Title is required."); return; }
    if (!startsAt) { setError("Event date/time is required."); return; }
    if (effectiveType === "team" && !hostName.trim()) {
      setError("Host name is required for team events.");
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
          type: effectiveType,
          hostName: effectiveType === "team" ? hostName.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create event.");
        return;
      }
      router.push("/");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="max-w-2xl mx-auto px-6 py-16">
      <div className="mb-6">
        <Link href="/" className="text-sm text-brand-700 hover:underline">
          ← Back
        </Link>
        <h1 className="text-2xl font-bold mt-2">Create Event</h1>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-gray-200 shadow-sm p-5"
      >
        {/* Event type — admin only */}
        {isAdmin && (
          <div className="mb-3">
            <label className="block text-xs text-gray-500 mb-1">Event Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as "team" | "company")}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            >
              <option value="team">Team Event</option>
              <option value="company">Company Event</option>
            </select>
          </div>
        )}

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

        {/* Host name — team events only */}
        {effectiveType === "team" && (
          <div className="mb-2">
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
        )}

        {error && <p className="text-red-500 text-sm mb-2">{error}</p>}

        <button
          type="submit"
          disabled={creating}
          className="bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-800 disabled:opacity-50 transition-colors"
        >
          {creating ? "Creating..." : "Create Event"}
        </button>
      </form>
    </main>
  );
}
