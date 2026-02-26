import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { LocalTime } from "./LocalTime";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatETDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatETTime(date: Date): string {
  return (
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      minute: "2-digit",
    }).format(date) + " ET"
  );
}

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  startsAt: Date | null;
  type: "company" | "team";
  hostName: string | null;
};

function EventCard({ event }: { event: EventRow }) {
  return (
    <Link
      href={`/events/${event.id}`}
      className="block rounded-2xl border border-gray-100 bg-white p-6 shadow-sm hover:shadow-md hover:-translate-y-px hover:border-brand-200 transition-all duration-150"
    >
      <div className="font-semibold text-lg">{event.title}</div>
      {event.type === "team" && event.hostName && (
        <div className="text-gray-400 text-sm mt-0.5">Hosted by {event.hostName}</div>
      )}
      {event.description && (
        <div className="text-gray-500 text-sm mt-1">{event.description}</div>
      )}
      {event.startsAt && (
        <div className="mt-3 space-y-0.5">
          <div className="text-xs font-medium text-gray-500">
            {formatETDate(new Date(event.startsAt))}
          </div>
          <div className="text-xs text-gray-400">
            {formatETTime(new Date(event.startsAt))}
            <LocalTime iso={event.startsAt.toISOString()} />
          </div>
        </div>
      )}
    </Link>
  );
}

export default async function HomePage() {
  const events = await prisma.event.findMany({
    where: { isActive: true },
    orderBy: { startsAt: "asc" },
    select: { id: true, title: true, description: true, startsAt: true, type: true, hostName: true },
  });

  const companyEvents = events.filter((e) => e.type === "company");
  const teamEvents = events.filter((e) => e.type === "team");

  return (
    <main className="max-w-2xl mx-auto px-6 py-16">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Image src="/Question.png" alt="Ask Paxos logo" width={44} height={44} />
            <h1 className="text-4xl font-bold tracking-tight">Ask Paxos</h1>
          </div>
          <p className="text-gray-400 text-sm">Submit questions. Vote on what matters most.</p>
        </div>
        <Link
          href="/events/new"
          className="mt-1 shrink-0 bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-800 transition-colors"
        >
          Create Event
        </Link>
      </div>

      <div className="border-t border-gray-100 mb-8" />

      {events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 p-10 text-center text-gray-400">
          No active events right now. Check back later.
        </div>
      ) : (
        <div className="space-y-10">
          {companyEvents.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
                Company Events
              </h2>
              <ul className="space-y-4">
                {companyEvents.map((event) => (
                  <li key={event.id}>
                    <EventCard event={event} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {teamEvents.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
                Team Events
              </h2>
              <ul className="space-y-4">
                {teamEvents.map((event) => (
                  <li key={event.id}>
                    <EventCard event={event} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {/* Admin link — bottom-left, always visible */}
      <div className="fixed bottom-5 left-5">
        <Link
          href="/admin"
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          Admin
        </Link>
      </div>
    </main>
  );
}
