export interface DiscoveredRequest {
  url: string;
  method: string;
  body?: string;
  headers?: Record<string, string>;
}

export function isCommentListRequest(request: DiscoveredRequest): boolean {
  const url = parseRequestUrl(request.url);
  const body = new URLSearchParams(request.body ?? "");
  const action = (url?.searchParams.get("action") ?? body.get("action") ?? "").toLowerCase();

  return (
    url?.hostname === "mp.weixin.qq.com" &&
    url.pathname.endsWith("/misc/appmsgcomment") &&
    /^list(?:_|$)/.test(action)
  );
}

export function createCurrentPageCommentRequest(href: string = window.location.href): DiscoveredRequest | null {
  const request = { url: href, method: "GET" };
  return isCommentListRequest(request) ? request : null;
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

function parseRequestUrl(url: string): URL | null {
  try {
    return new URL(url, window.location.href);
  } catch {
    return null;
  }
}
