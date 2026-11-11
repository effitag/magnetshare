import { describe, expect, it, vi } from "vitest";
import {
  RETRY_FOR_MS,
  SendFailed,
  classifyFailure,
  retryDelay,
  retryTransient,
  startSend,
  type SendEnv,
  type SendSteps,
} from "./sendRetry";

describe("which failures are retried", () => {
  it.each([
    [{ detail: "TypeError: Failed to fetch" }, "retry"],
    [{ detail: "TypeError: Load failed" }, "retry"],
    [{ detail: "TypeError: network timeout after 45000 ms" }, "retry"],
    [{ detail: "StorageUnknownError: fetch failed" }, "retry"],
    [{ detail: "AuthRetryableFetchError: Failed to fetch" }, "retry"],
    [{ status: 0 }, "retry"],
    [{ status: 503 }, "retry"],
    [{ status: 429 }, "retry"],
    [{ status: 408 }, "retry"],
    [{ code: "PGRST003" }, "retry"],
    [{ code: "57014" }, "retry"],
    [{ code: "photo_not_uploaded" }, "reupload"],
    [{ status: 401 }, "reauth"],
    [{ detail: "jwt expired" }, "reauth"],
    [{ code: "not_authenticated" }, "reauth"],
    [{ code: "print_quota_exceeded", status: 400 }, "stop"],
    [{ code: "event_not_live" }, "stop"],
    [{ code: "frame_not_in_event" }, "stop"],
    [{ code: "storage_path_not_yours" }, "stop"],
    [{ status: 413 }, "stop"],
    [{ status: 403, detail: "new row violates row-level security policy" }, "stop"],
  ])("%j → %s", (error, kind) => {
    expect(classifyFailure(error)).toBe(kind);
  });
});

describe("waits between attempts", () => {
  it("grows from about 1 to about 7 seconds, moved by up to a quarter", () => {
    expect(retryDelay(0, () => 0.5)).toBe(1_000);
    expect(retryDelay(1, () => 0.5)).toBe(3_000);
    expect(retryDelay(2, () => 0.5)).toBe(7_000);
    expect(retryDelay(9, () => 0.5)).toBe(7_000);
    expect(retryDelay(0, () => 0)).toBe(750);
    expect(retryDelay(0, () => 0.999999)).toBe(1_250);
  });
});

/** A phone with a fake clock: waits pass instantly and move the clock. */
function phone() {
  let clock = 0;
  let online = true;
  let reconnect: () => void = () => undefined;
  const states: string[] = [];
  const env: SendEnv = {
    online: () => online,
    waitUntilOnline: (wake) =>
      new Promise<void>((resolve) => {
        reconnect = resolve;
        void wake.then(resolve);
      }),
    sleep: async (ms) => {
      clock += ms;
    },
    now: () => clock,
    random: () => 0.5,
    onState: (state) => states.push(state),
  };
  return {
    env,
    states,
    goOffline: () => (online = false),
    goOnline: (afterMs = 0) => {
      clock += afterMs;
      online = true;
      reconnect();
    },
    advance: (ms: number) => (clock += ms),
  };
}

function steps(overrides: Partial<SendSteps> = {}): SendSteps & { calls: string[] } {
  const calls: string[] = [];
  const base: SendSteps = {
    uploadPhoto: async () => void calls.push("photo"),
    uploadThumb: async () => void calls.push("thumb"),
    createMagnet: async () => {
      calls.push("create");
      return "job-1";
    },
    refreshSession: async () => void calls.push("refresh"),
  };
  return Object.assign({ ...base, ...overrides }, { calls });
}

const network = () =>
  Object.assign(new Error("TypeError: Failed to fetch"), { detail: "TypeError: Failed to fetch" });
const refusal = (code: string) => Object.assign(new Error(code), { code });

describe("send", () => {
  it("uploads the photo and the thumbnail at the same time, then creates the magnet", async () => {
    let photoDone: () => void = () => undefined;
    const s = steps({
      uploadPhoto: () => new Promise<void>((resolve) => (photoDone = resolve)),
    });
    const thumbSpy = vi.spyOn(s, "uploadThumb");
    const run = startSend(s, phone().env);
    await Promise.resolve();
    expect(thumbSpy).toHaveBeenCalled();
    photoDone();
    expect(await run.done).toBe("job-1");
  });

  it("retries a dropped connection and creates one magnet", async () => {
    let failures = 1;
    const s = steps({
      createMagnet: async () => {
        if (failures-- > 0) throw network();
        return "job-1";
      },
    });
    const p = phone();
    expect(await startSend(s, p.env).done).toBe("job-1");
    expect(p.states).toEqual(["sending", "retrying", "sending"]);
  });

  it("does not upload again what is already stored when only creating the magnet failed", async () => {
    let failures = 2;
    const s = steps({
      createMagnet: async () => {
        if (failures-- > 0) throw network();
        return "job-1";
      },
    });
    await startSend(s, phone().env).done;
    expect(s.calls.filter((call) => call === "photo")).toHaveLength(1);
  });

  it("stops at once on a real refusal", async () => {
    const s = steps({ createMagnet: async () => Promise.reject(refusal("print_quota_exceeded")) });
    const error = await startSend(s, phone().env).done.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SendFailed);
    expect((error as SendFailed).reason).toBe("stop");
  });

  it("blocks the magnet while the thumbnail fails, and retries it", async () => {
    let failures = 2;
    const s = steps({
      uploadThumb: async () => {
        if (failures-- > 0) throw network();
      },
    });
    const createSpy = vi.spyOn(s, "createMagnet");
    expect(await startSend(s, phone().env).done).toBe("job-1");
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(s.calls.filter((call) => call === "photo")).toHaveLength(1);
  });

  it("uploads again when the server says the photo is missing", async () => {
    let missing = 1;
    const s = steps({
      createMagnet: async () => {
        if (missing-- > 0) throw refusal("photo_not_uploaded");
        return "job-1";
      },
    });
    await startSend(s, phone().env).done;
    expect(s.calls.filter((call) => call === "photo")).toHaveLength(2);
    expect(s.calls.filter((call) => call === "thumb")).toHaveLength(2);
  });

  it("renews the sign-in after it expired, then retries", async () => {
    let expired = 1;
    const s = steps({
      createMagnet: async () => {
        if (expired-- > 0) throw Object.assign(new Error("jwt"), { status: 401 });
        return "job-1";
      },
    });
    await startSend(s, phone().env).done;
    expect(s.calls).toContain("refresh");
  });

  it("gives up after about 2 minutes of retries online", async () => {
    const s = steps({ createMagnet: async () => Promise.reject(network()) });
    const p = phone();
    const error = await startSend(s, p.env).done.catch((e: unknown) => e);
    expect((error as SendFailed).reason).toBe("exhausted");
    expect(p.env.now()).toBeGreaterThanOrEqual(RETRY_FOR_MS);
    expect(p.env.now()).toBeLessThan(RETRY_FOR_MS + 10_000);
  });

  it("waits while offline without using up the 2 minutes, and resumes on reconnect", async () => {
    const p = phone();
    let first = true;
    const s = steps({
      uploadPhoto: async () => {
        if (first) {
          first = false;
          p.goOffline();
          throw network();
        }
      },
    });
    const run = startSend(s, p.env);
    await vi.waitFor(() => expect(p.states).toContain("offline"));
    p.goOnline(10 * 60_000);
    expect(await run.done).toBe("job-1");
  });

  it("'נסו עכשיו' ends the offline wait at once", async () => {
    const p = phone();
    p.goOffline();
    const run = startSend(steps(), p.env);
    await vi.waitFor(() => expect(p.states).toContain("offline"));
    run.retryNow();
    expect(await run.done).toBe("job-1");
  });

  it("a lost answer: the retry gets the same magnet", async () => {
    let created: string | null = null;
    let lost = true;
    const s = steps({
      createMagnet: async () => {
        created ??= "job-1";
        if (lost) {
          lost = false;
          throw network();
        }
        return created;
      },
    });
    expect(await startSend(s, phone().env).done).toBe("job-1");
  });
});

describe("retry with fixed waits", () => {
  it("retries a passing failure and tells the screen to wait", async () => {
    let failures = 2;
    const onWait = vi.fn();
    const result = await retryTransient(
      async () => {
        if (failures-- > 0) throw Object.assign(new Error("busy"), { status: 429 });
        return "guest-1";
      },
      { delays: [2_000, 5_000, 10_000], onWait, sleep: async () => undefined },
    );
    expect(result).toBe("guest-1");
    expect(onWait).toHaveBeenCalledTimes(2);
  });

  it("stops at once on a refusal and after the last wait", async () => {
    const refused = retryTransient(async () => Promise.reject(refusal("event_not_live")), {
      delays: [1, 1],
      sleep: async () => undefined,
    });
    await expect(refused).rejects.toThrow("event_not_live");
    const task = vi.fn(async () => Promise.reject(network()));
    await expect(
      retryTransient(task, { delays: [1, 1], sleep: async () => undefined }),
    ).rejects.toThrow();
    expect(task).toHaveBeenCalledTimes(3);
  });
});
