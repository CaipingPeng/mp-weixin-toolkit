import type { NormalizedComment } from "./types";

export function buildCommentTree(flatComments: NormalizedComment[]): NormalizedComment[] {
  const byId = new Map<string, NormalizedComment>();
  const roots: NormalizedComment[] = [];

  for (const comment of flatComments) {
    if (!comment.id) continue;
    byId.set(comment.id, { ...comment, metadata: { ...comment.metadata }, replies: [] });
  }

  for (const comment of byId.values()) {
    if (!comment.parent_id) {
      roots.push(comment);
      continue;
    }

    const parent = byId.get(comment.parent_id);
    if (parent) {
      parent.replies.push(comment);
    } else {
      comment.metadata.orphan_parent_id = comment.parent_id;
      roots.push(comment);
    }
  }

  return roots;
}
