import { mountExportButton } from "../../src/ui/exportButton";

describe("mountExportButton", () => {
  it("mounts one button and updates status", () => {
    const host = document.createElement("div");
    document.body.append(host);

    const control = mountExportButton(host, vi.fn());
    control.setStatus("ready");
    control.setBusy(false);

    expect(host.querySelectorAll("button")).toHaveLength(1);
    expect(host.textContent).toContain("Export JSON");
    expect(host.textContent).toContain("ready");
  });
});
