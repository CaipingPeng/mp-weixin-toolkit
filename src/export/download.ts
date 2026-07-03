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
