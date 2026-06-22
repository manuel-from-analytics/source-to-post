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
  Upload, BarChart3, TrendingUp, Eye, Heart, MessageCircle, Share2, MousePointerClick,
  ExternalLink, Trash2, Building2, User as UserIcon, Link2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLinkedinMetrics, useDeleteLinkedinMetric } from "@/hooks/useLinkedinMetrics";
import type { LinkedInSource } from "@/lib/linkedin-csv";
import { ImportCsvWizard } from "@/components/ImportCsvWizard";

type SourceFilter = "all" | LinkedInSource;

export default function PerformancePage() {
  const { data: metrics = [], isLoading } = useLinkedinMetrics();
  const deleteMut = useDeleteLinkedinMetric();
  const navigate = useNavigate();

  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [importOpen, setImportOpen] = useState(false);

  const filtered = useMemo(
    () => (sourceFilter === "all" ? metrics : metrics.filter((m) => m.source === sourceFilter)),
    [metrics, sourceFilter],
  );

  const summary = useMemo(() => {
    const total = filtered.length;
    const impressions = filtered.reduce((a, b) => a + b.impressions, 0);
    const reactions = filtered.reduce((a, b) => a + b.reactions, 0);
    const comments = filtered.reduce((a, b) => a + b.comments, 0);
    const shares = filtered.reduce((a, b) => a + b.shares, 0);
    const clicks = filtered.reduce((a, b) => a + b.clicks, 0);
    const er = impressions > 0 ? (reactions + comments + shares + clicks) / impressions : 0;
    const top = [...filtered].sort((a, b) => b.engagement_rate - a.engagement_rate)[0];
    return { total, impressions, reactions, comments, shares, clicks, er, top };
  }, [filtered]);

  const topPosts = useMemo(
    () => [...filtered].sort((a, b) => b.engagement_rate - a.engagement_rate).slice(0, 20),
    [filtered],
  );


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
            <KPI icon={<TrendingUp className="h-4 w-4" />} label="Engagement rate medio" value={`${(summary.er * 100).toFixed(2)}%`} />
            <KPI icon={<Heart className="h-4 w-4" />} label="Reacciones" value={summary.reactions.toLocaleString()} />
            <KPI icon={<BarChart3 className="h-4 w-4" />} label="Posts" value={summary.total.toLocaleString()} />
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Top 20 por engagement rate</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Post</TableHead>
                      <TableHead>Origen</TableHead>
                      <TableHead className="text-right">Impr.</TableHead>
                      <TableHead className="text-right"><Heart className="h-3.5 w-3.5 inline" /></TableHead>
                      <TableHead className="text-right"><MessageCircle className="h-3.5 w-3.5 inline" /></TableHead>
                      <TableHead className="text-right"><Share2 className="h-3.5 w-3.5 inline" /></TableHead>
                      <TableHead className="text-right"><MousePointerClick className="h-3.5 w-3.5 inline" /></TableHead>
                      <TableHead className="text-right">ER</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topPosts.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="max-w-[280px]">
                          {m.post_id ? (
                            <button
                              type="button"
                              onClick={() => navigate("/history", { state: { openPostId: m.post_id } })}
                              className="text-left w-full group/title"
                              title="Ver detalle del post"
                            >
                              <div className="font-medium truncate text-sm group-hover/title:text-primary group-hover/title:underline flex items-center gap-1">
                                <Link2 className="h-3 w-3 shrink-0 opacity-60" />
                                <span className="truncate">
                                  {m.post_title || m.post_excerpt?.slice(0, 60) || m.linkedin_url || "(sin título)"}
                                </span>
                              </div>
                              {m.posted_at && (
                                <div className="text-xs text-muted-foreground">
                                  {new Date(m.posted_at).toLocaleDateString()}
                                </div>
                              )}
                            </button>
                          ) : (
                            <>
                              <div className="font-medium truncate text-sm">
                                {m.post_title || m.post_excerpt?.slice(0, 60) || m.linkedin_url || "(sin título)"}
                              </div>
                              {m.posted_at && (
                                <div className="text-xs text-muted-foreground">
                                  {new Date(m.posted_at).toLocaleDateString()}
                                </div>
                              )}
                            </>
                          )}
                        </TableCell>
                        <TableCell>
                          <SourceBadge source={m.source} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{m.impressions.toLocaleString()}</TableCell>
                        <TableCell className="text-right tabular-nums">{m.reactions.toLocaleString()}</TableCell>
                        <TableCell className="text-right tabular-nums">{m.comments.toLocaleString()}</TableCell>
                        <TableCell className="text-right tabular-nums">{m.shares.toLocaleString()}</TableCell>
                        <TableCell className="text-right tabular-nums">{m.clicks.toLocaleString()}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {(m.engagement_rate * 100).toFixed(2)}%
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {m.linkedin_url && (
                              <a href={m.linkedin_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
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

function KPI({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          {icon}
          <span>{label}</span>
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
