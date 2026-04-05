import { useState } from "react";
import { Mic, Plus, Trash2, Loader2, FileText, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useVoices, useAddVoice, useDeleteVoice } from "@/hooks/useVoices";
import { useVoiceSamples, useAddVoiceSample, useDeleteVoiceSample } from "@/hooks/useVoiceSamples";

export default function VoicePage() {
  const { data: voices, isLoading: loadingVoices } = useVoices();
  const { data: allSamples, isLoading: loadingSamples } = useVoiceSamples();
  const addVoice = useAddVoice();
  const deleteVoice = useDeleteVoice();
  const addSample = useAddVoiceSample();
  const deleteSample = useDeleteVoiceSample();

  const [voiceName, setVoiceName] = useState("");
  const [voiceDesc, setVoiceDesc] = useState("");
  const [openNewVoice, setOpenNewVoice] = useState(false);

  const [sampleVoiceId, setSampleVoiceId] = useState<string | null>(null);
  const [sampleTitle, setSampleTitle] = useState("");
  const [sampleContent, setSampleContent] = useState("");
  const [openNewSample, setOpenNewSample] = useState(false);

  const [expandedVoices, setExpandedVoices] = useState<Set<string>>(new Set());

  const handleAddVoice = () => {
    if (!voiceName.trim()) return;
    addVoice.mutate({ name: voiceName.trim(), description: voiceDesc.trim() || undefined }, {
      onSuccess: () => {
        setVoiceName("");
        setVoiceDesc("");
        setOpenNewVoice(false);
      },
    });
  };

  const handleAddSample = () => {
    if (!sampleContent.trim() || !sampleVoiceId) return;
    addSample.mutate({ title: sampleTitle.trim() || undefined, content: sampleContent.trim(), voice_id: sampleVoiceId }, {
      onSuccess: () => {
        setSampleTitle("");
        setSampleContent("");
        setOpenNewSample(false);
        setSampleVoiceId(null);
      },
    });
  };

  const openAddSample = (voiceId: string) => {
    setSampleVoiceId(voiceId);
    setOpenNewSample(true);
  };

  const toggleExpanded = (id: string) => {
    setExpandedVoices(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isLoading = loadingVoices || loadingSamples;

  const getSamplesForVoice = (voiceId: string) =>
    (allSamples ?? []).filter(s => s.voice_id === voiceId);

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mis Voces</h1>
          <p className="text-muted-foreground mt-1">
            Crea perfiles de voz con ejemplos de posts para que el generador imite tu estilo
          </p>
        </div>
        <Dialog open={openNewVoice} onOpenChange={setOpenNewVoice}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nueva voz
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Crear nueva voz</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label className="text-xs">Nombre</Label>
                <Input
                  placeholder="Ej: Profesional, Casual, Newsletter..."
                  value={voiceName}
                  onChange={(e) => setVoiceName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Descripción (opcional)</Label>
                <Input
                  placeholder="Breve descripción de esta voz..."
                  value={voiceDesc}
                  onChange={(e) => setVoiceDesc(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
              <Button onClick={handleAddVoice} disabled={!voiceName.trim() || addVoice.isPending}>
                {addVoice.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Crear
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Add sample dialog */}
      <Dialog open={openNewSample} onOpenChange={setOpenNewSample}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo ejemplo de voz</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs">Título (opcional)</Label>
              <Input
                placeholder="Ej: Post sobre liderazgo, Hilo viral..."
                value={sampleTitle}
                onChange={(e) => setSampleTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Contenido del post</Label>
              <Textarea
                placeholder="Pega aquí el post de ejemplo..."
                value={sampleContent}
                onChange={(e) => setSampleContent(e.target.value)}
                className="min-h-[200px]"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={handleAddSample} disabled={!sampleContent.trim() || addSample.isPending}>
              {addSample.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !voices?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Mic className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="font-medium text-foreground mb-1">Sin voces creadas</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Crea una voz y añade posts de ejemplo para que el generador aprenda tu estilo
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {voices.map((voice) => {
            const samples = getSamplesForVoice(voice.id);
            const isExpanded = expandedVoices.has(voice.id);
            return (
              <Card key={voice.id}>
                <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(voice.id)}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CollapsibleTrigger className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        <div className="text-left">
                          <CardTitle className="text-sm font-medium">{voice.name}</CardTitle>
                          {voice.description && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">{voice.description}</p>
                          )}
                        </div>
                      </CollapsibleTrigger>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-muted-foreground">{samples.length} ejemplo{samples.length !== 1 ? "s" : ""}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs gap-1 h-7"
                          onClick={() => openAddSample(voice.id)}
                        >
                          <Plus className="h-3 w-3" />
                          Añadir
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => deleteVoice.mutate(voice.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      {samples.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">
                          Añade ejemplos de posts para esta voz
                        </p>
                      ) : (
                        <div className="grid gap-3 sm:grid-cols-2">
                          {samples.map((sample) => (
                            <div key={sample.id} className="group relative rounded-lg border p-3">
                              <div className="flex items-start justify-between mb-1">
                                <span className="text-xs font-medium flex items-center gap-1.5 truncate">
                                  <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                                  {sample.title || "Sin título"}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                                  onClick={() => deleteSample.mutate(sample.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                              <p className="text-[11px] text-muted-foreground line-clamp-4 whitespace-pre-wrap leading-relaxed">
                                {sample.content}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
