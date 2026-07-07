export interface ExportButtonControl {
  setStatus(message: string): void;
  setBusy(isBusy: boolean): void;
  destroy(): void;
}

export function findExportButtonHost(root: ParentNode = document): HTMLElement | null {
  return (
    root.querySelector<HTMLElement>(".comment-list-container .filter-bar .comment-options") ??
    root.querySelector<HTMLElement>(".comment-list-container .filter-bar") ??
    findFirstVisible(root.querySelectorAll<HTMLElement>(".weui-desktop-btn_wrp, .tool_area")) ??
    null
  );
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
  button.textContent = "导出 JSON";
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

function findFirstVisible(elements: NodeListOf<HTMLElement>): HTMLElement | null {
  for (const element of elements) {
    if (!hasHiddenAncestor(element)) return element;
  }
  return null;
}

function hasHiddenAncestor(element: HTMLElement): boolean {
  for (let current: HTMLElement | null = element; current; current = current.parentElement) {
    const style = current.getAttribute("style") ?? "";
    if (/\bdisplay\s*:\s*none\b/i.test(style) || /\bvisibility\s*:\s*hidden\b/i.test(style)) {
      return true;
    }
  }
  return false;
}
