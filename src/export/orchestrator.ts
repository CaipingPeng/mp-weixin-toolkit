import { buildExportDocument } from "./document";
import { normalizeRawComment } from "./normalizer";
import { buildCommentTree } from "./tree";
import type { ExportArticle, ExportDocument } from "./types";
import { fetchWechatCommentPage, withPagination } from "../wechat/apiClient";
import { parseCommentPage } from "../wechat/responseParser";
import type { DiscoveredRequest } from "../wechat/requestDiscovery";

export interface ExportAllCommentsOptions {
  initialRequest: DiscoveredRequest;
  article: ExportArticle;
  count?: number;
  maxPages?: number;
  fetchPage?: (request: DiscoveredRequest) => Promise<unknown>;
  delay?: (milliseconds: number) => Promise<void>;
  now?: () => string;
}

export async function exportAllComments(options: ExportAllCommentsOptions): Promise<ExportDocument> {
  const count = options.count ?? 20;
  const maxPages = options.maxPages ?? 500;
  const fetchPage = options.fetchPage ?? fetchWechatCommentPage;
  const delay = options.delay ?? defaultDelay;
  const now = options.now ?? (() => new Date().toISOString());

  const rawRecords: Record<string, unknown>[] = [];
  let offset = 0;

  for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
    const request = withPagination(options.initialRequest, offset, count);
    const response = await fetchWithRetry(fetchPage, request);
    const page = parseCommentPage(response, { offset, count });

    rawRecords.push(...page.records);
    if (!page.hasMore) break;

    offset = page.nextOffset;
    await delay(900);
  }

  const deduped = dedupeRecords(rawRecords);
  const normalized = deduped.map(normalizeRawComment);
  const tree = buildCommentTree(normalized);

  return buildExportDocument({
    article: options.article,
    comments: tree,
    exportedAt: now(),
    completed: true
  });
}

async function fetchWithRetry(
  fetchPage: (request: DiscoveredRequest) => Promise<unknown>,
  request: DiscoveredRequest
): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await fetchPage(request);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Comment request failed");
}

function dedupeRecords(records: Record<string, unknown>[]): Record<string, unknown>[] {
  const seen = new Set<string>();
  const output: Record<string, unknown>[] = [];
  for (const record of records) {
    const id = String(record.comment_id ?? record.commentid ?? record.id ?? "");
    if (!id || seen.has(id)) continue;
    seen.add(id);
    output.push(record);
  }
  return output;
}

function defaultDelay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}
