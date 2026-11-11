import { describe, expect, it } from "vitest";
import {
  OUTBOX_MAX_AGE_MS,
  memoryOutbox,
  pendingSends,
  withFallback,
  type OutboxItem,
  type OutboxStore,
} from "./outbox";

function item(sendId: string, overrides: Partial<OutboxItem> = {}): OutboxItem {
  return {
    sendId,
    eventId: "event-1",
    guestId: "guest-1",
    frameId: "frame-1",
    copies: 1,
    photo: new Blob(["photo"], { type: "image/jpeg" }),
    thumb: new Blob(["thumb"], { type: "image/jpeg" }),
    savedAt: 1_000,
    ...overrides,
  };
}

function broken(): OutboxStore {
  const fail = async () => {
    throw new Error("QuotaExceededError");
  };
  return { put: fail, delete: fail, list: fail };
}

describe("outbox", () => {
  it("keeps a photo until it is removed", async () => {
    const store = memoryOutbox();
    await store.put(item("send-1"));
    expect((await store.list()).map((i) => i.sendId)).toEqual(["send-1"]);
    await store.delete("send-1");
    expect(await store.list()).toEqual([]);
  });

  it("falls back to memory when IndexedDB refuses", async () => {
    const fallback = memoryOutbox();
    const store = withFallback(broken(), fallback);
    await store.put(item("send-1"));
    expect((await store.list()).map((i) => i.sendId)).toEqual(["send-1"]);
    await store.delete("send-1");
    expect(await fallback.list()).toEqual([]);
  });

  it("lists this guest's unsent photos for this event, oldest first", async () => {
    const store = memoryOutbox();
    await store.put(item("later", { savedAt: 3_000 }));
    await store.put(item("first", { savedAt: 2_000 }));
    await store.put(item("other-event", { eventId: "event-2" }));
    const pending = await pendingSends(store, "event-1", "guest-1", 5_000);
    expect(pending.map((i) => i.sendId)).toEqual(["first", "later"]);
    expect((await store.list()).map((i) => i.sendId)).toContain("other-event");
  });

  it("drops photos older than a day, and photos another guest left on this phone for this event", async () => {
    const store = memoryOutbox();
    await store.put(item("old", { savedAt: 0 }));
    await store.put(item("someone-else", { guestId: "guest-2", savedAt: 10 }));
    await store.put(item("mine", { savedAt: OUTBOX_MAX_AGE_MS }));
    const pending = await pendingSends(store, "event-1", "guest-1", OUTBOX_MAX_AGE_MS + 1);
    expect(pending.map((i) => i.sendId)).toEqual(["mine"]);
    expect((await store.list()).map((i) => i.sendId)).toEqual(["mine"]);
  });
});
