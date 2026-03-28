import { useState } from "react";
import { Search, Copy, Check, FileText, Calendar, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";

const mockPosts = [
  {
    id: "1",
    final_content: "🚀 Lo que aprendí construyendo mi marca personal en LinkedIn\n\nDurante los últimos 6 meses, pasé de 200 a 5,000 seguidores...",
    goal_type: "educate",
    tone: "professional",
    language: "es",
    created_at: "2024-01-16",
  },
  {
    id: "2",
    final_content: "3 errores que todo founder comete al escalar su startup:\n\n1. Contratar por urgencia, no por cultura...",
    goal_type: "storytelling",
    tone: "direct",
    language: "es",
    created_at: "2024-01-14",
  },
];

export default function HistoryPage() {
  const [search, setSearch] = useState("");
  const [selectedPost, setSelectedPost] = useState<typeof mockPosts[0] | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (post: typeof mockPosts[0]) => {
    navigator.clipboard.writeText(post.final_content);
    setCopiedId(post.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Historial</h1>
        <p className="text-muted-foreground mt-1">
          {mockPosts.length} posts generados
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar en historial..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="space-y-3">
        {mockPosts.map((post) => (
          <Card key={post.id} className="group">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setSelectedPost(post)}>
                  <p className="text-sm line-clamp-3 leading-relaxed">
                    {post.final_content}
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    <Badge variant="secondary" className="text-xs capitalize">
                      {post.goal_type}
                    </Badge>
                    <Badge variant="outline" className="text-xs capitalize">
                      {post.tone}
                    </Badge>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {post.created_at}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedPost(post)}>
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleCopy(post)}>
                    {copiedId === post.id ? (
                      <Check className="h-3.5 w-3.5 text-success" />
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

      {/* Detail dialog */}
      <Dialog open={!!selectedPost} onOpenChange={() => setSelectedPost(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">Post generado</DialogTitle>
          </DialogHeader>
          {selectedPost && (
            <div className="space-y-4">
              <div className="rounded-lg bg-secondary p-4">
                <p className="text-sm whitespace-pre-line leading-relaxed">
                  {selectedPost.final_content}
                </p>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <Badge variant="secondary" className="text-xs capitalize">
                    {selectedPost.goal_type}
                  </Badge>
                  <Badge variant="outline" className="text-xs capitalize">
                    {selectedPost.tone}
                  </Badge>
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

      {mockPosts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">Aún no has generado ningún post</p>
        </div>
      )}
    </div>
  );
}
