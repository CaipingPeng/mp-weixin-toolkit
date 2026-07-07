import { buildExportDocument } from "./document";
import { normalizeRawComment } from "./normalizer";
import { buildCommentTree } from "./tree";
import type { ExportArticle, ExportDocument } from "./types";
import { parseCommentPage } from "../wechat/responseParser";

export function exportVisibleCommentsFromDocument(
  document: Document,
  article: ExportArticle,
  now: () => string = () => new Date().toISOString()
): ExportDocument {
  const visibleCount =
    document.querySelectorAll(
      "#commentlist > div > .comment-list__item:not(.comment-reply), .comment-list-wrp > .comment-list__item:not(.comment-reply)"
    ).length || 1;
  const page = parseCommentPage(document.documentElement.outerHTML, { offset: 0, count: visibleCount });
  const normalized = page.records.map(normalizeRawComment);
  const comments = buildCommentTree(normalized);
  const completed = page.total !== null ? page.records.length >= page.total : true;

  return buildExportDocument({
    article,
    comments,
    exportedAt: now(),
    completed
  });
}
