import { exportCurrentPageComments } from "../../src/export/currentPage";
import { buildExportDocument } from "../../src/export/document";
import type { DiscoveredRequest } from "../../src/wechat/requestDiscovery";

describe("exportCurrentPageComments", () => {
  it("falls back to the rendered DOM when a discovered request has no recognizable comment list", async () => {
    document.body.innerHTML = `
      <section class="comment-list-container">
        <div class="filter-bar">
          <span class="weui-desktop-form__dropdown__value">全部留言(1条)</span>
        </div>
        <div id="commentlist">
          <div>
            <div class="comment-list__item">
              <span class="comment-nickname">作者</span>
              <div class="comment-text">页面可见留言</div>
            </div>
          </div>
        </div>
      </section>
    `;

    const request: DiscoveredRequest = {
      url: "https://mp.weixin.qq.com/misc/other?action=legacy_comment&begin=0&count=10",
      method: "GET"
    };

    const doc = await exportCurrentPageComments({
      request,
      document,
      article: { id: "a1", title: "Article", url: "https://mp.weixin.qq.com/", metadata: {} },
      exportAll: async () => {
        throw new Error("Unexpected comment response: comment list not found");
      }
    });

    expect(doc.export.comment_count).toBe(1);
    expect(doc.comments[0].content).toBe("页面可见留言");
  });

  it("does not hide session or risk errors behind a DOM fallback", async () => {
    await expect(
      exportCurrentPageComments({
        request: {
          url: "https://mp.weixin.qq.com/misc/other?action=legacy_comment&begin=0&count=10",
          method: "GET"
        },
        document,
        article: { id: "a1", title: "Article", url: "https://mp.weixin.qq.com/", metadata: {} },
        exportAll: async () => {
          throw new Error("Stopped by session, risk, or unexpected API response: ret=200003");
        }
      })
    ).rejects.toThrow(/session|risk/i);
  });

  it("uses the discovered request export when it succeeds", async () => {
    const expected = buildExportDocument({
      article: { id: "a1", title: "Article", url: "https://mp.weixin.qq.com/", metadata: {} },
      comments: []
    });

    const doc = await exportCurrentPageComments({
      request: {
        url: "https://mp.weixin.qq.com/misc/other?action=legacy_comment&begin=0&count=10",
        method: "GET"
      },
      document,
      article: { id: "a1", title: "Article", url: "https://mp.weixin.qq.com/", metadata: {} },
      exportAll: async () => expected
    });

    expect(doc).toBe(expected);
  });
});
