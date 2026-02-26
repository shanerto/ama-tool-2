import { cookies } from "next/headers";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/auth";
import CreateEventForm from "./CreateEventForm";

export default async function NewEventPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  const isAdmin = token ? await verifySessionToken(token) : false;

  return <CreateEventForm isAdmin={isAdmin} />;
}
