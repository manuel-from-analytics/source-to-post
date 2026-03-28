import { useState } from "react";
import {
  PenTool, Check, Copy, RefreshCw, Send, Sparkles,
  FileText, Save, Loader2, Globe, Youtube, File, Type
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
import { useInputs } from "@/hooks/useInputs";
import { useGeneratePost } from "@/hooks/useGeneratePost";
import { CategoryFilter } from "@/components/CategoryWidgets";

const typeIcons: Record<string, React.ElementType> = {
  pdf: File, url: Globe, youtube: Youtube, text: Type,
};

export default function GeneratorPage() {
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [filterCategoryId, setFilterCategoryId] = useState<string | null>(null);
  const [iterationPrompt, setIterationPrompt] = useState("");
  const [copied, setCopied] = useState(false);

  // Config state
  const [goal, setGoal] = useState("");
  const [tone, setTone] = useState("");
  const [language, setLanguage] = useState("es");
  const [length, setLength] = useState("medium");
  const [cta, setCta] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [writingStyle, setWritingStyle] = useState("");

  const { data: inputs, isLoading: loadingInputs } = useInputs();
  const { generate, savePost, isGenerating, content, setContent } = useGeneratePost();

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
      writing_style: writingStyle || undefined,
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
      writing_style: writingStyle || undefined,
      iteration_prompt: iterationPrompt.trim(),
      previous_content: content,
    });
    setIterationPrompt("");
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    savePost({
      content,
      input_id: selectedSources[0],
      goal: goal || undefined,
      tone: tone || undefined,
      target_audience: targetAudience || undefined,
    });
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
            <CardContent className="space-y-3">
              <CategoryFilter selectedCategoryId={filterCategoryId} onSelect={setFilterCategoryId} />
              <div className="space-y-2 max-h-[220px] overflow-y-auto">
              {loadingInputs ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (inputs ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No tienes fuentes guardadas aún
                </p>
              ) : (
                (inputs ?? []).filter((s) => !filterCategoryId || s.category_id === filterCategoryId).map((source) => {
                  const Icon = typeIcons[source.type] || FileText;
                  return (
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
                        <div className="flex items-center gap-2 mt-1">
                          <Icon className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground capitalize">{source.type}</span>
                        </div>
                      </div>
                    </label>
                  );
                })
              )}
              </div>
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
                <Select value={goal} onValueChange={setGoal}>
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
                  <Select value={tone} onValueChange={setTone}>
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
                  <Select value={language} onValueChange={setLanguage}>
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
                  <Select value={length} onValueChange={setLength}>
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
                  <Select value={cta} onValueChange={setCta}>
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
                <Input
                  placeholder="Ej: Founders, marketers, recruiters..."
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Estilo / Voz</Label>
                <Input
                  placeholder="Ej: Como Gary Vee, como un mentor..."
                  value={writingStyle}
                  onChange={(e) => setWritingStyle(e.target.value)}
                />
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
                {content && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={handleGenerate} disabled={isGenerating} className="text-xs gap-1">
                      <RefreshCw className="h-3 w-3" />
                      Regenerar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleCopy} className="text-xs gap-1">
                      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {copied ? "Copiado" : "Copiar"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleSave} className="text-xs gap-1">
                      <Save className="h-3 w-3" />
                      Guardar
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
                  <p className="text-sm text-muted-foreground">Generando tu borrador...</p>
                </div>
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
          {content && !isGenerating && (
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
                    onKeyDown={(e) => e.key === "Enter" && handleIterate()}
                    className="text-sm"
                  />
                  <Button size="sm" className="gap-1" onClick={handleIterate} disabled={isGenerating}>
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
