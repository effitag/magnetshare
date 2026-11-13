import { describe, expect, it } from "vitest";
import { createSessionStore, moveGuestSession, type KeyValueStore } from "./sessionStore";

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

describe("moveGuestSession", () => {
  const guest = JSON.stringify({ access_token: "a", refresh_token: "r", user: { id: "g1", is_anonymous: true } });
  const admin = JSON.stringify({ access_token: "a", refresh_token: "r", user: { id: "a1", is_anonymous: false } });

  it("moves an anonymous guest from the shared key to the guest key, once", () => {
    const local = memoryStore();
    const store = createSessionStore(local, memoryStore());
    store.setItem("sb-x-auth-token", guest);
    expect(moveGuestSession(store, "sb-x-auth-token", "sb-x-guest-auth-token")).toBe("moved");
    expect(store.getItem("sb-x-guest-auth-token")).toBe(guest);
    expect(store.getItem("sb-x-auth-token")).toBeNull();
    expect(moveGuestSession(store, "sb-x-auth-token", "sb-x-guest-auth-token")).toBe("kept");
  });

  it("never moves an admin's session", () => {
    const store = createSessionStore(memoryStore(), memoryStore());
    store.setItem("sb-x-auth-token", admin);
    expect(moveGuestSession(store, "sb-x-auth-token", "sb-x-guest-auth-token")).toBe("kept");
    expect(store.getItem("sb-x-auth-token")).toBe(admin);
    expect(store.getItem("sb-x-guest-auth-token")).toBeNull();
  });

  it("keeps a guest session that is already under the guest key", () => {
    const store = createSessionStore(memoryStore(), memoryStore());
    const newer = JSON.stringify({ user: { id: "g2", is_anonymous: true } });
    store.setItem("sb-x-guest-auth-token", newer);
    store.setItem("sb-x-auth-token", guest);
    expect(moveGuestSession(store, "sb-x-auth-token", "sb-x-guest-auth-token")).toBe("kept");
    expect(store.getItem("sb-x-guest-auth-token")).toBe(newer);
  });

  it("moves a guest an older build left in this tab's sessionStorage", () => {
    const local = memoryStore();
    const session = memoryStore();
    session.setItem("sb-x-auth-token", guest);
    const store = createSessionStore(local, session);
    expect(moveGuestSession(store, "sb-x-auth-token", "sb-x-guest-auth-token")).toBe("moved");
    expect(local.data.get("sb-x-guest-auth-token")).toBe(guest);
    expect(local.data.has("sb-x-auth-token")).toBe(false);
    expect(session.data.has("sb-x-auth-token")).toBe(false);
  });

  it("ignores empty or unreadable values", () => {
    const store = createSessionStore(memoryStore(), memoryStore());
    expect(moveGuestSession(store, "sb-x-auth-token", "sb-x-guest-auth-token")).toBe("kept");
    store.setItem("sb-x-auth-token", "not json");
    expect(moveGuestSession(store, "sb-x-auth-token", "sb-x-guest-auth-token")).toBe("kept");
    expect(store.getItem("sb-x-auth-token")).toBe("not json");
  });
});
