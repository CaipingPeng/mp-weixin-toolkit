export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export interface CommentAuthor {
  nickname: string;
  account_id: string;
  avatar_url: string;
  metadata: JsonObject;
}

export interface NormalizedComment {
  id: string;
  parent_id: string | null;
  author: CommentAuthor;
  content: string;
  created_at: string;
  like_count: number;
  reply_count: number;
  status: string;
  metadata: JsonObject;
  replies: NormalizedComment[];
}

export interface ExportArticle {
  id: string;
  title: string;
  url: string;
  metadata: JsonObject;
}

export interface ExportDocument {
  schema_version: 1;
  exported_at: string;
  source: "wechat_mp_comment_admin";
  article: ExportArticle;
  export: {
    scope: "current_article_all_comments";
    comment_count: number;
    root_comment_count: number;
    reply_count: number;
    completed: boolean;
  };
  comments: NormalizedComment[];
}
