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

const COMMENT_LIST_KEYS = ["comment_list", "comments", "list", "elected_comment"];

export function hasRecognizableCommentPage(response: unknown): boolean {
  if (!isObject(response)) return false;
  if (typeof response.comment_list === "string") {
    try {
      const parsed = JSON.parse(response.comment_list);
      return isObject(parsed) && Array.isArray(parsed.comment);
    } catch {
      return false;
    }
  }
  return findFirstArray(response, COMMENT_LIST_KEYS).found;
}

export function parseCommentPage(response: unknown, cursor: ParseCursor): ParsedCommentPage {
  if (typeof response === "string") {
    return parseHtmlCommentPage(response, cursor);
  }

  if (!isObject(response)) {
    throw new Error("Unexpected comment response: response is not an object");
  }

  assertBaseResponseIsUsable(response);

  const total = readNumber(response, ["total", "comment_count", "total_count"]);
  const roots = findFirstArray(response, COMMENT_LIST_KEYS).items;
  if (roots.length === 0 && cursor.offset === 0 && total !== 0) {
    throw new Error("Unexpected comment response: comment list not found");
  }

  const records = flattenComments(roots);
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

function findFirstArray(root: Record<string, unknown>, keys: string[]): { found: boolean; items: unknown[] } {
  for (const key of keys) {
    const value = root[key];
    if (Array.isArray(value)) return { found: true, items: value };
  }
  for (const value of Object.values(root)) {
    if (isObject(value)) {
      const nested = findFirstArray(value, keys);
      if (nested.found) return nested;
    }
  }
  return { found: false, items: [] };
}

function collectPageMetadata(response: Record<string, unknown>): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};
  for (const key of ["total", "comment_count", "total_count", "has_more", "can_msg_continue"]) {
    if (key in response) metadata[key] = response[key];
  }
  return metadata;
}

function parseHtmlCommentPage(html: string, cursor: ParseCursor): ParsedCommentPage {
  const document = new DOMParser().parseFromString(html, "text/html");
  const commentElements = findRenderedCommentElements(document);

  const records = commentElements.map((element, index) => htmlCommentElementToRecord(element, cursor.offset + index + 1));
  const total = readHtmlTotal(document);
  const nextOffset = cursor.offset + cursor.count;
  const hasMore = total === null ? records.length >= cursor.count : nextOffset < total;

  if (records.length === 0 && cursor.offset === 0 && total !== 0) {
    throw new Error("Unexpected comment response: comment list not found");
  }

  return {
    records,
    total,
    nextOffset,
    hasMore,
    rawPageMetadata: total === null ? {} : { total }
  };
}

function findRenderedCommentElements(document: Document): HTMLElement[] {
  const directCommentElements = Array.from(
    document.querySelectorAll<HTMLElement>(
      "#commentlist > div > .comment-list__item:not(.comment-reply), .comment-list-wrp > .comment-list__item:not(.comment-reply)"
    )
  ).filter(hasRenderedCommentContent);

  if (directCommentElements.length > 0) return directCommentElements;

  return Array.from(document.querySelectorAll<HTMLElement>(".comment-list__item")).filter(
    (element) =>
      !element.closest(".reply-dialog__wrp") && !element.classList.contains("comment-reply") && hasRenderedCommentContent(element)
  );
}

function htmlCommentElementToRecord(element: HTMLElement, sequence: number): Record<string, unknown> {
  const text = readText(element.querySelector(".comment-text:not(.comment-text_shield)"));
  const nickname = readText(element.querySelector(".comment-nickname"));
  const time = readText(element.querySelector(".comment-list__item-time"));
  const avatar = element.querySelector<HTMLImageElement>("img.avatar")?.src ?? "";
  const rawCommentId = element.getAttribute("data-commentid") ?? "";
  const likeCount = readInteger(readText(element.querySelector(".comment_opr_meta__like span")));
  const isElected = Boolean(element.querySelector('[title="取消精选"], .icon-starred'));

  return {
    comment_id: `dom-${sequence}`,
    raw_comment_id: rawCommentId,
    nickname,
    avatar_url: avatar,
    content: text,
    time,
    like_count: likeCount,
    status: isElected ? "elected" : "",
    source: "rendered_html"
  };
}

function hasRenderedCommentContent(element: HTMLElement): boolean {
  return Boolean(
    readText(element.querySelector(".comment-text:not(.comment-text_shield)")) ||
      readText(element.querySelector(".comment-nickname"))
  );
}

function readHtmlTotal(document: Document): number | null {
  const text = readText(document.querySelector(".filter-bar")) || document.body.textContent || "";
  const match = text.match(/全部留言\((\d+)条\)/);
  return match ? Number(match[1]) : null;
}

function readText(element: Element | null): string {
  return element?.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

function readInteger(text: string): number {
  const value = Number(text.replace(/[^\d.-]/g, ""));
  return Number.isFinite(value) ? value : 0;
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
