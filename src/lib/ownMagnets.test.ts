import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MagnetPoller,
  POLL_BASE_MS,
  POLL_JITTER_MS,
  SIGNED_URL_LIFETIME_MS,
  SIGNED_URL_MARGIN_MS,
  SIGNED_URL_RETRY_MS,
  SignedUrlCache,
  hasPendingMagnet,
  nextPollDelay,
  shouldPoll,
} from "./ownMagnets";

describe("pending magnets", () => {
  it("counts queued, printing and ready as pending, delivered and rejected as final", () => {
    expect(hasPendingMagnet([{ status: "queued" }])).toBe(true);
    expect(hasPendingMagnet([{ status: "printing" }])).toBe(true);
    expect(hasPendingMagnet([{ status: "ready" }])).toBe(true);
    expect(hasPendingMagnet([{ status: "delivered" }, { status: "rejected" }])).toBe(false);
    expect(hasPendingMagnet([])).toBe(false);
    expect(hasPendingMagnet([{ status: "delivered" }, { status: "queued" }])).toBe(true);
  });

  it("polls only while the page is visible and a magnet is pending", () => {
    expect(shouldPoll(true, [{ status: "queued" }])).toBe(true);
    expect(shouldPoll(false, [{ status: "queued" }])).toBe(false);
    expect(shouldPoll(true, [{ status: "delivered" }])).toBe(false);
    expect(shouldPoll(true, [])).toBe(false);
  });
});

describe("polling schedule", () => {
  it("waits 20 seconds give or take the jitter", () => {
    expect(nextPollDelay(() => 0.5)).toBe(POLL_BASE_MS);
    expect(nextPollDelay(() => 0)).toBe(POLL_BASE_MS - POLL_JITTER_MS);
    expect(nextPollDelay(() => 0.999999)).toBe(POLL_BASE_MS + POLL_JITTER_MS);
  });

  it("spreads guests over several seconds", () => {
    const delays = Array.from({ length: 300 }, () => nextPollDelay());
    expect(Math.min(...delays)).toBeGreaterThanOrEqual(POLL_BASE_MS - POLL_JITTER_MS);
    expect(Math.max(...delays)).toBeLessThanOrEqual(POLL_BASE_MS + POLL_JITTER_MS);
    const seconds = new Set(delays.map((ms) => Math.floor(ms / 1000)));
    expect(seconds.size).toBeGreaterThanOrEqual(5);
  });

  it("never waits less than a second", () => {
    expect(nextPollDelay(() => 0, 500, 2_000)).toBe(1_000);
  });
});

describe("signed URL cache", () => {
  it("signs a path once while the URL is fresh", async () => {
    let now = 0;
    const sign = vi.fn(async (path: string) => `signed:${path}:${now}`);
    const cache = new SignedUrlCache(sign, () => now);
    expect(await cache.get("a")).toBe("signed:a:0");
    now = SIGNED_URL_LIFETIME_MS - SIGNED_URL_MARGIN_MS - 1;
    expect(await cache.get("a")).toBe("signed:a:0");
    expect(sign).toHaveBeenCalledTimes(1);
  });

  it("signs again 5 minutes before the URL expires", async () => {
    let now = 0;
    const sign = vi.fn(async (path: string) => `signed:${path}:${now}`);
    const cache = new SignedUrlCache(sign, () => now);
    await cache.get("a");
    now = SIGNED_URL_LIFETIME_MS - SIGNED_URL_MARGIN_MS;
    expect(await cache.get("a")).toBe(`signed:a:${now}`);
    expect(sign).toHaveBeenCalledTimes(2);
  });

  it("shares one signing call between requests for the same path", async () => {
    const sign = vi.fn(async (path: string) => `signed:${path}`);
    const cache = new SignedUrlCache(sign, () => 0);
    const [a, b] = await Promise.all([cache.get("a"), cache.get("a")]);
    expect(a).toBe("signed:a");
    expect(b).toBe("signed:a");
    expect(sign).toHaveBeenCalledTimes(1);
  });

  it("keeps different paths apart", async () => {
    const sign = vi.fn(async (path: string) => `signed:${path}`);
    const cache = new SignedUrlCache(sign, () => 0);
    expect(await cache.get("a")).toBe("signed:a");
    expect(await cache.get("b")).toBe("signed:b");
    expect(sign).toHaveBeenCalledTimes(2);
  });

  it("tries a failed signing again after 2 minutes, not on every refresh", async () => {
    let now = 0;
    const sign = vi
      .fn<(path: string) => Promise<string | null>>()
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce("signed:a");
    const cache = new SignedUrlCache(sign, () => now);
    expect(await cache.get("a")).toBeNull();
    now = SIGNED_URL_RETRY_MS - 1;
    expect(await cache.get("a")).toBeNull();
    expect(sign).toHaveBeenCalledTimes(1);
    now = SIGNED_URL_RETRY_MS;
    expect(await cache.get("a")).toBeNull();
    expect(sign).toHaveBeenCalledTimes(2);
    now = 2 * SIGNED_URL_RETRY_MS;
    expect(await cache.get("a")).toBe("signed:a");
    expect(sign).toHaveBeenCalledTimes(3);
  });
});

describe("magnet poller", () => {
  type Job = { id: string; status: string };
  const queued: Job[] = [{ id: "a", status: "queued" }];
  const done: Job[] = [{ id: "a", status: "delivered" }];

  function setup(initial: Job[], answers: Job[][] = []) {
    let visible = true;
    const reads: number[] = [];
    const seen: Job[][] = [];
    let clock = 0;
    const read = vi.fn(async () => {
      reads.push(clock);
      return answers.length ? (answers.shift() as Job[]) : initial;
    });
    const poller = new MagnetPoller<Job>(initial, {
      read,
      visible: () => visible,
      onJobs: (jobs) => seen.push(jobs),
      random: () => 0.5,
      now: () => clock,
    });
    return {
      poller,
      read,
      reads,
      seen,
      setVisible: (value: boolean) => {
        visible = value;
      },
      advance: async (ms: number) => {
        clock += ms;
        await vi.advanceTimersByTimeAsync(ms);
      },
    };
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads every 20 seconds while visible with a pending magnet", async () => {
    const t = setup(queued);
    t.poller.start();
    await t.advance(19_999);
    expect(t.read).toHaveBeenCalledTimes(0);
    await t.advance(1);
    expect(t.read).toHaveBeenCalledTimes(1);
    await t.advance(20_000);
    expect(t.read).toHaveBeenCalledTimes(2);
    t.poller.stop();
  });

  it("does not read on a timer when every magnet is final", async () => {
    const t = setup(done);
    t.poller.start();
    expect(t.poller.polling).toBe(false);
    await t.advance(120_000);
    expect(t.read).toHaveBeenCalledTimes(0);
  });

  it("stops once a read shows every magnet final", async () => {
    const t = setup(queued, [done]);
    t.poller.start();
    await t.advance(20_000);
    expect(t.read).toHaveBeenCalledTimes(1);
    expect(t.seen).toEqual([done]);
    expect(t.poller.polling).toBe(false);
    await t.advance(120_000);
    expect(t.read).toHaveBeenCalledTimes(1);
  });

  it("stops while the page is hidden and reads at once when it is visible again", async () => {
    const t = setup(queued);
    t.poller.start();
    t.setVisible(false);
    await t.poller.visibilityChanged();
    expect(t.poller.polling).toBe(false);
    await t.advance(120_000);
    expect(t.read).toHaveBeenCalledTimes(0);
    t.setVisible(true);
    await t.poller.visibilityChanged();
    expect(t.read).toHaveBeenCalledTimes(1);
    expect(t.poller.polling).toBe(true);
  });

  it("reads once when several return events fire together", async () => {
    const t = setup(queued);
    t.poller.start();
    t.setVisible(false);
    await t.poller.visibilityChanged();
    await t.advance(60_000);
    t.setVisible(true);
    // visibilitychange and pageshow together, then focus a moment later.
    await Promise.all([t.poller.visibilityChanged(), t.poller.visibilityChanged()]);
    await t.advance(500);
    await t.poller.visibilityChanged();
    expect(t.read).toHaveBeenCalledTimes(1);
  });

  it("starts a new read after a send even while an older read is on its way", async () => {
    const newer: Job[] = [...queued, { id: "b", status: "queued" }];
    let releaseOld: (jobs: Job[]) => void = () => undefined;
    const t = setup(queued);
    t.read
      .mockImplementationOnce(() => new Promise<Job[]>((resolve) => (releaseOld = resolve)))
      .mockImplementationOnce(async () => newer);
    t.poller.start();
    t.setVisible(true);
    await t.advance(5_000);
    const old = t.poller.visibilityChanged();
    const fresh = await t.poller.refresh();
    expect(fresh).toEqual(newer);
    releaseOld(queued);
    expect(await old).toEqual(newer);
    expect(t.seen).toEqual([newer]);
  });

  it("keeps the last list and the timer after a failed read", async () => {
    const t = setup(queued);
    t.read.mockRejectedValueOnce(new Error("offline"));
    t.poller.start();
    await t.advance(20_000);
    expect(t.read).toHaveBeenCalledTimes(1);
    expect(t.seen).toEqual([]);
    expect(t.poller.polling).toBe(true);
    await t.advance(20_000);
    expect(t.read).toHaveBeenCalledTimes(2);
    t.poller.stop();
  });

  it("stops reading after stop()", async () => {
    const t = setup(queued);
    t.poller.start();
    t.poller.stop();
    await t.advance(120_000);
    expect(t.read).toHaveBeenCalledTimes(0);
  });
});
