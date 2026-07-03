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
