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
