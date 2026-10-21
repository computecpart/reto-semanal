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
    <LegalPage title="Las reglas cambiaron" updatedAt={`Versión ${rules.version}`}>
      <p className="font-semibold">
        Para seguir participando en {rules.campaign_name}, lee y acepta la versión vigente de las
        reglas.
      </p>
      <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-slate-200 p-5">
        <SafeMarkdown>{rules.content_md}</SafeMarkdown>
      </div>
      <AcceptRulesForm version={rules.version} />
    </LegalPage>
  );
}
