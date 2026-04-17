import { useState } from "react";
import { Plus, Pencil, Trash2, Check, X, Loader2, StickyNote } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  useInputNotes, useCreateInputNote,
  useUpdateInputNote, useDeleteInputNote,
} from "@/hooks/useInputNotes";
import { useLanguage } from "@/i18n/LanguageContext";

interface Props {
  inputId: string;
}

export function InputNotes({ inputId }: Props) {
  const { t } = useLanguage();
  const { data: notes, isLoading } = useInputNotes(inputId);
  const createNote = useCreateInputNote();
  const updateNote = useUpdateInputNote();
  const deleteNote = useDeleteInputNote();

  const [adding, setAdding] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  const handleAdd = async () => {
    if (!newContent.trim()) return;
    await createNote.mutateAsync({ input_id: inputId, content: newContent.trim() });
    setNewContent("");
    setAdding(false);
  };

  const startEdit = (id: string, content: string) => {
    setEditingId(id);
    setEditContent(content);
  };

  const handleUpdate = async () => {
    if (!editingId || !editContent.trim()) return;
    await updateNote.mutateAsync({ id: editingId, content: editContent.trim() });
    setEditingId(null);
    setEditContent("");
  };

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="pb-2 px-3 sm:px-6">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <StickyNote className="h-3.5 w-3.5" />
            {t("inputNotes.title")}
            {notes && notes.length > 0 && (
              <span className="text-xs">({notes.length})</span>
            )}
          </CardTitle>
          {!adding && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAdding(true)}
              className="gap-1.5 text-xs flex-shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              {t("inputNotes.add")}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-3 sm:px-6 space-y-2">
        {adding && (
          <div className="space-y-2 rounded-md border p-2.5 bg-secondary/30">
            <Textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder={t("inputNotes.placeholder")}
              className="min-h-[70px] text-sm"
              autoFocus
            />
            <div className="flex justify-end gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setAdding(false); setNewContent(""); }}
                className="text-xs gap-1"
              >
                <X className="h-3.5 w-3.5" />
                {t("inputNotes.cancel")}
              </Button>
              <Button
                size="sm"
                onClick={handleAdd}
                disabled={!newContent.trim() || createNote.isPending}
                className="text-xs gap-1"
              >
                {createNote.isPending
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Check className="h-3.5 w-3.5" />}
                {t("inputNotes.save")}
              </Button>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="flex justify-center py-3">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && (!notes || notes.length === 0) && !adding && (
          <p className="text-xs text-muted-foreground italic py-1">
            {t("inputNotes.empty")}
          </p>
        )}

        {notes?.map((note) => (
          <div key={note.id} className="rounded-md border p-2.5 bg-card group">
            {editingId === note.id ? (
              <div className="space-y-2">
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="min-h-[70px] text-sm"
                  autoFocus
                />
                <div className="flex justify-end gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setEditingId(null); setEditContent(""); }}
                    className="text-xs gap-1"
                  >
                    <X className="h-3.5 w-3.5" />
                    {t("inputNotes.cancel")}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleUpdate}
                    disabled={!editContent.trim() || updateNote.isPending}
                    className="text-xs gap-1"
                  >
                    {updateNote.isPending
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Check className="h-3.5 w-3.5" />}
                    {t("inputNotes.save")}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm leading-relaxed break-words [overflow-wrap:anywhere] whitespace-pre-wrap">
                  {note.content}
                </p>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(note.created_at).toLocaleDateString()}
                    {note.updated_at !== note.created_at && ` · ${t("inputNotes.edited")}`}
                  </span>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => startEdit(note.id, note.content)}
                      className="p-1 rounded hover:bg-secondary text-muted-foreground"
                      aria-label={t("inputNotes.edit")}
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => deleteNote.mutate({ id: note.id, input_id: inputId })}
                      className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                      aria-label={t("inputNotes.delete")}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
