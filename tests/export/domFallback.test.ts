import { exportVisibleCommentsFromDocument } from "../../src/export/domFallback";

describe("exportVisibleCommentsFromDocument", () => {
  it("exports rendered comments when no reusable comment request was discovered", () => {
    document.body.innerHTML = `
      <section class="comment-list-container">
        <div class="filter-bar">
          <span class="weui-desktop-form__dropdown__value">全部留言(2条)</span>
        </div>
        <div class="comment-list-wrp">
          <div data-commentid="server-id-1" class="comment-list__item">
            <img class="avatar" src="https://example.com/a.png">
            <span class="comment-nickname">作者 A</span>
            <div class="comment_opr_meta__like"><span>3</span></div>
            <div class="comment-text">第一条</div>
            <div class="comment-list__item-time">昨天 12:10:12 湖南</div>
          </div>
          <div data-commentid="server-id-2" class="comment-list__item">
            <span class="comment-nickname">作者 B</span>
            <div class="comment-text">第二条</div>
            <div class="comment-list__item-time">今天 09:00:00 北京</div>
          </div>
        </div>
      </section>
    `;

    const doc = exportVisibleCommentsFromDocument(document, {
      id: "article-1",
      title: "Article",
      url: "https://mp.weixin.qq.com/",
      metadata: {}
    });

    expect(doc.export.completed).toBe(true);
    expect(doc.export.comment_count).toBe(2);
    expect(doc.comments[0]).toMatchObject({
      id: "dom-1",
      author: { nickname: "作者 A", avatar_url: "https://example.com/a.png" },
      content: "第一条",
      like_count: 3
    });
  });

  it("marks DOM exports incomplete when the rendered page contains fewer comments than the total", () => {
    document.body.innerHTML = `
      <section class="comment-list-container">
        <div class="filter-bar">
          <span class="weui-desktop-form__dropdown__value">全部留言(17条)</span>
        </div>
        <div class="comment-list-wrp">
          <div data-commentid="server-id-1" class="comment-list__item">
            <span class="comment-nickname">作者 A</span>
            <div class="comment-text">第一条</div>
          </div>
        </div>
      </section>
    `;

    const doc = exportVisibleCommentsFromDocument(document, {
      id: "article-1",
      title: "Article",
      url: "https://mp.weixin.qq.com/",
      metadata: {}
    });

    expect(doc.export.completed).toBe(false);
    expect(doc.export.comment_count).toBe(1);
  });
});
