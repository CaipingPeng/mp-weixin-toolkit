import { downloadExportDocument } from "./export/download";
import { exportAllComments } from "./export/orchestrator";
import { mountExportButton, type ExportButtonControl } from "./ui/exportButton";
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

    let control: ExportButtonControl;
    control = mountExportButton(host, async () => {
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
  return (
    /mp\.weixin\.qq\.com/.test(location.hostname) &&
    /comment|appmsgcomment/.test(`${location.href} ${document.body.textContent ?? ""}`)
  );
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
