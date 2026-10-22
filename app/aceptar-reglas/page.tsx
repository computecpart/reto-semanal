import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AcceptRulesForm } from "@/components/campaign/accept-rules-form";
import { LegalPage } from "@/components/legal/legal-page";
import { SafeMarkdown } from "@/components/markdown/safe-markdown";
import { requireSessionPage } from "@/lib/auth/guards";
import { getCurrentRules, getMyRulesStatus } from "@/lib/campaign/queries";

export const metadata: Metadata = {
  title: "Acepta las reglas | Reto Semanal",
};

export default async function AcceptRulesPage() {
  await requireSessionPage("/app/perfil");
  const [status, rules] = await Promise.all([getMyRulesStatus(), getCurrentRules()]);

  if (!status.required || !rules) {
    redirect("/app/perfil");
  }

  return (
    <LegalPage eyebrow={rules.campaign_name} title="Reglas de la campaña">
      <p className="font-semibold text-[var(--color-ink)]">
        Antes de empezar tu aventura, lee las reglas oficiales. Al aceptarlas quedas listo para sumar puntos.
      </p>
      <div className="max-h-[50vh] overflow-y-auto border-2 border-slate-200 p-4 sm:p-5">
        <SafeMarkdown>{rules.content_md}</SafeMarkdown>
      </div>
      <AcceptRulesForm />
    </LegalPage>
  );
}
