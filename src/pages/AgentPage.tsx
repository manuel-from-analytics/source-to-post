import AgentSettingsCard from "@/components/AgentSettingsCard";
import { Bot } from "lucide-react";

export default function AgentPage() {
  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start gap-3">
        <Bot className="h-6 w-6 text-primary mt-0.5 shrink-0" />
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground">Agente</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Configura tu agente diario y revisa sus ejecuciones. Haz click en una ejecución para abrir la newsletter generada.
          </p>
        </div>
      </div>
      <AgentSettingsCard />
    </div>
  );
}
