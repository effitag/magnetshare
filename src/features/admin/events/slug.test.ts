import { describe, expect, it } from "vitest";
import { randomSuffix, suggestSlug } from "./slug";

describe("event links", () => {
  it("ends every new link with ten random letters or digits", () => {
    const suffixes = new Set(Array.from({ length: 200 }, () => randomSuffix()));
    for (const suffix of suffixes) expect(suffix).toMatch(/^[a-z0-9]{10}$/);
    expect(suffixes.size).toBe(200);
  });

  it("keeps the whole random part, even after a long English name", () => {
    const slug = suggestSlug("Jonathan and Rebecca", "abcdefghij");
    expect(slug).toBe("jonathabcdefghij");
    expect(slug.length).toBeLessThanOrEqual(16);
    expect(suggestSlug("החתונה של נועה", "abcdefghij")).toBe("eventabcdefghij");
  });

  it("matches the database slug format", () => {
    for (let i = 0; i < 50; i += 1) {
      expect(suggestSlug("רון ♥ מאיה")).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });
});
