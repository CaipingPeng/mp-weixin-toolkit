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
    remember(toDiscoveredFetchRequest(input, init));
    return originalFetch(input, init);
  };
}

function patchXhr(): void {
  type OpenArgs = [method: string, url: string | URL, async?: boolean, username?: string | null, password?: string | null];

  const metadata = new WeakMap<XMLHttpRequest, { method: string; url: string }>();
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function patchedOpen(this: XMLHttpRequest, ...args: OpenArgs): void {
    const [method, url] = args;
    metadata.set(this, { method, url: String(url) });
    Reflect.apply(originalOpen, this, args);
  };

  XMLHttpRequest.prototype.send = function patchedSend(
    this: XMLHttpRequest,
    body?: Document | XMLHttpRequestBodyInit | null
  ): void {
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
