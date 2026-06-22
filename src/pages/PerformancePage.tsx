import { useMemo, useState } from "react";
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
  Upload, BarChart3, TrendingUp, Eye, Heart,
  ExternalLink, Trash2, Building2, User as UserIcon, Link2,
  ArrowUpDown, ArrowUp, ArrowDown,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLinkedinMetrics, useDeleteLinkedinMetric, type LinkedinMetric } from "@/hooks/useLinkedinMetrics";
import { usePosts } from "@/hooks/usePosts";
import type { LinkedInSource } from "@/lib/linkedin-csv";
import { ImportCsvWizard } from "@/components/ImportCsvWizard";
import { buildPostMatcher } from "@/lib/match-posts";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

type SourceFilter = "all" | LinkedInSource;
type SortKey = "post" | "source" | "posted_at" | "impressions" | "engagements" | "engagement_rate";
type SortDir = "asc" | "desc";

interface Row extends LinkedinMetric {
  matchedPostId: string | null;
  engagements: number;
}

export default function PerformancePage() {
  const { data: metrics = [], isLoading } = useLinkedinMetrics();
  const { data: posts = [] } = usePosts();
  const deleteMut = useDeleteLinkedinMetric();
  const navigate = useNavigate();

  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [importOpen, setImportOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("engagement_rate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Posts that carry the "Personal" label — used for date-based matching of personal metrics.
  const { data: personalPostIds = new Set<string>() } = useQuery({
    queryKey: ["personal-post-ids"],
    queryFn: async () => {
      const { data: lbl } = await supabase
        .from("post_labels").select("id").eq("name", "Personal").maybeSingle();
      if (!lbl?.id) return new Set<string>();
      const { data: assigns } = await supabase
        .from("post_label_assignments").select("post_id").eq("label_id", lbl.id);
      return new Set<string>((assigns ?? []).map((a: any) => a.post_id));
    },
  });

  const matcher = useMemo(
    () => buildPostMatcher(
      (posts ?? []).map((p: any) => ({
        id: p.id,
        content: p.content,
        linkedin_url: p.linkedin_url,
        published_at: p.published_at,
        is_personal: personalPostIds.has(p.id),
      })),
    ),
    [posts, personalPostIds],
  );

  const rows = useMemo<Row[]>(() => {
    const base = sourceFilter === "all" ? metrics : metrics.filter((m) => m.source === sourceFilter);
    return base.map((m) => ({
      ...m,
      matchedPostId: matcher(m),
      engagements: Math.round(m.impressions * m.engagement_rate),
    }));
  }, [metrics, sourceFilter, matcher]);

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

  return (
    <div className="container mx-auto p-4 lg:p-8 space-y-6 max-w-7xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-primary" />
            Rendimiento
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Métricas de tus posts publicados en LinkedIn (personal y empresa). Sube el fichero exportado desde LinkedIn (.csv, .xls o .xlsx) y se cruza con tus posts generados.
          </p>
        </div>
        <Button onClick={() => setImportOpen(true)}>
          <Upload className="h-4 w-4 mr-2" />Importar fichero
        </Button>
        <ImportCsvWizard open={importOpen} onOpenChange={setImportOpen} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Origen:</span>
        <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as SourceFilter)}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="personal">Personal</SelectItem>
            <SelectItem value="company">Empresa</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Cargando…</CardContent></Card>
      ) : metrics.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <p className="font-medium">Aún no has importado métricas</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              LinkedIn no expone una API pública de analytics, así que la fuente de verdad es el fichero exportado desde LinkedIn (perfil personal o página de empresa).
            </p>
            <Button onClick={() => setImportOpen(true)}><Upload className="h-4 w-4 mr-2" />Importar mi primer fichero</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KPI icon={<Eye className="h-4 w-4" />} label="Impresiones" value={summary.impressions.toLocaleString()} />
            <KPI icon={<Heart className="h-4 w-4" />} label="Engagements" value={summary.engagements.toLocaleString()} />
            <KPI icon={<TrendingUp className="h-4 w-4" />} label="Engagement rate medio" value={`${(summary.er * 100).toFixed(2)}%`} />
            <KPI icon={<BarChart3 className="h-4 w-4" />} label="Posts" value={summary.total.toLocaleString()} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Posts ({sorted.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableHead label="Post" k="post" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                      <SortableHead label="Origen" k="source" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                      <SortableHead label="Fecha" k="posted_at" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                      <SortableHead label="Impresiones" k="impressions" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
                      <SortableHead label="Engagements" k="engagements" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
                      <SortableHead label="ER" k="engagement_rate" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
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
                          {m.matchedPostId ? (
                            <button
                              type="button"
                              onClick={() => navigate("/history", { state: { openPostId: m.matchedPostId } })}
                              className="text-left w-full group/title"
                              title="Ver detalle del post en la app"
                            >
                              <div className="font-medium truncate text-sm group-hover/title:text-primary group-hover/title:underline flex items-center gap-1">
                                <Link2 className="h-3 w-3 shrink-0 opacity-60" />
                                <span className="truncate">
                                  {m.post_title || m.post_excerpt?.slice(0, 60) || m.linkedin_url || "(sin título)"}
                                </span>
                              </div>
                            </button>
                          ) : (
                            <div
                              className="font-medium truncate text-sm text-amber-700 dark:text-amber-400"
                              title="Este post no está vinculado a ningún post de la app"
                            >
                              ⚠ {m.post_title || m.post_excerpt?.slice(0, 60) || m.linkedin_url || "(sin título)"}
                            </div>
                          )}
                        </TableCell>
                        <TableCell><SourceBadge source={m.source} /></TableCell>
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
                            {m.linkedin_url && (
                              <a href={m.linkedin_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground" title="Abrir en LinkedIn">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            )}
                            <button
                              onClick={() => deleteMut.mutate(m.id)}
                              className="text-muted-foreground hover:text-destructive"
                              aria-label="Eliminar"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
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
