"use client";

import ProtectedRoute from "@/components/auth/ProtectedRoute";
import ImageUploader from "@/components/crop/CropUploader";
import { useLanguage } from "@/components/common/LanguageContext";

export default function CropAnalysisPage() {
  const { t } = useLanguage();

  return (
    <ProtectedRoute>
      <main className="max-w-5xl mx-auto py-10 px-6">
        <h1 className="text-4xl font-bold mb-8">{t("cropAnalysisTitle")}</h1>

        <ImageUploader />
      </main>
    </ProtectedRoute>
  );
}
