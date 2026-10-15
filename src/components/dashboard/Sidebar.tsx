"use client";

import Link from "next/link";
import { useLanguage } from "@/components/common/LanguageContext";

export default function Sidebar() {
  const { t } = useLanguage();

  return (
    <aside className="hidden lg:block w-64 bg-green-700 text-white min-h-screen p-6 shrink-0">
      <h2 className="text-2xl font-bold mb-10">🌱 AgriTech AI</h2>

      <nav className="space-y-5 text-base font-semibold">
        <Link href="/dashboard" className="block hover:text-green-200">
          {t("dashboard")}
        </Link>

        <Link
          href="/dashboard/terrace-planner"
          className="block hover:text-green-200"
        >
          🏠 {t("terracePlanner")}
        </Link>

        <Link
          href="/dashboard/digital-twin"
          className="block hover:text-green-200"
        >
          🌐 {t("digitalTwin")}
        </Link>

        <Link
          href="/dashboard/crop-analysis"
          className="block hover:text-green-200"
        >
          🌱 {t("cropAnalysis")}
        </Link>

        <Link
          href="/dashboard/history"
          className="block hover:text-green-200"
        >
          📜 {t("history")}
        </Link>

        <Link
          href="/dashboard/hydroponics"
          className="block hover:text-green-200"
        >
          💧 {t("hydroponics")}
        </Link>

        <Link href="/marketplace" className="block hover:text-green-200">
          🛒 {t("marketplace")}
        </Link>
      </nav>
    </aside>
  );
}
