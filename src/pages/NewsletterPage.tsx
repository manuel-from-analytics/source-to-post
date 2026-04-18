import { useState, useRef, useEffect } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  Newspaper, Search, Loader2, Clock, ExternalLink,
  Library, Check, ChevronRight, Sparkles, Send, MoreVertical, Trash2,
  Headphones, Pause, Play, Volume2, RefreshCw,
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

function SourceBadge({ type, t }: { type: string; t: (k: string) => string }) {
  const config: Record<string, { labelKey: string; variant: "default" | "secondary" | "outline" }> = {
    independent: { labelKey: "newsletter.sourceBadge.independent", variant: "default" },
    vendor: { labelKey: "newsletter.sourceBadge.vendor", variant: "secondary" },
    foundational: { labelKey: "newsletter.sourceBadge.foundational", variant: "outline" },
    academic: { labelKey: "newsletter.sourceBadge.academic", variant: "default" },
  };
  const c = config[type] || config.independent;
  return <Badge variant={c.variant} className="text-[10px]">{t(c.labelKey)}</Badge>;
}

function FreshnessBadge({ pubDate, t }: { pubDate: string; t: (k: string) => string }) {
  const now = new Date();
  const date = new Date(pubDate);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  let color: string;
  let label: string;
  if (diffDays <= 30) {
    color = "bg-green-500";
    label = t("newsletter.veryRecent");
  } else if (diffDays <= 90) {
    color = "bg-yellow-500";
    label = t("newsletter.recent");
  } else {
    color = "bg-red-400";
    label = t("newsletter.old");
  }

  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground" title={label}>
      <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
      {pubDate}
    </span>
  );
}

function NewsletterItemCard({ item, onImport, importing, t }: {
  item: NewsletterItem;
  onImport: () => void;
  importing: boolean;
  t: (k: string) => string;
}) {
  return (
    <div className="min-w-0 space-y-1.5 rounded-lg border p-3 sm:p-4 overflow-hidden">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between min-w-0">
        <h4 className="min-w-0 flex-1 text-[13px] font-medium leading-snug break-words [overflow-wrap:anywhere]">{item.title}</h4>
        <div className="flex flex-wrap items-center gap-2 self-start shrink-0 max-w-full">
          {item.pub_date && <FreshnessBadge pubDate={item.pub_date} t={t} />}
          <SourceBadge type={item.source_type} t={t} />
        </div>
      </div>
      {item.description && (
        <p className="text-[11px] leading-relaxed text-muted-foreground break-words [overflow-wrap:anywhere] line-clamp-2">{item.description}</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          <ExternalLink className="h-3 w-3" />
          {t("newsletter.viewSource")}
        </a>
        {item.imported_to_library ? (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Check className="h-3 w-3" /> {t("newsletter.imported")}
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
            {t("newsletter.import")}
          </Button>
        )}
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function PodcastPlayer({ newsletterId, savedScript, newsletterLang, t }: { newsletterId: string; savedScript?: string | null; newsletterLang?: string | null; t: (k: string) => string }) {
  const hasSaved = !!savedScript;
  const [status, setStatus] = useState<"idle" | "generating" | "ready" | "error">(hasSaved ? "ready" : "idle");
  const [isPlaying, setIsPlaying] = useState(false);
  const [script, setScript] = useState<string | null>(savedScript || null);
  const [lang, setLang] = useState(newsletterLang || "es");
  const [elapsed, setElapsed] = useState(0);
  const [estimatedDuration, setEstimatedDuration] = useState(() => {
    if (savedScript) {
      const wc = savedScript.split(/\s+/).length;
      const wpm = (newsletterLang || "es") === "en" ? 160 : 150;
      return Math.round((wc / wpm) * 60);
    }
    return 0;
  });
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedElapsedRef = useRef<number>(0);

  const startTimer = () => {
    stopTimer();
    startTimeRef.current = Date.now() - pausedElapsedRef.current * 1000;
    timerRef.current = setInterval(() => {
      const secs = (Date.now() - startTimeRef.current) / 1000;
      setElapsed(Math.min(secs, estimatedDuration || secs));
    }, 250);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleGenerate = async () => {
    setStatus("generating");
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("No autenticado");

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/newsletter-audio`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ newsletter_id: newsletterId, force_regenerate: true }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Error desconocido" }));
        throw new Error(err.error || `Error ${resp.status}`);
      }

      const data = await resp.json();
      const detectedLang = data.language || "es";
      setScript(data.script);
      setLang(detectedLang);

      const wordCount = (data.script || "").split(/\s+/).length;
      const wpm = detectedLang === "en" ? 160 : 150;
      const estSeconds = Math.round((wordCount / wpm) * 60);
      setEstimatedDuration(estSeconds);

      setStatus("ready");
      speakScript(data.script, detectedLang);
    } catch (e: any) {
      console.error("Podcast error:", e);
      setStatus("error");
      const { toast } = await import("sonner");
      toast.error(e.message || "Error al generar el podcast");
    }
  };

  const speakScript = (text: string, language: string) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === "es" ? "es-ES" : language === "en" ? "en-US" : language;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const langVoice = voices.find(v => v.lang.startsWith(language) && v.localService === false)
      || voices.find(v => v.lang.startsWith(language));
    if (langVoice) utterance.voice = langVoice;

    utterance.onend = () => {
      setIsPlaying(false);
      stopTimer();
      // Set elapsed to estimated so it shows full duration
      setElapsed(prev => prev);
    };
    utterance.onerror = () => {
      setIsPlaying(false);
      stopTimer();
    };
    utteranceRef.current = utterance;

    pausedElapsedRef.current = 0;
    setElapsed(0);
    window.speechSynthesis.speak(utterance);
    setIsPlaying(true);
    startTimer();
  };

  const togglePlay = () => {
    if (isPlaying) {
      window.speechSynthesis.pause();
      setIsPlaying(false);
      pausedElapsedRef.current = elapsed;
      stopTimer();
    } else if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setIsPlaying(true);
      startTimer();
    } else if (script) {
      speakScript(script, lang);
    }
  };

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
      stopTimer();
    };
  }, []);

  if (status === "idle") {
    return (
      <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={handleGenerate}>
        <Headphones className="h-3.5 w-3.5" />
        {t("newsletter.listenPodcast")}
      </Button>
    );
  }

  if (status === "generating") {
    return (
      <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="text-xs text-muted-foreground">{t("newsletter.generatingScript")}</span>
      </div>
    );
  }

  if (status === "error") {
    return (
      <Button variant="outline" size="sm" className="text-xs gap-1.5 text-destructive border-destructive/30" onClick={handleGenerate}>
        <Headphones className="h-3.5 w-3.5" />
        {t("newsletter.retryPodcast")}
      </Button>
    );
  }

  const progress = estimatedDuration > 0 ? Math.min((elapsed / estimatedDuration) * 100, 100) : 0;

  return (
    <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={togglePlay}>
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="h-1 w-full rounded-full bg-muted-foreground/20 overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between">
          <span className="text-[10px] tabular-nums text-muted-foreground">{formatTime(elapsed)}</span>
          <span className="text-[10px] tabular-nums text-muted-foreground">~{formatTime(estimatedDuration)}</span>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 shrink-0"
        onClick={() => { window.speechSynthesis.cancel(); setIsPlaying(false); stopTimer(); setElapsed(0); pausedElapsedRef.current = 0; handleGenerate(); }}
        title={t("newsletter.regeneratePodcast")}
      >
        <RefreshCw className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function NewsletterView({ newsletter }: { newsletter: Newsletter }) {
  const { t } = useLanguage();
  const importMutation = useImportToLibrary();

  const handleImportAll = () => {
    const unimported = (newsletter.items || []).filter(i => !i.imported_to_library);
    unimported.forEach(item => importMutation.mutate(item));
  };

  return (
    <div className="min-w-0 space-y-4 overflow-hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between min-w-0">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold break-words [overflow-wrap:anywhere]">{newsletter.topic}</h2>
          <p className="text-xs text-muted-foreground break-words">
            {format(new Date(newsletter.created_at), "d MMM yyyy, HH:mm", { locale: es })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 max-w-full sm:shrink-0">
          {newsletter.id && !newsletter.id.startsWith("temp-") && (
            <PodcastPlayer newsletterId={newsletter.id} savedScript={newsletter.podcast_script} newsletterLang={newsletter.language} t={t} />
          )}
          {(newsletter.items || []).some(i => !i.imported_to_library) && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1"
              onClick={handleImportAll}
              disabled={importMutation.isPending}
            >
            <Library className="h-3.5 w-3.5" />
            {t("newsletter.importAll")}
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {(newsletter.items || []).map((item, i) => (
          <NewsletterItemCard
            key={item.id || i}
            item={item}
            onImport={() => importMutation.mutate(item)}
            importing={importMutation.isPending}
            t={t}
          />
        ))}
      </div>

      {newsletter.content && (
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("newsletter.fullContent")}</CardTitle>
          </CardHeader>
          <CardContent className="min-w-0 overflow-hidden">
            <pre className="max-w-full text-xs whitespace-pre-wrap font-sans leading-relaxed text-foreground break-words [overflow-wrap:anywhere]">
              {newsletter.content}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function NewsletterPage() {
  const { t } = useLanguage();
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
  const hasHistory = Boolean(newsletters && newsletters.length > 0);

  return (
    <div className="mx-auto max-w-5xl min-w-0 overflow-hidden p-3 sm:p-4 lg:p-8">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Newsletter</h1>
        <p className="text-sm text-muted-foreground mt-0.5 break-words">
          {t("newsletter.subtitle")}
        </p>
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1fr_1.5fr]">
        {/* Left: Search + History */}
        <div className="space-y-3 sm:space-y-4">
          {/* Search */}
          <Card>
            <CardHeader className="px-3 py-2.5 sm:px-6 sm:py-4 pb-2 sm:pb-3">
              <CardTitle className="text-xs font-medium flex items-center gap-2 sm:text-sm">
                <Search className="h-4 w-4" />
                {t("newsletter.searchTopic")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-3 sm:px-6 sm:space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  placeholder="Ej: AI agents in enterprise analytics..."
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
                  className="h-10 text-sm"
                />
                <Button
                  size="sm"
                  onClick={handleGenerate}
                  disabled={isGenerating || !topic.trim()}
                  className="h-10 w-full shrink-0 gap-1 sm:w-auto"
                >
                  {isGenerating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  <span className="sm:hidden">{t("newsletter.generateNewsletter")}</span>
                </Button>
              </div>

              {/* Past topics */}
              {pastTopics && pastTopics.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                    {t("newsletter.recentSearches")}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {pastTopics.slice(0, 8).map((t) => (
                      <button
                        key={t}
                        onClick={() => handleReuseTopic(t)}
                        className="max-w-full truncate rounded-full bg-secondary px-2.5 py-1 text-[11px] text-secondary-foreground transition-colors hover:bg-secondary/80 sm:max-w-[180px]"
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
            <CardHeader className="px-3 py-2.5 sm:px-6 sm:py-4 pb-2 sm:pb-3">
              <CardTitle className="text-xs font-medium flex items-center gap-2 sm:text-sm">
                <Clock className="h-4 w-4" />
                {t("newsletter.history")}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6">
              {loadingHistory ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : !newsletters || newsletters.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  {t("newsletter.noHistory")}
                </p>
              ) : (
                <div className="space-y-1 max-h-[280px] overflow-y-auto overflow-x-hidden sm:max-h-[400px]">
                    {newsletters.map((nl) => (
                      <div
                        key={nl.id}
                        className={`flex min-w-0 w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                          selectedId === nl.id
                            ? "border-primary/20 bg-primary/10 text-primary"
                            : "border-border/60 hover:bg-secondary/50"
                        }`}
                      >
                        <button
                          className="flex min-w-0 flex-1 items-start gap-2"
                          onClick={() => handleSelectHistory(nl)}
                        >
                          <Newspaper className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
                          <div className="flex-1 min-w-0 text-left">
                            <p className="line-clamp-2 text-[13px] font-medium leading-snug break-words [overflow-wrap:anywhere]">{nl.topic}</p>
                            <p className="mt-0.5 text-[9px] text-muted-foreground">
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
                              {t("newsletter.delete")}
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
          <div className="min-w-0 overflow-hidden">
          {isGenerating ? (
            <Card className="flex min-h-[240px] items-center justify-center sm:min-h-[400px]">
              <div className="space-y-3 px-6 text-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
                <div>
                  <p className="font-medium text-sm">{t("newsletter.generating")}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("newsletter.searchingAndCurating")}
                  </p>
                </div>
              </div>
            </Card>
          ) : activeNewsletter ? (
            <NewsletterView newsletter={activeNewsletter} />
          ) : (
            <Card className={`flex items-center justify-center ${hasHistory ? "min-h-[220px] sm:min-h-[320px]" : "min-h-[260px] sm:min-h-[400px]"}`}>
              <div className="space-y-3 px-6 py-10 text-center sm:py-14">
                <Sparkles className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                <div>
                  <p className="font-medium text-sm">{t("newsletter.appearHere")}</p>
                  <p className="mx-auto mt-1 max-w-[16rem] text-xs text-muted-foreground break-words [overflow-wrap:anywhere]">
                    {t("newsletter.appearHereDesc")}
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
