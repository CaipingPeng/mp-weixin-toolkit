import { hasRecognizableCommentPage, parseCommentPage } from "../../src/wechat/responseParser";

describe("parseCommentPage", () => {
  it("extracts comments from a common list response", () => {
    const page = parseCommentPage(
      {
        base_resp: { ret: 0 },
        total: 3,
        comment_list: [
          {
            comment_id: "c1",
            content: "Root",
            reply_list: [{ comment_id: "r1", parent_id: "c1", content: "Reply" }]
          }
        ]
      },
      { offset: 0, count: 2 }
    );

    expect(page.records).toHaveLength(2);
    expect(page.total).toBe(3);
    expect(page.nextOffset).toBe(2);
    expect(page.hasMore).toBe(true);
  });

  it("marks login or risk responses as stop errors", () => {
    expect(() =>
      parseCommentPage({ base_resp: { ret: 200003, err_msg: "invalid session" } }, { offset: 0, count: 20 })
    ).toThrow(/session|risk|unexpected/i);
  });

  it("rejects non-empty responses that contain no comment list", () => {
    expect(() => parseCommentPage({ base_resp: { ret: 0 }, total: 10 }, { offset: 0, count: 20 })).toThrow(
      /comment list/i
    );
  });

  it("allows an empty article response", () => {
    const page = parseCommentPage({ base_resp: { ret: 0 }, total: 0, comment_list: [] }, { offset: 0, count: 20 });

    expect(page.records).toEqual([]);
    expect(page.hasMore).toBe(false);
  });

  it("recognizes only responses with a comment list payload", () => {
    expect(hasRecognizableCommentPage({ base_resp: { ret: 0 }, total: 1, comment_list: [{ comment_id: "c1" }] })).toBe(
      true
    );
    expect(
      hasRecognizableCommentPage({
        base_resp: { ret: 0 },
        comment_list: JSON.stringify({ comment: [{ content_id: "c1", content: "Root" }] })
      })
    ).toBe(true);
    expect(hasRecognizableCommentPage({ base_resp: { ret: 0 }, setting: { comment_enabled: true } })).toBe(false);
  });

  it("extracts visible comments from the rendered comment list HTML", () => {
    const page = parseCommentPage(
      `
        <section class="comment-list-container">
          <div class="filter-bar">
            <span class="weui-desktop-form__dropdown__value">全部留言(17条)</span>
          </div>
          <div class="comment-list-wrp">
            <div data-commentid="same-server-id" class="comment-list__item">
              <img class="avatar private" src="https://example.com/a.png">
              <span class="comment-nickname"><span>作者 A</span></span>
              <div class="comment_opr_meta__like"><span>3</span></div>
              <div class="comment-text">第一条</div>
              <div class="comment-list__item-time">昨天 12:10:12 湖南</div>
              <div class="reply-dialog__wrp">
                <div data-commentid="same-server-id" class="comment-list__item">
                  <span class="comment-nickname"><span>作者 A</span></span>
                  <div class="comment-text">第一条</div>
                  <div class="comment-list__item-time">昨天 12:10:12 湖南</div>
                </div>
              </div>
            </div>
            <div data-commentid="same-server-id" class="comment-list__item">
              <span class="comment-nickname"><span>作者 B</span></span>
              <div class="comment-text">第二条</div>
              <div class="comment-list__item-time">今天 09:00:00 北京</div>
            </div>
          </div>
        </section>
      `,
      { offset: 10, count: 2 }
    );

    expect(page.records).toHaveLength(2);
    expect(page.records[0]).toMatchObject({
      comment_id: "dom-11",
      nickname: "作者 A",
      content: "第一条",
      time: "昨天 12:10:12 湖南",
      like_count: 3,
      avatar_url: "https://example.com/a.png"
    });
    expect(page.records[1]).toMatchObject({ comment_id: "dom-12", nickname: "作者 B", content: "第二条" });
    expect(page.total).toBe(17);
    expect(page.hasMore).toBe(true);
  });

  it("extracts visible comments when rendered items do not expose data-commentid", () => {
    const page = parseCommentPage(
      `
        <section class="comment-list-container">
          <div class="filter-bar">
            <span class="weui-desktop-form__dropdown__value">全部留言(1条)</span>
          </div>
          <div class="comment-list-wrp">
            <div class="comment-list__item">
              <span class="comment-nickname">作者 C</span>
              <div class="comment-text">没有 data id 的留言</div>
              <div class="comment-list__item-time">刚刚 上海</div>
            </div>
          </div>
        </section>
      `,
      { offset: 0, count: 1 }
    );

    expect(page.records).toHaveLength(1);
    expect(page.records[0]).toMatchObject({
      comment_id: "dom-1",
      nickname: "作者 C",
      content: "没有 data id 的留言",
      time: "刚刚 上海"
    });
  });

  it("extracts top-level comments from the WeChat #commentlist container", () => {
    const page = parseCommentPage(
      `
        <section class="comment-list-container">
          <div class="filter-bar">
            <span class="weui-desktop-form__dropdown__value">全部留言(17条)</span>
          </div>
          <div id="commentlist">
            <div class="weui-desktop-panel__bd">
              <div class="loading-area">加载中</div>
              <div data-commentid="root-1" class="comment-list__item with-comment-reply">
                <div class="comment-list__item-container">
                  <div class="comment-list__item-bd">
                    <span class="comment-nickname">根作者</span>
                    <div class="comment_opr_meta__like"><span>5</span></div>
                    <div class="comment-text">根留言内容</div>
                    <div class="comment-list__item-time">07-03 12:10:12 湖南</div>
                  </div>
                </div>
                <div class="comment-reply-box">输入回复</div>
                <div class="comment-list__item comment-reply">
                  <div class="comment-list__item-extend">共8条回复</div>
                  <div class="reply-dialog__wrp">
                    <div class="comment-list__item">
                      <span class="comment-nickname">弹窗作者</span>
                      <div class="comment-text">弹窗里的重复内容</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      `,
      { offset: 0, count: 1 }
    );

    expect(page.records).toHaveLength(1);
    expect(page.records[0]).toMatchObject({
      comment_id: "dom-1",
      raw_comment_id: "root-1",
      nickname: "根作者",
      content: "根留言内容",
      time: "07-03 12:10:12 湖南",
      like_count: 5
    });
  });
});
