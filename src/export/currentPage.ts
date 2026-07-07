import { exportVisibleCommentsFromDocument } from "./domFallback";
import { exportAllComments } from "./orchestrator";
import type { ExportArticle, ExportDocument } from "./types";
import { exportWechatAdminComments } from "../wechat/adminCommentExport";
import type { DiscoveredRequest } from "../wechat/requestDiscovery";

export interface ExportCurrentPageCommentsOptions {
  request: DiscoveredRequest | null;
  document: Document;
  article: ExportArticle;
  exportAll?: typeof exportAllComments;
}

export async function exportCurrentPageComments(options: ExportCurrentPageCommentsOptions): Promise<ExportDocument> {
  if (!options.request) {
    return exportVisibleCommentsFromDocument(options.document, options.article);
  }

  try {
    if (isWechatAdminCommentRequest(options.request)) {
      return await exportWechatAdminComments({
        initialRequest: options.request,
        article: options.article
      });
    }

    return await (options.exportAll ?? exportAllComments)({
      initialRequest: options.request,
      article: options.article
    });
  } catch (error) {
    if (!canFallbackToRenderedDom(error)) throw error;
    return exportVisibleCommentsFromDocument(options.document, options.article);
  }
}

function canFallbackToRenderedDom(error: unknown): boolean {
  return error instanceof Error && /comment list not found|response is not an object/i.test(error.message);
}

function isWechatAdminCommentRequest(request: DiscoveredRequest): boolean {
  try {
    const url = new URL(request.url, window.location.href);
    const action = url.searchParams.get("action") ?? "";
    return url.hostname === "mp.weixin.qq.com" && ["list_latest_comment", "list_comment"].includes(action);
  } catch {
    return false;
  }
}
