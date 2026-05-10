import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Play, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useVoices } from "@/hooks/useVoices";
import { useNewsletterProfiles } from "@/hooks/useNewsletters";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";

type Schedule = {
  id?: string;
  enabled: boolean;
  run_hour: number;
  topic: string;
  voice_id: string | null;
  tone: string | null;
  length: string | null;
  cta: string | null;
  language: string | null;
  goal: string | null;
  target_audience: string | null;
  content_focus: string | null;
  preference_profile_id: string | null;
  notification_email: string | null;
  extract_content: boolean;
  last_run_at: string | null;
};

const DEFAULT: Schedule = {
  enabled: false, run_hour: 7, topic: "", voice_id: null, tone: null,
  length: null, cta: null, language: null, goal: null,
  target_audience: null, content_focus: null, preference_profile_id: null,
  notification_email: null, extract_content: false, last_run_at: null,
};

type RunRow = { id: string; started_at: string; status: string; posts_created: number; error: string | null; notified_at: string | null; newsletter_id: string | null };

export default function AgentSettingsCard() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { session } = useAuth();
  const { data: voices } = useVoices();
  const { data: profiles } = useNewsletterProfiles();
  const [schedule, setSchedule] = useState<Schedule>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [runs, setRuns] = useState<RunRow[]>([]);

  const load = async () => {
    if (!session?.user) return;
    setLoading(true);
    const { data } = await supabase.from("agent_schedules").select("*").eq("user_id", session.user.id).maybeSingle();
    if (data) setSchedule({ ...DEFAULT, ...data, topic: data.topic || "" });
    else setSchedule({ ...DEFAULT, notification_email: session.user.email ?? null });
    const { data: r } = await supabase.from("agent_runs").select("id, started_at, status, posts_created, error, notified_at, newsletter_id").order("started_at", { ascending: false }).limit(10);
    setRuns((r as RunRow[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [session]);

  const save = async () => {
    if (!session?.user) return;
    setSaving(true);
    const payload = {
      user_id: session.user.id,
      enabled: schedule.enabled,
      run_hour: schedule.run_hour,
      topic: schedule.topic || null,
      voice_id: schedule.voice_id,
      tone: schedule.tone,
      length: schedule.length,
      cta: schedule.cta,
      language: schedule.language,
      goal: schedule.goal,
      target_audience: schedule.target_audience,
      content_focus: schedule.content_focus,
      preference_profile_id: schedule.preference_profile_id,
      notification_email: schedule.notification_email,
      extract_content: schedule.extract_content,
    };
    const { error } = await supabase.from("agent_schedules").upsert(payload, { onConflict: "user_id" });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t("agent.savedOk"));
  };

  const runNow = async () => {
    if (!session?.access_token) return;
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("daily-agent", { body: {} });
      if (error) throw error;
      toast.success(
        t("agent.runOk").replace("{count}", String(data?.posts_created ?? 0)) +
        (data?.notified ? t("agent.runOkEmail") : "")
      );
      load();
    } catch (e: any) {
      toast.error(e.message || t("agent.runError"));
    } finally {
      setRunning(false);
    }
  };

  if (loading) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bot className="h-5 w-5 text-primary" />
          {t("agent.dailyAgent")}
        </CardTitle>
        <CardDescription>{t("agent.dailyAgentDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-2 p-3 rounded-lg border bg-muted/30">
          <div className="min-w-0">
            <p className="text-sm font-medium">{t("agent.enabled")}</p>
            <p className="text-xs text-muted-foreground break-all">
              {schedule.last_run_at ? `${t("agent.lastRun")}: ${new Date(schedule.last_run_at).toLocaleString()}` : t("agent.noRuns")}
            </p>
          </div>
          <Switch checked={schedule.enabled} onCheckedChange={(v) => setSchedule({ ...schedule, enabled: v })} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">{t("agent.hourUTC")}</Label>
            <Select value={String(schedule.run_hour)} onValueChange={(v) => setSchedule({ ...schedule, run_hour: parseInt(v) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 24 }).map((_, h) => (
                  <SelectItem key={h} value={String(h)}>{String(h).padStart(2, "0")}:00</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("agent.notificationEmail")}</Label>
            <Input value={schedule.notification_email || ""} onChange={(e) => setSchedule({ ...schedule, notification_email: e.target.value })} placeholder="tu@email.com" />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">{t("agent.dailyTopic")}</Label>
          <Input value={schedule.topic} onChange={(e) => setSchedule({ ...schedule, topic: e.target.value })} placeholder={t("agent.dailyTopicPlaceholder")} />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">{t("agent.profile")}</Label>
          <Select value={schedule.preference_profile_id || "none"} onValueChange={(v) => setSchedule({ ...schedule, preference_profile_id: v === "none" ? null : v })}>
            <SelectTrigger><SelectValue placeholder={t("agent.profilePlaceholder")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("agent.userDefault")}</SelectItem>
              {(profiles || []).map((p: any) => (
                <SelectItem key={p.id} value={p.id}>{p.name}{p.is_default ? ` (${t("agent.profileDefaultBadge")})` : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{t("agent.profileHint")}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">{t("agent.voice")}</Label>
            <Select value={schedule.voice_id || "none"} onValueChange={(v) => setSchedule({ ...schedule, voice_id: v === "none" ? null : v })}>
              <SelectTrigger><SelectValue placeholder={t("agent.profilePlaceholder")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("agent.voiceDefault")}</SelectItem>
                {(voices || []).map((v: any) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("agent.goal")}</Label>
            <Select value={schedule.goal || "none"} onValueChange={(v) => setSchedule({ ...schedule, goal: v === "none" ? null : v })}>
              <SelectTrigger><SelectValue placeholder={t("agent.profilePlaceholder")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("agent.dash")}</SelectItem>
                <SelectItem value="auto">{t("agent.autoDecide")}</SelectItem>
                <SelectItem value="educate">{t("generator.educate")}</SelectItem>
                <SelectItem value="inspire">{t("generator.inspire")}</SelectItem>
                <SelectItem value="promote">{t("generator.promote")}</SelectItem>
                <SelectItem value="engage">{t("generator.engage")}</SelectItem>
                <SelectItem value="storytelling">{t("generator.storytelling")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("agent.tone")}</Label>
            <Select value={schedule.tone || "none"} onValueChange={(v) => setSchedule({ ...schedule, tone: v === "none" ? null : v })}>
              <SelectTrigger><SelectValue placeholder={t("agent.profilePlaceholder")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("agent.dash")}</SelectItem>
                <SelectItem value="auto">{t("agent.autoDecide")}</SelectItem>
                <SelectItem value="professional">{t("generator.professional")}</SelectItem>
                <SelectItem value="casual">{t("generator.casual")}</SelectItem>
                <SelectItem value="inspirational">{t("generator.inspirational")}</SelectItem>
                <SelectItem value="direct">{t("generator.direct")}</SelectItem>
                <SelectItem value="humorous">{t("generator.humorous")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("agent.language")}</Label>
            <Select value={schedule.language || "none"} onValueChange={(v) => setSchedule({ ...schedule, language: v === "none" ? null : v })}>
              <SelectTrigger><SelectValue placeholder={t("agent.profilePlaceholder")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("agent.dash")}</SelectItem>
                <SelectItem value="auto">{t("agent.autoDecide")}</SelectItem>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="pt">Português</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("agent.length")}</Label>
            <Select value={schedule.length || "none"} onValueChange={(v) => setSchedule({ ...schedule, length: v === "none" ? null : v })}>
              <SelectTrigger><SelectValue placeholder={t("agent.profilePlaceholder")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("agent.dash")}</SelectItem>
                <SelectItem value="auto">{t("agent.autoDecide")}</SelectItem>
                <SelectItem value="short">{t("generator.short")}</SelectItem>
                <SelectItem value="medium">{t("generator.medium")}</SelectItem>
                <SelectItem value="long">{t("generator.long")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("agent.cta")}</Label>
            <Select value={schedule.cta || "none"} onValueChange={(v) => setSchedule({ ...schedule, cta: v === "none" ? null : v })}>
              <SelectTrigger><SelectValue placeholder={t("agent.profilePlaceholder")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("agent.dash")}</SelectItem>
                <SelectItem value="auto">{t("agent.autoDecide")}</SelectItem>
                <SelectItem value="question">{t("generator.question")}</SelectItem>
                <SelectItem value="share">{t("generator.share")}</SelectItem>
                <SelectItem value="follow">{t("generator.follow")}</SelectItem>
                <SelectItem value="link">{t("generator.visitLink")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs">{t("agent.targetAudience")}</Label>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
              <Switch
                checked={schedule.target_audience === "auto"}
                onCheckedChange={(v) => setSchedule({ ...schedule, target_audience: v ? "auto" : null })}
              />
              🤖 {t("agent.auto")}
            </label>
          </div>
          <Input
            disabled={schedule.target_audience === "auto"}
            value={schedule.target_audience === "auto" ? "" : (schedule.target_audience || "")}
            onChange={(e) => setSchedule({ ...schedule, target_audience: e.target.value || null })}
            placeholder={schedule.target_audience === "auto" ? t("agent.targetAudienceAutoPlaceholder") : t("agent.targetAudiencePlaceholder")}
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs">{t("agent.contentFocus")}</Label>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
              <Switch
                checked={schedule.content_focus === "auto"}
                onCheckedChange={(v) => setSchedule({ ...schedule, content_focus: v ? "auto" : null })}
              />
              🤖 {t("agent.auto")}
            </label>
          </div>
          <Textarea
            rows={3}
            disabled={schedule.content_focus === "auto"}
            value={schedule.content_focus === "auto" ? "" : (schedule.content_focus || "")}
            onChange={(e) => setSchedule({ ...schedule, content_focus: e.target.value || null })}
            placeholder={schedule.content_focus === "auto" ? t("agent.contentFocusAutoPlaceholder") : t("agent.contentFocusPlaceholder")}
          />
        </div>

        <div className="flex items-center justify-between gap-2 p-3 rounded-lg border bg-muted/30">
          <div className="min-w-0">
            <p className="text-sm font-medium">{t("agent.extractContent")}</p>
            <p className="text-xs text-muted-foreground">{t("agent.extractContentDesc")}</p>
          </div>
          <Switch checked={schedule.extract_content} onCheckedChange={(v) => setSchedule({ ...schedule, extract_content: v })} />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={save} disabled={saving}>{saving ? t("agent.saving") : t("agent.save")}</Button>
          <Button variant="outline" onClick={runNow} disabled={running}>
            {running ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
            {t("agent.runNow")}
          </Button>
        </div>

        {runs.length > 0 && (
          <div className="space-y-1">
            <Label className="text-xs">{t("agent.lastRuns")}</Label>
            <div className="space-y-1.5">
              {runs.map((r) => {
                const clickable = !!r.newsletter_id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    disabled={!clickable}
                    onClick={() => clickable && navigate(`/newsletter?id=${r.newsletter_id}`)}
                    className={`flex w-full items-center justify-between gap-2 p-2 rounded-lg border bg-muted/30 text-xs min-w-0 text-left transition-colors ${clickable ? "hover:bg-muted/60 cursor-pointer" : "cursor-default opacity-80"}`}
                    title={clickable ? t("agent.viewNewsletter") : t("agent.noNewsletterAssoc")}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{new Date(r.started_at).toLocaleString()}</p>
                      {r.error && <p className="text-destructive break-all">{r.error}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-medium">{r.posts_created} {t("agent.postsCount")}</p>
                      <p className="text-muted-foreground">{r.status}{r.notified_at ? " · ✉" : ""}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
