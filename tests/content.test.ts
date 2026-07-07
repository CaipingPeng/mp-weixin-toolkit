import { createCurrentPageCommentRequest } from "../src/wechat/requestDiscovery";

describe("content fallback request", () => {
  it("uses the current latest-comment page as a fallback export request", () => {
    const request = createCurrentPageCommentRequest(
      "https://mp.weixin.qq.com/misc/appmsgcomment?action=list_latest_comment&begin=0&count=10&token=secret&lang=zh_CN"
    );

    expect(request).toMatchObject({
      url: "https://mp.weixin.qq.com/misc/appmsgcomment?action=list_latest_comment&begin=0&count=10&token=secret&lang=zh_CN",
      method: "GET"
    });
  });

  it("does not use unrelated pages as fallback export requests", () => {
    expect(createCurrentPageCommentRequest("https://mp.weixin.qq.com/cgi-bin/home?t=home/index")).toBeNull();
  });
});
