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
import { useLanguage } from "@/i18n/LanguageContext";
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

type RunRow = {
  id: string;
  started_at: string;
  status: string;
  message: string | null;
  linkedin_url: string | null;
  target: string | null;
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

export default function AutoPublishCard() {
  const { session } = useAuth();
  const { t } = useLanguage();
  const [sched, setSched] = useState<Sched>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [runs, setRuns] = useState<RunRow[]>([]);

  const DAYS = [
    { v: 1, label: t("autoPublish.dayMon") },
    { v: 2, label: t("autoPublish.dayTue") },
    { v: 3, label: t("autoPublish.dayWed") },
    { v: 4, label: t("autoPublish.dayThu") },
    { v: 5, label: t("autoPublish.dayFri") },
    { v: 6, label: t("autoPublish.daySat") },
    { v: 0, label: t("autoPublish.daySun") },
  ];

  const load = async () => {
    if (!session?.user) return;
    setLoading(true);
    const { data } = await supabase
      .from("auto_publish_schedules" as any)
      .select("*")
      .eq("user_id", session.user.id)
      .maybeSingle();
    const { data: prof } = await supabase.from("profiles").select("timezone").eq("id", session.user.id).maybeSingle();
    const userTz = ((prof as any)?.timezone as string) || "Europe/Madrid";
    if (data) setSched({ ...DEFAULT, ...(data as any), timezone: userTz });
    else setSched({ ...DEFAULT, timezone: userTz, notification_email: session.user.email ?? null });
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
    toast.success(t("autoPublish.savedOk"));
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
      if (r?.ok) toast.success(t("autoPublish.published"));
      else toast.message(r?.reason === "no_posts" ? t("autoPublish.noPosts") : `${t("autoPublish.unpublished")}: ${r?.reason ?? "error"}`);
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
          {t("autoPublish.title")}
        </CardTitle>
        <CardDescription>{t("autoPublish.desc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-2 p-3 rounded-lg border bg-muted/30">
          <div className="min-w-0">
            <p className="text-sm font-medium">{t("autoPublish.active")}</p>
            <p className="text-xs text-muted-foreground break-all">
              {sched.last_run_at
                ? `${t("autoPublish.lastRun")}: ${new Date(sched.last_run_at).toLocaleString()} · ${sched.last_run_status ?? ""}`
                : t("autoPublish.noRuns")}
            </p>
          </div>
          <Switch checked={sched.enabled} onCheckedChange={(v) => setSched({ ...sched, enabled: v })} />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">{t("autoPublish.days")}</Label>
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
            <Label className="text-xs">{t("autoPublish.hour")} ({sched.timezone || "Europe/Madrid"})</Label>
            <Select value={String(sched.hour)} onValueChange={(v) => setSched({ ...sched, hour: parseInt(v) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 24 }).map((_, h) => (
                  <SelectItem key={h} value={String(h)}>{String(h).padStart(2, "0")}:00</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t("autoPublish.hourHint")}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("autoPublish.target")}</Label>
            <Select value={sched.target} onValueChange={(v: any) => setSched({ ...sched, target: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="personal">{t("autoPublish.targetPersonal")}</SelectItem>
                <SelectItem value="company">{t("autoPublish.targetCompany")}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t("autoPublish.targetHint")}</p>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">{t("autoPublish.email")}</Label>
          <Input
            value={sched.notification_email || ""}
            onChange={(e) => setSched({ ...sched, notification_email: e.target.value })}
            placeholder="tu@email.com"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={save} disabled={saving}>{saving ? t("autoPublish.saving") : t("autoPublish.save")}</Button>
          <Button variant="outline" onClick={runNow} disabled={running}>
            {running ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
            {t("autoPublish.runNow")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
