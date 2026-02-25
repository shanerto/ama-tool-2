import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  const events = await prisma.event.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, description: true, createdAt: true },
  });

  // If exactly one active event, redirect there immediately
  if (events.length === 1) {
    redirect(`/events/${events[0].id}`);
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">AMA Board</h1>
      <p className="text-gray-500 mb-8">Select an active event to view and ask questions.</p>

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
                className="block rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all"
              >
                <div className="font-semibold text-lg">{event.title}</div>
                {event.description && (
                  <div className="text-gray-500 text-sm mt-1">{event.description}</div>
                )}
                <div className="text-xs text-gray-400 mt-2">
                  {new Date(event.createdAt).toLocaleDateString()}
                </div>
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
