import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft, Star, Globe, Tag, FolderOpen, Plus,
  RefreshCw, Trash2, StickyNote, ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

export default function InputDetailPage() {
  const { id } = useParams();
  const [noteText, setNoteText] = useState("");

  // Mock data
  const input = {
    id,
    type: "article",
    title: "Cómo construir tu marca personal en LinkedIn",
    original_url: "https://ejemplo.com/articulo-marca-personal",
    extracted_content: `La marca personal en LinkedIn es uno de los activos más importantes para cualquier founder. En este artículo exploramos las estrategias clave para construir una presencia sólida y auténtica.\n\n1. Define tu narrativa central\nAntes de publicar, identifica qué problema resuelves y para quién. Tu narrativa debe ser consistente y reconocible.\n\n2. Publica con regularidad\nLa consistencia es más importante que la perfección. Establece un ritmo de publicación que puedas mantener.\n\n3. Comparte aprendizajes reales\nLos posts que mejor funcionan son los que comparten experiencias auténticas, incluyendo fracasos y lecciones aprendidas.\n\n4. Interactúa con tu comunidad\nResponde comentarios, comenta en posts de otros y construye relaciones genuinas.`,
    extracted_summary: "Guía completa sobre estrategias de marca personal en LinkedIn para founders y emprendedores. Cubre narrativa personal, consistencia, autenticidad y engagement.",
    is_favorite: true,
    extraction_status: "success",
    categories: ["Marketing"],
    tags: ["LinkedIn", "Branding"],
    notes: [
      { id: "n1", content: "Muy relevante para mi próximo post sobre lecciones aprendidas", created_at: "2024-01-15" },
    ],
    created_at: "2024-01-15",
  };

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-4xl mx-auto">
      {/* Back */}
      <Link to="/library" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Volver a Biblioteca
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="secondary" className="text-xs">Artículo</Badge>
            {input.extraction_status === "success" && (
              <Badge className="bg-success text-success-foreground text-xs">Extraído</Badge>
            )}
          </div>
          <h1 className="text-xl lg:text-2xl font-bold">{input.title}</h1>
          {input.original_url && (
            <a
              href={input.original_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-1"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Ver original
            </a>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon">
            <Star className={`h-4 w-4 ${input.is_favorite ? "fill-accent text-accent" : ""}`} />
          </Button>
          <Button variant="ghost" size="icon" className="text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-2">
        {input.categories.map((c) => (
          <Badge key={c} variant="outline">
            <FolderOpen className="h-3 w-3 mr-1" />
            {c}
          </Badge>
        ))}
        {input.tags.map((t) => (
          <Badge key={t} variant="outline">
            <Tag className="h-3 w-3 mr-1" />
            {t}
          </Badge>
        ))}
        <Button variant="outline" size="sm" className="h-6 text-xs gap-1">
          <Plus className="h-3 w-3" /> Etiqueta
        </Button>
        <Button variant="outline" size="sm" className="h-6 text-xs gap-1">
          <Plus className="h-3 w-3" /> Categoría
        </Button>
      </div>

      <Separator />

      {/* Summary */}
      {input.extracted_summary && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Resumen</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{input.extracted_summary}</p>
          </CardContent>
        </Card>
      )}

      {/* Content */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Contenido extraído</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none">
            {input.extracted_content.split("\n\n").map((p, i) => (
              <p key={i} className="text-sm leading-relaxed mb-3">{p}</p>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <StickyNote className="h-4 w-4" />
              Notas personales
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {input.notes.map((note) => (
            <div key={note.id} className="rounded-lg bg-secondary p-3">
              <p className="text-sm">{note.content}</p>
              <p className="text-xs text-muted-foreground mt-1">{note.created_at}</p>
            </div>
          ))}
          <div className="flex gap-2">
            <Textarea
              placeholder="Añadir una nota..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={2}
              className="text-sm"
            />
            <Button size="sm" className="self-end">
              Añadir
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
