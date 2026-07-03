# WeChat MP Comment JSON Export Design

Date: 2026-07-04

## Goal

Build a browser extension feature for the WeChat Official Account admin comment management page. The feature adds a manual export button that exports all comments for the current article as tree-structured JSON for programmatic consumption.

## Scope

In scope:

- Chrome/Edge Manifest V3 extension foundation.
- Content script injection on `mp.weixin.qq.com` admin pages.
- A visible "Export JSON" button on the article comment management page.
- Manual, user-triggered export only.
- Read-only access to comments for the current article.
- Pagination through the current article's complete comment set using the same authenticated browser session.
- Tree-structured JSON output with comment metadata.
- Local JSON file download.
- Stop-on-error behavior for login expiration, captcha/risk challenge, rate limiting, or unexpected API responses.

Out of scope:

- Background scheduled exports.
- Cross-article batch export.
- Write operations such as replying, deleting, selecting, hiding, or moderating comments.
- Bypassing login, captcha, permissions, or WeChat risk controls.
- Cloud sync, remote storage, or uploading exported data.
- CSV, Excel, or UI-based data analysis.

## User Flow

1. User opens the WeChat Official Account admin article comment management page while already logged in.
2. Extension detects the supported page and inserts an "Export JSON" button near the native page actions.
3. User clicks the button.
4. Extension identifies the current article context and the comment list request shape from the active page.
5. Extension fetches all comment pages serially with conservative pacing.
6. Extension normalizes raw records into a stable tree-shaped JSON document.
7. Browser downloads the JSON file locally.
8. If the session expires, a risk challenge appears, the API shape is unknown, or requests fail repeatedly, export stops and the user sees a short error message.

## Recommended Approach

Use interface reuse from the logged-in admin page instead of DOM-only scraping.

The extension should observe or wrap page network calls enough to identify the current comment list endpoint and required parameters. It should then replay read-only comment list requests from the page context or content-script bridge using the browser's existing authenticated session. Requests must be serial and low frequency.

This approach is preferred because:

- It preserves metadata that may not be rendered in the DOM.
- It can retrieve all pages without brittle scrolling or click simulation.
- It keeps the feature read-only and user-triggered.
- It is easier to transform the result into reliable program-readable JSON.

Fallback DOM scraping is not part of the first version.

## Components

### Manifest

Defines a Manifest V3 extension with:

- Host access limited to `https://mp.weixin.qq.com/*`.
- Content script for supported admin pages.
- Background service worker only if needed for downloads or cross-context messaging.
- Minimal permissions, expected to include `downloads`, `storage` if local state is needed, and host permissions for WeChat admin pages.

### Content Script

Responsibilities:

- Detect whether the current page is the article comment management page.
- Insert and maintain the export button without disturbing native page controls.
- Listen for user clicks.
- Show small progress and error states.
- Coordinate export through page-context helpers and extension messaging.

### Page-Context Helper

Responsibilities:

- Run inside the page JavaScript context when needed to access page globals or intercept same-page network requests.
- Discover the active article/comment request parameters.
- Return sanitized endpoint and pagination metadata to the content script.

### Export Orchestrator

Responsibilities:

- Fetch pages serially.
- Apply conservative delay between requests.
- Stop on unexpected status, login expiration, risk challenge, or repeated network errors.
- Deduplicate records by stable comment id when available.
- Preserve raw metadata under `metadata` for fields not normalized into top-level names.

### JSON Builder

Responsibilities:

- Normalize raw comments.
- Connect replies to parent comments.
- Preserve orphan replies in a predictable way if a parent record is missing.
- Emit stable JSON schema.

## JSON Schema

Top-level document:

```json
{
  "schema_version": 1,
  "exported_at": "2026-07-04T12:00:00+08:00",
  "source": "wechat_mp_comment_admin",
  "article": {
    "id": "",
    "title": "",
    "url": "",
    "metadata": {}
  },
  "export": {
    "scope": "current_article_all_comments",
    "comment_count": 0,
    "root_comment_count": 0,
    "reply_count": 0,
    "completed": true
  },
  "comments": []
}
```

Comment node:

```json
{
  "id": "",
  "parent_id": null,
  "author": {
    "nickname": "",
    "account_id": "",
    "avatar_url": "",
    "metadata": {}
  },
  "content": "",
  "created_at": "",
  "like_count": 0,
  "reply_count": 0,
  "status": "",
  "metadata": {},
  "replies": []
}
```

Rules:

- `comments` contains root comments only.
- Replies are nested under `replies`.
- `parent_id` is `null` for root comments.
- Unknown normalized fields use empty string, `0`, `null`, or omitted values consistently.
- Original API-specific fields that are useful but not normalized are retained under `metadata`.
- Sensitive tokens, cookies, and request credentials are never written to the export.

## Error Handling

The export must stop and show an error when:

- Current page is not recognized as a supported comment management page.
- Current article context cannot be identified.
- Required list endpoint or pagination parameters cannot be discovered.
- The user is no longer logged in.
- WeChat returns a captcha, verification, or risk-control response.
- The API returns an unexpected schema.
- Network errors continue after a small retry count.

Partial exports should not be silently presented as complete. If partial data is saved in a later version, the JSON must set `export.completed` to `false` and include an error summary. For the first version, prefer stopping without download on failed export.

## Safety Constraints

- User must click the button to start export.
- Only the current article is exported.
- No write requests are sent.
- Requests are serial, with conservative delay.
- No background automation.
- No credential, token, or cookie values are stored or exported.
- No attempts are made to bypass login, permissions, captcha, or risk controls.

## Testing Strategy

Unit-level tests:

- Normalize raw comment records into the target schema.
- Build a reply tree from parent-child records.
- Deduplicate repeated comment records.
- Preserve unknown fields under `metadata`.
- Handle orphan replies predictably.

Manual browser tests:

- Extension button appears only on supported comment management pages.
- Clicking export downloads valid JSON.
- Export includes all comments for a current article with multiple pages.
- Export handles comments with replies.
- Export stops cleanly on unsupported page.
- Export stops cleanly when login expires or the API shape is unrecognized.

## Implementation Notes

- The first implementation should avoid a heavy frontend framework unless the extension UI grows beyond a simple button and progress state.
- The code should isolate WeChat page detection, network discovery, export orchestration, and JSON building into separate modules.
- The interface adapter should be written defensively because WeChat admin page internals may change.
- API response samples should be captured during development, but real user data should not be committed.

