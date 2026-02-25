import { redirect } from "next/navigation";
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
          href="/admin"
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors mt-1 shrink-0"
        >
          Admin
        </Link>
      </div>

      <div className="border-t border-gray-100 mb-8" />

      {events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 p-10 text-center text-gray-400">
          No active events right now. Check back later.
        </div>
      ) : (
        <ul className="space-y-4">
          {events.map((event) => (
            <li key={event.id}>
              <Link
                href={`/events/${event.id}`}
                className="block rounded-2xl border border-gray-100 bg-white p-6 shadow-sm hover:shadow-md hover:-translate-y-px hover:border-brand-200 transition-all duration-150"
              >
                <div className="font-semibold text-lg">{event.title}</div>
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
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
