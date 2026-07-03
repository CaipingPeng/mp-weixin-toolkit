# WeChat MP Comment Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Manifest V3 browser extension that adds a manual JSON export button to the WeChat Official Account admin article comment management page and exports all comments for the current article as tree-structured JSON.

**Architecture:** Use a plain TypeScript extension with a content script for page UI, a page-context bridge for discovering the active WeChat comment request, and isolated pure modules for parsing, pagination, normalization, tree building, and export document generation. Keep the feature read-only, manually triggered, current-article-only, and conservative in request pacing.

**Tech Stack:** TypeScript, esbuild, Vitest, jsdom, Chrome/Edge Manifest V3, browser DOM APIs.

---

## Source Spec

- `docs/superpowers/specs/2026-07-04-wechat-mp-comment-export-design.md`

## File Structure

- Create: `package.json` - npm scripts and dev dependencies.
- Create: `tsconfig.json` - strict TypeScript config for extension source and tests.
- Create: `scripts/build.mjs` - esbuild bundle script that emits extension-safe IIFE files.
- Create: `vitest.config.ts` - Vitest jsdom test config.
- Create: `public/manifest.json` - Manifest V3 extension metadata and host restrictions.
- Create: `src/content.ts` - content script entry point; injects page bridge, mounts export button, coordinates export.
- Create: `src/pageBridge.ts` - page-context script; observes fetch/XHR and shares discovered comment list request details.
- Create: `src/content.css` - small scoped button/progress styles.
- Create: `src/export/types.ts` - normalized export and internal orchestration types.
- Create: `src/export/normalizer.ts` - converts raw WeChat-like comment records to normalized comment nodes.
- Create: `src/export/tree.ts` - builds root/reply tree and handles orphan replies predictably.
- Create: `src/export/document.ts` - creates final JSON export document and counts.
- Create: `src/export/download.ts` - downloads JSON locally from the content script.
- Create: `src/export/orchestrator.ts` - serial pagination loop, retry handling, stop conditions, and final document creation.
- Create: `src/wechat/requestDiscovery.ts` - pure helpers for detecting and sanitizing comment list requests.
- Create: `src/wechat/responseParser.ts` - extracts raw comment records and pagination state from supported WeChat response shapes.
- Create: `src/wechat/apiClient.ts` - read-only API request executor using discovered request metadata.
- Create: `src/ui/exportButton.ts` - DOM button/progress component.
- Create: `tests/export/document.test.ts` - normalization, tree, metadata, and export document tests.
- Create: `tests/wechat/responseParser.test.ts` - parser and pagination tests with synthetic fixtures.
- Create: `tests/wechat/requestDiscovery.test.ts` - request detection and sanitization tests.
- Create: `tests/export/orchestrator.test.ts` - serial fetching, retry, and stop-condition tests.
- Create: `tests/ui/exportButton.test.ts` - jsdom button mount and state tests.
- Create: `README.md` - local build, load-unpacked, safety constraints, and manual verification checklist.

Do not commit real WeChat tokens, cookies, real user comments, or captured production responses.

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `scripts/build.mjs`
- Create: `vitest.config.ts`
- Create: `public/manifest.json`
- Create: `src/content.ts`
- Create: `src/pageBridge.ts`
- Create: `src/content.css`

- [ ] **Step 1: Create npm project metadata**

Create `package.json`:

```json
{
  "name": "wechat-mp-comment-exporter",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "node scripts/build.mjs",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@types/chrome": "^0.0.268",
    "esbuild": "^0.23.0",
    "jsdom": "^24.1.1",
    "typescript": "^5.5.4",
    "vitest": "^2.0.5"
  }
}
```

- [ ] **Step 2: Create TypeScript config**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "types": ["chrome", "vitest/globals"]
  },
  "include": ["src", "tests", "vitest.config.ts"]
}
```

- [ ] **Step 3: Create esbuild extension build**

Create `scripts/build.mjs`:

```js
import { copyFile, mkdir, rm } from "node:fs/promises";
import { build } from "esbuild";

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });

await Promise.all([
  build({
    entryPoints: ["src/content.ts"],
    outfile: "dist/content.js",
    bundle: true,
    format: "iife",
    target: "es2022",
    sourcemap: true
  }),
  build({
    entryPoints: ["src/pageBridge.ts"],
    outfile: "dist/pageBridge.js",
    bundle: true,
    format: "iife",
    target: "es2022",
    sourcemap: true
  }),
  copyFile("public/manifest.json", "dist/manifest.json"),
  copyFile("src/content.css", "dist/content.css")
]);
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true
  }
});
```

- [ ] **Step 4: Create extension manifest**

Create `public/manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "WeChat MP Comment Exporter",
  "version": "0.1.0",
  "description": "Export current WeChat Official Account article comments as tree-structured JSON.",
  "host_permissions": ["https://mp.weixin.qq.com/*"],
  "content_scripts": [
    {
      "matches": ["https://mp.weixin.qq.com/*"],
      "js": ["content.js"],
      "css": ["content.css"],
      "run_at": "document_idle"
    }
  ],
  "web_accessible_resources": [
    {
      "resources": ["pageBridge.js"],
      "matches": ["https://mp.weixin.qq.com/*"]
    }
  ]
}
```

- [ ] **Step 5: Create minimal entries**

Create `src/content.ts`:

```ts
console.info("[wechat-comment-export] content script loaded");
```

Create `src/pageBridge.ts`:

```ts
console.info("[wechat-comment-export] page bridge loaded");
```

Create `src/content.css`:

```css
.wechat-comment-export-root {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-left: 8px;
}
```

- [ ] **Step 6: Install dependencies**

Run: `npm install`

Expected: `package-lock.json` is created and dependencies install successfully.

- [ ] **Step 7: Verify scaffold**

Run: `npm run typecheck`

Expected: PASS with no TypeScript errors.

Run: `npm run build`

Expected: PASS and `dist/manifest.json`, `dist/content.js`, and `dist/pageBridge.js` exist.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json tsconfig.json scripts/build.mjs vitest.config.ts public/manifest.json src/content.ts src/pageBridge.ts src/content.css
git commit -m "chore: scaffold extension project"
```

---

### Task 2: Export Types, Normalization, Tree Builder, and Document Builder

**Files:**
- Create: `src/export/types.ts`
- Create: `src/export/normalizer.ts`
- Create: `src/export/tree.ts`
- Create: `src/export/document.ts`
- Test: `tests/export/document.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/export/document.test.ts`:

```ts
import { buildExportDocument } from "../../src/export/document";
import { buildCommentTree } from "../../src/export/tree";
import { normalizeRawComment } from "../../src/export/normalizer";

describe("comment export document", () => {
  it("normalizes root comments and replies into a tree export document", () => {
    const raw = [
      {
        comment_id: "c1",
        nick_name: "Alice",
        content: "Root comment",
        create_time: 1710000000,
        like_num: 3,
        reply_count: 1,
        status: "elected",
        extra_field: "kept"
      },
      {
        comment_id: "r1",
        parent_id: "c1",
        nick_name: "Bob",
        content: "Reply",
        create_time: 1710000060,
        like_num: 1
      }
    ];

    const nodes = raw.map(normalizeRawComment);
    const tree = buildCommentTree(nodes);
    const doc = buildExportDocument({
      article: { id: "article-1", title: "Example", url: "https://mp.weixin.qq.com/example", metadata: {} },
      comments: tree,
      exportedAt: "2026-07-04T12:00:00+08:00"
    });

    expect(doc.schema_version).toBe(1);
    expect(doc.export.comment_count).toBe(2);
    expect(doc.export.root_comment_count).toBe(1);
    expect(doc.export.reply_count).toBe(1);
    expect(doc.comments[0].id).toBe("c1");
    expect(doc.comments[0].author.nickname).toBe("Alice");
    expect(doc.comments[0].created_at).toBe("2024-03-09T16:00:00.000Z");
    expect(doc.comments[0].metadata.extra_field).toBe("kept");
    expect(doc.comments[0].replies[0].id).toBe("r1");
  });

  it("keeps orphan replies as root nodes with metadata flag", () => {
    const nodes = [
      normalizeRawComment({
        comment_id: "r2",
        parent_id: "missing",
        nick_name: "Carol",
        content: "Orphan reply"
      })
    ];

    const tree = buildCommentTree(nodes);

    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("r2");
    expect(tree[0].metadata.orphan_parent_id).toBe("missing");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/export/document.test.ts`

Expected: FAIL because export modules do not exist.

- [ ] **Step 3: Implement export types**

Create `src/export/types.ts`:

```ts
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export interface CommentAuthor {
  nickname: string;
  account_id: string;
  avatar_url: string;
  metadata: JsonObject;
}

export interface NormalizedComment {
  id: string;
  parent_id: string | null;
  author: CommentAuthor;
  content: string;
  created_at: string;
  like_count: number;
  reply_count: number;
  status: string;
  metadata: JsonObject;
  replies: NormalizedComment[];
}

export interface ExportArticle {
  id: string;
  title: string;
  url: string;
  metadata: JsonObject;
}

export interface ExportDocument {
  schema_version: 1;
  exported_at: string;
  source: "wechat_mp_comment_admin";
  article: ExportArticle;
  export: {
    scope: "current_article_all_comments";
    comment_count: number;
    root_comment_count: number;
    reply_count: number;
    completed: boolean;
  };
  comments: NormalizedComment[];
}
```

- [ ] **Step 4: Implement normalizer**

Create `src/export/normalizer.ts`:

```ts
import type { JsonObject, NormalizedComment } from "./types";

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
  const id = readString(raw, ["comment_id", "commentid", "id"]);
  const parentId = readString(raw, ["parent_id", "parentid", "reply_to_comment_id"]) || null;

  return {
    id,
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

function isJsonValue(value: unknown): value is JsonObject[keyof JsonObject] {
  if (value === null) return true;
  if (["string", "number", "boolean"].includes(typeof value)) return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).every(isJsonValue);
  }
  return false;
}
```

- [ ] **Step 5: Implement tree builder**

Create `src/export/tree.ts`:

```ts
import type { NormalizedComment } from "./types";

export function buildCommentTree(flatComments: NormalizedComment[]): NormalizedComment[] {
  const byId = new Map<string, NormalizedComment>();
  const roots: NormalizedComment[] = [];

  for (const comment of flatComments) {
    if (!comment.id) continue;
    byId.set(comment.id, { ...comment, replies: [] });
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
```

- [ ] **Step 6: Implement document builder**

Create `src/export/document.ts`:

```ts
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
```

- [ ] **Step 7: Run tests and typecheck**

Run: `npm test -- tests/export/document.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/export tests/export
git commit -m "feat: build comment export document"
```

---

### Task 3: WeChat Response Parser

**Files:**
- Create: `src/wechat/responseParser.ts`
- Test: `tests/wechat/responseParser.test.ts`

- [ ] **Step 1: Write failing parser tests**

Create `tests/wechat/responseParser.test.ts`:

```ts
import { parseCommentPage } from "../../src/wechat/responseParser";

describe("parseCommentPage", () => {
  it("extracts comments from a common list response", () => {
    const page = parseCommentPage(
      {
        base_resp: { ret: 0 },
        total: 3,
        comment_list: [
          {
            comment_id: "c1",
            content: "Root",
            reply_list: [{ comment_id: "r1", parent_id: "c1", content: "Reply" }]
          }
        ]
      },
      { offset: 0, count: 2 }
    );

    expect(page.records).toHaveLength(2);
    expect(page.total).toBe(3);
    expect(page.nextOffset).toBe(2);
    expect(page.hasMore).toBe(true);
  });

  it("marks login or risk responses as stop errors", () => {
    expect(() =>
      parseCommentPage({ base_resp: { ret: 200003, err_msg: "invalid session" } }, { offset: 0, count: 20 })
    ).toThrow(/session|risk|unexpected/i);
  });
});
```

- [ ] **Step 2: Run parser tests to verify failure**

Run: `npm test -- tests/wechat/responseParser.test.ts`

Expected: FAIL because parser does not exist.

- [ ] **Step 3: Implement parser**

Create `src/wechat/responseParser.ts`:

```ts
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
```

- [ ] **Step 4: Run parser tests and typecheck**

Run: `npm test -- tests/wechat/responseParser.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/wechat/responseParser.ts tests/wechat/responseParser.test.ts
git commit -m "feat: parse WeChat comment responses"
```

---

### Task 4: Request Discovery Helpers and Page Bridge

**Files:**
- Create: `src/wechat/requestDiscovery.ts`
- Modify: `src/pageBridge.ts`
- Test: `tests/wechat/requestDiscovery.test.ts`

- [ ] **Step 1: Write failing request discovery tests**

Create `tests/wechat/requestDiscovery.test.ts`:

```ts
import { isCommentListRequest, sanitizeDiscoveredRequest } from "../../src/wechat/requestDiscovery";

describe("request discovery", () => {
  it("detects appmsgcomment list requests", () => {
    expect(
      isCommentListRequest({
        url: "https://mp.weixin.qq.com/misc/appmsgcomment?action=list_comment&token=secret",
        method: "GET",
        body: ""
      })
    ).toBe(true);
  });

  it("removes sensitive token-like fields from sanitized copies", () => {
    const sanitized = sanitizeDiscoveredRequest({
      url: "https://mp.weixin.qq.com/misc/appmsgcomment?action=list_comment&token=secret&begin=0",
      method: "GET",
      body: "token=secret&begin=0",
      headers: { "x-test": "ok", cookie: "hidden" }
    });

    expect(sanitized.url).not.toContain("secret");
    expect(sanitized.body).not.toContain("secret");
    expect(sanitized.headers.cookie).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/wechat/requestDiscovery.test.ts`

Expected: FAIL because request discovery module does not exist.

- [ ] **Step 3: Implement request discovery helpers**

Create `src/wechat/requestDiscovery.ts`:

```ts
export interface DiscoveredRequest {
  url: string;
  method: string;
  body?: string;
  headers?: Record<string, string>;
}

export function isCommentListRequest(request: DiscoveredRequest): boolean {
  const haystack = `${request.url}\n${request.body ?? ""}`.toLowerCase();
  return haystack.includes("appmsgcomment") && /list|comment/.test(haystack);
}

export function sanitizeDiscoveredRequest(request: DiscoveredRequest): DiscoveredRequest {
  return {
    url: sanitizeUrl(request.url),
    method: request.method,
    body: sanitizeBody(request.body),
    headers: sanitizeHeaders(request.headers)
  };
}

function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url, window.location.href);
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (isSensitiveKey(key)) parsed.searchParams.set(key, "[redacted]");
    }
    return parsed.toString();
  } catch {
    return url.replace(/(token|cookie|pass_ticket)=([^&]+)/gi, "$1=[redacted]");
  }
}

function sanitizeBody(body: string | undefined): string | undefined {
  if (!body) return body;
  return body.replace(/(token|cookie|pass_ticket)=([^&]+)/gi, "$1=[redacted]");
}

function sanitizeHeaders(headers: Record<string, string> | undefined): Record<string, string> {
  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (isSensitiveKey(key)) continue;
    output[key] = value;
  }
  return output;
}

function isSensitiveKey(key: string): boolean {
  return /token|cookie|pass_ticket|authorization|credential/i.test(key);
}
```

- [ ] **Step 4: Implement page bridge discovery**

Modify `src/pageBridge.ts`:

```ts
import { isCommentListRequest, type DiscoveredRequest } from "./wechat/requestDiscovery";

const DISCOVERED_EVENT = "WECHAT_COMMENT_EXPORT_DISCOVERED_REQUEST";
const REQUEST_LAST_EVENT = "WECHAT_COMMENT_EXPORT_REQUEST_LAST";
const RESPONSE_LAST_EVENT = "WECHAT_COMMENT_EXPORT_RESPONSE_LAST";

let lastRequest: DiscoveredRequest | null = null;

function remember(request: DiscoveredRequest): void {
  if (!isCommentListRequest(request)) return;
  lastRequest = request;
  window.postMessage({ source: "wechat-comment-export", type: DISCOVERED_EVENT, request }, window.location.origin);
}

function patchFetch(): void {
  const originalFetch = window.fetch;
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = toDiscoveredFetchRequest(input, init);
    remember(request);
    return originalFetch(input, init);
  };
}

function patchXhr(): void {
  const metadata = new WeakMap<XMLHttpRequest, { method: string; url: string }>();
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function patchedOpen(method: string, url: string | URL, ...args: unknown[]) {
    metadata.set(this, { method, url: String(url) });
    return originalOpen.apply(this, [method, url, ...args] as Parameters<XMLHttpRequest["open"]>);
  };

  XMLHttpRequest.prototype.send = function patchedSend(body?: Document | XMLHttpRequestBodyInit | null) {
    const request = metadata.get(this);
    if (request) {
      remember({
        url: request.url,
        method: request.method,
        body: typeof body === "string" ? body : undefined
      });
    }
    return originalSend.call(this, body);
  };
}

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.data?.source !== "wechat-comment-export") return;
  if (event.data?.type !== REQUEST_LAST_EVENT) return;
  window.postMessage({ source: "wechat-comment-export", type: RESPONSE_LAST_EVENT, request: lastRequest }, window.location.origin);
});

patchFetch();
patchXhr();

function toDiscoveredFetchRequest(input: RequestInfo | URL, init?: RequestInit): DiscoveredRequest {
  if (input instanceof Request) {
    return { url: input.url, method: init?.method ?? input.method, body: bodyToString(init?.body) };
  }
  return { url: String(input), method: init?.method ?? "GET", body: bodyToString(init?.body) };
}

function bodyToString(body: BodyInit | null | undefined): string | undefined {
  if (typeof body === "string") return body;
  if (body instanceof URLSearchParams) return body.toString();
  return undefined;
}
```

- [ ] **Step 5: Run tests and build**

Run: `npm test -- tests/wechat/requestDiscovery.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/wechat/requestDiscovery.ts src/pageBridge.ts tests/wechat/requestDiscovery.test.ts
git commit -m "feat: discover WeChat comment requests"
```

---

### Task 5: API Client and Export Orchestrator

**Files:**
- Create: `src/wechat/apiClient.ts`
- Create: `src/export/orchestrator.ts`
- Test: `tests/export/orchestrator.test.ts`

- [ ] **Step 1: Write failing orchestrator tests**

Create `tests/export/orchestrator.test.ts`:

```ts
import { exportAllComments } from "../../src/export/orchestrator";
import type { DiscoveredRequest } from "../../src/wechat/requestDiscovery";

describe("exportAllComments", () => {
  it("fetches pages serially and returns a completed export document", async () => {
    const calls: string[] = [];
    const request: DiscoveredRequest = {
      url: "https://mp.weixin.qq.com/misc/appmsgcomment?action=list_comment&begin=0&count=1",
      method: "GET"
    };

    const fetchPage = vi.fn(async (nextRequest: DiscoveredRequest) => {
      calls.push(nextRequest.url);
      const begin = new URL(nextRequest.url).searchParams.get("begin");
      return begin === "0"
        ? { base_resp: { ret: 0 }, total: 2, comment_list: [{ comment_id: "c1", content: "One" }] }
        : { base_resp: { ret: 0 }, total: 2, comment_list: [{ comment_id: "c2", content: "Two" }] };
    });

    const doc = await exportAllComments({
      initialRequest: request,
      article: { id: "a1", title: "Article", url: "https://mp.weixin.qq.com/s/example", metadata: {} },
      count: 1,
      fetchPage,
      delay: async () => undefined,
      now: () => "2026-07-04T12:00:00+08:00"
    });

    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(calls[0]).toContain("begin=0");
    expect(calls[1]).toContain("begin=1");
    expect(doc.export.completed).toBe(true);
    expect(doc.export.comment_count).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- tests/export/orchestrator.test.ts`

Expected: FAIL because orchestrator does not exist.

- [ ] **Step 3: Implement API client**

Create `src/wechat/apiClient.ts`:

```ts
import type { DiscoveredRequest } from "./requestDiscovery";

export async function fetchWechatCommentPage(request: DiscoveredRequest): Promise<unknown> {
  const response = await fetch(request.url, {
    method: request.method,
    body: request.method.toUpperCase() === "GET" ? undefined : request.body,
    credentials: "include"
  });

  if (!response.ok) {
    throw new Error(`Comment request failed: HTTP ${response.status}`);
  }

  return response.json();
}

export function withPagination(request: DiscoveredRequest, offset: number, count: number): DiscoveredRequest {
  const url = new URL(request.url, window.location.href);
  applyPaginationParams(url.searchParams, offset, count);

  return {
    ...request,
    url: url.toString(),
    body: request.body ? applyBodyPagination(request.body, offset, count) : request.body
  };
}

function applyPaginationParams(params: URLSearchParams, offset: number, count: number): void {
  const offsetKeys = ["begin", "offset", "start"];
  const existingOffsetKey = offsetKeys.find((key) => params.has(key)) ?? "begin";
  params.set(existingOffsetKey, String(offset));
  if (params.has("count")) params.set("count", String(count));
}

function applyBodyPagination(body: string, offset: number, count: number): string {
  const params = new URLSearchParams(body);
  applyPaginationParams(params, offset, count);
  return params.toString();
}
```

- [ ] **Step 4: Implement orchestrator**

Create `src/export/orchestrator.ts`:

```ts
import { buildExportDocument } from "./document";
import { normalizeRawComment } from "./normalizer";
import { buildCommentTree } from "./tree";
import type { ExportArticle, ExportDocument } from "./types";
import { parseCommentPage } from "../wechat/responseParser";
import type { DiscoveredRequest } from "../wechat/requestDiscovery";
import { fetchWechatCommentPage, withPagination } from "../wechat/apiClient";

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
```

- [ ] **Step 5: Run orchestrator tests and typecheck**

Run: `npm test -- tests/export/orchestrator.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/wechat/apiClient.ts src/export/orchestrator.ts tests/export/orchestrator.test.ts
git commit -m "feat: orchestrate comment export pagination"
```

---

### Task 6: Export Button UI and Content Script Integration

**Files:**
- Create: `src/ui/exportButton.ts`
- Create: `src/export/download.ts`
- Modify: `src/content.ts`
- Modify: `src/content.css`
- Test: `tests/ui/exportButton.test.ts`

- [ ] **Step 1: Write failing UI tests**

Create `tests/ui/exportButton.test.ts`:

```ts
import { mountExportButton } from "../../src/ui/exportButton";

describe("mountExportButton", () => {
  it("mounts one button and updates status", () => {
    const host = document.createElement("div");
    document.body.append(host);

    const control = mountExportButton(host, vi.fn());
    control.setStatus("ready");
    control.setBusy(false);

    expect(host.querySelectorAll("button")).toHaveLength(1);
    expect(host.textContent).toContain("Export JSON");
    expect(host.textContent).toContain("ready");
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- tests/ui/exportButton.test.ts`

Expected: FAIL because UI module does not exist.

- [ ] **Step 3: Implement button component**

Create `src/ui/exportButton.ts`:

```ts
export interface ExportButtonControl {
  setStatus(message: string): void;
  setBusy(isBusy: boolean): void;
  destroy(): void;
}

export function mountExportButton(host: HTMLElement, onClick: () => void): ExportButtonControl {
  if (host.querySelector(".wechat-comment-export-root")) {
    host.querySelector(".wechat-comment-export-root")?.remove();
  }

  const root = document.createElement("span");
  root.className = "wechat-comment-export-root";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "wechat-comment-export-button";
  button.textContent = "Export JSON";
  button.addEventListener("click", onClick);

  const status = document.createElement("span");
  status.className = "wechat-comment-export-status";

  root.append(button, status);
  host.append(root);

  return {
    setStatus(message: string) {
      status.textContent = message;
    },
    setBusy(isBusy: boolean) {
      button.disabled = isBusy;
      button.setAttribute("aria-busy", String(isBusy));
    },
    destroy() {
      root.remove();
    }
  };
}
```

- [ ] **Step 4: Implement JSON download helper**

Create `src/export/download.ts`:

```ts
import type { ExportDocument } from "./types";

export function downloadExportDocument(document: ExportDocument): void {
  const safeTitle = document.article.title.replace(/[\\/:*?"<>|]+/g, "_").slice(0, 60) || "wechat-comments";
  const filename = `${safeTitle}-${document.exported_at.replace(/[:.]/g, "-")}.json`;
  const blob = new Blob([JSON.stringify(document, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 5: Update CSS**

Modify `src/content.css`:

```css
.wechat-comment-export-root {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-left: 8px;
  vertical-align: middle;
}

.wechat-comment-export-button {
  border: 1px solid #07c160;
  border-radius: 4px;
  background: #07c160;
  color: #fff;
  cursor: pointer;
  font-size: 13px;
  line-height: 1;
  padding: 7px 12px;
}

.wechat-comment-export-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.wechat-comment-export-status {
  color: #576b95;
  font-size: 12px;
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

- [ ] **Step 6: Wire content script**

Modify `src/content.ts`:

```ts
import { downloadExportDocument } from "./export/download";
import { exportAllComments } from "./export/orchestrator";
import { mountExportButton } from "./ui/exportButton";
import type { DiscoveredRequest } from "./wechat/requestDiscovery";

const REQUEST_LAST_EVENT = "WECHAT_COMMENT_EXPORT_REQUEST_LAST";
const RESPONSE_LAST_EVENT = "WECHAT_COMMENT_EXPORT_RESPONSE_LAST";

injectPageBridge();
mountWhenReady();

function injectPageBridge(): void {
  if (document.documentElement.dataset.wechatCommentExportBridgeInjected === "1") return;
  document.documentElement.dataset.wechatCommentExportBridgeInjected = "1";
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("pageBridge.js");
  script.onload = () => script.remove();
  (document.head || document.documentElement).append(script);
}

function mountWhenReady(): void {
  const interval = window.setInterval(() => {
    if (!isLikelyCommentPage()) return;
    const host = findActionHost();
    if (!host || host.querySelector(".wechat-comment-export-root")) return;

    const control = mountExportButton(host, async () => {
      control.setBusy(true);
      control.setStatus("Exporting...");
      try {
        const request = await getLastDiscoveredRequest();
        if (!request) throw new Error("Open or refresh the comment list before exporting.");
        const doc = await exportAllComments({
          initialRequest: request,
          article: getArticleContext()
        });
        downloadExportDocument(doc);
        control.setStatus("Done");
      } catch (error) {
        control.setStatus(error instanceof Error ? error.message : "Export failed");
      } finally {
        control.setBusy(false);
      }
    });

    window.clearInterval(interval);
  }, 1000);
}

function isLikelyCommentPage(): boolean {
  return /mp\.weixin\.qq\.com/.test(location.hostname) && /comment|appmsgcomment/.test(`${location.href} ${document.body.textContent ?? ""}`);
}

function findActionHost(): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>(".weui-desktop-btn_wrp") ??
    document.querySelector<HTMLElement>(".tool_area") ??
    document.querySelector<HTMLElement>("body")
  );
}

function getLastDiscoveredRequest(): Promise<DiscoveredRequest | null> {
  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener("message", onMessage);
      resolve(null);
    }, 1000);

    function onMessage(event: MessageEvent): void {
      if (event.source !== window) return;
      if (event.data?.source !== "wechat-comment-export") return;
      if (event.data?.type !== RESPONSE_LAST_EVENT) return;
      window.clearTimeout(timeout);
      window.removeEventListener("message", onMessage);
      resolve(event.data.request ?? null);
    }

    window.addEventListener("message", onMessage);
    window.postMessage({ source: "wechat-comment-export", type: REQUEST_LAST_EVENT }, window.location.origin);
  });
}

function getArticleContext() {
  const title =
    document.querySelector<HTMLElement>(".weui-desktop-page__title")?.innerText.trim() ||
    document.querySelector<HTMLElement>("h1")?.innerText.trim() ||
    document.title ||
    "";

  const url = new URL(location.href);

  return {
    id: url.searchParams.get("appmsgid") ?? url.searchParams.get("msgid") ?? "",
    title,
    url: location.href,
    metadata: {}
  };
}
```

- [ ] **Step 7: Run tests, typecheck, and build**

Run: `npm test -- tests/ui/exportButton.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/ui/exportButton.ts src/export/download.ts src/content.ts src/content.css tests/ui/exportButton.test.ts
git commit -m "feat: add export button content script"
```

---

### Task 7: Hardening and Stop Conditions

**Files:**
- Modify: `src/export/orchestrator.ts`
- Modify: `src/wechat/apiClient.ts`
- Modify: `src/wechat/responseParser.ts`
- Modify: `tests/export/orchestrator.test.ts`
- Modify: `tests/wechat/responseParser.test.ts`

- [ ] **Step 1: Add failing tests for stop conditions**

Extend `tests/export/orchestrator.test.ts`:

```ts
it("stops instead of downloading partial data when the API returns a risk response", async () => {
  await expect(
    exportAllComments({
      initialRequest: {
        url: "https://mp.weixin.qq.com/misc/appmsgcomment?action=list_comment&begin=0&count=20",
        method: "GET"
      },
      article: { id: "a1", title: "Article", url: "https://mp.weixin.qq.com/s/example", metadata: {} },
      fetchPage: async () => ({ base_resp: { ret: 200003, err_msg: "risk control" } }),
      delay: async () => undefined
    })
  ).rejects.toThrow(/risk|session|unexpected/i);
});
```

Extend `tests/wechat/responseParser.test.ts`:

```ts
it("rejects non-empty responses that contain no comment list", () => {
  expect(() => parseCommentPage({ base_resp: { ret: 0 }, total: 10 }, { offset: 0, count: 20 })).toThrow(
    /comment list/i
  );
});

it("allows an empty article response", () => {
  const page = parseCommentPage({ base_resp: { ret: 0 }, total: 0, comment_list: [] }, { offset: 0, count: 20 });
  expect(page.records).toEqual([]);
  expect(page.hasMore).toBe(false);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/export/orchestrator.test.ts tests/wechat/responseParser.test.ts`

Expected: FAIL because non-empty successful responses without a recognizable comment list are not rejected yet.

- [ ] **Step 3: Implement hardening**

Modify `parseCommentPage` in `src/wechat/responseParser.ts` by replacing the initial `roots`, `records`, and `total` parsing block with this order:

```ts
const roots = findFirstArray(response, ["comment_list", "comments", "list", "elected_comment"]);
const total = readNumber(response, ["total", "comment_count", "total_count"]);
if (roots.length === 0 && cursor.offset === 0 && total !== 0) {
  throw new Error("Unexpected comment response: comment list not found");
}
const records = flattenComments(roots);
```

Modify `src/export/orchestrator.ts` to enforce the page cap:

```ts
let reachedEnd = false;
for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
  // existing loop body
  if (!page.hasMore) {
    reachedEnd = true;
    break;
  }
}
if (!reachedEnd) {
  throw new Error(`Export stopped after max page limit: ${maxPages}`);
}
```

Verify that no catch block converts these errors into partial downloads.

- [ ] **Step 4: Run all tests**

Run: `npm test`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/export/orchestrator.ts src/wechat/apiClient.ts src/wechat/responseParser.ts tests/export/orchestrator.test.ts tests/wechat/responseParser.test.ts
git commit -m "fix: stop safely on unsupported comment responses"
```

---

### Task 8: Documentation and Manual Verification

**Files:**
- Create: `README.md`
- Modify: any source files only if manual verification finds issues.

- [ ] **Step 1: Write README**

Create `README.md`:

````md
# WeChat MP Comment Exporter

Browser extension for exporting comments from the current WeChat Official Account admin article comment management page as tree-structured JSON.

## Safety Constraints

- Manual click only.
- Current article only.
- Read-only requests only.
- No scheduled or cross-article batch export.
- No login, captcha, permission, or risk-control bypass.
- No credentials, cookies, or tokens are written to exported JSON.

## Development

```bash
npm install
npm test
npm run typecheck
npm run build
```

## Load in Chrome or Edge

1. Run `npm run build`.
2. Open `chrome://extensions` or `edge://extensions`.
3. Enable Developer mode.
4. Choose "Load unpacked".
5. Select the `dist` directory.

## Manual Verification

1. Log in to the WeChat Official Account admin site.
2. Open one article's comment management page.
3. Refresh the page if the export button reports that no comment request was discovered.
4. Click "Export JSON".
5. Confirm a JSON file downloads.
6. Confirm the JSON has `schema_version`, `article`, `export`, and `comments`.
7. Confirm root comments are in `comments` and replies are nested in `replies`.
8. Confirm no token, cookie, or credential values appear in the JSON.

Do not commit real exported comments or captured production API responses.
````

- [ ] **Step 2: Run full verification before manual browser test**

Run: `npm test`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 3: Load unpacked extension**

Open Chrome or Edge extensions page and load the generated `dist` directory.

Expected: Extension loads without manifest errors.

- [ ] **Step 4: Manual test on WeChat admin comment page**

Open the target WeChat Official Account admin article comment management page.

Expected:

- Button appears only on a likely comment page.
- Clicking the button after the native comment list loads starts export.
- Exported JSON is valid and tree-shaped.
- The exported JSON does not include cookies, tokens, or credentials.
- If WeChat returns login/risk errors, the button shows an error and no partial file is downloaded.

- [ ] **Step 5: Fix any manual verification issue**

If an issue is found, write or update a focused test first when possible, then make the smallest source change.

Run after each fix:

```bash
npm test
npm run typecheck
npm run build
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add README.md src tests public package.json package-lock.json tsconfig.json scripts/build.mjs vitest.config.ts
git commit -m "docs: add extension usage and verification guide"
```

---

## Final Verification

- [ ] Run: `npm test`
- [ ] Run: `npm run typecheck`
- [ ] Run: `npm run build`
- [ ] Load `dist` as an unpacked extension.
- [ ] Verify on a real WeChat Official Account admin article comment management page.
- [ ] Confirm exported JSON is valid and contains no sensitive credential fields.
- [ ] Run: `git status --short`
- [ ] Expected final status: clean working tree.

## Execution Notes

- Use @superpowers:test-driven-development for implementation tasks that add behavior.
- Use @superpowers:systematic-debugging if real WeChat response shapes differ from the synthetic fixtures.
- Use @superpowers:verification-before-completion before claiming the feature is complete.
- Use @superpowers:subagent-driven-development if subagents are available; otherwise use @superpowers:executing-plans for inline execution.
