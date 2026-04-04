import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  useCategories, useCreateCategory, useDeleteCategory, useAssignCategory,
  type CategoryRow,
} from "@/hooks/useCategories";

const PRESET_COLORS = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316",
];

/* ───── Pill that represents a single category ───── */
export function CategoryBadge({
  category,
  onRemove,
  className = "",
}: {
  category: CategoryRow;
  onRemove?: () => void;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={`inline-flex max-w-full items-center gap-1 overflow-hidden text-xs ${className}`}
      style={{ borderColor: category.color ?? undefined, color: category.color ?? undefined }}
    >
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: category.color ?? "#3b82f6" }}
      />
      <span className="max-w-[8rem] truncate sm:max-w-[12rem]">{category.name}</span>
      {onRemove && (
        <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="ml-0.5 hover:opacity-70">
          <X className="h-3 w-3" />
        </button>
      )}
    </Badge>
  );
}

/* ───── Popover to assign / create categories on an input ───── */
export function CategoryPicker({
  inputId,
  currentCategoryId,
}: {
  inputId: string;
  currentCategoryId: string | null;
}) {
  const { data: categories } = useCategories();
  const createCategory = useCreateCategory();
  const assignCategory = useAssignCategory();
  const [newName, setNewName] = useState("");
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);
  const [open, setOpen] = useState(false);

  const handleAssign = (catId: string) => {
    assignCategory.mutate({ inputId, categoryId: catId === currentCategoryId ? null : catId });
    setOpen(false);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const result = await createCategory.mutateAsync({ name: newName.trim(), color: selectedColor });
    assignCategory.mutate({ inputId, categoryId: result.id });
    setNewName("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground">
          <Plus className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="end" onClick={(e) => e.stopPropagation()}>
        <p className="text-xs font-medium text-muted-foreground mb-2 px-1">Categorías</p>
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {(categories ?? []).map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleAssign(cat.id)}
              className={`w-full flex items-center gap-2 text-left text-sm px-2 py-1.5 rounded hover:bg-secondary transition-colors ${
                cat.id === currentCategoryId ? "bg-secondary font-medium" : ""
              }`}
            >
              <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color ?? "#3b82f6" }} />
              {cat.name}
            </button>
          ))}
        </div>
        <div className="border-t mt-2 pt-2 space-y-2">
          <Input
            placeholder="Nueva categoría…"
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
            <Button size="sm" className="w-full h-7 text-xs" onClick={handleCreate} disabled={createCategory.isPending}>
              Crear "{newName.trim()}"
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ───── Horizontal filter bar ───── */
export function CategoryFilter({
  selectedCategoryId,
  onSelect,
}: {
  selectedCategoryId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const { data: categories } = useCategories();

  if (!categories?.length) return null;

  return (
    <div className="flex min-w-0 flex-wrap gap-1.5">
      <button
        onClick={() => onSelect(null)}
        className={`max-w-full rounded-full border px-2.5 py-1 text-xs transition-colors ${
          !selectedCategoryId ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-secondary"
        }`}
      >
        Todas
      </button>
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onSelect(cat.id === selectedCategoryId ? null : cat.id)}
          className={`flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
            cat.id === selectedCategoryId ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-secondary"
          }`}
        >
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: cat.id === selectedCategoryId ? "currentColor" : (cat.color ?? "#3b82f6") }} />
          <span className="max-w-[8rem] truncate sm:max-w-[12rem]">{cat.name}</span>
        </button>
      ))}
    </div>
  );
}
