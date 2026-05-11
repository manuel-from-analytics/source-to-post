import { useState } from "react";
import { Plus, X, Tag, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  usePostLabels, useCreatePostLabel, useTogglePostLabel,
  usePostLabelAssignments, type PostLabel,
} from "@/hooks/usePostLabels";
import { useLanguage } from "@/i18n/LanguageContext";

const PRESET_COLORS = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316",
];

/** Mini-badge that shows a label's name + a date with the label color. Read-only. */
export function LabelPublishedDate({
  label,
  date,
}: {
  label: PostLabel;
  date: string;
}) {
  const formatted = new Date(date).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
  return (
    <span
      className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium leading-tight"
      style={{ borderColor: label.color ?? undefined, color: label.color ?? undefined }}
    >
      <Check className="h-2.5 w-2.5 shrink-0" />
      <span className="shrink-0">Publish</span>
      <span className="shrink-0 opacity-70">·</span>
      <span className="min-w-0 flex-1 truncate">{label.name}</span>
      <span className="shrink-0 opacity-70">·</span>
      <span className="shrink-0 whitespace-nowrap">{formatted}</span>
    </span>
  );
}

export function PostLabelBadge({
  label,
  onRemove,
  className = "",
}: {
  label: PostLabel;
  onRemove?: () => void;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={`inline-flex max-w-full items-center gap-1 overflow-hidden text-xs ${className}`}
      style={{ borderColor: label.color ?? undefined, color: label.color ?? undefined }}
    >
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: label.color ?? "#3b82f6" }}
      />
      <span className="max-w-[8rem] truncate sm:max-w-[12rem]">{label.name}</span>
      {onRemove && (
        <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="ml-0.5 hover:opacity-70">
          <X className="h-3 w-3" />
        </button>
      )}
    </Badge>
  );
}

export function PostLabelPicker({ postId }: { postId: string }) {
  const { t } = useLanguage();
  const { data: labels } = usePostLabels();
  const { data: assignedIds } = usePostLabelAssignments(postId);
  const createLabel = useCreatePostLabel();
  const toggleLabel = useTogglePostLabel();
  const [newName, setNewName] = useState("");
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);
  const [open, setOpen] = useState(false);

  const handleToggle = (labelId: string) => {
    const assigned = (assignedIds ?? []).includes(labelId);
    toggleLabel.mutate({ postId, labelId, assigned });
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const result = await createLabel.mutateAsync({ name: newName.trim(), color: selectedColor });
    toggleLabel.mutate({ postId, labelId: result.id, assigned: false });
    setNewName("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground">
          <Tag className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="end" onClick={(e) => e.stopPropagation()}>
        <p className="text-xs font-medium text-muted-foreground mb-2 px-1">Labels</p>
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {(labels ?? []).map((lbl) => {
            const isAssigned = (assignedIds ?? []).includes(lbl.id);
            return (
              <button
                key={lbl.id}
                onClick={() => handleToggle(lbl.id)}
                className={`w-full flex items-center gap-2 text-left text-sm px-2 py-1.5 rounded hover:bg-secondary transition-colors ${
                  isAssigned ? "bg-secondary font-medium" : ""
                }`}
              >
                <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: lbl.color ?? "#3b82f6" }} />
                {lbl.name}
              </button>
            );
          })}
        </div>
        <div className="border-t mt-2 pt-2 space-y-2">
          <Input
            placeholder="Nueva label…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            className="h-8 text-xs"
          />
          <div className="flex gap-1 flex-wrap px-1">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setSelectedColor(c)}
                className={`h-5 w-5 rounded-full border-2 transition-all ${
                  selectedColor === c ? "border-foreground scale-110" : "border-transparent"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          {newName.trim() && (
            <Button size="sm" className="w-full h-7 text-xs" onClick={handleCreate} disabled={createLabel.isPending}>
              Crear "{newName.trim()}"
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function PostLabelFilter({
  selectedLabelId,
  onSelect,
}: {
  selectedLabelId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const { data: labels } = usePostLabels();

  if (!labels?.length) return null;

  return (
    <div className="flex min-w-0 flex-wrap gap-1.5">
      {labels.map((lbl) => (
        <button
          key={lbl.id}
          onClick={() => onSelect(lbl.id === selectedLabelId ? null : lbl.id)}
          className={`flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
            lbl.id === selectedLabelId ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-secondary"
          }`}
        >
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: lbl.id === selectedLabelId ? "currentColor" : (lbl.color ?? "#3b82f6") }} />
          <span className="max-w-[8rem] truncate sm:max-w-[12rem]">{lbl.name}</span>
        </button>
      ))}
    </div>
  );
}
