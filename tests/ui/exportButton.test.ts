import { findExportButtonHost, mountExportButton } from "../../src/ui/exportButton";

describe("mountExportButton", () => {
  it("mounts one button and updates status", () => {
    const host = document.createElement("div");
    document.body.append(host);

    const control = mountExportButton(host, vi.fn());
    control.setStatus("ready");
    control.setBusy(false);

    expect(host.querySelectorAll("button")).toHaveLength(1);
    expect(host.textContent).toContain("导出 JSON");
    expect(host.textContent).toContain("ready");
  });

  it("prefers the visible comment action area over hidden dialog button wrappers", () => {
    document.body.innerHTML = `
      <div class="weui-desktop-dialog__wrp" style="display: none;">
        <div class="weui-desktop-btn_wrp">
          <button>Hidden dialog action</button>
        </div>
      </div>
      <section class="comment-list-container">
        <div class="sticky-bar">
          <div class="filter-bar">
            <ul class="comment-dropdown-list"></ul>
            <div class="comment-options">
              <div class="comment_entry"><a href="javascript:;">写留言</a></div>
              <div><a href="javascript:;">留言设置</a></div>
            </div>
          </div>
        </div>
      </section>
    `;

    const host = findExportButtonHost(document);

    expect(host).toBe(document.querySelector(".comment-options"));
  });
});
