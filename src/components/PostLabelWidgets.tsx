import { Check, User as UserIcon, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  usePostLabels, useTogglePostLabel, useEnsureCanonicalLabel,
  usePostLabelAssignments,
  type PostLabel, type PostLabelKind,
} from "@/hooks/usePostLabels";
import { useLanguage } from "@/i18n/LanguageContext";

const KIND_META: Record<"personal" | "company", { labelKey: string; color: string; Icon: typeof UserIcon }> = {
  personal: { labelKey: "performance.personal", color: "#3b82f6", Icon: UserIcon },
  company:  { labelKey: "performance.company",  color: "#8b5cf6", Icon: Building2 },
};

const KINDS: ("personal" | "company")[] = ["personal", "company"];

/** Mini-badge that shows a label's name + a date with the label color. Read-only. */
export function LabelPublishedDate({
  label,
  date,
}: {
  label: PostLabel;
  date: string;
}) {
  const { t } = useLanguage();
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
      <span className="shrink-0">{t("common.published")}</span>
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
  const meta = label.kind && label.kind !== "other" ? KIND_META[label.kind] : null;
  const Icon = meta?.Icon;
  return (
    <Badge
      variant="outline"
      className={`inline-flex max-w-full items-center gap-1 overflow-hidden text-xs ${className}`}
      style={{ borderColor: label.color ?? undefined, color: label.color ?? undefined }}
    >
      {Icon ? <Icon className="h-3 w-3 shrink-0" /> : (
        <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: label.color ?? "#3b82f6" }} />
      )}
      <span className="max-w-[8rem] truncate sm:max-w-[12rem]">{label.name}</span>
      {onRemove && (
        <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="ml-0.5 hover:opacity-70">
          ×
        </button>
      )}
    </Badge>
  );
}

/**
 * Two-pill toggle: Personal / Empresa. Auto-creates the canonical label on first click.
 * Replaces the old free-text label picker.
 */
export function PostLabelPicker({ postId }: { postId: string }) {
  const { t } = useLanguage();
  const { data: labels } = usePostLabels();
  const { data: assignedIds } = usePostLabelAssignments(postId);
  const toggleLabel = useTogglePostLabel();
  const ensure = useEnsureCanonicalLabel();

  const handleClick = async (kind: "personal" | "company") => {
    let label = (labels ?? []).find((l) => l.kind === kind);
    if (!label) label = await ensure.mutateAsync(kind);
    const assigned = (assignedIds ?? []).includes(label.id);
    toggleLabel.mutate({ postId, labelId: label.id, assigned });
  };

  return (
    <div className="inline-flex items-center gap-1">
      {KINDS.map((kind) => {
        const lbl = (labels ?? []).find((l) => l.kind === kind);
        const isAssigned = !!lbl && (assignedIds ?? []).includes(lbl.id);
        const meta = KIND_META[kind];
        const Icon = meta.Icon;
        const labelText = t(meta.labelKey);
        return (
          <button
            key={kind}
            type="button"
            onClick={(e) => { e.stopPropagation(); handleClick(kind); }}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
              isAssigned ? "text-white" : "text-muted-foreground hover:bg-secondary"
            }`}
            style={
              isAssigned
                ? { backgroundColor: meta.color, borderColor: meta.color }
                : { borderColor: undefined }
            }
            title={isAssigned ? `${t("common.removeLabel")} ${labelText}` : `${t("common.markAsLabel")} ${labelText}`}
          >
            <Icon className="h-3 w-3" />
            <span>{labelText}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Filter pills for listings: Personal / Empresa. */
export function PostLabelFilter({
  selectedLabelId,
  onSelect,
}: {
  selectedLabelId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const { t } = useLanguage();
  const { data: labels } = usePostLabels();
  const available = KINDS
    .map((kind) => ({ kind, label: (labels ?? []).find((l) => l.kind === kind) }))
    .filter((x) => !!x.label) as { kind: "personal" | "company"; label: PostLabel }[];

  if (available.length === 0) return null;

  return (
    <div className="flex min-w-0 flex-wrap gap-1.5">
      {available.map(({ kind, label }) => {
        const meta = KIND_META[kind];
        const Icon = meta.Icon;
        const active = label.id === selectedLabelId;
        return (
          <button
            key={label.id}
            onClick={() => onSelect(active ? null : label.id)}
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
              active ? "text-white" : "hover:bg-secondary"
            }`}
            style={active ? { backgroundColor: meta.color, borderColor: meta.color } : {}}
          >
            <Icon className="h-3 w-3" />
            <span>{t(meta.labelKey)}</span>
          </button>
        );
      })}
    </div>
  );
}

// Re-export for backwards compatibility (kept so other files don't need updates)
export type { PostLabelKind };
