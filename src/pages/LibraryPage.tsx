import { useState, useRef } from "react";
import {
  Plus, Search, Star, FileText,
  Youtube, File,
  Upload, Globe, Type, Trash2, Loader2
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
import { useInputs, useCreateInput, useToggleFavorite, useDeleteInput, type InputRow } from "@/hooks/useInputs";
import { useCategories, type CategoryRow } from "@/hooks/useCategories";
import { CategoryBadge, CategoryPicker, CategoryFilter } from "@/components/CategoryWidgets";

const typeIcons: Record<string, React.ElementType> = {
  pdf: File,
  url: Globe,
  youtube: Youtube,
  text: Type,
};

const typeLabels: Record<string, string> = {
  pdf: "PDF",
  url: "URL",
  youtube: "YouTube",
  text: "Texto",
};

const typeColors: Record<string, string> = {
  pdf: "bg-destructive/10 text-destructive",
  url: "bg-primary/10 text-primary",
  youtube: "bg-destructive/10 text-destructive",
  text: "bg-accent/10 text-accent-foreground",
};

export default function LibraryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategoryId, setFilterCategoryId] = useState<string | null>(null);
  const [newInputOpen, setNewInputOpen] = useState(false);
  const [newInputType, setNewInputType] = useState("url");

  // Form state
  const [urlValue, setUrlValue] = useState("");
  const [titleValue, setTitleValue] = useState("");
  const [textContent, setTextContent] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: inputs, isLoading } = useInputs();
  const { data: categories } = useCategories();
  const createInput = useCreateInput();
  const toggleFavorite = useToggleFavorite();
  const deleteInput = useDeleteInput();

  const categoriesMap = new Map((categories ?? []).map((c) => [c.id, c]));

  const filteredInputs = (inputs ?? [])
    .filter((input) => input.title.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter((input) => !filterCategoryId || input.category_id === filterCategoryId);

  const resetForm = () => {
    setUrlValue("");
    setTitleValue("");
    setTextContent("");
    setSelectedFile(null);
  };

  const handleSave = async () => {
    if (newInputType === "url" || newInputType === "youtube") {
      if (!urlValue.trim()) return;
      await createInput.mutateAsync({
        title: titleValue.trim() || urlValue.trim(),
        type: newInputType === "youtube" ? "youtube" : "url",
        original_url: urlValue.trim(),
      });
    } else if (newInputType === "pdf") {
      if (!selectedFile) return;
      await createInput.mutateAsync({
        title: titleValue.trim() || selectedFile.name,
        type: "pdf",
        file: selectedFile,
      });
    } else if (newInputType === "text") {
      if (!titleValue.trim() || !textContent.trim()) return;
      await createInput.mutateAsync({
        title: titleValue.trim(),
        type: "text",
        raw_content: textContent.trim(),
      });
    }
    resetForm();
    setNewInputOpen(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setSelectedFile(file);
      if (!titleValue) setTitleValue(file.name.replace(/\.pdf$/i, ""));
    }
  };

  return (
    <div className="mx-auto max-w-5xl min-w-0 space-y-4 overflow-hidden p-3 sm:space-y-6 sm:p-4 lg:p-8">
      {/* Header */}
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Biblioteca</h1>
          <p className="text-sm text-muted-foreground">
            {inputs?.length ?? 0} fuentes guardadas
          </p>
        </div>
        <Dialog open={newInputOpen} onOpenChange={(open) => { setNewInputOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="shrink-0 gap-1.5">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Añadir fuente</span>
              <span className="sm:hidden">Añadir</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Añadir nueva fuente</DialogTitle>
              <DialogDescription>Selecciona el tipo de fuente que quieres guardar</DialogDescription>
            </DialogHeader>
            <Tabs value={newInputType} onValueChange={setNewInputType}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="url" className="text-xs px-1">
                  <Globe className="h-3.5 w-3.5 sm:mr-1" />
                  <span className="hidden sm:inline">URL</span>
                </TabsTrigger>
                <TabsTrigger value="youtube" className="text-xs px-1">
                  <Youtube className="h-3.5 w-3.5 sm:mr-1" />
                  <span className="hidden sm:inline">YouTube</span>
                </TabsTrigger>
                <TabsTrigger value="pdf" className="text-xs px-1">
                  <File className="h-3.5 w-3.5 sm:mr-1" />
                  <span className="hidden sm:inline">PDF</span>
                </TabsTrigger>
                <TabsTrigger value="text" className="text-xs px-1">
                  <Type className="h-3.5 w-3.5 sm:mr-1" />
                  <span className="hidden sm:inline">Texto</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="url" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>URL del artículo</Label>
                  <Input placeholder="https://ejemplo.com/articulo" value={urlValue} onChange={e => setUrlValue(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Título (opcional)</Label>
                  <Input placeholder="Se usará la URL si no lo indicas" value={titleValue} onChange={e => setTitleValue(e.target.value)} />
                </div>
              </TabsContent>

              <TabsContent value="youtube" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>URL del video de YouTube</Label>
                  <Input placeholder="https://youtube.com/watch?v=..." value={urlValue} onChange={e => setUrlValue(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Título (opcional)</Label>
                  <Input placeholder="Se usará la URL si no lo indicas" value={titleValue} onChange={e => setTitleValue(e.target.value)} />
                </div>
              </TabsContent>

              <TabsContent value="pdf" className="space-y-4 mt-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <div
                  className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                  {selectedFile ? (
                    <>
                      <p className="text-sm font-medium">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{(selectedFile.size / 1024 / 1024).toFixed(1)} MB</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium">Arrastra tu PDF aquí</p>
                      <p className="text-xs text-muted-foreground mt-1">o haz clic para seleccionar (máx. 20MB)</p>
                    </>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Título (opcional)</Label>
                  <Input placeholder="Se usará el nombre del archivo" value={titleValue} onChange={e => setTitleValue(e.target.value)} />
                </div>
              </TabsContent>

              <TabsContent value="text" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Título</Label>
                  <Input placeholder="Título de tu nota" value={titleValue} onChange={e => setTitleValue(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Contenido</Label>
                  <Textarea placeholder="Escribe o pega tu texto aquí..." rows={6} value={textContent} onChange={e => setTextContent(e.target.value)} />
                </div>
              </TabsContent>
            </Tabs>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setNewInputOpen(false); resetForm(); }}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={createInput.isPending}>
                {createInput.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</>
                ) : "Guardar fuente"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search + category filter */}
      <div className="min-w-0 space-y-2">
        <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar fuentes..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-9 pl-9 text-sm" />
        </div>
        <CategoryFilter selectedCategoryId={filterCategoryId} onSelect={setFilterCategoryId} />
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && filteredInputs.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-10 w-10 text-muted-foreground/50 mb-4" />
            <h3 className="font-semibold mb-1">
              {searchQuery ? "Sin resultados" : "Tu biblioteca está vacía"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchQuery
                ? "Intenta con otra búsqueda"
                : "Añade tu primera fuente para empezar a generar contenido"}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Input cards */}
      <div className="space-y-2">
        {filteredInputs.map((input) => {
          const Icon = typeIcons[input.type] || FileText;
          return (
             <Card key={input.id} className="group overflow-hidden transition-colors hover:border-primary/20">
              <CardContent className="p-2.5 sm:p-4">
                <div className="flex items-start gap-2.5">
                  <Link to={`/library/${input.id}`} className="flex min-w-0 flex-1 items-start gap-2.5">
                    <div className={`rounded-md p-1.5 mt-0.5 flex-shrink-0 ${typeColors[input.type] ?? "bg-secondary"}`}>
                       <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                       <h3 className="text-[13px] font-medium leading-snug break-words [overflow-wrap:anywhere]">{input.title}</h3>
                      {input.summary && (
                         <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground break-words [overflow-wrap:anywhere]">{input.summary}</p>
                      )}
                       <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5">
                        <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${input.type === "youtube" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : ""}`}>
                          {input.type === "youtube" && <Youtube className="h-2.5 w-2.5 mr-0.5" />}
                          {typeLabels[input.type] ?? input.type}
                        </Badge>
                        {input.category_id && categoriesMap.get(input.category_id) && (
                          <CategoryBadge category={categoriesMap.get(input.category_id)!} />
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(input.created_at).toLocaleDateString("es")}
                        </span>
                      </div>
                    </div>
                  </Link>
                  <div className="flex shrink-0 items-center gap-0">
                    <CategoryPicker inputId={input.id} currentCategoryId={input.category_id} />
                    <button
                      onClick={(e) => { e.preventDefault(); toggleFavorite.mutate({ id: input.id, is_favorite: !input.is_favorite }); }}
                      className="p-1 rounded-md hover:bg-secondary transition-colors"
                    >
                      <Star className={`h-3.5 w-3.5 ${input.is_favorite ? "text-accent fill-accent" : "text-muted-foreground"}`} />
                    </button>
                    <button
                      onClick={(e) => { e.preventDefault(); deleteInput.mutate(input); }}
                      className="p-1 rounded-md hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
