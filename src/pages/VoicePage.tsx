import { useState } from "react";
import { Mic, Plus, Trash2, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { useVoiceSamples, useAddVoiceSample, useDeleteVoiceSample } from "@/hooks/useVoiceSamples";

export default function VoicePage() {
  const { data: samples, isLoading } = useVoiceSamples();
  const addSample = useAddVoiceSample();
  const deleteSample = useDeleteVoiceSample();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [open, setOpen] = useState(false);

  const handleAdd = () => {
    if (!content.trim()) return;
    addSample.mutate({ title: title.trim() || undefined, content: content.trim() }, {
      onSuccess: () => {
        setTitle("");
        setContent("");
        setOpen(false);
      },
    });
  };

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mi Voz</h1>
          <p className="text-muted-foreground mt-1">
            Pega posts de ejemplo para que el generador aprenda tu estilo y tono
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Añadir ejemplo
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Nuevo ejemplo de voz</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label className="text-xs">Título (opcional)</Label>
                <Input
                  placeholder="Ej: Post sobre liderazgo, Hilo viral..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Contenido del post</Label>
                <Textarea
                  placeholder="Pega aquí el post de ejemplo que quieres usar como referencia de estilo..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="min-h-[200px]"
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancelar</Button>
              </DialogClose>
              <Button onClick={handleAdd} disabled={!content.trim() || addSample.isPending}>
                {addSample.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Guardar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !samples?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Mic className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="font-medium text-foreground mb-1">Sin ejemplos de voz</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Pega posts que te gusten para que el generador analice el estilo, la narrativa y las expresiones que usas
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {samples.map((sample) => (
            <Card key={sample.id} className="group relative">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-sm font-medium truncate flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    {sample.title || "Sin título"}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                    onClick={() => deleteSample.mutate(sample.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground line-clamp-5 whitespace-pre-wrap leading-relaxed">
                  {sample.content}
                </p>
                <p className="text-[10px] text-muted-foreground/60 mt-3">
                  {new Date(sample.created_at).toLocaleDateString("es-ES", {
                    day: "numeric", month: "short", year: "numeric",
                  })}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
