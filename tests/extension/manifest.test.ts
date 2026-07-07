import manifest from "../../public/manifest.json";

describe("extension manifest", () => {
  it("injects the content script at document_start so the page bridge can observe initial requests", () => {
    expect(manifest.content_scripts[0].run_at).toBe("document_start");
  });
});
