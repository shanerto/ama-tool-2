"use client";

import { useRouter, usePathname } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  const pathname = usePathname();

  if (pathname === "/admin/login") return null;

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/");
  }

  return (
    <button
      onClick={handleLogout}
      className="text-xs text-brand-200 hover:text-white underline"
    >
      Log out
    </button>
  );
}
