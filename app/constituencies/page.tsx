"use client";
import { useLiveData } from "@/components/LiveDataProvider";
import { useLocale } from "@/components/LocaleProvider";
import { ConstituencyTable } from "@/components/ConstituencyTable";

export default function ConstituenciesPage() {
  const { constituencies, recentlyChanged } = useLiveData();
  const { t } = useLocale();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black">{t("page.constituencies.title")}</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          {t("page.constituencies.subtitle")}
        </p>
      </div>
      <ConstituencyTable constituencies={constituencies} recentlyChanged={recentlyChanged} />
    </div>
  );
}
