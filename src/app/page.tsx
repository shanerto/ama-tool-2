import Link from "next/link";
import Image from "next/image";
import { Prisma } from "@prisma/client";
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
  questionCount: number;
  voteCount: number;
};

function EventCard({ event }: { event: EventRow }) {
  const showMetrics = event.questionCount > 0;

  return (
    <Link
      href={`/events/${event.id}`}
      className="block rounded-2xl border border-gray-100 bg-white p-6 shadow-sm hover:shadow-md hover:-translate-y-px hover:border-brand-200 transition-all duration-150"
    >
      <div className="flex items-center gap-4">
        {/* Left: event info */}
        <div className="flex-1 min-w-0">
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
        </div>

        {/* Right: engagement metrics */}
        {showMetrics && (
          <div className="shrink-0 self-center pl-2 space-y-0.5">
            <div className="flex items-baseline gap-1.5 whitespace-nowrap">
              <span className="text-sm font-semibold text-gray-900 tabular-nums">{event.questionCount}</span>
              <span className="text-sm font-semibold text-gray-900">questions</span>
            </div>
            <div className="flex items-baseline gap-1.5 whitespace-nowrap">
              <span className="text-xs text-gray-600 tabular-nums">{event.voteCount}</span>
              <span className="text-xs text-gray-600">votes</span>
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}

export default async function HomePage() {
  const rawEvents = await prisma.event.findMany({
    where: { isActive: true },
    orderBy: { startsAt: "asc" },
    select: {
      id: true,
      title: true,
      description: true,
      startsAt: true,
      type: true,
      hostName: true,
      _count: { select: { questions: { where: { isHidden: false } } } },
    },
  });

  // Single query: vote counts per event (joins through questions — no N+1)
  const voteCountRows = rawEvents.length > 0
    ? await prisma.$queryRaw<{ eventId: string; voteCount: bigint }[]>(
        Prisma.sql`
          SELECT q."eventId", COUNT(v.id) AS "voteCount"
          FROM votes v
          INNER JOIN questions q ON v."questionId" = q.id
          WHERE q."eventId" IN (${Prisma.join(rawEvents.map((e) => e.id))})
            AND q."isHidden" = false
          GROUP BY q."eventId"
        `
      )
    : [];

  const voteCountMap = new Map(voteCountRows.map((r) => [r.eventId, Number(r.voteCount)]));

  const events: EventRow[] = rawEvents.map((e) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    startsAt: e.startsAt,
    type: e.type,
    hostName: e.hostName,
    questionCount: e._count.questions,
    voteCount: voteCountMap.get(e.id) ?? 0,
  }));

  const companyEvents = events.filter((e) => e.type === "company");
  const teamEvents = events.filter((e) => e.type === "team");

  return (
    <main className="max-w-2xl mx-auto px-6 py-16">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        {/* Left: logo + text block as a horizontal pair */}
        <div className="flex items-start gap-3">
          <Image
            src="/Question.png"
            alt="Ask Paxos logo"
            width={56}
            height={56}
            className="shrink-0 mt-0.5"
          />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Ask Paxos</h1>
            <p className="text-gray-400 text-sm mt-0.5">Submit questions. Vote on what matters most.</p>
          </div>
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

      {/* Footer */}
      <footer className="mt-16 border-t border-gray-100 pt-4">
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
          <span className="text-xs text-gray-400">
            Ask Paxos · Built for thoughtful conversations
          </span>
          <Link
            href="/admin/login"
            className="text-xs text-gray-400 hover:underline transition-colors"
          >
            Admin Login
          </Link>
        </div>
      </footer>
    </main>
  );
}
