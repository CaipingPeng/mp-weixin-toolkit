export interface ParseCursor {
  offset: number;
  count: number;
}

export interface ParsedCommentPage {
  records: Record<string, unknown>[];
  total: number | null;
  nextOffset: number;
  hasMore: boolean;
  rawPageMetadata: Record<string, unknown>;
}

export function parseCommentPage(response: unknown, cursor: ParseCursor): ParsedCommentPage {
  if (!isObject(response)) {
    throw new Error("Unexpected comment response: response is not an object");
  }

  assertBaseResponseIsUsable(response);

  const roots = findFirstArray(response, ["comment_list", "comments", "list", "elected_comment"]);
  const records = flattenComments(roots);
  const total = readNumber(response, ["total", "comment_count", "total_count"]);
  const hasMoreFlag = readBoolean(response, ["has_more", "can_msg_continue"]);
  const nextOffset = cursor.offset + cursor.count;
  const hasMore = hasMoreFlag ?? (total === null ? roots.length >= cursor.count : nextOffset < total);

  return {
    records,
    total,
    nextOffset,
    hasMore,
    rawPageMetadata: collectPageMetadata(response)
  };
}

function assertBaseResponseIsUsable(response: Record<string, unknown>): void {
  const baseResp = response.base_resp;
  if (!isObject(baseResp)) return;

  const ret = Number(baseResp.ret);
  if (!Number.isFinite(ret) || ret === 0) return;

  const message = typeof baseResp.err_msg === "string" ? baseResp.err_msg : "unexpected response";
  throw new Error(`Stopped by session, risk, or unexpected API response: ret=${ret} ${message}`);
}

function flattenComments(items: unknown[]): Record<string, unknown>[] {
  const records: Record<string, unknown>[] = [];
  for (const item of items) {
    if (!isObject(item)) continue;
    const { reply_list: replyList, replies, reply, ...rest } = item;
    records.push(rest);
    for (const replyItem of [...asArray(replyList), ...asArray(replies), ...asArray(reply)]) {
      if (!isObject(replyItem)) continue;
      const parentId = readString(item, ["comment_id", "commentid", "id"]);
      records.push({ parent_id: parentId, ...replyItem });
    }
  }
  return records;
}

function findFirstArray(root: Record<string, unknown>, keys: string[]): unknown[] {
  for (const key of keys) {
    const value = root[key];
    if (Array.isArray(value)) return value;
  }
  for (const value of Object.values(root)) {
    if (isObject(value)) {
      const nested = findFirstArray(value, keys);
      if (nested.length > 0) return nested;
    }
  }
  return [];
}

function collectPageMetadata(response: Record<string, unknown>): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};
  for (const key of ["total", "comment_count", "total_count", "has_more", "can_msg_continue"]) {
    if (key in response) metadata[key] = response[key];
  }
  return metadata;
}

function readNumber(raw: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

function readBoolean(raw: Record<string, unknown>, keys: string[]): boolean | null {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "boolean") return value;
    if (value === 0 || value === "0") return false;
    if (value === 1 || value === "1") return true;
  }
  return null;
}

function readString(raw: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string") return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
