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
