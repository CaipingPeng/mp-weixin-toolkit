import type { ExportArticle, ExportDocument, NormalizedComment } from "./types";

export function buildExportDocument(input: {
  article: ExportArticle;
  comments: NormalizedComment[];
  exportedAt?: string;
  completed?: boolean;
}): ExportDocument {
  const counts = countComments(input.comments);

  return {
    schema_version: 1,
    exported_at: input.exportedAt ?? new Date().toISOString(),
    source: "wechat_mp_comment_admin",
    article: input.article,
    export: {
      scope: "current_article_all_comments",
      comment_count: counts.total,
      root_comment_count: input.comments.length,
      reply_count: counts.replies,
      completed: input.completed ?? true
    },
    comments: input.comments
  };
}

function countComments(comments: NormalizedComment[]): { total: number; replies: number } {
  let total = 0;
  let replies = 0;

  function visit(comment: NormalizedComment, isReply: boolean): void {
    total += 1;
    if (isReply) replies += 1;
    for (const reply of comment.replies) visit(reply, true);
  }

  for (const comment of comments) visit(comment, false);
  return { total, replies };
}
