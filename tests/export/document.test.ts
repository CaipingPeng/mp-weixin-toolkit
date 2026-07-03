import { buildExportDocument } from "../../src/export/document";
import { normalizeRawComment } from "../../src/export/normalizer";
import { buildCommentTree } from "../../src/export/tree";

describe("comment export document", () => {
  it("normalizes root comments and replies into a tree export document", () => {
    const raw = [
      {
        comment_id: "c1",
        nick_name: "Alice",
        content: "Root comment",
        create_time: 1710000000,
        like_num: 3,
        reply_count: 1,
        status: "elected",
        extra_field: "kept"
      },
      {
        comment_id: "r1",
        parent_id: "c1",
        nick_name: "Bob",
        content: "Reply",
        create_time: 1710000060,
        like_num: 1
      }
    ];

    const nodes = raw.map(normalizeRawComment);
    const tree = buildCommentTree(nodes);
    const doc = buildExportDocument({
      article: { id: "article-1", title: "Example", url: "https://mp.weixin.qq.com/example", metadata: {} },
      comments: tree,
      exportedAt: "2026-07-04T12:00:00+08:00"
    });

    expect(doc.schema_version).toBe(1);
    expect(doc.export.comment_count).toBe(2);
    expect(doc.export.root_comment_count).toBe(1);
    expect(doc.export.reply_count).toBe(1);
    expect(doc.comments[0].id).toBe("c1");
    expect(doc.comments[0].author.nickname).toBe("Alice");
    expect(doc.comments[0].created_at).toBe("2024-03-09T16:00:00.000Z");
    expect(doc.comments[0].metadata.extra_field).toBe("kept");
    expect(doc.comments[0].replies[0].id).toBe("r1");
  });

  it("keeps orphan replies as root nodes with metadata flag", () => {
    const nodes = [
      normalizeRawComment({
        comment_id: "r2",
        parent_id: "missing",
        nick_name: "Carol",
        content: "Orphan reply"
      })
    ];

    const tree = buildCommentTree(nodes);

    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("r2");
    expect(tree[0].metadata.orphan_parent_id).toBe("missing");
  });
});
