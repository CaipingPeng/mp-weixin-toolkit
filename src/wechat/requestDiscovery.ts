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
