import { isCommentListRequest, sanitizeDiscoveredRequest } from "../../src/wechat/requestDiscovery";

describe("request discovery", () => {
  it("detects appmsgcomment list requests", () => {
    expect(
      isCommentListRequest({
        url: "https://mp.weixin.qq.com/misc/appmsgcomment?action=list_comment&token=secret",
        method: "GET",
        body: ""
      })
    ).toBe(true);
  });

  it("removes sensitive token-like fields from sanitized copies", () => {
    const sanitized = sanitizeDiscoveredRequest({
      url: "https://mp.weixin.qq.com/misc/appmsgcomment?action=list_comment&token=secret&begin=0",
      method: "GET",
      body: "token=secret&begin=0",
      headers: { "x-test": "ok", cookie: "hidden" }
    });

    expect(sanitized.url).not.toContain("secret");
    expect(sanitized.body).not.toContain("secret");
    expect(sanitized.headers?.cookie).toBeUndefined();
  });
});
