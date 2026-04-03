import { useState } from "react";
import { Search, Copy, Check, FileText, Calendar, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { usePosts, useUpdatePostStatus } from "@/hooks/usePosts";
import { Skeleton } from "@/components/ui/skeleton";
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
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (post: Post) => {
    navigator.clipboard.writeText(post.content);
    setCopiedId(post.id);
    setTimeout(() => setCopiedId(null), 2000);
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
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedPost(post)}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleCopy(post)}>
                      {copiedId === post.id ? (
                        <Check className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">
              {selectedPost?.title || "Post generado"}
            </DialogTitle>
          </DialogHeader>
          {selectedPost && (
            <div className="space-y-4">
              <div className="rounded-lg bg-secondary p-4">
                <p className="text-sm whitespace-pre-line leading-relaxed">
                  {selectedPost.content}
                </p>
              </div>
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
                <Button size="sm" onClick={() => handleCopy(selectedPost)} className="gap-1">
                  {copiedId === selectedPost.id ? (
                    <><Check className="h-3 w-3" /> Copiado</>
                  ) : (
                    <><Copy className="h-3 w-3" /> Copiar</>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
