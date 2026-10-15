"use client";

import ProtectedRoute from "@/components/auth/ProtectedRoute";
import AnalysisHistory from "@/components/history/AnalysisHistory";
import { useLanguage } from "@/components/common/LanguageContext";

export default function HistoryPage() {
  const { t } = useLanguage();

  return (
    <ProtectedRoute>
      <main className="max-w-6xl mx-auto py-10 px-6">
        <h1 className="text-4xl font-bold mb-8">{t("historyTitle")}</h1>

        <AnalysisHistory />
      </main>
    </ProtectedRoute>
  );
}
