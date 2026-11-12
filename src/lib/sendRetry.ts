/**
 * Reliable send: retry what can pass (a dropped connection, a timeout, a busy
 * server), stop at once on a real refusal (quota used up, event closed, frame
 * changed), and keep waiting while the phone is offline.
 *
 * Every retry is safe. The photo and thumbnail go to fixed paths per send, and
 * the server returns the existing magnet for a send it already stored, so a
 * retry never makes a second magnet or a second file.
 */

export type FailureKind = "retry" | "reupload" | "reauth" | "stop";

/** Refusals that the same request will never get past. */
const STOP_CODES = [
  "print_quota_exceeded",
  "event_not_live",
  "event_not_found",
  "frame_not_in_event",
  "storage_path_not_yours",
  "invalid_storage_path",
  "invalid_copies",
  "too_many_copies",
];

type Failure = {
  code?: unknown;
  status?: unknown;
  message?: unknown;
  detail?: unknown;
  name?: unknown;
};

function text(error: Failure): string {
  return [error.code, error.name, error.message, error.detail]
    .filter((part) => typeof part === "string")
    .join(" ")
    .toLowerCase();
}

/** What to do after a failed step. */
export function classifyFailure(error: unknown): FailureKind {
  if (typeof error !== "object" || error === null) return "retry";
  const e = error as Failure;
  const all = text(e);
  const status = typeof e.status === "number" ? e.status : undefined;
  if (STOP_CODES.some((code) => all.includes(code))) return "stop";
  if (all.includes("photo_not_uploaded")) return "reupload";
  if (
    all.includes("not_authenticated") ||
    all.includes("jwt expired") ||
    all.includes("pgrst301") ||
    all.includes("pgrst303") ||
    status === 401
  ) {
    return "reauth";
  }
  if (
    status === 0 ||
    all.includes("failed to fetch") ||
    all.includes("load failed") ||
    all.includes("networkerror") ||
    all.includes("network timeout") ||
    all.includes("fetch failed") ||
    all.includes("typeerror") ||
    all.includes("storageunknownerror") ||
    all.includes("authretryablefetcherror")
  ) {
    return "retry";
  }
  if (status !== undefined && (status === 408 || status === 429 || status >= 500)) return "retry";
  if (["pgrst003", "57014", "40p01", "40001"].some((code) => all.includes(code))) return "retry";
  return "stop";
}

/** Waits between attempts: about 1, 3 and 7 seconds, then 7, each moved by up to a quarter either way. */
export const RETRY_DELAYS_MS = [1_000, 3_000, 7_000];

export function retryDelay(
  attempt: number,
  random: () => number = Math.random,
  delays = RETRY_DELAYS_MS,
): number {
  const base = delays[Math.min(attempt, delays.length - 1)];
  return Math.round(base * (0.75 + random() * 0.5));
}

/** Keep retrying for about 2 minutes of time online. Time offline does not count. */
export const RETRY_FOR_MS = 120_000;

export type SendState = "sending" | "retrying" | "offline";

export type SendSteps = {
  uploadPhoto: () => Promise<void>;
  uploadThumb: () => Promise<void>;
  /** Creates the magnet (or returns the one already created for this send) and returns its id. */
  createMagnet: () => Promise<string>;
  /** Called before retrying after an expired sign-in. */
  refreshSession: () => Promise<void>;
};

export type SendEnv = {
  online: () => boolean;
  /** Resolves when the phone is back online, or when `wake` resolves. */
  waitUntilOnline: (wake: Promise<void>) => Promise<void>;
  /** Resolves after `ms`, or earlier when `wake` resolves. */
  sleep: (ms: number, wake: Promise<void>) => Promise<void>;
  now: () => number;
  random?: () => number;
  onState?: (state: SendState) => void;
  retryForMs?: number;
};

export class SendFailed extends Error {
  constructor(
    readonly reason: "stop" | "exhausted",
    readonly cause: unknown,
  ) {
    super(cause instanceof Error ? cause.message : "send failed");
    this.name = "SendFailed";
  }
}

export type SendRun = {
  /** The magnet id once it exists. Rejects with SendFailed. */
  done: Promise<string>;
  /** Skip the current wait and try again now ("נסו עכשיו", back online, back to the page). */
  retryNow: () => void;
};

export function startSend(steps: SendSteps, env: SendEnv): SendRun {
  let wakeResolve: () => void = () => undefined;
  let wake = new Promise<void>((resolve) => (wakeResolve = resolve));
  const retryNow = () => {
    const resolve = wakeResolve;
    wake = new Promise<void>((next) => (wakeResolve = next));
    resolve();
  };

  async function run(): Promise<string> {
    const retryFor = env.retryForMs ?? RETRY_FOR_MS;
    const uploaded = { photo: false, thumb: false };
    let onlineSpent = 0;
    let attempt = 0;
    let mark = env.now();
    env.onState?.("sending");

    for (;;) {
      if (!env.online()) {
        onlineSpent += env.now() - mark;
        env.onState?.("offline");
        await env.waitUntilOnline(wake);
        mark = env.now();
        env.onState?.("sending");
      }
      try {
        const pending: Promise<unknown>[] = [];
        if (!uploaded.photo) pending.push(steps.uploadPhoto().then(() => (uploaded.photo = true)));
        if (!uploaded.thumb) pending.push(steps.uploadThumb().then(() => (uploaded.thumb = true)));
        // Wait for both, so a failed thumbnail does not leave the photo upload running into the retry.
        const results = await Promise.allSettled(pending);
        const failed = results.find((result) => result.status === "rejected");
        if (failed) throw (failed as PromiseRejectedResult).reason;
        return await steps.createMagnet();
      } catch (error) {
        const kind = classifyFailure(error);
        if (kind === "stop") throw new SendFailed("stop", error);
        if (kind === "reupload") {
          uploaded.photo = false;
          uploaded.thumb = false;
        }
        if (kind === "reauth") await steps.refreshSession().catch(() => undefined);
        if (!env.online()) continue;
        onlineSpent += env.now() - mark;
        mark = env.now();
        if (onlineSpent >= retryFor) throw new SendFailed("exhausted", error);
        env.onState?.("retrying");
        await env.sleep(retryDelay(attempt, env.random), wake);
        attempt += 1;
        onlineSpent += env.now() - mark;
        mark = env.now();
        if (onlineSpent >= retryFor) throw new SendFailed("exhausted", error);
        env.onState?.("sending");
      }
    }
  }

  return { done: run(), retryNow };
}

/**
 * Runs `task`, retrying what can pass with the given waits. `onWait` is called
 * before each wait (to show "עוד רגע…"). A real refusal is thrown at once.
 */
export async function retryTransient<T>(
  task: () => Promise<T>,
  options: {
    delays: number[];
    onWait?: () => void;
    sleep?: (ms: number) => Promise<void>;
    random?: () => number;
  },
): Promise<T> {
  const sleep =
    options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      const kind = classifyFailure(error);
      if (kind === "stop" || attempt >= options.delays.length) throw error;
      options.onWait?.();
      await sleep(retryDelay(attempt, options.random, options.delays));
    }
  }
}
