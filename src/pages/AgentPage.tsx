import AgentSettingsCard from "@/components/AgentSettingsCard";
import { Bot } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

export default function AgentPage() {
  const { t } = useLanguage();
  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start gap-3">
        <Bot className="h-6 w-6 text-primary mt-0.5 shrink-0" />
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground">{t("agent.title")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t("agent.subtitle")}</p>
        </div>
      </div>
      <AgentSettingsCard />
    </div>
  );
}
