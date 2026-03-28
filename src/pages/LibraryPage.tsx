import { useState } from "react";
import {
  Plus, Search, Filter, Star, FileText, Link as LinkIcon,
  Youtube, Linkedin, File, MoreVertical, Tag, FolderOpen, X,
  Upload, Globe, Type
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const typeIcons: Record<string, React.ElementType> = {
  pdf: File,
  article: Globe,
  linkedin_post: Linkedin,
  youtube: Youtube,
  manual_text: Type,
};

const typeLabels: Record<string, string> = {
  pdf: "PDF",
  article: "Artículo",
  linkedin_post: "LinkedIn",
  youtube: "YouTube",
  manual_text: "Texto",
};

const typeColors: Record<string, string> = {
  pdf: "bg-destructive/10 text-destructive",
  article: "bg-primary/10 text-primary",
  linkedin_post: "bg-primary/10 text-primary",
  youtube: "bg-destructive/10 text-destructive",
  manual_text: "bg-accent/10 text-accent-foreground",
};

// Mock data for UI
const mockInputs = [
  {
    id: "1",
    type: "article",
    title: "Cómo construir tu marca personal en LinkedIn",
    extracted_summary: "Guía completa sobre estrategias de marca personal en LinkedIn para founders y emprendedores...",
    is_favorite: true,
    extraction_status: "success",
    categories: ["Marketing"],
    tags: ["LinkedIn", "Branding"],
    created_at: "2024-01-15",
  },
  {
    id: "2",
    type: "youtube",
    title: "The Art of Storytelling for Business",
    extracted_summary: "Técnicas narrativas aplicadas al contexto empresarial y cómo usarlas en redes sociales...",
    is_favorite: false,
    extraction_status: "success",
    categories: ["Storytelling"],
    tags: ["Video", "Narrativa"],
    created_at: "2024-01-14",
  },
  {
    id: "3",
    type: "pdf",
    title: "Reporte Q4 - Estrategia de contenidos",
    extracted_summary: null,
    is_favorite: false,
    extraction_status: "error",
    categories: [],
    tags: [],
    created_at: "2024-01-13",
  },
];

export default function LibraryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [newInputOpen, setNewInputOpen] = useState(false);
  const [newInputType, setNewInputType] = useState("article");

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Biblioteca</h1>
          <p className="text-muted-foreground mt-1">
            {mockInputs.length} fuentes guardadas
          </p>
        </div>
        <Dialog open={newInputOpen} onOpenChange={setNewInputOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Añadir fuente
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Añadir nueva fuente</DialogTitle>
              <DialogDescription>
                Selecciona el tipo de fuente que quieres guardar
              </DialogDescription>
            </DialogHeader>
            <Tabs value={newInputType} onValueChange={setNewInputType}>
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="article" className="text-xs px-1">
                  <Globe className="h-3.5 w-3.5 sm:mr-1" />
                  <span className="hidden sm:inline">Artículo</span>
                </TabsTrigger>
                <TabsTrigger value="linkedin_post" className="text-xs px-1">
                  <Linkedin className="h-3.5 w-3.5 sm:mr-1" />
                  <span className="hidden sm:inline">LinkedIn</span>
                </TabsTrigger>
                <TabsTrigger value="youtube" className="text-xs px-1">
                  <Youtube className="h-3.5 w-3.5 sm:mr-1" />
                  <span className="hidden sm:inline">YouTube</span>
                </TabsTrigger>
                <TabsTrigger value="pdf" className="text-xs px-1">
                  <File className="h-3.5 w-3.5 sm:mr-1" />
                  <span className="hidden sm:inline">PDF</span>
                </TabsTrigger>
                <TabsTrigger value="manual_text" className="text-xs px-1">
                  <Type className="h-3.5 w-3.5 sm:mr-1" />
                  <span className="hidden sm:inline">Texto</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="article" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>URL del artículo</Label>
                  <Input placeholder="https://ejemplo.com/articulo" />
                </div>
                <div className="space-y-2">
                  <Label>Título (opcional)</Label>
                  <Input placeholder="Se detectará automáticamente" />
                </div>
              </TabsContent>

              <TabsContent value="linkedin_post" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>URL del post de LinkedIn</Label>
                  <Input placeholder="https://linkedin.com/posts/..." />
                </div>
              </TabsContent>

              <TabsContent value="youtube" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>URL del video de YouTube</Label>
                  <Input placeholder="https://youtube.com/watch?v=..." />
                </div>
              </TabsContent>

              <TabsContent value="pdf" className="space-y-4 mt-4">
                <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center">
                  <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">Arrastra tu PDF aquí</p>
                  <p className="text-xs text-muted-foreground mt-1">o haz clic para seleccionar</p>
                  <Button variant="outline" size="sm" className="mt-3">
                    Seleccionar archivo
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="manual_text" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Título</Label>
                  <Input placeholder="Título de tu nota" />
                </div>
                <div className="space-y-2">
                  <Label>Contenido</Label>
                  <Textarea placeholder="Escribe o pega tu texto aquí..." rows={6} />
                </div>
              </TabsContent>
            </Tabs>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewInputOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={() => setNewInputOpen(false)}>
                Guardar fuente
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar fuentes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="icon">
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      {/* Input cards */}
      <div className="space-y-3">
        {mockInputs.map((input) => {
          const Icon = typeIcons[input.type] || FileText;
          return (
            <Link key={input.id} to={`/library/${input.id}`}>
              <Card className="group cursor-pointer transition-all hover:shadow-md hover:border-primary/20">
                <CardContent className="flex items-start gap-3 p-4">
                  <div className={`rounded-lg p-2 mt-0.5 ${typeColors[input.type]}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-sm truncate">{input.title}</h3>
                      {input.is_favorite && (
                        <Star className="h-3.5 w-3.5 text-accent fill-accent flex-shrink-0" />
                      )}
                    </div>
                    {input.extraction_status === "error" ? (
                      <p className="text-xs text-destructive mt-1">
                        Error en extracción — contenido no guardado
                      </p>
                    ) : input.extracted_summary ? (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {input.extracted_summary}
                      </p>
                    ) : null}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <Badge variant="secondary" className="text-xs">
                        {typeLabels[input.type]}
                      </Badge>
                      {input.categories.map((c) => (
                        <Badge key={c} variant="outline" className="text-xs">
                          <FolderOpen className="h-2.5 w-2.5 mr-1" />
                          {c}
                        </Badge>
                      ))}
                      {input.tags.map((t) => (
                        <Badge key={t} variant="outline" className="text-xs">
                          <Tag className="h-2.5 w-2.5 mr-1" />
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
