import { describe, expect, it, vi } from "vitest";
import { GUEST_SIGN_IN_LOCK, createGuestSignIn, type LockFn } from "./guestSession";

/** A lock shared by every "tab" in the test, like Web Locks: one holder at a time per name. */
function sharedLock(): LockFn & { names: string[] } {
  const tails = new Map<string, Promise<unknown>>();
  const names: string[] = [];
  const lock = (<T>(name: string, fn: () => Promise<T>) => {
    names.push(name);
    const previous = tails.get(name) ?? Promise.resolve();
    const run = previous.then(fn, fn);
    tails.set(
      name,
      run.catch(() => undefined),
    );
    return run;
  }) as LockFn & { names: string[] };
  lock.names = names;
  return lock;
}

/** One browser: a session store shared by its tabs and a server that hands out guest ids. */
function browser() {
  let stored: string | null = null;
  let next = 0;
  const signIn = vi.fn(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    next += 1;
    stored = `guest-${next}`;
    return stored;
  });
  const lock = sharedLock();
  const tab = () =>
    createGuestSignIn({
      currentUserId: async () => stored,
      signIn,
      lock,
    });
  return { tab, signIn, lock, stored: () => stored };
}

describe("guest sign-in", () => {
  it("uses the stored session without taking the lock", async () => {
    const b = browser();
    await b.tab()();
    const lockCalls = b.lock.names.length;
    expect(await b.tab()()).toBe("guest-1");
    expect(b.lock.names.length).toBe(lockCalls);
    expect(b.signIn).toHaveBeenCalledTimes(1);
  });

  it("signs in one guest when the same tab asks twice at once", async () => {
    const b = browser();
    const ensure = b.tab();
    const [first, second] = await Promise.all([ensure(), ensure()]);
    expect(first).toBe("guest-1");
    expect(second).toBe("guest-1");
    expect(b.signIn).toHaveBeenCalledTimes(1);
  });

  it("signs in one guest when two tabs open the event at the same moment", async () => {
    const b = browser();
    const [tabA, tabB] = [b.tab(), b.tab()];
    const [a, c] = await Promise.all([tabA(), tabB()]);
    expect(a).toBe("guest-1");
    expect(c).toBe("guest-1");
    expect(b.signIn).toHaveBeenCalledTimes(1);
    expect(b.lock.names.every((name) => name === GUEST_SIGN_IN_LOCK)).toBe(true);
  });

  it("five tabs at once still make one guest", async () => {
    const b = browser();
    const ids = await Promise.all(Array.from({ length: 5 }, () => b.tab()()));
    expect(new Set(ids)).toEqual(new Set(["guest-1"]));
    expect(b.signIn).toHaveBeenCalledTimes(1);
  });

  it("tries again after a failed sign-in", async () => {
    const b = browser();
    b.signIn.mockRejectedValueOnce(new Error("429"));
    const ensure = b.tab();
    await expect(ensure()).rejects.toThrow("429");
    expect(await ensure()).toBe("guest-1");
    expect(b.signIn).toHaveBeenCalledTimes(2);
  });

  it("runs without a lock when the browser has no Web Locks", async () => {
    const signIn = vi.fn(async () => "guest-1");
    const ensure = createGuestSignIn({ currentUserId: async () => null, signIn });
    expect(await ensure()).toBe("guest-1");
  });
});
