import Image from "next/image";
import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-black/[0.08] pt-6 pb-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <Image
            src="/paxoslogo.png"
            alt="Paxos"
            height={22}
            width={0}
            sizes="100vw"
            className="w-auto opacity-80"
            style={{ height: "22px", width: "auto" }}
          />
          <span className="text-xs text-gray-400">
            PAXQ · Built for thoughtful conversations
          </span>
        </div>
        <Link
          href="/admin/login"
          className="text-xs text-gray-400 hover:text-gray-600 hover:underline transition-colors"
        >
          Admin Login
        </Link>
      </div>
    </footer>
  );
}
