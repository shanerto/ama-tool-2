"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
  }

  return (
    <button
      onClick={handleLogout}
      className="text-xs text-indigo-200 hover:text-white underline"
    >
      Log out
    </button>
  );
}
