import { describe, expect, it } from "vitest";
import { escapeHtml, plainLine } from "./escapeHtml";

describe("escapeHtml", () => {
  it("turns markup typed by a visitor into plain text", () => {
    expect(escapeHtml('<a href="https://evil.example">Pay here</a>')).toBe(
      "&lt;a href=&quot;https://evil.example&quot;&gt;Pay here&lt;/a&gt;",
    );
    expect(escapeHtml("Tom & 'Jerry'")).toBe("Tom &amp; &#39;Jerry&#39;");
    expect(escapeHtml(null)).toBe("");
  });
  it("keeps email subjects on one line", () => {
    expect(plainLine("Hi\r\nBcc: x@y.z")).toBe("Hi Bcc: x@y.z");
  });
});
