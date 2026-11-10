/**
 * Rules for a guest's own magnets without Realtime: when to read them again,
 * how long to wait between reads, and how long a signed thumbnail URL is kept.
 */

/** A magnet in one of these states will not change any more. */
export const FINAL_STATUSES: ReadonlySet<string> = new Set(["delivered", "rejected"]);

/** Light read every 20 s while the page is visible and a magnet is still on its way. */
export const POLL_BASE_MS = 20_000;

/** Each wait is moved by up to this much either way, so guests do not all read at the same second. */
export const POLL_JITTER_MS = 3_000;

/** True while at least one magnet can still change status (queued, printing or ready). */
export function hasPendingMagnet(jobs: readonly { status: string }[]): boolean {
  return jobs.some((job) => !FINAL_STATUSES.has(job.status));
}

/** Whether to keep reading on a timer: only while the page is visible and a magnet is pending. */
export function shouldPoll(visible: boolean, jobs: readonly { status: string }[]): boolean {
  return visible && hasPendingMagnet(jobs);
}

/** Wait before the next light read: base ± jitter, never below one second. */
export function nextPollDelay(
  random: () => number = Math.random,
  base: number = POLL_BASE_MS,
  jitter: number = POLL_JITTER_MS,
): number {
  const offset = (random() * 2 - 1) * jitter;
  return Math.max(1_000, Math.round(base + offset));
}

/** A return to the page right after a read (focus, pageshow and visibilitychange often fire together) reads only once. */
export const FRESH_READ_MS = 2_000;

export type PollerDeps<T> = {
  /** Reads the guest's own magnets (through RLS). */
  read: () => Promise<T[]>;
  /** Whether the page is visible now. */
  visible: () => boolean;
  /** Called with every newer list of magnets while the poller runs. */
  onJobs: (jobs: T[]) => void;
  random?: () => number;
  now?: () => number;
};

/**
 * Keeps a guest's magnets current without Realtime. Reads on a ~20 s timer
 * only while the page is visible and a magnet is pending, stops when the page
 * is hidden, and reads at once when the page becomes visible again.
 */
export class MagnetPoller<T extends { status: string }> {
  private jobs: T[];
  private lastRead: number;
  private seq = 0;
  private applied = 0;
  private inFlight: Promise<T[]> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;

  constructor(
    initial: T[],
    private readonly deps: PollerDeps<T>,
  ) {
    this.jobs = initial;
    this.lastRead = this.now();
  }

  /** Starts the timer if a magnet is pending and the page is visible. */
  start(): void {
    this.running = true;
    this.schedule();
  }

  stop(): void {
    this.running = false;
    this.clear();
  }

  /** Whether a timed read is waiting. */
  get polling(): boolean {
    return this.timer !== null;
  }

  /** Always reads, even while another read is on its way (for example right after a send). */
  refresh(): Promise<T[]> {
    return this.read(true);
  }

  /**
   * The page was hidden or shown (visibilitychange, pageshow, focus, resume).
   * Hidden: stop the timer. Visible: read now, unless a read just finished or
   * is already on its way.
   */
  visibilityChanged(): Promise<T[]> {
    if (!this.deps.visible()) {
      this.clear();
      return Promise.resolve(this.jobs);
    }
    if (this.inFlight) return this.inFlight;
    if (this.now() - this.lastRead < FRESH_READ_MS) {
      this.schedule();
      return Promise.resolve(this.jobs);
    }
    return this.read(false);
  }

  private now(): number {
    return (this.deps.now ?? Date.now)();
  }

  private read(force: boolean): Promise<T[]> {
    if (!force && this.inFlight) return this.inFlight;
    const seq = ++this.seq;
    this.clear();
    const request = this.deps
      .read()
      .then((next) => {
        // An older read that finishes after a newer one never overwrites it.
        if (seq <= this.applied) return this.jobs;
        this.applied = seq;
        this.jobs = next;
        this.lastRead = this.now();
        if (this.running) this.deps.onJobs(next);
        return next;
      })
      .finally(() => {
        if (this.inFlight === request) this.inFlight = null;
        this.schedule();
      });
    this.inFlight = request;
    return request;
  }

  private schedule(): void {
    this.clear();
    if (!this.running || this.inFlight || !shouldPoll(this.deps.visible(), this.jobs)) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.read(false).catch(() => undefined);
    }, nextPollDelay(this.deps.random));
  }

  private clear(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
}

/** Signed thumbnail URLs live 30 minutes. A cached one is used until 5 minutes before that. */
export const SIGNED_URL_LIFETIME_MS = 30 * 60_000;
export const SIGNED_URL_MARGIN_MS = 5 * 60_000;
/** A path that could not be signed (missing thumbnail, network error) is tried again after 2 minutes, not on every refresh. */
export const SIGNED_URL_RETRY_MS = 2 * 60_000;

type CachedUrl = { url: string | null; expiresAt: number };

/**
 * Keeps one signed URL per storage path, so a refresh of the guest's magnets
 * does not sign (and download) every thumbnail again. Concurrent requests for
 * the same path share one signing call. A failed signing is remembered for
 * 2 minutes, so a missing thumbnail is not signed again on every refresh.
 */
export class SignedUrlCache {
  private readonly urls = new Map<string, CachedUrl>();
  private readonly pending = new Map<string, Promise<string | null>>();

  constructor(
    private readonly sign: (path: string) => Promise<string | null>,
    private readonly now: () => number = Date.now,
    private readonly lifetimeMs: number = SIGNED_URL_LIFETIME_MS,
    private readonly marginMs: number = SIGNED_URL_MARGIN_MS,
    private readonly retryMs: number = SIGNED_URL_RETRY_MS,
  ) {}

  get(path: string): Promise<string | null> {
    const cached = this.urls.get(path);
    if (cached && this.now() < cached.expiresAt) return Promise.resolve(cached.url);
    const inFlight = this.pending.get(path);
    if (inFlight) return inFlight;
    const signedAt = this.now();
    const request = this.sign(path)
      .then((url) => {
        const keepFor = url ? this.lifetimeMs - this.marginMs : this.retryMs;
        this.urls.set(path, { url, expiresAt: signedAt + keepFor });
        return url;
      })
      .catch(() => {
        this.urls.set(path, { url: null, expiresAt: signedAt + this.retryMs });
        return null;
      })
      .finally(() => {
        this.pending.delete(path);
      });
    this.pending.set(path, request);
    return request;
  }
}
