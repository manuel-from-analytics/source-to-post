import { useState } from "react";
import {
  Newspaper, Search, Loader2, Clock, ExternalLink,
  Library, Check, ChevronRight, Sparkles, Send, MoreVertical, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  useNewsletters,
  useNewsletterDetail,
  useGenerateNewsletter,
  useImportToLibrary,
  useDeleteNewsletter,
  useSearchTopics,
  type Newsletter,
  type NewsletterItem,
} from "@/hooks/useNewsletters";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { es } from "date-fns/locale";

function SourceBadge({ type }: { type: string }) {
  const config: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
    independent: { label: "Independiente", variant: "default" },
    vendor: { label: "Vendor", variant: "secondary" },
    foundational: { label: "Foundational", variant: "outline" },
  };
  const c = config[type] || config.independent;
  return <Badge variant={c.variant} className="text-[10px]">{c.label}</Badge>;
}

function NewsletterItemCard({ item, onImport, importing }: {
  item: NewsletterItem;
  onImport: () => void;
  importing: boolean;
}) {
  return (
    <div className="rounded-lg border p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-medium text-sm leading-tight flex-1">{item.title}</h4>
        <SourceBadge type={item.source_type} />
      </div>
      {item.description && (
        <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
      )}
      <div className="flex items-center gap-2">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          <ExternalLink className="h-3 w-3" />
          Ver fuente
        </a>
        {item.imported_to_library ? (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Check className="h-3 w-3" /> En biblioteca
          </span>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-6 gap-1"
            onClick={onImport}
            disabled={importing}
          >
            <Library className="h-3 w-3" />
            Importar
          </Button>
        )}
      </div>
    </div>
  );
}

function NewsletterView({ newsletter }: { newsletter: Newsletter }) {
  const importMutation = useImportToLibrary();

  const handleImportAll = () => {
    const unimported = (newsletter.items || []).filter(i => !i.imported_to_library);
    unimported.forEach(item => importMutation.mutate(item));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">{newsletter.topic}</h2>
          <p className="text-xs text-muted-foreground">
            {format(new Date(newsletter.created_at), "d MMM yyyy, HH:mm", { locale: es })}
          </p>
        </div>
        {(newsletter.items || []).some(i => !i.imported_to_library) && (
          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-1"
            onClick={handleImportAll}
            disabled={importMutation.isPending}
          >
            <Library className="h-3.5 w-3.5" />
            Importar todas
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {(newsletter.items || []).map((item, i) => (
          <NewsletterItemCard
            key={item.id || i}
            item={item}
            onImport={() => importMutation.mutate(item)}
            importing={importMutation.isPending}
          />
        ))}
      </div>

      {newsletter.content && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Contenido completo</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs whitespace-pre-wrap font-sans leading-relaxed text-foreground">
              {newsletter.content}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function NewsletterPage() {
  const [topic, setTopic] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [generatedNewsletter, setGeneratedNewsletter] = useState<Newsletter | null>(null);

  const { data: newsletters, isLoading: loadingHistory } = useNewsletters();
  const { data: pastTopics } = useSearchTopics();
  const { data: selectedDetail } = useNewsletterDetail(selectedId);
  const { generate, isGenerating } = useGenerateNewsletter();
  const deleteMutation = useDeleteNewsletter();

  const handleDelete = (id: string) => {
    if (selectedId === id) {
      setSelectedId(null);
    }
    deleteMutation.mutate(id);
  };

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setSelectedId(null);
    const result = await generate(topic.trim());
    if (result) {
      setGeneratedNewsletter(result);
    }
  };

  const handleSelectHistory = (nl: Newsletter) => {
    setSelectedId(nl.id);
    setGeneratedNewsletter(null);
  };

  const handleReuseTopic = (t: string) => {
    setTopic(t);
  };

  const activeNewsletter = selectedId ? selectedDetail : generatedNewsletter;

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Newsletter</h1>
        <p className="text-muted-foreground mt-1">
          Genera newsletters curadas con fuentes verificadas sobre cualquier tema
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr]">
        {/* Left: Search + History */}
        <div className="space-y-4">
          {/* Search */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Search className="h-4 w-4" />
                Buscar tema
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Ej: AI agents in enterprise analytics..."
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
                  className="text-sm"
                />
                <Button
                  size="sm"
                  onClick={handleGenerate}
                  disabled={isGenerating || !topic.trim()}
                  className="gap-1 shrink-0"
                >
                  {isGenerating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>

              {/* Past topics */}
              {pastTopics && pastTopics.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                    Búsquedas recientes
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {pastTopics.slice(0, 8).map((t) => (
                      <button
                        key={t}
                        onClick={() => handleReuseTopic(t)}
                        className="text-[11px] px-2 py-1 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors truncate max-w-[180px]"
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* History */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Historial
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingHistory ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : !newsletters || newsletters.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Aún no has generado newsletters
                </p>
              ) : (
                <div className="space-y-1 max-h-[400px] overflow-y-auto">
                    {newsletters.map((nl) => (
                      <div
                        key={nl.id}
                        className={`w-full text-left rounded-lg px-3 py-2.5 transition-colors flex items-center gap-2 ${
                          selectedId === nl.id
                            ? "bg-primary/10 text-primary"
                            : "hover:bg-secondary/50"
                        }`}
                      >
                        <button
                          className="flex items-center gap-2 flex-1 min-w-0"
                          onClick={() => handleSelectHistory(nl)}
                        >
                          <Newspaper className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <div className="flex-1 min-w-0 text-left">
                            <p className="text-sm font-medium truncate">{nl.topic}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {format(new Date(nl.created_at), "d MMM yyyy", { locale: es })}
                            </p>
                          </div>
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0">
                              <MoreVertical className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleDelete(nl.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-2" />
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Newsletter display */}
        <div>
          {isGenerating ? (
            <Card className="min-h-[400px] flex items-center justify-center">
              <div className="text-center space-y-3">
                <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
                <div>
                  <p className="font-medium text-sm">Generando newsletter...</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Buscando fuentes verificadas y curando contenido
                  </p>
                </div>
              </div>
            </Card>
          ) : activeNewsletter ? (
            <NewsletterView newsletter={activeNewsletter} />
          ) : (
            <Card className="min-h-[400px] flex items-center justify-center">
              <div className="text-center space-y-3">
                <Sparkles className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                <div>
                  <p className="font-medium text-sm">Tu newsletter aparecerá aquí</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                    Escribe un tema y genera una newsletter curada con fuentes independientes y verificadas
                  </p>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
