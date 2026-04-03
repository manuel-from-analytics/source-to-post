import { useState } from "react";
import { Search, Copy, Check, FileText, Calendar, Eye, Trash2, Pencil, Send, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { usePosts, useUpdatePostStatus, useUpdatePost, useDeletePost } from "@/hooks/usePosts";
import { Skeleton } from "@/components/ui/skeleton";
import { useGeneratePost } from "@/hooks/useGeneratePost";
import type { Database } from "@/integrations/supabase/types";

type PostStatus = Database["public"]["Enums"]["post_status"];
type Post = Database["public"]["Tables"]["generated_posts"]["Row"];

const statusLabels: Record<PostStatus, string> = {
  draft: "Borrador",
  final: "Listo",
  published: "Publicado",
};

const statusColors: Record<PostStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  final: "bg-primary/15 text-primary",
  published: "bg-green-500/15 text-green-700 dark:text-green-400",
};

export default function HistoryPage() {
  const { data: posts, isLoading } = usePosts();
  const updateStatus = useUpdatePostStatus();
  const updatePost = useUpdatePost();
  const deletePost = useDeletePost();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");

  const { generate, isGenerating, content: aiContent, setContent: setAiContent } = useGeneratePost();

  const handleCopy = (post: Post) => {
    navigator.clipboard.writeText(post.content);
    setCopiedId(post.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleStartEdit = () => {
    if (!selectedPost) return;
    setEditContent(selectedPost.content);
    setEditTitle(selectedPost.title ?? "");
    setEditing(true);
  };

  const handleSaveEdit = () => {
    if (!selectedPost) return;
    updatePost.mutate(
      { id: selectedPost.id, content: editContent, title: editTitle || undefined },
      {
        onSuccess: () => {
          setSelectedPost({ ...selectedPost, content: editContent, title: editTitle || null });
          setEditing(false);
        },
      }
    );
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
    if (search && !p.content.toLowerCase().includes(search.toLowerCase()) &&
        !(p.title ?? "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Historial</h1>
        <p className="text-muted-foreground mt-1">
          {posts?.length ?? 0} posts generados
        </p>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar en historial..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="draft">Borrador</SelectItem>
            <SelectItem value="final">Listo</SelectItem>
            <SelectItem value="published">Publicado</SelectItem>
          </SelectContent>
        </Select>
      </div>

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
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { setSelectedPost(post); setEditing(false); }}>
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
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelectedPost(post); setEditing(false); }}>
                      <Eye className="h-3.5 w-3.5" />
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

      {/* Detail / Edit dialog */}
      <Dialog open={!!selectedPost} onOpenChange={() => { setSelectedPost(null); setEditing(false); }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">
              {editing ? "Editar post" : (selectedPost?.title || "Post generado")}
            </DialogTitle>
          </DialogHeader>
          {selectedPost && !editing && (
            <div className="space-y-4">
              {/* Content display - show AI result if generating/generated, otherwise original */}
              <div className="rounded-lg bg-secondary p-4">
                {isGenerating ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Modificando con IA...</span>
                    </div>
                    <p className="text-sm whitespace-pre-line leading-relaxed">
                      {aiContent || selectedPost.content}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-line leading-relaxed">
                    {selectedPost.content}
                  </p>
                )}
              </div>

              {/* AI iteration bar */}
              {!isGenerating && (
                <div className="flex gap-2 items-center">
                  <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
                  <Input
                    placeholder='Ej: "Hazlo más directo", "Añade datos"...'
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && aiPrompt.trim()) {
                        generate({
                          input_ids: [],
                          iteration_prompt: aiPrompt.trim(),
                          previous_content: selectedPost.content,
                        });
                        setAiPrompt("");
                      }
                    }}
                    className="text-sm"
                  />
                  <Button
                    size="sm"
                    className="gap-1 flex-shrink-0"
                    disabled={!aiPrompt.trim()}
                    onClick={() => {
                      generate({
                        input_ids: [],
                        iteration_prompt: aiPrompt.trim(),
                        previous_content: selectedPost.content,
                      });
                      setAiPrompt("");
                    }}
                  >
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}

              {/* Apply AI result button */}
              {!isGenerating && aiContent && (
                <div className="flex gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <Sparkles className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium mb-1">Nueva versión generada por IA</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{aiContent.slice(0, 120)}...</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => setAiContent("")}
                    >
                      Descartar
                    </Button>
                    <Button
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        updatePost.mutate(
                          { id: selectedPost.id, content: aiContent },
                          {
                            onSuccess: () => {
                              setSelectedPost({ ...selectedPost, content: aiContent });
                              setAiContent("");
                            },
                          }
                        );
                      }}
                    >
                      Aplicar
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Estado:</span>
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
                      <SelectItem value="draft">Borrador</SelectItem>
                      <SelectItem value="final">Listo</SelectItem>
                      <SelectItem value="published">Publicado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={handleStartEdit} className="gap-1">
                    <Pencil className="h-3 w-3" /> Editar
                  </Button>
                  <Button size="sm" onClick={() => handleCopy(selectedPost)} className="gap-1">
                    {copiedId === selectedPost.id ? (
                      <><Check className="h-3 w-3" /> Copiado</>
                    ) : (
                      <><Copy className="h-3 w-3" /> Copiar</>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
          {selectedPost && editing && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Input
                  placeholder="Título (opcional)"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                />
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="min-h-[200px]"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleSaveEdit} disabled={updatePost.isPending || !editContent.trim()}>
                  Guardar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este post?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {!isLoading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">
            {posts?.length ? "No hay posts que coincidan con tu búsqueda" : "Aún no has generado ningún post"}
          </p>
        </div>
      )}
    </div>
  );
}
