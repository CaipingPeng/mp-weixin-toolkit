import { exportAllComments } from "../../src/export/orchestrator";
import type { DiscoveredRequest } from "../../src/wechat/requestDiscovery";

describe("exportAllComments", () => {
  it("fetches pages serially and returns a completed export document", async () => {
    const calls: string[] = [];
    const request: DiscoveredRequest = {
      url: "https://mp.weixin.qq.com/misc/appmsgcomment?action=list_comment&begin=0&count=1",
      method: "GET"
    };

    const fetchPage = vi.fn(async (nextRequest: DiscoveredRequest) => {
      calls.push(nextRequest.url);
      const begin = new URL(nextRequest.url).searchParams.get("begin");
      return begin === "0"
        ? { base_resp: { ret: 0 }, total: 2, comment_list: [{ comment_id: "c1", content: "One" }] }
        : { base_resp: { ret: 0 }, total: 2, comment_list: [{ comment_id: "c2", content: "Two" }] };
    });

    const doc = await exportAllComments({
      initialRequest: request,
      article: { id: "a1", title: "Article", url: "https://mp.weixin.qq.com/s/example", metadata: {} },
      count: 1,
      fetchPage,
      delay: async () => undefined,
      now: () => "2026-07-04T12:00:00+08:00"
    });

    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(calls[0]).toContain("begin=0");
    expect(calls[1]).toContain("begin=1");
    expect(doc.export.completed).toBe(true);
    expect(doc.export.comment_count).toBe(2);
  });

  it("stops instead of downloading partial data when the API returns a risk response", async () => {
    await expect(
      exportAllComments({
        initialRequest: {
          url: "https://mp.weixin.qq.com/misc/appmsgcomment?action=list_comment&begin=0&count=20",
          method: "GET"
        },
        article: { id: "a1", title: "Article", url: "https://mp.weixin.qq.com/s/example", metadata: {} },
        fetchPage: async () => ({ base_resp: { ret: 200003, err_msg: "risk control" } }),
        delay: async () => undefined
      })
    ).rejects.toThrow(/risk|session|unexpected/i);
  });

  it("stops when the max page limit is reached before the end", async () => {
    await expect(
      exportAllComments({
        initialRequest: {
          url: "https://mp.weixin.qq.com/misc/appmsgcomment?action=list_comment&begin=0&count=1",
          method: "GET"
        },
        article: { id: "a1", title: "Article", url: "https://mp.weixin.qq.com/s/example", metadata: {} },
        count: 1,
        maxPages: 1,
        fetchPage: async () => ({ base_resp: { ret: 0 }, total: 2, comment_list: [{ comment_id: "c1" }] }),
        delay: async () => undefined
      })
    ).rejects.toThrow(/max page/i);
  });
});
