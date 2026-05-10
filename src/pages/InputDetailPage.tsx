import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Star, Trash2, ExternalLink, Loader2,
  FileText, Sparkles, RefreshCw, Youtube, PenTool, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToggleFavorite, useDeleteInput, type InputRow } from "@/hooks/useInputs";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";
import { InputNotes } from "@/components/InputNotes";

export default function InputDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const toggleFavorite = useToggleFavorite();
  const deleteInput = useDeleteInput();
  const queryClient = useQueryClient();
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionStep, setExtractionStep] = useState("");

  const typeLabels: Record<string, string> = {
    pdf: t("inputDetail.typePdf"),
    url: t("inputDetail.typeUrl"),
    youtube: t("inputDetail.typeYoutube"),
    text: t("inputDetail.typeText"),
  };

  const { data: input, isLoading } = useQuery({
    queryKey: ["input-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inputs")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as InputRow;
    },
    enabled: !!user && !!id,
  });

  const { data: relatedPosts } = useQuery({
    queryKey: ["input-related-posts", id],
    enabled: !!user && !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generated_posts")
        .select("id, title, content, status, created_at, input_id, input_ids")
        .or(`input_id.eq.${id},input_ids.cs.{${id}}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const handleDelete = () => {
    if (!input) return;
    deleteInput.mutate(input, {
      onSuccess: () => navigate("/library"),
    });
  };

  const handleToggleFavorite = () => {
    if (!input) return;
    toggleFavorite.mutate({ id: input.id, is_favorite: !input.is_favorite });
  };

  const handleExtractPdf = async () => {
    if (!input || !input.file_path) return;
    setIsExtracting(true);
    setExtractionStep(t("inputDetail.downloadingPdf"));
    try {
      const { data: fileBlob, error: dlError } = await supabase.storage
        .from("inputs")
        .download(input.file_path);
      
      if (!dlError && fileBlob) {
        setExtractionStep(t("inputDetail.analyzingPdf"));
        const { extractTextFromPdfFile } = await import("@/lib/pdf");
        const file = new File([fileBlob], "doc.pdf", { type: "application/pdf" });
        const text = await extractTextFromPdfFile(file);
        
        if (text) {
          setExtractionStep(t("inputDetail.savingExtracted"));
          const { error: updateError } = await supabase
            .from("inputs")
            .update({ extracted_content: text })
            .eq("id", input.id);
          if (updateError) throw updateError;
          toast.success(t("inputDetail.extractedOk"));
          queryClient.invalidateQueries({ queryKey: ["input-detail", id] });
          queryClient.invalidateQueries({ queryKey: ["inputs"] });
          return;
        }
      }

      setExtractionStep(t("inputDetail.extractingAI"));
      const { data, error } = await supabase.functions.invoke("extract-pdf", {
        body: { input_id: input.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(t("inputDetail.extractedOk"));
      queryClient.invalidateQueries({ queryKey: ["input-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["inputs"] });
    } catch (e: any) {
      toast.error(e.message || t("inputDetail.extractError"));
    } finally {
      setIsExtracting(false);
      setExtractionStep("");
    }
  };

  const handleExtractUrl = async () => {
    if (!input || !input.original_url) return;
    setIsExtracting(true);
    setExtractionStep(t("inputDetail.extractingUrl"));
    try {
      const { data, error } = await supabase.functions.invoke("extract-url", {
        body: { input_id: input.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(t("inputDetail.extractUrlOk"));
      queryClient.invalidateQueries({ queryKey: ["input-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["inputs"] });
    } catch (e: any) {
      toast.error(e.message || t("inputDetail.extractUrlError"));
    } finally {
      setIsExtracting(false);
      setExtractionStep("");
    }
  };

  const handleSummarize = async () => {
    if (!input) return;
    setIsSummarizing(true);
    try {
      const { data, error } = await supabase.functions.invoke("summarize-input", {
        body: { input_id: input.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(t("inputDetail.summaryOk"));
      queryClient.invalidateQueries({ queryKey: ["input-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["inputs"] });
    } catch (e: any) {
      toast.error(e.message || t("inputDetail.summaryError"));
    } finally {
      setIsSummarizing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!input) {
    return (
      <div className="p-4 lg:p-8 max-w-4xl mx-auto text-center py-16">
        <p className="text-muted-foreground">{t("inputDetail.notFound")}</p>
        <Link to="/library" className="text-primary hover:underline text-sm mt-2 inline-block">
          {t("inputDetail.backToLibrary")}
        </Link>
      </div>
    );
  }

  const displayContent = input.extracted_content || input.raw_content || "";

  return (
    <div className="p-3 sm:p-4 lg:p-8 space-y-4 sm:space-y-6 max-w-4xl mx-auto min-w-0 overflow-x-hidden [word-break:break-word]">
      <Link to="/library" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" />
        {t("inputDetail.backToLibrary")}
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="secondary" className={`text-xs flex-shrink-0 ${input.type === "youtube" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : ""}`}>
              {input.type === "youtube" && <Youtube className="h-3 w-3 mr-1" />}
              {typeLabels[input.type] ?? input.type}
            </Badge>
          </div>
          <h1 className="text-lg sm:text-xl lg:text-2xl font-bold break-words">{input.title}</h1>
          {input.original_url && (
            <a
              href={input.original_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-1 break-all"
            >
              <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" />
              {t("inputDetail.viewOriginal")}
            </a>
          )}
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleToggleFavorite}>
            <Star className={`h-4 w-4 ${input.is_favorite ? "fill-accent text-accent" : ""}`} />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span>{t("inputDetail.created")}: {new Date(input.created_at).toLocaleDateString()}</span>
        <span>·</span>
        <span>{t("inputDetail.updated")}: {new Date(input.updated_at).toLocaleDateString()}</span>
      </div>

      <Separator />

      {/* Extract button for PDF or URL without extracted content */}
      {((input.type === "pdf" && input.file_path) || (input.type === "url" && input.original_url)) && !input.extracted_content && (
        <Card className="border-dashed">
          <CardContent className="py-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">
                  {input.type === "pdf" ? t("inputDetail.extractPdf") : t("inputDetail.extractUrl")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isExtracting ? extractionStep : input.type === "pdf" ? t("inputDetail.extractPdfDesc") : t("inputDetail.extractUrlDesc")}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={input.type === "pdf" ? handleExtractPdf : handleExtractUrl}
                disabled={isExtracting}
                className="gap-1.5"
              >
                {isExtracting ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" />{t("inputDetail.extracting")}</>
                ) : (
                  <><FileText className="h-3.5 w-3.5" />{t("inputDetail.extractContent")}</>
                )}
              </Button>
            </div>
            {isExtracting && (
              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                <div className="bg-primary h-full rounded-full animate-pulse" style={{ width: "100%" }} />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Notes (above summary) */}
      <InputNotes inputId={input.id} />

      {/* Summary */}
      <Card className="min-w-0 overflow-hidden">
        <CardHeader className="pb-2 px-3 sm:px-6">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("inputDetail.summary")}</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSummarize}
              disabled={isSummarizing}
              className="gap-1.5 flex-shrink-0 text-xs"
            >
              {isSummarizing ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" />{t("inputDetail.generating")}</>
              ) : input.summary ? (
                <><RefreshCw className="h-3.5 w-3.5" />{t("inputDetail.regenerate")}</>
              ) : (
                <><Sparkles className="h-3.5 w-3.5" /><span className="hidden sm:inline">{t("inputDetail.generateSummary")}</span><span className="sm:hidden">{t("inputDetail.generateSummaryShort")}</span></>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          {input.summary ? (
            <p className="text-sm leading-relaxed break-words [overflow-wrap:anywhere]">{input.summary}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              {t("inputDetail.noSummary")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Related generated posts */}
      {relatedPosts && relatedPosts.length > 0 && (
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="pb-2 px-3 sm:px-6">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <PenTool className="h-4 w-4" />
              {t("inputDetail.relatedPosts").replace("{count}", String(relatedPosts.length))}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 space-y-2">
            {relatedPosts.map((p: any) => (
              <button
                key={p.id}
                type="button"
                onClick={() => navigate("/history", { state: { openPostId: p.id } })}
                className="w-full flex items-start gap-2 rounded-lg border p-2.5 text-left hover:bg-secondary/50 transition-colors min-w-0"
              >
                <div className="min-w-0 flex-1">
                  {p.title && (
                    <p className="text-[13px] font-medium leading-snug break-words [overflow-wrap:anywhere] mb-0.5">{p.title}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground line-clamp-2 break-words [overflow-wrap:anywhere]">{p.content}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-[10px] capitalize">{p.status ?? "draft"}</Badge>
                    <span className="text-[10px] text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Content */}
      {displayContent && (
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="pb-2 px-3 sm:px-6">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {input.extracted_content ? t("inputDetail.extractedContent") : t("inputDetail.content")}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="prose prose-sm max-w-none break-words [overflow-wrap:anywhere]">
              {displayContent.split("\n\n").map((p, i) => (
                <p key={i} className="text-sm leading-relaxed mb-3 break-words">{p}</p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No content state */}
      {!displayContent && !input.summary && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              {t("inputDetail.noContent")}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
