import type { JsonObject, JsonValue, NormalizedComment } from "./types";

type RawRecord = Record<string, unknown>;

const RESERVED_KEYS = new Set([
  "comment_id",
  "commentid",
  "id",
  "parent_id",
  "parentid",
  "reply_to_comment_id",
  "nick_name",
  "nickname",
  "user_name",
  "openid",
  "fakeid",
  "avatar",
  "avatar_url",
  "head_img_url",
  "content",
  "comment_content",
  "create_time",
  "time",
  "created_at",
  "like_num",
  "like_count",
  "reply_count",
  "status"
]);

export function normalizeRawComment(raw: RawRecord): NormalizedComment {
  const parentId = readString(raw, ["parent_id", "parentid", "reply_to_comment_id"]) || null;

  return {
    id: readString(raw, ["comment_id", "commentid", "id"]),
    parent_id: parentId,
    author: {
      nickname: readString(raw, ["nick_name", "nickname", "user_name"]),
      account_id: readString(raw, ["openid", "fakeid"]),
      avatar_url: readString(raw, ["avatar_url", "avatar", "head_img_url"]),
      metadata: {}
    },
    content: readString(raw, ["content", "comment_content"]),
    created_at: normalizeTime(raw),
    like_count: readNumber(raw, ["like_num", "like_count"]),
    reply_count: readNumber(raw, ["reply_count"]),
    status: readString(raw, ["status"]),
    metadata: collectMetadata(raw),
    replies: []
  };
}

function readString(raw: RawRecord, keys: string[]): string {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string") return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function readNumber(raw: RawRecord, keys: string[]): number {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return 0;
}

function normalizeTime(raw: RawRecord): string {
  const value = raw.create_time ?? raw.time ?? raw.created_at;
  if (typeof value === "number" && Number.isFinite(value)) {
    const milliseconds = value < 10_000_000_000 ? value * 1000 : value;
    return new Date(milliseconds).toISOString();
  }
  if (typeof value === "string" && value.trim() !== "") {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      const milliseconds = numeric < 10_000_000_000 ? numeric * 1000 : numeric;
      return new Date(milliseconds).toISOString();
    }
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return "";
}

function collectMetadata(raw: RawRecord): JsonObject {
  const metadata: JsonObject = {};
  for (const [key, value] of Object.entries(raw)) {
    if (RESERVED_KEYS.has(key)) continue;
    if (isJsonValue(value)) metadata[key] = value;
  }
  return metadata;
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null) return true;
  if (["string", "number", "boolean"].includes(typeof value)) return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).every(isJsonValue);
  }
  return false;
}
