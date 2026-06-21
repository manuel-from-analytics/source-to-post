import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import {
  Upload, BarChart3, TrendingUp, Eye, Heart, MessageCircle, Share2, MousePointerClick,
  ExternalLink, Trash2, Building2, User as UserIcon,
} from "lucide-react";
import { useLinkedinMetrics, useDeleteLinkedinMetric } from "@/hooks/useLinkedinMetrics";
import type { LinkedInSource } from "@/lib/linkedin-csv";
import { ImportCsvWizard } from "@/components/ImportCsvWizard";

type SourceFilter = "all" | LinkedInSource;
type Granularity = "week" | "month";

export default function PerformancePage() {
  const { data: metrics = [], isLoading } = useLinkedinMetrics();
  const deleteMut = useDeleteLinkedinMetric();

  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [importOpen, setImportOpen] = useState(false);
  const [granularity, setGranularity] = useState<Granularity>("week");

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

  const timeline = useMemo(() => {
    const buckets = new Map<string, { key: string; impressions: number; engagement: number; count: number; er: number }>();
    for (const m of filtered) {
      if (!m.posted_at) continue;
      const d = new Date(m.posted_at);
      let key: string;
      if (granularity === "week") {
        const day = d.getUTCDay();
        const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((day + 6) % 7)));
        key = monday.toISOString().slice(0, 10);
      } else {
        key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      }
      const cur = buckets.get(key) ?? { key, impressions: 0, engagement: 0, count: 0, er: 0 };
      cur.impressions += m.impressions;
      cur.engagement += m.reactions + m.comments + m.shares + m.clicks;
      cur.count += 1;
      buckets.set(key, cur);
    }
    return Array.from(buckets.values())
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((b) => ({ ...b, er: b.impressions > 0 ? (b.engagement / b.impressions) * 100 : 0 }));
  }, [filtered, granularity]);

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
            Métricas de tus posts publicados en LinkedIn (personal y empresa). Subes el CSV exportado desde LinkedIn y se cruza con tus posts generados.
          </p>
        </div>
        <Dialog open={importOpen} onOpenChange={setImportOpen}>
          <DialogTrigger asChild>
            <Button><Upload className="h-4 w-4 mr-2" />Importar CSV</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Importar CSV de LinkedIn</DialogTitle>
              <DialogDescription>
                En LinkedIn → tu perfil o página de empresa → Analytics → Exportar. Sube aquí el CSV.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Origen</label>
                <Select value={importSource} onValueChange={(v) => setImportSource(v as LinkedInSource)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personal">Cuenta personal</SelectItem>
                    <SelectItem value="company">Página de empresa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Archivo CSV</label>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Detectamos automáticamente impresiones, clics, reacciones, comentarios y compartidos. El cruce con tus posts se hace por URL o por contenido.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setImportOpen(false)}>Cancelar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
              LinkedIn no expone una API pública de analytics, así que la fuente de verdad es el export CSV que descargas desde LinkedIn (perfil personal o página de empresa).
            </p>
            <Button onClick={() => setImportOpen(true)}><Upload className="h-4 w-4 mr-2" />Importar mi primer CSV</Button>
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

          <Tabs defaultValue="top">
            <TabsList>
              <TabsTrigger value="top">Top posts</TabsTrigger>
              <TabsTrigger value="timeline">Evolución</TabsTrigger>
            </TabsList>

            <TabsContent value="top" className="mt-4">
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
                              <div className="font-medium truncate text-sm">
                                {m.post_title || m.post_excerpt?.slice(0, 60) || m.linkedin_url || "(sin título)"}
                              </div>
                              {m.posted_at && (
                                <div className="text-xs text-muted-foreground">
                                  {new Date(m.posted_at).toLocaleDateString()}
                                </div>
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
            </TabsContent>

            <TabsContent value="timeline" className="mt-4 space-y-3">
              <div className="flex items-center gap-2">
                <Select value={granularity} onValueChange={(v) => setGranularity(v as Granularity)}>
                  <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">Semanal</SelectItem>
                    <SelectItem value="month">Mensual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Card>
                <CardHeader><CardTitle className="text-base">Impresiones</CardTitle></CardHeader>
                <CardContent className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={timeline}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="key" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="impressions" name="Impresiones" stroke="hsl(var(--primary))" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Engagement rate (%)</CardTitle></CardHeader>
                <CardContent className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={timeline}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="key" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip formatter={(v: number) => `${v.toFixed(2)}%`} />
                      <Legend />
                      <Line type="monotone" dataKey="er" name="ER %" stroke="hsl(var(--primary))" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
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
