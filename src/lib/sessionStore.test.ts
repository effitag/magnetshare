import { describe, expect, it } from "vitest";
import { createSessionStore, type KeyValueStore } from "./sessionStore";

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

function blockedStore(): KeyValueStore {
  const fail = () => {
    throw new Error("SecurityError");
  };
  return { getItem: fail, setItem: fail, removeItem: fail };
}

describe("session store", () => {
  it("keeps the session in localStorage, shared by every tab", () => {
    const local = memoryStore();
    const tabA = createSessionStore(local, memoryStore());
    const tabB = createSessionStore(local, memoryStore());
    tabA.setItem("sb-auth", "guest-1");
    expect(local.data.get("sb-auth")).toBe("guest-1");
    expect(tabB.getItem("sb-auth")).toBe("guest-1");
  });

  it("moves a session the old build left in sessionStorage to localStorage once", () => {
    const local = memoryStore();
    const session = memoryStore();
    session.setItem("sb-auth", "guest-before-deploy");
    const store = createSessionStore(local, session);
    expect(store.getItem("sb-auth")).toBe("guest-before-deploy");
    expect(local.data.get("sb-auth")).toBe("guest-before-deploy");
    expect(session.data.has("sb-auth")).toBe(false);
    expect(createSessionStore(local, memoryStore()).getItem("sb-auth")).toBe("guest-before-deploy");
  });

  it("prefers the localStorage session over an old one in sessionStorage", () => {
    const local = memoryStore();
    const session = memoryStore();
    local.setItem("sb-auth", "current");
    session.setItem("sb-auth", "old");
    expect(createSessionStore(local, session).getItem("sb-auth")).toBe("current");
  });

  it("falls back to sessionStorage when localStorage is blocked", () => {
    const session = memoryStore();
    const store = createSessionStore(blockedStore(), session);
    store.setItem("sb-auth", "guest");
    expect(session.data.get("sb-auth")).toBe("guest");
    expect(store.getItem("sb-auth")).toBe("guest");
  });

  it("falls back to memory when both are blocked, so the page still works", () => {
    const store = createSessionStore(blockedStore(), blockedStore());
    store.setItem("sb-auth", "guest");
    expect(store.getItem("sb-auth")).toBe("guest");
    store.removeItem("sb-auth");
    expect(store.getItem("sb-auth")).toBeNull();
  });

  it("works when the browser has no storage at all", () => {
    const store = createSessionStore(null, null);
    store.setItem("sb-auth", "guest");
    expect(store.getItem("sb-auth")).toBe("guest");
  });

  it("sign-out removes the session from localStorage, sessionStorage and memory", () => {
    const local = memoryStore();
    const session = memoryStore();
    const store = createSessionStore(local, session);
    store.setItem("sb-auth", "admin");
    session.setItem("sb-auth", "old-copy");
    store.removeItem("sb-auth");
    expect(local.data.has("sb-auth")).toBe(false);
    expect(session.data.has("sb-auth")).toBe(false);
    expect(store.getItem("sb-auth")).toBeNull();
  });
});
