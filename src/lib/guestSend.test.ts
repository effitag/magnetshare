import { describe, expect, it } from "vitest";
import { guestPhotoPaths, isAlreadyStored, newSendId } from "./guestSend";
import { thumbPathFromPhoto } from "./magnets";

describe("guest send", () => {
  it("makes a new UUID for every captured photo", () => {
    const a = newSendId();
    const b = newSendId();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a).not.toBe(b);
  });

  it("falls back to getRandomValues when randomUUID is missing", () => {
    const original = globalThis.crypto.randomUUID;
    try {
      Object.defineProperty(globalThis.crypto, "randomUUID", {
        value: undefined,
        configurable: true,
      });
      expect(newSendId()).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    } finally {
      Object.defineProperty(globalThis.crypto, "randomUUID", {
        value: original,
        configurable: true,
      });
    }
  });

  it("keeps the same paths for the same send, in the guest's folder for the event", () => {
    const first = guestPhotoPaths("event-1", "guest-1", "send-1");
    expect(first).toEqual({
      photo: "event-1/guest-1/send-1_photo.jpg",
      thumb: "event-1/guest-1/send-1_thumb.webp",
    });
    expect(guestPhotoPaths("event-1", "guest-1", "send-1")).toEqual(first);
  });

  it("finds the thumbnail of a send from its photo path", () => {
    const sendId = newSendId();
    const paths = guestPhotoPaths("event-1", "guest-1", sendId);
    expect(thumbPathFromPhoto(paths.photo)).toBe(paths.thumb);
  });

  it("treats only an existing file as already stored", () => {
    expect(isAlreadyStored({ status: 409, message: "x" })).toBe(true);
    expect(
      isAlreadyStored({ status: 400, statusCode: "409", message: "The resource already exists" }),
    ).toBe(true);
    expect(isAlreadyStored({ error: "Duplicate" })).toBe(true);
    expect(
      isAlreadyStored({
        status: 403,
        statusCode: "403",
        message: "new row violates row-level security policy",
      }),
    ).toBe(false);
    expect(isAlreadyStored({ status: 413, message: "Payload too large" })).toBe(false);
    expect(isAlreadyStored(new TypeError("Failed to fetch"))).toBe(false);
    expect(isAlreadyStored(null)).toBe(false);
  });
});
