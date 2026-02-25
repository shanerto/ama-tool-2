import { redirect } from "next/navigation";
import Link from "next/link";
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

export default async function HomePage() {
  const events = await prisma.event.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, description: true, startsAt: true },
  });

  // If exactly one active event, redirect there immediately
  if (events.length === 1) {
    redirect(`/events/${events[0].id}`);
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">Ask Paxos</h1>
      <p className="text-gray-500 mb-8">Submit questions. Vote on what matters most.</p>

      {events.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-gray-400">
          No active events right now. Check back later.
        </div>
      ) : (
        <ul className="space-y-3">
          {events.map((event) => (
            <li key={event.id}>
              <Link
                href={`/events/${event.id}`}
                className="block rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-brand-300 transition-all"
              >
                <div className="font-semibold text-lg">{event.title}</div>
                {event.description && (
                  <div className="text-gray-500 text-sm mt-1">{event.description}</div>
                )}
                {event.startsAt && (
                  <div className="text-xs text-gray-400 mt-2">
                    {formatETDate(new Date(event.startsAt))}
                    {" · "}
                    {formatETTime(new Date(event.startsAt))}
                    <LocalTime iso={event.startsAt.toISOString()} />
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-10 text-center">
        <Link href="/admin" className="text-xs text-gray-400 hover:text-gray-600 underline">
          Admin
        </Link>
      </div>
    </main>
  );
}
