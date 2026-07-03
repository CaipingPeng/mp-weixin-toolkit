import { parseCommentPage } from "../../src/wechat/responseParser";

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
});
