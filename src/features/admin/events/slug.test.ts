import { describe, expect, it } from "vitest";
import { guestEventUrl, isPastDate, isSlug, suggestSlug } from "./slug";

describe("event slug", () => {
  it("keeps a short latin slug and drops everything else", () => {
    expect(suggestSlug("Noa & Itai", "ab12")).toBe("noaitaiab12");
    expect(suggestSlug("חתונה של נועה", "ab12")).toBe("eventab12");
    expect(suggestSlug("Party 2026", "zz")).toMatch(/^[a-z0-9]+$/);
    expect(isSlug(suggestSlug("חתונה", "k3"))).toBe(true);
  });

  it("rejects spaces, capitals, and hyphens", () => {
    expect(isSlug("noa-itai")).toBe(false);
    expect(isSlug("Noa")).toBe(false);
    expect(isSlug("")).toBe(false);
    expect(isSlug("a".repeat(33))).toBe(false);
  });

  it("builds the public guest link", () => {
    expect(guestEventUrl("eventab12")).toBe("https://www.magnetimshare.com/e/eventab12");
  });

  it("warns only for a date before today", () => {
    expect(isPastDate("2000-01-01")).toBe(true);
    expect(isPastDate("2999-01-01")).toBe(false);
    expect(isPastDate("")).toBe(false);
  });
});
