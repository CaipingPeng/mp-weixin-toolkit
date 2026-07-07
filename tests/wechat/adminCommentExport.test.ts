import { exportWechatAdminComments } from "../../src/wechat/adminCommentExport";
import type { DiscoveredRequest } from "../../src/wechat/requestDiscovery";

describe("exportWechatAdminComments", () => {
  it("exports the selected article comments and paginated replies from WeChat admin APIs", async () => {
    const calls: string[] = [];
    const initialRequest: DiscoveredRequest = {
      url: "https://mp.weixin.qq.com/misc/appmsgcomment?action=list_latest_comment&begin=0&count=10&sendtype=MASSSEND&token=test&lang=zh_CN",
      method: "GET"
    };

    const doc = await exportWechatAdminComments({
      initialRequest,
      article: { id: "", title: "", url: "https://mp.weixin.qq.com/misc/appmsgcomment", metadata: {} },
      count: 2,
      replyCount: 1,
      now: () => "2026-07-07T12:00:00.000Z",
      fetchPage: async (request) => {
        calls.push(request.url);
        const url = new URL(request.url);
        const action = url.searchParams.get("action");

        if (action === "list_latest_comment") {
          return {
            base_resp: { ret: 0, err_msg: "ok" },
            app_msg_list: JSON.stringify({
              app_msg: [
                {
                  item: { comment_id: "article-comment-1", title: "Article title" }
                }
              ]
            })
          };
        }

        if (action === "list_comment") {
          const begin = Number(url.searchParams.get("begin"));
          return {
            base_resp: { ret: 0, err_msg: "ok" },
            comment_list: JSON.stringify({
              total_count: 4,
              total_shield_count: 1,
              comment:
                begin === 0
                  ? [
                      {
                        comment_id: "article-comment-1",
                        content_id: "root-1",
                        nick_name: "Root A",
                        icon: "https://example.com/a.png",
                        content: "Root one",
                        post_time: 1710000000,
                        like_num: 2,
                        new_reply: {
                          reply_total_cnt: 2,
                          max_reply_id: 3,
                          reply_list: [
                            {
                              reply_id: 3,
                              nick_name: "Reply A",
                              logo_url: "https://example.com/r.png",
                              content: "Existing reply",
                              create_time: 1710000060,
                              reply_like_num: 1
                            }
                          ]
                        }
                      },
                      {
                        comment_id: "article-comment-1",
                        content_id: "root-2",
                        nick_name: "Root B",
                        content: "Root two",
                        post_time: 1710000100,
                        new_reply: { reply_total_cnt: 0, max_reply_id: 0, reply_list: [] }
                      }
                    ]
                  : [
                      {
                        comment_id: "article-comment-1",
                        content_id: "root-3",
                        nick_name: "Root C",
                        content: "Root three",
                        post_time: 1710000200,
                        new_reply: { reply_total_cnt: 0, max_reply_id: 0, reply_list: [] }
                      }
                    ]
            })
          };
        }

        if (action === "get_comment_reply") {
          return {
            base_resp: { ret: 0, err_msg: "ok" },
            continue_flag: 0,
            reply_list: {
              max_reply_id: 2,
              reply_list: [
                {
                  reply_id: 2,
                  nick_name: "Reply B",
                  logo_url: "https://example.com/r2.png",
                  content: "Fetched reply",
                  create_time: 1710000120,
                  reply_like_num: 4
                }
              ]
            }
          };
        }

        throw new Error(`Unexpected action: ${action}`);
      }
    });

    expect(calls.some((url) => url.includes("action=list_latest_comment"))).toBe(true);
    expect(calls.filter((url) => url.includes("action=list_comment"))).toHaveLength(2);
    expect(calls.some((url) => url.includes("type=4"))).toBe(false);
    expect(calls.some((url) => url.includes("action=get_comment_reply"))).toBe(true);
    expect(doc.article.id).toBe("article-comment-1");
    expect(doc.article.title).toBe("Article title");
    expect(doc.export.completed).toBe(true);
    expect(doc.export.root_comment_count).toBe(3);
    expect(doc.export.comment_count).toBe(5);
    expect(doc.comments[0].id).toBe("root-1");
    expect(doc.comments[0].author.nickname).toBe("Root A");
    expect(doc.comments[0].author.avatar_url).toBe("https://example.com/a.png");
    expect(doc.comments[0].replies.map((reply) => reply.content)).toEqual(["Existing reply", "Fetched reply"]);
  });

  it("exports comments when the discovered request already points at the switched article", async () => {
    const calls: string[] = [];
    const initialRequest: DiscoveredRequest = {
      url: "https://mp.weixin.qq.com/misc/appmsgcomment?action=list_comment&begin=0&count=10&comment_id=article-comment-2&filtertype=0&day=0&type=0&max_id=0&token=test&lang=zh_CN",
      method: "GET"
    };

    const doc = await exportWechatAdminComments({
      initialRequest,
      article: { id: "", title: "Switched article", url: "https://mp.weixin.qq.com/misc/appmsgcomment", metadata: {} },
      count: 10,
      now: () => "2026-07-07T12:00:00.000Z",
      fetchPage: async (request) => {
        calls.push(request.url);
        const url = new URL(request.url);
        const action = url.searchParams.get("action");

        if (action === "list_latest_comment") {
          throw new Error("Should not request latest comments after switching articles");
        }

        if (action === "list_comment") {
          expect(url.searchParams.get("comment_id")).toBe("article-comment-2");
          return {
            base_resp: { ret: 0, err_msg: "ok" },
            comment_list: JSON.stringify({
              total_count: 1,
              total_shield_count: 0,
              comment: [
                {
                  comment_id: "article-comment-2",
                  content_id: "root-21",
                  nick_name: "Root switched",
                  content: "Switched article root",
                  post_time: 1710000300,
                  new_reply: { reply_total_cnt: 0, max_reply_id: 0, reply_list: [] }
                }
              ]
            })
          };
        }

        throw new Error(`Unexpected action: ${action}`);
      }
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("action=list_comment");
    expect(calls[0]).toContain("comment_id=article-comment-2");
    expect(doc.article.id).toBe("article-comment-2");
    expect(doc.article.title).toBe("Switched article");
    expect(doc.export.root_comment_count).toBe(1);
    expect(doc.comments[0].content).toBe("Switched article root");
  });
});
