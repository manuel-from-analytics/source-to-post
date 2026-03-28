import { useState } from "react";
import {
  PenTool, Check, Copy, RefreshCw, Send, Sparkles,
  FileText, ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";

const mockSources = [
  { id: "1", title: "Cómo construir tu marca personal en LinkedIn", type: "article" },
  { id: "2", title: "The Art of Storytelling for Business", type: "youtube" },
];

export default function GeneratorPage() {
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [generatedContent, setGeneratedContent] = useState("");
  const [iterationPrompt, setIterationPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const toggleSource = (id: string) => {
    setSelectedSources((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setGeneratedContent(
        `🚀 Lo que aprendí construyendo mi marca personal en LinkedIn\n\nDurante los últimos 6 meses, pasé de 200 a 5,000 seguidores en LinkedIn.\n\nNo fue suerte. Fue método.\n\nEstas son las 3 lecciones que más impacto tuvieron:\n\n1️⃣ Tu narrativa lo es todo\nAntes de escribir un solo post, definí qué problema resuelvo y para quién. Eso me dio claridad y consistencia.\n\n2️⃣ Regularidad > perfección\nPublico 3 veces por semana, aunque no sea "perfecto". La consistencia construye audiencia.\n\n3️⃣ Vulnerabilidad = conexión\nLos posts donde compartí fracasos tuvieron 3x más engagement que mis "victorias".\n\n¿Cuál ha sido tu mayor aprendizaje construyendo presencia en LinkedIn?\n\n#MarcaPersonal #LinkedIn #Founders`
      );
      setIsGenerating(false);
    }, 1500);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Generador de Posts</h1>
        <p className="text-muted-foreground mt-1">
          Selecciona fuentes de referencia y configura tu post
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Config */}
        <div className="space-y-6">
          {/* Source selection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                Fuentes de referencia
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {mockSources.map((source) => (
                <label
                  key={source.id}
                  className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-secondary/50 transition-colors"
                >
                  <Checkbox
                    checked={selectedSources.includes(source.id)}
                    onCheckedChange={() => toggleSource(source.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{source.title}</p>
                    <Badge variant="secondary" className="text-xs mt-1">
                      {source.type}
                    </Badge>
                  </div>
                </label>
              ))}
              {mockSources.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No tienes fuentes guardadas aún
                </p>
              )}
            </CardContent>
          </Card>

          {/* Parameters */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                Parámetros de generación
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">Objetivo del post</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona objetivo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="educate">Educar</SelectItem>
                    <SelectItem value="inspire">Inspirar</SelectItem>
                    <SelectItem value="promote">Promocionar</SelectItem>
                    <SelectItem value="engage">Generar engagement</SelectItem>
                    <SelectItem value="storytelling">Storytelling</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Tono</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Tono" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Profesional</SelectItem>
                      <SelectItem value="casual">Casual</SelectItem>
                      <SelectItem value="inspirational">Inspiracional</SelectItem>
                      <SelectItem value="direct">Directo</SelectItem>
                      <SelectItem value="humorous">Con humor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Idioma</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Idioma" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="es">Español</SelectItem>
                      <SelectItem value="en">Inglés</SelectItem>
                      <SelectItem value="pt">Portugués</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Longitud</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Longitud" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="short">Corto (~100 palabras)</SelectItem>
                      <SelectItem value="medium">Medio (~200 palabras)</SelectItem>
                      <SelectItem value="long">Largo (~300 palabras)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">CTA</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Call to action" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="question">Pregunta</SelectItem>
                      <SelectItem value="share">Compartir</SelectItem>
                      <SelectItem value="follow">Seguir</SelectItem>
                      <SelectItem value="link">Visitar link</SelectItem>
                      <SelectItem value="none">Sin CTA</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Audiencia objetivo</Label>
                <Input placeholder="Ej: Founders, marketers, recruiters..." />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Estilo / Voz</Label>
                <Input placeholder="Ej: Como Gary Vee, como un mentor..." />
              </div>
            </CardContent>
          </Card>

          <Button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full gap-2"
            size="lg"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generar borrador
              </>
            )}
          </Button>
        </div>

        {/* Right: Result */}
        <div className="space-y-4">
          <Card className="min-h-[400px]">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Borrador</CardTitle>
                {generatedContent && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={handleGenerate} className="text-xs gap-1">
                      <RefreshCw className="h-3 w-3" />
                      Regenerar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleCopy} className="text-xs gap-1">
                      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {copied ? "Copiado" : "Copiar"}
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {generatedContent ? (
                <Textarea
                  value={generatedContent}
                  onChange={(e) => setGeneratedContent(e.target.value)}
                  className="min-h-[300px] resize-none border-none p-0 focus-visible:ring-0 text-sm leading-relaxed"
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <PenTool className="h-10 w-10 text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Tu borrador aparecerá aquí
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Selecciona fuentes y configura los parámetros
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Iteration */}
          {generatedContent && (
            <Card>
              <CardContent className="p-4">
                <Label className="text-xs text-muted-foreground mb-2 block">
                  Pedir cambios
                </Label>
                <div className="flex gap-2">
                  <Input
                    placeholder='Ej: "Hazlo más directo", "Añade datos"...'
                    value={iterationPrompt}
                    onChange={(e) => setIterationPrompt(e.target.value)}
                    className="text-sm"
                  />
                  <Button size="sm" className="gap-1">
                    <Send className="h-3.5 w-3.5" />
                    Enviar
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
