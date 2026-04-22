import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Copy, Check, FileText, Calendar, Eye, Trash2, Pencil, Files } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { usePosts, useUpdatePostStatus, useDeletePost } from "@/hooks/usePosts";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/i18n/LanguageContext";
import type { Database } from "@/integrations/supabase/types";
import { PostLabelBadge, PostLabelPicker, PostLabelFilter, LabelPublishedDate } from "@/components/PostLabelWidgets";
import {
  usePostLabels, useAllPostLabelAssignments,
  usePostLabelAssignments, usePostLabelPublications,
  useAllPostLabelPublications, usePublishToLabel, useUnpublishFromLabel,
} from "@/hooks/usePostLabels";

type PostStatus = Database["public"]["Enums"]["post_status"];
type Post = Database["public"]["Tables"]["generated_posts"]["Row"];

export default function HistoryPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { data: posts, isLoading } = usePosts();
  const updateStatus = useUpdatePostStatus();
  const deletePost = useDeletePost();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterLabelId, setFilterLabelId] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [labelPickerOpen, setLabelPickerOpen] = useState(false);
  const { data: allLabels } = usePostLabels();
  const { data: assignmentsMap } = useAllPostLabelAssignments();
  const { data: publicationsMap } = useAllPostLabelPublications();
  const { data: selectedAssignedIds } = usePostLabelAssignments(selectedPost?.id);
  const { data: selectedPublications } = usePostLabelPublications(selectedPost?.id);
  const publishToLabel = usePublishToLabel();
  const unpublishFromLabel = useUnpublishFromLabel();

  const statusLabels: Record<PostStatus, string> = {
    draft: t("history.draft"),
    final: t("history.final"),
    published: t("history.published"),
  };

  const statusColors: Record<PostStatus, string> = {
    draft: "bg-muted text-muted-foreground",
    final: "bg-primary/15 text-primary",
    published: "bg-green-500/15 text-green-700 dark:text-green-400",
  };

  const handleCopy = (post: Post) => {
    navigator.clipboard.writeText(post.content);
    setCopiedId(post.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const postStateForGenerator = (post: Post) => ({
    id: post.id,
    content: post.content,
    goal: post.goal,
    tone: post.tone,
    target_audience: post.target_audience,
    input_id: post.input_id,
    input_ids: (post as any).input_ids as string[] | null,
    title: post.title,
    language: (post as any).language,
    cta: (post as any).cta,
    length: (post as any).length,
    content_focus: (post as any).content_focus,
    voice_id: (post as any).voice_id,
  });

  const handleEdit = (post: Post) => {
    navigate("/generator", {
      state: { editingPost: postStateForGenerator(post) },
    });
  };

  const handleDuplicate = (post: Post) => {
    const { id: _id, ...rest } = postStateForGenerator(post);
    navigate("/generator", {
      state: { duplicatePost: rest },
    });
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deletePost.mutate(deleteId, {
      onSuccess: () => {
        setDeleteId(null);
        if (selectedPost?.id === deleteId) setSelectedPost(null);
      },
    });
  };

  const filtered = (posts ?? []).filter((p) => {
    if (filterStatus !== "all" && p.status !== filterStatus) return false;
    if (filterLabelId && !(assignmentsMap?.[p.id] ?? []).includes(filterLabelId)) return false;
    if (search && !p.content.toLowerCase().includes(search.toLowerCase()) &&
        !(p.title ?? "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("history.title")}</h1>
        <p className="text-muted-foreground mt-1">
          {posts?.length ?? 0} {t("history.postsGenerated")}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("history.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("history.all")}</SelectItem>
            <SelectItem value="draft">{t("history.draft")}</SelectItem>
            <SelectItem value="final">{t("history.final")}</SelectItem>
            <SelectItem value="published">{t("history.published")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <PostLabelFilter selectedLabelId={filterLabelId} onSelect={setFilterLabelId} />

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((post) => (
            <Card key={post.id} className="group">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setSelectedPost(post)}>
                    {post.title && (
                      <p className="text-sm font-medium mb-1">{post.title}</p>
                    )}
                    <p className="text-sm line-clamp-3 leading-relaxed text-muted-foreground">
                      {post.content}
                    </p>
                     <div className="flex items-center gap-2 mt-3 flex-wrap">
                       <Badge className={`text-xs ${statusColors[post.status ?? "draft"]} border-0`}>
                         {statusLabels[post.status ?? "draft"]}
                       </Badge>
                       {(assignmentsMap?.[post.id] ?? []).map((lid) => {
                         const lbl = (allLabels ?? []).find((l) => l.id === lid);
                         if (!lbl) return null;
                         return <PostLabelBadge key={lid} label={lbl} />;
                       })}
                       {post.goal && (
                         <Badge variant="secondary" className="text-xs capitalize">{post.goal}</Badge>
                       )}
                       {post.tone && (
                         <Badge variant="outline" className="text-xs capitalize">{post.tone}</Badge>
                       )}
                       <span className="text-xs text-muted-foreground flex items-center gap-1">
                         <Calendar className="h-3 w-3" />
                         {new Date(post.created_at).toLocaleDateString()}
                       </span>
                       {(post as any).published_at && (assignmentsMap?.[post.id]?.length ?? 0) === 0 && (
                         <span className="text-xs text-primary flex items-center gap-1">
                           <Check className="h-3 w-3" />
                           {t("history.publishedOn")} {new Date((post as any).published_at).toLocaleDateString()}
                         </span>
                       )}
                     </div>
                     {(publicationsMap?.[post.id]?.length ?? 0) > 0 && (
                       <div className="flex flex-wrap gap-1.5 mt-2">
                         {(publicationsMap?.[post.id] ?? []).map((pub) => {
                           const lbl = (allLabels ?? []).find((l) => l.id === pub.label_id);
                           if (!lbl) return null;
                           return (
                             <LabelPublishedDate key={pub.label_id} label={lbl} date={pub.published_at} />
                           );
                         })}
                       </div>
                     )}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <PostLabelPicker postId={post.id} />
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedPost(post)} title={t("history.view")}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(post)} title={t("history.edit")}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDuplicate(post)} title={t("history.duplicate")}>
                      <Files className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleCopy(post)}>
                      {copiedId === post.id ? (
                        <Check className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(post.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!selectedPost} onOpenChange={() => setSelectedPost(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">
              {selectedPost?.title || t("history.generatedPost")}
            </DialogTitle>
          </DialogHeader>
          {selectedPost && (
            <div className="space-y-4">
              <div className="rounded-lg bg-secondary p-4">
                <p className="text-sm whitespace-pre-line leading-relaxed">
                  {selectedPost.content}
                </p>
              </div>

              {(selectedAssignedIds?.length ?? 0) > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    {t("history.publishByChannel")}
                  </p>
                  <div className="space-y-1.5">
                    {(selectedAssignedIds ?? []).map((labelId) => {
                      const lbl = (allLabels ?? []).find((l) => l.id === labelId);
                      if (!lbl) return null;
                      const pub = (selectedPublications ?? []).find((p) => p.label_id === labelId);
                      const isPublished = !!pub;
                      return (
                        <div
                          key={labelId}
                          className="flex items-center justify-between gap-2 rounded-md border p-2"
                          style={{ borderColor: lbl.color ?? undefined }}
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: lbl.color ?? "#3b82f6" }}
                            />
                            <span className="truncate text-sm font-medium" style={{ color: lbl.color ?? undefined }}>
                              {lbl.name}
                            </span>
                            {isPublished && pub && (
                              <span className="text-xs text-muted-foreground">
                                · {new Date(pub.published_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          {isPublished ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              onClick={() =>
                                unpublishFromLabel.mutate({ postId: selectedPost.id, labelId })
                              }
                              disabled={unpublishFromLabel.isPending}
                            >
                              {t("history.unpublish")}
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() =>
                                publishToLabel.mutate({ postId: selectedPost.id, labelId })
                              }
                              disabled={publishToLabel.isPending}
                            >
                              <Check className="h-3 w-3 mr-1" />
                              {t("history.markPublishedToday")}
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{t("history.status")}</span>
                  <Select
                    value={selectedPost.status ?? "draft"}
                    onValueChange={(v) => {
                      updateStatus.mutate({ id: selectedPost.id, status: v as PostStatus });
                      setSelectedPost({ ...selectedPost, status: v as PostStatus });
                    }}
                  >
                    <SelectTrigger className="h-8 w-[120px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">{t("history.draft")}</SelectItem>
                      <SelectItem value="final">{t("history.final")}</SelectItem>
                      <SelectItem value="published">{t("history.published")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => { setSelectedPost(null); handleDuplicate(selectedPost); }} className="gap-1">
                    <Files className="h-3 w-3" /> {t("history.duplicate")}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleEdit(selectedPost)} className="gap-1">
                    <Pencil className="h-3 w-3" /> {t("history.edit")}
                  </Button>
                  <Button size="sm" onClick={() => handleCopy(selectedPost)} className="gap-1">
                    {copiedId === selectedPost.id ? (
                      <><Check className="h-3 w-3" /> {t("history.copied")}</>
                    ) : (
                      <><Copy className="h-3 w-3" /> {t("history.copy")}</>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("history.deleteConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("history.deleteDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("history.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {!isLoading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">
            {posts?.length ? t("history.noResults") : t("history.empty")}
          </p>
        </div>
      )}
    </div>
  );
}
