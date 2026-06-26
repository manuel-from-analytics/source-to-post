import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Play, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type Sched = {
  id?: string;
  enabled: boolean;
  days_of_week: number[];
  hour: number;
  timezone: string;
  target: "personal" | "company";
  notification_email: string | null;
  last_run_at: string | null;
  last_run_status: string | null;
  last_run_message: string | null;
};

const DEFAULT: Sched = {
  enabled: false,
  days_of_week: [1, 3, 5],
  hour: 11,
  timezone: "Europe/Madrid",
  target: "personal",
  notification_email: null,
  last_run_at: null,
  last_run_status: null,
  last_run_message: null,
};

const DAYS = [
  { v: 1, label: "L" },
  { v: 2, label: "M" },
  { v: 3, label: "X" },
  { v: 4, label: "J" },
  { v: 5, label: "V" },
  { v: 6, label: "S" },
  { v: 0, label: "D" },
];

export default function AutoPublishCard() {
  const { session } = useAuth();
  const [sched, setSched] = useState<Sched>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  const load = async () => {
    if (!session?.user) return;
    setLoading(true);
    const { data } = await supabase
      .from("auto_publish_schedules" as any)
      .select("*")
      .eq("user_id", session.user.id)
      .maybeSingle();
    if (data) setSched({ ...DEFAULT, ...(data as any) });
    else setSched({ ...DEFAULT, notification_email: session.user.email ?? null });
    setLoading(false);
  };
  useEffect(() => { load(); }, [session]);

  const toggleDay = (d: number) => {
    const has = sched.days_of_week.includes(d);
    const next = has ? sched.days_of_week.filter((x) => x !== d) : [...sched.days_of_week, d].sort();
    setSched({ ...sched, days_of_week: next });
  };

  const save = async () => {
    if (!session?.user) return;
    setSaving(true);
    const payload = {
      user_id: session.user.id,
      enabled: sched.enabled,
      days_of_week: sched.days_of_week,
      hour: sched.hour,
      timezone: sched.timezone,
      target: sched.target,
      notification_email: sched.notification_email,
    };
    const { error } = await supabase
      .from("auto_publish_schedules" as any)
      .upsert(payload as any, { onConflict: "user_id" });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Guardado");
  };

  const runNow = async () => {
    if (!session?.user) return;
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("auto-publish-linkedin", {
        body: { user_id: session.user.id },
      });
      if (error) throw error;
      const r = (data as any)?.results?.[0];
      if (r?.ok) toast.success("Post publicado en LinkedIn");
      else toast.message(r?.reason === "no_posts" ? "No hay posts ready con esa etiqueta" : `Sin publicar: ${r?.reason ?? "error"}`);
      load();
    } catch (e: any) {
      toast.error(e?.message || "Error");
    } finally {
      setRunning(false);
    }
  };

  if (loading) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Send className="h-5 w-5 text-primary" />
          Auto-publicación en LinkedIn
        </CardTitle>
        <CardDescription>
          Publica automáticamente el post más antiguo en estado Ready con la etiqueta elegida, en los días y hora configurados.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-2 p-3 rounded-lg border bg-muted/30">
          <div className="min-w-0">
            <p className="text-sm font-medium">Activo</p>
            <p className="text-xs text-muted-foreground break-all">
              {sched.last_run_at
                ? `Última ejecución: ${new Date(sched.last_run_at).toLocaleString()} · ${sched.last_run_status ?? ""}`
                : "Sin ejecuciones aún"}
            </p>
          </div>
          <Switch checked={sched.enabled} onCheckedChange={(v) => setSched({ ...sched, enabled: v })} />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Días</Label>
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map((d) => {
              const active = sched.days_of_week.includes(d.v);
              return (
                <button
                  key={d.v}
                  type="button"
                  onClick={() => toggleDay(d.v)}
                  className={`h-9 w-9 rounded-md border text-sm font-medium transition-colors ${
                    active ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Hora (Europe/Madrid)</Label>
            <Select value={String(sched.hour)} onValueChange={(v) => setSched({ ...sched, hour: parseInt(v) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 24 }).map((_, h) => (
                  <SelectItem key={h} value={String(h)}>{String(h).padStart(2, "0")}:00</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Etiqueta</Label>
            <Select value={sched.target} onValueChange={(v: any) => setSched({ ...sched, target: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="personal">Personal</SelectItem>
                <SelectItem value="company">Empresa</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Email de notificación</Label>
          <Input
            value={sched.notification_email || ""}
            onChange={(e) => setSched({ ...sched, notification_email: e.target.value })}
            placeholder="tu@email.com"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={save} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
          <Button variant="outline" onClick={runNow} disabled={running}>
            {running ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
            Ejecutar ahora
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
