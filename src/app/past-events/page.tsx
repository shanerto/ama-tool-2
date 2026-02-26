import Link from "next/link";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

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

export default async function PastEventsPage() {
  const rawEvents = await prisma.event.findMany({
    where: { status: "CLOSED" },
    orderBy: { startsAt: "desc" },
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
      <div className="mb-6">
        <Link href="/" className="text-sm text-brand-700 hover:underline">
          ← Back to events
        </Link>
        <h1 className="text-2xl font-bold mt-2 text-gray-700">Past Events</h1>
        <p className="text-sm text-gray-400 mt-1">Events that have been closed.</p>
      </div>

      <div className="border-t border-gray-100 mb-8" />

      {events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 p-10 text-center text-gray-400">
          No past events yet.
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
                    <PastEventCard event={event} />
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
                    <PastEventCard event={event} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </main>
  );
}

function PastEventCard({ event }: { event: EventRow }) {
  const showMetrics = event.questionCount > 0;

  return (
    <Link
      href={`/events/${event.id}`}
      className="block rounded-2xl border border-gray-100 bg-gray-50 p-6 shadow-sm hover:shadow-md hover:-translate-y-px hover:border-gray-200 transition-all duration-150"
    >
      <div className="flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-lg text-gray-600">{event.title}</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-200 text-gray-500">
              Closed
            </span>
          </div>
          {event.type === "team" && event.hostName && (
            <div className="text-gray-400 text-sm mt-0.5">Hosted by {event.hostName}</div>
          )}
          {event.description && (
            <div className="text-gray-400 text-sm mt-1">{event.description}</div>
          )}
          {event.startsAt && (
            <div className="mt-3 space-y-0.5">
              <div className="text-xs font-medium text-gray-400">
                {formatETDate(new Date(event.startsAt))}
              </div>
              <div className="text-xs text-gray-400">
                {formatETTime(new Date(event.startsAt))}
              </div>
            </div>
          )}
        </div>

        {showMetrics && (
          <div className="shrink-0 self-center pl-2 space-y-0.5">
            <div className="flex items-baseline gap-1.5 whitespace-nowrap">
              <span className="text-sm font-semibold text-gray-500 tabular-nums">{event.questionCount}</span>
              <span className="text-sm font-semibold text-gray-500">questions</span>
            </div>
            <div className="flex items-baseline gap-1.5 whitespace-nowrap">
              <span className="text-xs text-gray-400 tabular-nums">{event.voteCount}</span>
              <span className="text-xs text-gray-400">votes</span>
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}
