import { buildExportDocument } from "../export/document";
import { normalizeRawComment } from "../export/normalizer";
import { buildCommentTree } from "../export/tree";
import type { ExportArticle, ExportDocument } from "../export/types";
import { fetchWechatCommentPage } from "./apiClient";
import type { DiscoveredRequest } from "./requestDiscovery";

interface ExportWechatAdminCommentsOptions {
  initialRequest: DiscoveredRequest;
  article: ExportArticle;
  count?: number;
  replyCount?: number;
  fetchPage?: (request: DiscoveredRequest) => Promise<unknown>;
  now?: () => string;
}

export async function exportWechatAdminComments(options: ExportWechatAdminCommentsOptions): Promise<ExportDocument> {
  const fetchPage = options.fetchPage ?? fetchWechatCommentPage;
  const count = options.count ?? 10;
  const replyCount = options.replyCount ?? 10;

  const selected = await resolveSelectedArticle(options.initialRequest, fetchPage, options.article);
  const articleCommentId = selected.commentId;
  if (!articleCommentId) throw new Error("Comment request did not identify the current article.");

  const rawRecords: Record<string, unknown>[] = [];
  let totalRoots: number | null = null;
  let shieldedRoots = 0;

  for (let begin = 0; ; begin += count) {
    const response = await fetchPage(buildListCommentRequest(options.initialRequest, articleCommentId, begin, count, "0"));
    assertBaseResponse(response);
    const page = parseJsonStringField(response, "comment_list");
    const roots = asArray(page.comment).filter(isRecord);
    totalRoots = readNumber(page.total_count);
    shieldedRoots = Math.max(shieldedRoots, readNumber(page.total_shield_count) ?? 0);

    for (const root of roots) {
      rawRecords.push(rootToRecord(root));
      rawRecords.push(...(await collectReplyRecords(root, options.initialRequest, fetchPage, replyCount)));
    }

    if (roots.length < count) break;
    const visibleRoots = totalRoots === null ? null : Math.max(0, totalRoots - shieldedRoots);
    if (visibleRoots !== null && begin + roots.length >= visibleRoots) break;
  }

  const normalized = rawRecords.map(normalizeRawComment);
  const comments = buildCommentTree(normalized);
  const exportableRoots = totalRoots === null ? null : Math.max(0, totalRoots - shieldedRoots);

  return buildExportDocument({
    article: {
      ...options.article,
      id: options.article.id || articleCommentId,
      title: options.article.title || selected.title
    },
    comments,
    exportedAt: (options.now ?? (() => new Date().toISOString()))(),
    completed: exportableRoots === null ? true : comments.length >= exportableRoots
  });
}

async function resolveSelectedArticle(
  initialRequest: DiscoveredRequest,
  fetchPage: (request: DiscoveredRequest) => Promise<unknown>,
  article: ExportArticle
): Promise<{ commentId: string; title: string }> {
  if (readQueryParam(initialRequest.url, "action") === "list_comment") {
    return {
      commentId: readQueryParam(initialRequest.url, "comment_id"),
      title: article.title
    };
  }

  const latestPage = await fetchPage(withJsonParams(initialRequest));
  assertBaseResponse(latestPage);

  const selected = readSelectedArticle(latestPage);
  return {
    commentId: selected.commentId || readQueryParam(initialRequest.url, "comment_id"),
    title: selected.title
  };
}

async function collectReplyRecords(
  root: Record<string, unknown>,
  initialRequest: DiscoveredRequest,
  fetchPage: (request: DiscoveredRequest) => Promise<unknown>,
  count: number
): Promise<Record<string, unknown>[]> {
  const parentId = readString(root.content_id);
  const articleCommentId = readString(root.comment_id);
  const replyContainer = isRecord(root.new_reply) ? root.new_reply : isRecord(root.reply) ? root.reply : {};
  const total = readNumber(replyContainer.reply_total_cnt) ?? readNumber(replyContainer.reply_count) ?? 0;
  const seen = new Set<string>();
  const output: Record<string, unknown>[] = [];

  for (const reply of asArray(replyContainer.reply_list).filter(isRecord)) {
    const record = replyToRecord(reply, parentId);
    if (record.comment_id && !seen.has(String(record.comment_id))) {
      seen.add(String(record.comment_id));
      output.push(record);
    }
  }

  let maxReplyId = readNumber(replyContainer.max_reply_id) ?? 0;
  while (output.length < total && maxReplyId > 0) {
    const response = await fetchPage(buildReplyRequest(initialRequest, articleCommentId, parentId, count, maxReplyId));
    assertBaseResponse(response);
    const replyList = isRecord(response) && isRecord(response.reply_list) ? response.reply_list : {};
    for (const reply of asArray(replyList.reply_list).filter(isRecord)) {
      const record = replyToRecord(reply, parentId);
      if (record.comment_id && !seen.has(String(record.comment_id))) {
        seen.add(String(record.comment_id));
        output.push(record);
      }
    }
    maxReplyId = readNumber(replyList.max_reply_id) ?? 0;
    if (!readBoolean((response as Record<string, unknown>).continue_flag)) break;
  }

  return output;
}

function readSelectedArticle(response: unknown): { commentId: string; title: string } {
  const appMsgList = parseJsonStringField(response, "app_msg_list");
  const first = asArray(appMsgList.app_msg).find(isRecord) ?? {};
  const item = isRecord(first.item) ? first.item : {};
  return {
    commentId: readString(item.comment_id) || readString(first.comment_id),
    title: readString(item.title) || readString(first.title)
  };
}

function buildListCommentRequest(
  initialRequest: DiscoveredRequest,
  commentId: string,
  begin: number,
  count: number,
  type: string
): DiscoveredRequest {
  return {
    ...initialRequest,
    method: "GET",
    url: buildUrl(initialRequest.url, {
      action: "list_comment",
      begin: String(begin),
      count: String(count),
      comment_id: commentId,
      filtertype: "0",
      day: "0",
      type,
      max_id: "0",
      f: "json",
      ajax: "1"
    })
  };
}

function buildReplyRequest(
  initialRequest: DiscoveredRequest,
  articleCommentId: string,
  contentId: string,
  count: number,
  maxReplyId: number
): DiscoveredRequest {
  return {
    ...initialRequest,
    method: "GET",
    url: buildUrl(initialRequest.url, {
      action: "get_comment_reply",
      comment_id: articleCommentId,
      content_id: contentId,
      limit: String(count),
      max_reply_id: String(maxReplyId),
      clear_unread: "0",
      f: "json",
      ajax: "1"
    })
  };
}

function withJsonParams(request: DiscoveredRequest): DiscoveredRequest {
  return {
    ...request,
    method: "GET",
    url: buildUrl(request.url, { f: "json", ajax: "1" })
  };
}

function buildUrl(base: string, params: Record<string, string>): string {
  const url = new URL(base, window.location.href);
  url.pathname = "/misc/appmsgcomment";
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

function rootToRecord(root: Record<string, unknown>): Record<string, unknown> {
  return {
    ...root,
    comment_id: readString(root.content_id),
    article_comment_id: readString(root.comment_id),
    avatar_url: readString(root.icon),
    create_time: root.post_time,
    reply_count: readNumber(isRecord(root.new_reply) ? root.new_reply.reply_total_cnt : undefined) ?? 0
  };
}

function replyToRecord(reply: Record<string, unknown>, parentId: string): Record<string, unknown> {
  return {
    ...reply,
    comment_id: `${parentId}:reply:${readString(reply.reply_id)}`,
    raw_reply_id: readString(reply.reply_id),
    parent_id: parentId,
    avatar_url: readString(reply.logo_url),
    like_num: readNumber(reply.reply_like_num) ?? 0,
    status: readNumber(reply.reply_is_elected) === 1 ? "elected" : ""
  };
}

function parseJsonStringField(response: unknown, key: string): Record<string, unknown> {
  if (!isRecord(response)) throw new Error("Unexpected comment response: response is not an object");
  const raw = response[key];
  if (isRecord(raw)) return raw;
  if (typeof raw !== "string") throw new Error(`Unexpected comment response: ${key} not found`);
  const parsed = JSON.parse(raw);
  if (!isRecord(parsed)) throw new Error(`Unexpected comment response: ${key} is not an object`);
  return parsed;
}

function assertBaseResponse(response: unknown): void {
  if (!isRecord(response) || !isRecord(response.base_resp)) return;
  const ret = Number(response.base_resp.ret);
  if (ret === 0) return;
  const message = typeof response.base_resp.err_msg === "string" ? response.base_resp.err_msg : "unexpected response";
  throw new Error(`Stopped by session, risk, or unexpected API response: ret=${ret} ${message}`);
}

function readQueryParam(url: string, key: string): string {
  try {
    return new URL(url, window.location.href).searchParams.get(key) ?? "";
  } catch {
    return "";
  }
}

function readString(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function readBoolean(value: unknown): boolean {
  return value === true || value === 1 || value === "1";
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
