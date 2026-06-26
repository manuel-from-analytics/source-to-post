import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Upload, BarChart3, TrendingUp, Eye, Heart,
  ExternalLink, Trash2, Building2, User as UserIcon, Link2, Link as LinkIcon,
  ArrowUpDown, ArrowUp, ArrowDown, Clock, X, Search,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useLinkedinMetrics, useDeleteLinkedinMetric, type LinkedinMetric } from "@/hooks/useLinkedinMetrics";
import { usePosts } from "@/hooks/usePosts";
import type { LinkedInSource } from "@/lib/linkedin-csv";
import { ImportCsvWizard } from "@/components/ImportCsvWizard";
import { buildPostMatcher, type PersonalPublication } from "@/lib/match-posts";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useScheduledPublications, useCancelScheduledPublication } from "@/hooks/usePublishLinkedin";
import { useLanguage } from "@/i18n/LanguageContext";

type SourceFilter = "all" | LinkedInSource;
type SortKey = "post" | "source" | "posted_at" | "impressions" | "engagements" | "engagement_rate";
type SortDir = "asc" | "desc";

interface Row extends LinkedinMetric {
  matchedPostId: string | null;
  engagements: number;
}

export default function PerformancePage() {
  const { t } = useLanguage();
  const { data: metrics = [], isLoading } = useLinkedinMetrics();
  const { data: posts = [] } = usePosts();
  const deleteMut = useDeleteLinkedinMetric();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();

  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [search, setSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("engagement_rate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [linkingMetric, setLinkingMetric] = useState<LinkedinMetric | null>(null);
  const [focusedPostId, setFocusedPostId] = useState<string | null>(null);

  useEffect(() => {
    const id = (location.state as any)?.openPostId as string | undefined;
    if (id) {
      setFocusedPostId(id);
      window.history.replaceState({}, "");
    }
  }, [location.state]);


  // Per-label publication dates for the "Personal" label — used to match
  // personal LinkedIn metrics by date even when a post is also tagged Empresa.
  const { data: personalPublications = [] as PersonalPublication[] } = useQuery({
    queryKey: ["personal-publications"],
    queryFn: async () => {
      const { data: lbl } = await supabase
        .from("post_labels").select("id").eq("kind", "personal").maybeSingle();
      if (!lbl?.id) return [] as PersonalPublication[];
      const { data: pubs } = await supabase
        .from("post_label_publications")
        .select("post_id, published_at")
        .eq("label_id", lbl.id);
      return ((pubs ?? []) as any[]).filter((p) => p.published_at) as PersonalPublication[];
    },
  });

  const matcher = useMemo(
    () => buildPostMatcher(
      (posts ?? []).map((p: any) => ({
        id: p.id, content: p.content, linkedin_url: p.linkedin_url,
      })),
      personalPublications,
      { personalMetrics: metrics.filter((m) => m.source === "personal") },
    ),
    [posts, personalPublications, metrics],
  );

  const postById = useMemo(() => {
    const m = new Map<string, any>();
    for (const p of (posts ?? []) as any[]) m.set(p.id, p);
    return m;
  }, [posts]);

  const rows = useMemo<Row[]>(() => {
    const base = sourceFilter === "all" ? metrics : metrics.filter((m) => m.source === sourceFilter);
    const mapped = base.map((m) => ({
      ...m,
      matchedPostId: m.post_id ?? matcher(m),
      engagements: Math.round(m.impressions * m.engagement_rate),
    }));
    const withPostFilter = focusedPostId ? mapped.filter((r) => r.matchedPostId === focusedPostId) : mapped;
    if (!search.trim()) return withPostFilter;
    const q = search.toLowerCase();
    return withPostFilter.filter((r) => {
      const post = r.matchedPostId ? postById.get(r.matchedPostId) : null;
      const text = (
        (post?.content ?? "") +
        (post?.title ?? "") +
        (r.post_title ?? "") +
        (r.post_excerpt ?? "") +
        (r.linkedin_url ?? "")
      ).toLowerCase();
      return text.includes(q);
    });
  }, [metrics, sourceFilter, matcher, focusedPostId, search, postById]);

  const focusedPostTitle = useMemo(() => {
    if (!focusedPostId) return null;
    const p = postById.get(focusedPostId);
    return p?.title || (p?.content ? p.content.slice(0, 60) : null);
  }, [focusedPostId, postById]);


  // Persist on-the-fly: any metric without post_id in DB but resolvable via the
  // client matcher gets written back so MCP / future imports see the link.
  // Also push the metric's linkedin_url to the matched post when missing.
  const backfilledRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!metrics.length || !posts.length) return;
    const pending: { id: string; postId: string; url: string | null }[] = [];
    for (const m of metrics) {
      if (m.post_id) continue;
      if (m.manually_unmatched) continue;
      if (backfilledRef.current.has(m.id)) continue;
      const pid = matcher(m);
      if (pid) {
        pending.push({ id: m.id, postId: pid, url: m.linkedin_url ?? null });
        backfilledRef.current.add(m.id);
      }
    }
    if (!pending.length) return;
    (async () => {
      // Update metrics with post_id.
      await Promise.all(
        pending.map(({ id, postId }) =>
          supabase.from("linkedin_post_metrics").update({ post_id: postId }).eq("id", id),
        ),
      );
      // Push linkedin_url back to the post when the post has none yet.
      const postIds = Array.from(new Set(pending.map((p) => p.postId)));
      const { data: postRows } = await supabase
        .from("generated_posts")
        .select("id, linkedin_url")
        .in("id", postIds);
      const havingUrl = new Set((postRows ?? []).filter((p: any) => p.linkedin_url).map((p: any) => p.id));
      await Promise.all(
        pending
          .filter((p) => p.url && !havingUrl.has(p.postId))
          .map((p) =>
            supabase.from("generated_posts").update({ linkedin_url: p.url }).eq("id", p.postId),
          ),
      );
      qc.invalidateQueries({ queryKey: ["linkedin-metrics"] });
      qc.invalidateQueries({ queryKey: ["posts"] });
    })();
  }, [metrics, posts, matcher, qc]);


  const summary = useMemo(() => {
    const total = rows.length;
    const impressions = rows.reduce((a, b) => a + b.impressions, 0);
    const engagements = rows.reduce((a, b) => a + b.engagements, 0);
    const er = impressions > 0 ? engagements / impressions : 0;
    return { total, impressions, engagements, er };
  }, [rows]);

  const sorted = useMemo(() => {
    const arr = [...rows];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      let av: any, bv: any;
      switch (sortKey) {
        case "post":
          av = (a.post_title || a.post_excerpt || "").toLowerCase();
          bv = (b.post_title || b.post_excerpt || "").toLowerCase();
          return av < bv ? -1 * dir : av > bv ? 1 * dir : 0;
        case "source":
          return a.source.localeCompare(b.source) * dir;
        case "posted_at":
          av = a.posted_at ? new Date(a.posted_at).getTime() : 0;
          bv = b.posted_at ? new Date(b.posted_at).getTime() : 0;
          return (av - bv) * dir;
        case "impressions":
          return (a.impressions - b.impressions) * dir;
        case "engagements":
          return (a.engagements - b.engagements) * dir;
        case "engagement_rate":
          return (a.engagement_rate - b.engagement_rate) * dir;
      }
    });
    return arr;
  }, [rows, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir(k === "post" || k === "source" ? "asc" : "desc"); }
  };

  const linkMut = useMutation({
    mutationFn: async ({ metricId, postId, linkedinUrl }: { metricId: string; postId: string; linkedinUrl: string | null }) => {
      const { error } = await supabase
        .from("linkedin_post_metrics")
        .update({ post_id: postId, manually_unmatched: false } as any)
        .eq("id", metricId);
      if (error) throw error;
      // Persist the LinkedIn URL on the post so future imports auto-match by URL/URN.
      if (linkedinUrl) {
        // Clear this URL from any other post that had it (in case of re-link).
        await supabase
          .from("generated_posts")
          .update({ linkedin_url: null })
          .eq("linkedin_url", linkedinUrl)
          .neq("id", postId);
        await supabase.from("generated_posts").update({ linkedin_url: linkedinUrl }).eq("id", postId);
      }
    },
    onSuccess: () => {
      toast.success(t("performance.linked"));
      qc.invalidateQueries({ queryKey: ["linkedin-metrics"] });
      qc.invalidateQueries({ queryKey: ["posts"] });
      setLinkingMetric(null);
    },
    onError: (e: any) => toast.error(e?.message ?? t("performance.linkFailed")),
  });

  const unlinkMut = useMutation({
    mutationFn: async (metricId: string) => {
      // Reset backfill cache so the matcher won't immediately re-link.
      backfilledRef.current.add(metricId);
      const { error } = await supabase
        .from("linkedin_post_metrics")
        .update({ post_id: null, manually_unmatched: true } as any)
        .eq("id", metricId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("performance.unlinked"));
      qc.invalidateQueries({ queryKey: ["linkedin-metrics"] });
      setLinkingMetric(null);
    },
    onError: (e: any) => toast.error(e?.message ?? t("performance.unlinkFailed")),
  });

  return (
    <div className="container mx-auto p-3 sm:p-4 lg:p-8 space-y-5 max-w-7xl min-w-0 overflow-x-hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 sm:h-7 sm:w-7 text-primary shrink-0" />
            <span className="min-w-0 break-words">{t("performance.title")}</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 break-words">
            {t("performance.subtitle")}
          </p>
        </div>
        <Button onClick={() => setImportOpen(true)} className="w-full sm:w-auto shrink-0">
          <Upload className="h-4 w-4 mr-2" />{t("performance.import")}
        </Button>
        <ImportCsvWizard open={importOpen} onOpenChange={setImportOpen} />
      </div>

      <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground shrink-0">{t("performance.origin")}</span>
          <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as SourceFilter)}>
            <SelectTrigger className="w-full sm:w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("performance.all")}</SelectItem>
              <SelectItem value="personal">{t("performance.personal")}</SelectItem>
              <SelectItem value="company">{t("performance.company")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="relative flex-1 min-w-0 sm:min-w-[200px] sm:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("performance.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {focusedPostId && (
          <button
            type="button"
            onClick={() => setFocusedPostId(null)}
            className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs text-primary hover:bg-primary/15"
            title={t("performance.removePostFilter")}
          >
            <span className="min-w-0 truncate">
              {t("performance.postFilter")} {focusedPostTitle || focusedPostId.slice(0, 8)}
            </span>
            <X className="h-3 w-3 shrink-0" />
          </button>
        )}
      </div>


      {isLoading ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">{t("performance.loading")}</CardContent></Card>
      ) : metrics.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <p className="font-medium">{t("performance.emptyTitle")}</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {t("performance.emptyDesc")}
            </p>
            <Button onClick={() => setImportOpen(true)}><Upload className="h-4 w-4 mr-2" />{t("performance.emptyImport")}</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KPI icon={<Eye className="h-4 w-4" />} label={t("performance.kpiImpressions")} value={summary.impressions.toLocaleString()} />
            <KPI icon={<Heart className="h-4 w-4" />} label={t("performance.kpiEngagements")} value={summary.engagements.toLocaleString()} />
            <KPI icon={<TrendingUp className="h-4 w-4" />} label={t("performance.kpiEr")} value={`${(summary.er * 100).toFixed(2)}%`} />
            <KPI icon={<BarChart3 className="h-4 w-4" />} label={t("performance.kpiPosts")} value={summary.total.toLocaleString()} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t("performance.postsTitle")} ({sorted.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableHead label={t("performance.colPost")} k="post" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                      <SortableHead label={t("performance.colSource")} k="source" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                      <SortableHead label={t("performance.colDate")} k="posted_at" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                      <SortableHead label={t("performance.colImpressions")} k="impressions" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
                      <SortableHead label={t("performance.colEngagements")} k="engagements" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
                      <SortableHead label={t("performance.colEr")} k="engagement_rate" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sorted.map((m) => (
                      <TableRow
                        key={m.id}
                        className={!m.matchedPostId ? "bg-amber-50/60 dark:bg-amber-500/10 border-l-2 border-l-amber-400" : undefined}
                      >
                        <TableCell className="max-w-[320px]">
                          {(() => {
                            const matchedPost = m.matchedPostId ? postById.get(m.matchedPostId) : null;
                            const excerptFromPost = matchedPost?.content
                              ? matchedPost.content.replace(/\s+/g, " ").slice(0, 80)
                              : null;
                            const displayText =
                              excerptFromPost ||
                              m.post_title ||
                              m.post_excerpt?.slice(0, 80) ||
                              (m.matchedPostId ? t("performance.noContent") : m.linkedin_url) ||
                              t("performance.noTitle");
                            return m.matchedPostId ? (
                              <button
                                type="button"
                                onClick={() => navigate("/history", { state: { openPostId: m.matchedPostId } })}
                                className="text-left w-full group/title"
                              >
                                <div className="font-medium truncate text-sm group-hover/title:text-primary group-hover/title:underline flex items-center gap-1">
                                  <Link2 className="h-3 w-3 shrink-0 opacity-60" />
                                  <span className="truncate">{displayText}</span>
                                </div>
                              </button>
                            ) : (
                              <div
                                className="font-medium truncate text-sm text-amber-700 dark:text-amber-400"
                                title={t("performance.notLinkedHint")}
                              >
                                ⚠ {displayText}
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell><SourceBadge source={m.source} t={t} /></TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {m.posted_at ? new Date(m.posted_at).toLocaleDateString() : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{m.impressions.toLocaleString()}</TableCell>
                        <TableCell className="text-right tabular-nums">{m.engagements.toLocaleString()}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {(m.engagement_rate * 100).toFixed(2)}%
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setLinkingMetric(m)}
                              className={
                                m.matchedPostId
                                  ? "text-muted-foreground hover:text-foreground"
                                  : "text-amber-600 hover:text-amber-700 dark:text-amber-400"
                              }
                              title={m.matchedPostId ? t("performance.changeLinked") : t("performance.linkPost")}
                              aria-label={m.matchedPostId ? t("performance.changeLinkedAria") : t("performance.linkPostAria")}
                            >
                              <LinkIcon className="h-4 w-4" />
                            </button>
                            {m.linkedin_url && (
                              <a href={m.linkedin_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground" title={t("performance.openLinkedin")}>
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            )}
                            <button
                              onClick={() => deleteMut.mutate(m.id)}
                              className="text-muted-foreground hover:text-destructive"
                              aria-label={t("performance.delete")}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {focusedPostId && sorted.length === 0 && (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    {t("performance.noMatchedMetrics")}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <ScheduledPublicationsSection />



      <LinkPostDialog
        metric={linkingMetric}
        posts={posts}
        onClose={() => setLinkingMetric(null)}
        onSelect={(postId) =>
          linkingMetric &&
          linkMut.mutate({ metricId: linkingMetric.id, postId, linkedinUrl: linkingMetric.linkedin_url })
        }
        onUnlink={() => linkingMetric && unlinkMut.mutate(linkingMetric.id)}
      />
    </div>
  );
}

function LinkPostDialog({
  metric, posts, onClose, onSelect, onUnlink,
}: {
  metric: LinkedinMetric | null;
  posts: any[];
  onClose: () => void;
  onSelect: (postId: string) => void;
  onUnlink?: () => void;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = (posts ?? []).slice().sort((a: any, b: any) => {
      const at = a.published_at ? new Date(a.published_at).getTime() : 0;
      const bt = b.published_at ? new Date(b.published_at).getTime() : 0;
      return bt - at;
    });
    if (!needle) return list.slice(0, 50);
    return list
      .filter((p: any) =>
        (p.title || "").toLowerCase().includes(needle) ||
        (p.content || "").toLowerCase().includes(needle))
      .slice(0, 50);
  }, [posts, q]);

  return (
    <Dialog open={!!metric} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Vincular con un post de la biblioteca</DialogTitle>
          <DialogDescription>
            {metric?.linkedin_url ? (
              <>Se guardará la URL de LinkedIn en el post seleccionado para que las próximas importaciones lo emparejen automáticamente.</>
            ) : (
              <>Se vinculará la métrica al post elegido.</>
            )}
          </DialogDescription>
        </DialogHeader>
        <Input placeholder="Buscar por título o contenido…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        <div className="max-h-[50vh] overflow-y-auto divide-y rounded border">
          {filtered.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground text-center">Sin resultados</div>
          ) : filtered.map((p: any) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p.id)}
              className="w-full text-left p-3 hover:bg-muted/50 transition-colors"
            >
              <div className="font-medium text-sm truncate">{p.title || "(sin título)"}</div>
              <div className="text-xs text-muted-foreground truncate">
                {p.published_at ? new Date(p.published_at).toLocaleDateString() : "Sin publicar"}
                {" · "}
                {(p.content || "").slice(0, 100)}
              </div>
            </button>
          ))}
        </div>
        {onUnlink && (
          <div className="flex justify-between items-center pt-2 border-t">
            <span className="text-xs text-muted-foreground">
              ¿Esta métrica no proviene de la app?
            </span>
            <Button variant="ghost" size="sm" onClick={onUnlink}>
              No vincular
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SortableHead({
  label, k, sortKey, sortDir, onClick, align = "left",
}: {
  label: string; k: SortKey; sortKey: SortKey; sortDir: SortDir;
  onClick: (k: SortKey) => void; align?: "left" | "right";
}) {
  const active = sortKey === k;
  const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead className={align === "right" ? "text-right" : undefined}>
      <button
        type="button"
        onClick={() => onClick(k)}
        className={`inline-flex items-center gap-1 hover:text-foreground ${active ? "text-foreground" : ""} ${align === "right" ? "justify-end w-full" : ""}`}
      >
        <span>{label}</span>
        <Icon className="h-3 w-3 opacity-60" />
      </button>
    </TableHead>
  );
}

function KPI({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          {icon}<span>{label}</span>
        </div>
        <div className="text-xl lg:text-2xl font-bold mt-1 tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

function SourceBadge({ source }: { source: LinkedInSource }) {
  return source === "company" ? (
    <Badge variant="secondary" className="gap-1"><Building2 className="h-3 w-3" />Empresa</Badge>
  ) : (
    <Badge variant="outline" className="gap-1"><UserIcon className="h-3 w-3" />Personal</Badge>
  );
}

function ScheduledPublicationsSection() {
  const { data: scheduled = [] } = useScheduledPublications();
  const { data: posts = [] } = usePosts();
  const cancel = useCancelScheduledPublication();
  const pending = scheduled.filter((s) => s.status === "pending" || s.status === "publishing");
  const recent = scheduled
    .filter((s) => s.status === "done" || s.status === "failed")
    .slice(0, 5);
  if (scheduled.length === 0) return null;
  const postById = new Map(posts.map((p) => [p.id, p]));

  const statusBadge = (s: string) => {
    if (s === "pending") return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />Programado</Badge>;
    if (s === "publishing") return <Badge variant="secondary">Publicando…</Badge>;
    if (s === "done") return <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-0">Publicado</Badge>;
    if (s === "failed") return <Badge variant="destructive">Falló</Badge>;
    return <Badge variant="outline">{s}</Badge>;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4" /> Publicaciones programadas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {[...pending, ...recent].map((s) => {
          const post = postById.get(s.post_id);
          return (
            <div key={s.id} className="flex items-start gap-3 rounded-md border p-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  {statusBadge(s.status)}
                  <span className="text-muted-foreground">
                    {new Date(s.scheduled_at).toLocaleString()}
                  </span>
                  {s.attempts > 0 && (
                    <span className="text-muted-foreground">· {s.attempts} intento{s.attempts > 1 ? "s" : ""}</span>
                  )}
                </div>
                <p className="text-sm mt-1.5 line-clamp-2 text-muted-foreground">
                  {post?.title || post?.content?.slice(0, 120) || "(post eliminado)"}
                </p>
                {s.error && (
                  <p className="text-xs text-destructive mt-1 break-all">{s.error}</p>
                )}
                {s.linkedin_url && (
                  <a href={s.linkedin_url} target="_blank" rel="noreferrer"
                     className="inline-flex items-center gap-1 text-xs text-primary mt-1">
                    <ExternalLink className="h-3 w-3" /> Ver en LinkedIn
                  </a>
                )}
              </div>
              {(s.status === "pending" || s.status === "failed") && (
                <Button
                  variant="ghost" size="icon" className="h-8 w-8 shrink-0"
                  onClick={() => cancel.mutate(s.id)}
                  title="Cancelar"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
