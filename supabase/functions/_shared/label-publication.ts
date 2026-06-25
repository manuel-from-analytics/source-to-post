// Helper: record a per-label publication for a post after publishing.
// Auto-creates the user's personal/company label if it doesn't exist,
// auto-assigns it to the post, and upserts the publication date.

export type LabelKind = "personal" | "company";

const DEFAULT_NAMES: Record<LabelKind, { name: string; color: string }> = {
  personal: { name: "Personal", color: "#3b82f6" },
  company: { name: "Empresa", color: "#8b5cf6" },
};

export async function recordLabelPublication(
  admin: any,
  userId: string,
  postId: string,
  kind: LabelKind,
  publishedAt: string,
): Promise<void> {
  // 1) Find existing label of this kind for the user
  let { data: label } = await admin
    .from("post_labels")
    .select("id")
    .eq("user_id", userId)
    .eq("kind", kind)
    .maybeSingle();

  // 2) Create if missing
  if (!label) {
    const defaults = DEFAULT_NAMES[kind];
    const { data: created, error: createErr } = await admin
      .from("post_labels")
      .insert({
        user_id: userId,
        name: defaults.name,
        color: defaults.color,
        kind,
      })
      .select("id")
      .single();
    if (createErr) {
      console.error("create label failed", createErr);
      return;
    }
    label = created;
  }

  // 3) Assign label to post if not already assigned
  const { data: existingAssign } = await admin
    .from("post_label_assignments")
    .select("post_id")
    .eq("post_id", postId)
    .eq("label_id", label.id)
    .maybeSingle();
  if (!existingAssign) {
    await admin
      .from("post_label_assignments")
      .insert({ post_id: postId, label_id: label.id });
  }

  // 4) Insert publication if not already recorded
  const { data: existingPub } = await admin
    .from("post_label_publications")
    .select("post_id")
    .eq("post_id", postId)
    .eq("label_id", label.id)
    .maybeSingle();
  if (!existingPub) {
    await admin
      .from("post_label_publications")
      .insert({ post_id: postId, label_id: label.id, published_at: publishedAt });
  }
}
