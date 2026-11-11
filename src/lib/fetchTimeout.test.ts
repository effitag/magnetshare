import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CREATE_MAGNET_TIMEOUT_MS,
  DEFAULT_TIMEOUT_MS,
  UPLOAD_TIMEOUT_MS,
  fetchWithTimeouts,
  requestTimeoutMs,
} from "./fetchTimeout";

const BASE = "https://lab.supabase.co";

describe("request timeouts", () => {
  it("gives a guest upload 45 seconds", () => {
    expect(
      requestTimeoutMs(`${BASE}/storage/v1/object/media/event/guest/send_photo.jpg`, "POST"),
    ).toBe(UPLOAD_TIMEOUT_MS);
  });

  it("gives creating a magnet 15 seconds", () => {
    expect(requestTimeoutMs(`${BASE}/rest/v1/rpc/create_guest_print`, "POST")).toBe(
      CREATE_MAGNET_TIMEOUT_MS,
    );
  });

  it("gives reads, sign-in and signed URLs 20 seconds", () => {
    expect(requestTimeoutMs(`${BASE}/rest/v1/print_jobs?select=id`, "GET")).toBe(
      DEFAULT_TIMEOUT_MS,
    );
    expect(requestTimeoutMs(`${BASE}/auth/v1/signup`, "POST")).toBe(DEFAULT_TIMEOUT_MS);
    expect(
      requestTimeoutMs(`${BASE}/storage/v1/object/sign/media/event/guest/send_thumb.webp`, "POST"),
    ).toBe(DEFAULT_TIMEOUT_MS);
  });

  it("leaves admin frame and cover files without a limit", () => {
    expect(
      requestTimeoutMs(`${BASE}/storage/v1/object/media/frames/f1/overlay.png`, "POST"),
    ).toBeNull();
    expect(
      requestTimeoutMs(`${BASE}/storage/v1/object/media/events/e1/cover.jpg`, "PUT"),
    ).toBeNull();
    expect(
      requestTimeoutMs(`${BASE}/storage/v1/object/sign/media/frames/f1/screen.webp`, "POST"),
    ).toBeNull();
  });
});

describe("fetch with timeouts", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  /** A fetch that only ends when its signal aborts. */
  const hanging: typeof fetch = (_input, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () =>
        reject(new DOMException("aborted", "AbortError")),
      );
    });

  it("fails like a dropped connection when the time runs out", async () => {
    const run = fetchWithTimeouts(hanging)(`${BASE}/rest/v1/rpc/create_guest_print`, {
      method: "POST",
    });
    const caught = run.catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(CREATE_MAGNET_TIMEOUT_MS);
    const error = await caught;
    expect(error).toBeInstanceOf(TypeError);
    expect(String((error as Error).message)).toContain("network timeout");
  });

  it("returns the answer when it comes in time", async () => {
    const ok: typeof fetch = async () => new Response("ok", { status: 200 });
    const response = await fetchWithTimeouts(ok)(`${BASE}/rest/v1/print_jobs`);
    expect(await response.text()).toBe("ok");
  });

  it("keeps the caller's own abort", async () => {
    const controller = new AbortController();
    const run = fetchWithTimeouts(hanging)(`${BASE}/rest/v1/print_jobs`, {
      signal: controller.signal,
    });
    const caught = run.catch((error: unknown) => error);
    controller.abort();
    const error = await caught;
    expect((error as Error).name).toBe("AbortError");
  });

  it("does not time out an admin frame upload", async () => {
    let settled = false;
    const run = fetchWithTimeouts(hanging)(
      `${BASE}/storage/v1/object/media/frames/f1/overlay.png`,
      {
        method: "POST",
      },
    );
    void run.catch(() => undefined).finally(() => (settled = true));
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(settled).toBe(false);
  });
});
