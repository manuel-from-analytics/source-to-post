import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  PenTool, Check, Copy, RefreshCw, Send, Sparkles,
  FileText, Save, Loader2, Globe, Youtube, File, Type
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useInputs } from "@/hooks/useInputs";
import { useGeneratePost } from "@/hooks/useGeneratePost";
import { useUpdatePost } from "@/hooks/usePosts";
import { CategoryFilter } from "@/components/CategoryWidgets";
import { useVoices } from "@/hooks/useVoices";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";

const typeIcons: Record<string, React.ElementType> = {
  pdf: File, url: Globe, youtube: Youtube, text: Type,
};

interface EditingPost {
  id: string;
  content: string;
  goal?: string | null;
  tone?: string | null;
  target_audience?: string | null;
  input_id?: string | null;
  title?: string | null;
  language?: string | null;
  cta?: string | null;
  length?: string | null;
  content_focus?: string | null;
  voice_id?: string | null;
}

export default function GeneratorPage() {
  const { t } = useLanguage();
  const location = useLocation();
  const editingPost = location.state?.editingPost as EditingPost | undefined;
  const duplicatePost = location.state?.duplicatePost as Omit<EditingPost, "id"> | undefined;
  const initialPost = editingPost || duplicatePost;

  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [filterCategoryId, setFilterCategoryId] = useState<string | null>(null);
  const [iterationPrompt, setIterationPrompt] = useState("");
  const [copied, setCopied] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);

  const [goal, setGoal] = useState("");
  const [tone, setTone] = useState("");
  const [language, setLanguage] = useState("es");
  const [length, setLength] = useState("medium");
  const [cta, setCta] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [contentFocus, setContentFocus] = useState("");
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("none");

  const { data: inputs, isLoading: loadingInputs } = useInputs();
  const { data: voices } = useVoices();
  const { generate, savePost, isGenerating, content, setContent } = useGeneratePost();
  const updatePost = useUpdatePost();

  useEffect(() => {
    const load = async () => {
      if (initialPost) {
        if (editingPost) setContent(initialPost.content);
        if (initialPost.goal) setGoal(initialPost.goal);
        if (initialPost.tone) setTone(initialPost.tone);
        if (initialPost.target_audience) setTargetAudience(initialPost.target_audience);
        if (initialPost.input_id) setSelectedSources([initialPost.input_id]);
        if (initialPost.language) setLanguage(initialPost.language);
        if (initialPost.cta) setCta(initialPost.cta);
        if (initialPost.length) setLength(initialPost.length);
        if (initialPost.content_focus) setContentFocus(initialPost.content_focus);
        if (initialPost.voice_id) setSelectedVoiceId(initialPost.voice_id);
        setProfileLoaded(true);
        return;
      }

      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      if (!userId) { setProfileLoaded(true); return; }

      const { data } = await supabase
        .from("profiles")
        .select("preferred_language, default_writing_style, default_voice_id, default_length, default_cta")
        .eq("id", userId)
        .single();

      if (data) {
        if (data.preferred_language) setLanguage(data.preferred_language);
        if ((data as any).default_length) setLength((data as any).default_length);
        if ((data as any).default_cta) setCta((data as any).default_cta);
        if ((data as any).default_voice_id) setSelectedVoiceId((data as any).default_voice_id);
      }
      setProfileLoaded(true);
    };
    load();
  }, []);

  const toggleSource = (id: string) => {
    setSelectedSources((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleGenerate = () => {
    generate({
      input_ids: selectedSources,
      goal: goal || undefined,
      tone: tone || undefined,
      language: language || undefined,
      length: length || undefined,
      cta: cta || undefined,
      target_audience: targetAudience || undefined,
      content_focus: contentFocus || undefined,
      voice_id: selectedVoiceId !== "none" ? selectedVoiceId : undefined,
    });
  };

  const handleIterate = () => {
    if (!iterationPrompt.trim()) return;
    generate({
      input_ids: selectedSources,
      goal: goal || undefined,
      tone: tone || undefined,
      language: language || undefined,
      length: length || undefined,
      cta: cta || undefined,
      target_audience: targetAudience || undefined,
      content_focus: contentFocus || undefined,
      iteration_prompt: iterationPrompt.trim(),
      previous_content: content,
      voice_id: selectedVoiceId !== "none" ? selectedVoiceId : undefined,
    });
    setIterationPrompt("");
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    if (editingPost) {
      updatePost.mutate(
        {
          id: editingPost.id,
          content,
          title: editingPost.title || undefined,
          goal: goal || undefined,
          tone: tone || undefined,
          target_audience: targetAudience || undefined,
          language: language || undefined,
          cta: cta || undefined,
          length: length || undefined,
          content_focus: contentFocus || undefined,
          voice_id: selectedVoiceId !== "none" ? selectedVoiceId : undefined,
        },
        { onSuccess: () => toast.success(t("generator.postUpdated")) }
      );
    } else {
      savePost({
        content,
        input_id: selectedSources[0],
        goal: goal || undefined,
        tone: tone || undefined,
        target_audience: targetAudience || undefined,
        language: language || undefined,
        cta: cta || undefined,
        length: length || undefined,
        content_focus: contentFocus || undefined,
        voice_id: selectedVoiceId !== "none" ? selectedVoiceId : undefined,
      });
    }
  };

  return (
    <div className="mx-auto max-w-5xl min-w-0 overflow-hidden p-3 sm:p-4 lg:p-8">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
          {editingPost ? t("generator.editPost") : duplicatePost ? t("generator.duplicatePost") : t("generator.title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5 break-words">
          {editingPost
            ? t("generator.editSubtitle")
            : duplicatePost
            ? t("generator.duplicateSubtitle")
            : t("generator.defaultSubtitle")}
        </p>
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        {/* Left: Config */}
        <div className="space-y-4 sm:space-y-6">
          <Card>
            <CardHeader className="px-3 py-2.5 sm:px-6 sm:py-4 pb-2 sm:pb-3">
              <CardTitle className="text-xs font-medium sm:text-sm">
                {t("generator.referenceSources")}
              </CardTitle>
            </CardHeader>
            <CardContent className="min-w-0 space-y-2 px-3 sm:px-6 sm:space-y-3">
              <CategoryFilter selectedCategoryId={filterCategoryId} onSelect={setFilterCategoryId} />
              <div className="max-h-[180px] space-y-1.5 overflow-x-hidden overflow-y-auto sm:max-h-[220px] sm:space-y-2">
              {loadingInputs ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (inputs ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {t("generator.noSources")}
                </p>
              ) : (
                (inputs ?? []).filter((s) => !filterCategoryId || s.category_id === filterCategoryId).map((source) => {
                  const Icon = typeIcons[source.type] || FileText;
                  return (
                    <label
                      key={source.id}
                      className="flex min-w-0 items-center gap-2.5 rounded-lg border p-2 transition-colors hover:bg-secondary/50 sm:gap-3 sm:p-3"
                    >
                      <Checkbox
                        checked={selectedSources.includes(source.id)}
                        onCheckedChange={() => toggleSource(source.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium leading-snug break-words [overflow-wrap:anywhere]">{source.title}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="text-[10px] text-muted-foreground capitalize">{source.type}</span>
                        </div>
                      </div>
                    </label>
                  );
                })
              )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="px-3 py-2.5 sm:px-6 sm:py-4 pb-2 sm:pb-3">
              <CardTitle className="text-xs font-medium sm:text-sm">
                {t("generator.params")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 px-3 sm:px-6 sm:space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">{t("generator.goal")}</Label>
                <Select value={goal} onValueChange={setGoal}>
                  <SelectTrigger><SelectValue placeholder={t("generator.goalSelect")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="educate">{t("generator.educate")}</SelectItem>
                    <SelectItem value="inspire">{t("generator.inspire")}</SelectItem>
                    <SelectItem value="promote">{t("generator.promote")}</SelectItem>
                    <SelectItem value="engage">{t("generator.engage")}</SelectItem>
                    <SelectItem value="storytelling">{t("generator.storytelling")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs">{t("generator.tone")}</Label>
                  <Select value={tone} onValueChange={setTone}>
                    <SelectTrigger><SelectValue placeholder={t("generator.tonePlaceholder")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">{t("generator.professional")}</SelectItem>
                      <SelectItem value="casual">{t("generator.casual")}</SelectItem>
                      <SelectItem value="inspirational">{t("generator.inspirational")}</SelectItem>
                      <SelectItem value="direct">{t("generator.direct")}</SelectItem>
                      <SelectItem value="humorous">{t("generator.humorous")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">{t("generator.language")}</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger><SelectValue placeholder={t("generator.languagePlaceholder")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="es">{t("common.spanish")}</SelectItem>
                      <SelectItem value="en">{t("common.english")}</SelectItem>
                      <SelectItem value="pt">{t("common.portuguese")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs">{t("generator.length")}</Label>
                  <Select value={length} onValueChange={setLength}>
                    <SelectTrigger><SelectValue placeholder={t("generator.lengthPlaceholder")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="short">{t("generator.short")}</SelectItem>
                      <SelectItem value="medium">{t("generator.medium")}</SelectItem>
                      <SelectItem value="long">{t("generator.long")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">{t("generator.cta")}</Label>
                  <Select value={cta} onValueChange={setCta}>
                    <SelectTrigger><SelectValue placeholder={t("generator.ctaPlaceholder")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="question">{t("generator.question")}</SelectItem>
                      <SelectItem value="share">{t("generator.share")}</SelectItem>
                      <SelectItem value="follow">{t("generator.follow")}</SelectItem>
                      <SelectItem value="link">{t("generator.visitLink")}</SelectItem>
                      <SelectItem value="none">{t("generator.noCta")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">{t("generator.audience")}</Label>
                <Input
                  placeholder={t("generator.audiencePlaceholder")}
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">{t("generator.focus")}</Label>
                <Textarea
                  placeholder={t("generator.focusPlaceholder")}
                  value={contentFocus}
                  onChange={(e) => setContentFocus(e.target.value)}
                  className="min-h-[60px]"
                />
              </div>

              {(voices?.length ?? 0) > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs">{t("generator.voice")}</Label>
                  <Select value={selectedVoiceId} onValueChange={setSelectedVoiceId}>
                    <SelectTrigger><SelectValue placeholder={t("generator.selectVoice")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("generator.noVoiceGeneric")}</SelectItem>
                      {voices!.map((v) => (
                        <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>

          <Button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full gap-2"
            size="lg"
          >
            {isGenerating ? (
              <><RefreshCw className="h-4 w-4 animate-spin" />{t("generator.generating")}</>
            ) : (
              <><Sparkles className="h-4 w-4" />{editingPost ? t("generator.regeneratePost") : t("generator.generateDraft")}</>
            )}
          </Button>
        </div>

        {/* Right: Result */}
        <div className="space-y-4">
          <Card className="min-h-[400px]">
            <CardHeader className="px-3 py-2.5 sm:px-6 sm:py-4 pb-2 sm:pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-sm font-medium">{t("generator.draft")}</CardTitle>
                {content && (
                  <div className="flex flex-wrap gap-1">
                    <Button variant="ghost" size="sm" onClick={handleGenerate} disabled={isGenerating} className="text-xs gap-1">
                      <RefreshCw className="h-3 w-3" />{t("generator.regenerate")}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleCopy} className="text-xs gap-1">
                      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {copied ? t("generator.copied") : t("generator.copy")}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleSave} className="text-xs gap-1">
                      <Save className="h-3 w-3" />{editingPost ? t("generator.update") : t("generator.save")}
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {content ? (
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="min-h-[300px] resize-none border-none p-0 focus-visible:ring-0 text-sm leading-relaxed"
                />
              ) : isGenerating ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
                  <p className="text-sm text-muted-foreground">{t("generator.generatingDraft")}</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <PenTool className="h-10 w-10 text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">{t("generator.draftAppears")}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t("generator.selectAndConfigure")}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {content && !isGenerating && (
            <Card>
              <CardContent className="p-3 sm:p-4">
                <Label className="text-xs text-muted-foreground mb-1.5 block">{t("generator.requestChanges")}</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    placeholder={t("generator.iterationExample")}
                    value={iterationPrompt}
                    onChange={(e) => setIterationPrompt(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleIterate()}
                    className="text-sm"
                  />
                  <Button size="sm" className="gap-1 self-start sm:self-auto" onClick={handleIterate} disabled={isGenerating}>
                    <Send className="h-3.5 w-3.5" />{t("generator.send")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
