import { useState } from "react";
import { Linkedin, Send, Clock, Building2, User as UserIcon, ExternalLink } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { usePublishLinkedinNow, useSchedulePublication } from "@/hooks/usePublishLinkedin";
import { useLanguage } from "@/i18n/LanguageContext";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
  content: string;
}

function minDatetimeLocal() {
  const d = new Date(Date.now() + 5 * 60 * 1000);
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}

export function PublishToLinkedinDialog({ open, onOpenChange, postId, content }: Props) {
  const { t } = useLanguage();
  const [target, setTarget] = useState<"personal" | "company">("personal");
  const [mode, setMode] = useState<"now" | "schedule">("now");
  const [when, setWhen] = useState<string>(minDatetimeLocal());
  const publishNow = usePublishLinkedinNow();
  const schedule = useSchedulePublication();

  const busy = publishNow.isPending || schedule.isPending;

  const handleSubmit = async () => {
    if (mode === "now") {
      await publishNow.mutateAsync({ post_id: postId, target });
      onOpenChange(false);
    } else {
      const iso = new Date(when).toISOString();
      if (new Date(iso).getTime() <= Date.now() + 60 * 1000) return;
      await schedule.mutateAsync({ post_id: postId, scheduled_at: iso, target });
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Linkedin className="h-4 w-4 text-[#0a66c2]" />
            {t("publish.title")}
          </DialogTitle>
          <DialogDescription className="text-xs">{t("publish.desc")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">{t("publish.target")}</Label>
            <TooltipProvider>
              <RadioGroup
                value={target}
                onValueChange={(v) => setTarget(v as any)}
                className="grid grid-cols-2 gap-2"
              >
                <label className="flex items-center gap-2 rounded-md border p-2.5 cursor-pointer hover:bg-secondary/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                  <RadioGroupItem value="personal" />
                  <UserIcon className="h-3.5 w-3.5" />
                  <span className="text-sm">{t("publish.personalProfile")}</span>
                </label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <label className="flex items-center gap-2 rounded-md border p-2.5 opacity-50 cursor-not-allowed">
                      <RadioGroupItem value="company" disabled />
                      <Building2 className="h-3.5 w-3.5" />
                      <span className="text-sm">{t("publish.company")}</span>
                    </label>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    {t("publish.companyTooltip")}
                  </TooltipContent>
                </Tooltip>
              </RadioGroup>
            </TooltipProvider>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">{t("publish.when")}</Label>
            <RadioGroup
              value={mode}
              onValueChange={(v) => setMode(v as any)}
              className="grid grid-cols-2 gap-2"
            >
              <label className="flex items-center gap-2 rounded-md border p-2.5 cursor-pointer hover:bg-secondary/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                <RadioGroupItem value="now" />
                <Send className="h-3.5 w-3.5" />
                <span className="text-sm">{t("publish.now")}</span>
              </label>
              <label className="flex items-center gap-2 rounded-md border p-2.5 cursor-pointer hover:bg-secondary/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                <RadioGroupItem value="schedule" />
                <Clock className="h-3.5 w-3.5" />
                <span className="text-sm">{t("publish.schedule")}</span>
              </label>
            </RadioGroup>
            {mode === "schedule" && (
              <Input
                type="datetime-local"
                value={when}
                min={minDatetimeLocal()}
                onChange={(e) => setWhen(e.target.value)}
                className="text-sm"
              />
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{t("publish.preview")}</Label>
            <div className="rounded-md bg-secondary p-3 max-h-32 overflow-y-auto">
              <p className="text-xs whitespace-pre-line leading-relaxed text-muted-foreground">
                {content}
              </p>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
            <ExternalLink className="h-3 w-3 mt-0.5 shrink-0" />
            {t("publish.connectorNote")}
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("publish.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={busy} className="gap-1.5">
            {mode === "now" ? <Send className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
            {busy ? "..." : mode === "now" ? t("publish.submitNow") : t("publish.submitSchedule")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
