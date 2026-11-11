import { describe, expect, it } from "vitest";
import {
  counterLine,
  overTargetLine,
  parseTarget,
  sentMagnets,
  targetBadge,
  targetLevel,
  targetShare,
} from "./magnetTarget";

describe("sentMagnets", () => {
  it("counts every status except rejected", () => {
    expect(sentMagnets({ queued: 3, printing: 2, ready: 1, delivered: 4, rejected: 7 })).toBe(10);
  });
});

describe("targetLevel", () => {
  it("is none without a target", () => {
    expect(targetLevel(500, null)).toBe("none");
    expect(targetLevel(500, 0)).toBe("none");
  });

  it("alerts at exactly 80% and at the target", () => {
    expect(targetLevel(79, 100)).toBe("under");
    expect(targetLevel(80, 100)).toBe("near");
    expect(targetLevel(99, 100)).toBe("near");
    expect(targetLevel(100, 100)).toBe("reached");
    expect(targetLevel(140, 100)).toBe("reached");
  });

  it("does not round 80% up", () => {
    // 7 of 9 is 77.8%; 8 of 9 is 88.9%.
    expect(targetLevel(7, 9)).toBe("under");
    expect(targetLevel(8, 9)).toBe("near");
    // 4 of 5 is exactly 80%.
    expect(targetLevel(4, 5)).toBe("near");
  });
});

describe("targetShare", () => {
  it("stays between 0 and 1", () => {
    expect(targetShare(50, 200)).toBe(0.25);
    expect(targetShare(300, 200)).toBe(1);
    expect(targetShare(10, null)).toBe(0);
  });
});

describe("texts", () => {
  it("shows X of Y, or X alone without a target", () => {
    expect(counterLine(120, 300)).toBe("120 מתוך 300 מגנטים");
    expect(counterLine(120, null)).toBe("120 מגנטים");
    expect(counterLine(1, null)).toBe("מגנט אחד");
  });

  it("keeps counting past the target", () => {
    expect(overTargetLine(312, 300)).toBe("+12 מעל היעד");
    expect(overTargetLine(300, 300)).toBeNull();
    expect(overTargetLine(312, null)).toBeNull();
  });

  it("badges only near and reached", () => {
    expect(targetBadge("reached")).toBe("הגיע ליעד");
    expect(targetBadge("near")).toBe("80% מהיעד");
    expect(targetBadge("under")).toBeNull();
    expect(targetBadge("none")).toBeNull();
  });
});

describe("parseTarget", () => {
  it("reads an empty field as no target", () => {
    expect(parseTarget("")).toBeNull();
    expect(parseTarget("  ")).toBeNull();
  });

  it("accepts whole numbers from 1", () => {
    expect(parseTarget("300")).toBe(300);
    expect(parseTarget(" 45 ")).toBe(45);
  });

  it("rejects anything else", () => {
    expect(parseTarget("0")).toBeUndefined();
    expect(parseTarget("-5")).toBeUndefined();
    expect(parseTarget("2.5")).toBeUndefined();
    expect(parseTarget("abc")).toBeUndefined();
  });
});
