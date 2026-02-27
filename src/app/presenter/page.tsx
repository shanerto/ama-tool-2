import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PresenterPickerPage() {
  // Show all events (active and inactive) so hosts can present any session.
  const events = await prisma.event.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      isActive: true,
      createdAt: true,
      _count: { select: { questions: true } },
    },
  });

  // Single event — jump straight in.
  if (events.length === 1) {
    redirect(`/presenter/${events[0].id}`);
  }

  return (
    <main className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold text-white mb-1">Select an Event</h1>
      <p className="text-gray-400 mb-8 text-sm">
        Choose which event to present.
      </p>

      {events.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-700 p-12 text-center text-gray-500">
          No events found.{" "}
          <Link href="/admin" className="text-brand-700 hover:underline">
            Create one in admin.
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {events.map((event) => (
            <li key={event.id}>
              <Link
                href={`/presenter/${event.id}`}
                className="block rounded-xl bg-gray-800 border border-gray-700 p-5 hover:border-brand-700 hover:bg-gray-750 transition-all group"
              >
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-semibold text-lg text-white group-hover:text-brand-400 transition-colors">
                    {event.title}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      event.isActive
                        ? "bg-gray-500 text-gray-100"
                        : "bg-gray-700 text-gray-400"
                    }`}
                  >
                    {event.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                {event.description && (
                  <p className="text-gray-400 text-sm">{event.description}</p>
                )}
                <p className="text-xs text-gray-500 mt-2">
                  {event._count.questions} question
                  {event._count.questions !== 1 ? "s" : ""} ·{" "}
                  {new Date(event.createdAt).toLocaleDateString()}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
