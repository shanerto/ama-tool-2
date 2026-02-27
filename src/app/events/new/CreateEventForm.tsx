"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DateTimePicker from "@/components/DateTimePicker";

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

const inputClass =
  "w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-500 transition-colors";

export default function CreateEventForm({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();

  const [type, setType] = useState<"team" | "company">("team");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [hostName, setHostName] = useState("");
  const [isPublic, setIsPublic] = useState(true);
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
          isPublic,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create event.");
        return;
      }
      router.push(`/events/${data.id}`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="max-w-xl mx-auto px-6 py-14">
      {/* Page header */}
      <div className="mb-8">
        <Link href="/" className="text-xs font-medium text-brand-700 hover:underline">
          ← Back
        </Link>
        <h1 className="text-2xl font-bold tracking-tight mt-3">Create Event</h1>
        <p className="text-sm text-gray-500 mt-1">
          Create a new team AMA and start collecting questions.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-gray-200 shadow-sm p-7 space-y-5"
      >
        {/* Event type — admin only */}
        {isAdmin && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Event Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as "team" | "company")}
              className={inputClass}
            >
              <option value="team">Team Event</option>
              <option value="company">Company Event</option>
            </select>
          </div>
        )}

        {/* Title */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">
            Event Title{" "}
            <span className="text-gray-400 font-normal">*</span>
          </label>
          <input
            type="text"
            placeholder="e.g. Q3 Engineering AMA"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            className={inputClass}
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">
            Description{" "}
            <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            placeholder="Brief description of what this AMA covers"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            className={inputClass}
          />
        </div>

        {/* Date & Time */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">
            Date &amp; Time{" "}
            <span className="text-gray-400 font-normal">(Eastern Time)</span>{" "}
            <span className="text-gray-400 font-normal">*</span>
          </label>
          <DateTimePicker value={startsAt} onChange={setStartsAt} required />
        </div>

        {/* Host name — team events only */}
        {effectiveType === "team" && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Host Name{" "}
              <span className="text-gray-400 font-normal">*</span>
            </label>
            <input
              type="text"
              placeholder="Your full name"
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              maxLength={100}
              className={inputClass}
            />
          </div>
        )}

        {/* Visibility */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">
            Visibility
          </label>
          <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
            <button
              type="button"
              onClick={() => setIsPublic(true)}
              className={`flex-1 px-3 py-2 text-center transition-colors ${
                isPublic
                  ? "bg-brand-700 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Public
            </button>
            <button
              type="button"
              onClick={() => setIsPublic(false)}
              className={`flex-1 px-3 py-2 text-center border-l border-gray-300 transition-colors ${
                !isPublic
                  ? "bg-brand-700 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Private
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            {isPublic
              ? "Shows on the homepage."
              : "Only people with the link can access."}
          </p>
        </div>

        {/* Error — reserve height to prevent layout shift */}
        <div className="min-h-[1.25rem]">
          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}
        </div>

        {/* Actions */}
        <div>
          <button
            type="submit"
            disabled={creating}
            className="bg-brand-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-brand-800 disabled:opacity-50 transition-colors"
          >
            {creating ? "Creating..." : "Create Event"}
          </button>
        </div>
      </form>
    </main>
  );
}
