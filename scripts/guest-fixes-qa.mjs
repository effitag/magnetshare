import { mkdir } from "node:fs/promises";
import { chromium, devices } from "playwright";

const GUEST = "11111111-1111-4111-8111-111111111111";
const EVENT = "22222222-2222-4222-8222-222222222222";
const FRAME_L = "33333333-3333-4333-8333-333333333333";
const FRAME_P = "44444444-4444-4444-8444-444444444444";
const base = "http://127.0.0.1:8080";

function card(slug) {
  const quota = slug === "count" ? 5 : 8;
  return {
    id: EVENT,
    slug,
    title: "אלי ורחל",
    event_date: "2026-12-24",
    place: null,
    frame_id: FRAME_L,
    frame_portrait_id: FRAME_P,
    print_quota: quota,
    status: "live",
    cover_path: "events/x/cover.jpg",
    screen_path: `frames/${FRAME_L}/screen.webp`,
    screen_path_portrait: `frames/${FRAME_P}/screen.webp`,
  };
}

function frameRow(id) {
  const portrait = id === FRAME_P;
  return {
    id,
    width_mm: portrait ? 75 : 100,
    height_mm: portrait ? 100 : 75,
    window_x: 0.08,
    window_y: 0.08,
    window_w: 0.84,
    window_h: 0.62,
  };
}

function session() {
  return {
    access_token: "test-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: 4_000_000_000,
    refresh_token: "test-refresh",
    user: {
      id: GUEST,
      aud: "authenticated",
      role: "authenticated",
      is_anonymous: true,
      email: "",
      app_metadata: { provider: "anonymous", providers: ["anonymous"] },
      user_metadata: {},
      created_at: "2026-11-06T00:00:00Z",
    },
  };
}

function job(id, when) {
  return {
    id,
    event_id: EVENT,
    photo_id: `photo-${id}`,
    guest_id: GUEST,
    copies: 1,
    status: "queued",
    created_at: when,
    frame_id: FRAME_L,
    photo: { storage_path: `${EVENT}/${GUEST}/${id}_photo.jpg` },
  };
}

async function installApp(page, state) {
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (!url.hostname.includes("supabase")) {
      await route.continue();
      return;
    }
    if (request.method() === "OPTIONS") {
      await route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "*",
          "access-control-allow-methods": "*",
        },
      });
      return;
    }
    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "content-type": "application/json",
    };
    const json = (body, status = 200) => route.fulfill({ status, headers, body: JSON.stringify(body) });
    const path = url.pathname;
    const object = (request.headers()["accept"] || "").includes("vnd.pgrst.object");
    if (path.includes("/auth/v1/")) {
      await json(path.endsWith("/user") ? session().user : session());
      return;
    }
    if (path.includes("/rest/v1/event_cards")) {
      const slug = url.searchParams.get("slug")?.replace(/^eq\./, "") || "count";
      await json(object ? card(slug) : [card(slug)]);
      return;
    }
    if (path.includes("/rest/v1/frames")) {
      const id = url.searchParams.get("id")?.replace(/^eq\./, "") || FRAME_L;
      await json(object ? frameRow(id) : [frameRow(id)]);
      return;
    }
    if (path.includes("/rest/v1/print_jobs")) {
      await json(state.jobs);
      return;
    }
    if (path.includes("/storage/v1/object/sign") || path.includes("/storage/v1/render/image/sign")) {
      await json({ signedURL: `${base}/hero.jpg` });
      return;
    }
    if (path.includes("/storage/v1/object/")) {
      await json({ Key: path });
      return;
    }
    if (path.includes("/rest/v1/rpc/create_guest_print")) {
      const body = request.postDataJSON();
      state.jobs.unshift({
        id: crypto.randomUUID(),
        event_id: EVENT,
        photo_id: crypto.randomUUID(),
        guest_id: GUEST,
        copies: body.p_copies ?? 1,
        status: "queued",
        created_at: new Date().toISOString(),
        frame_id: body.p_frame_id,
        photo: { storage_path: body.p_storage_path },
      });
      await json(state.jobs[0].id);
      return;
    }
    await json([]);
  });
}

function watch(page, problems) {
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") problems.push(`${msg.type()}: ${msg.text()}`);
  });
}

async function boot(browser, device, problems, state) {
  const context = await browser.newContext({
    ...device,
    permissions: ["camera"],
  });
  await context.addInitScript(() => {
    class FakeSocket {
      constructor() {
        this.readyState = 0;
        setTimeout(() => {
          this.readyState = 1;
          this.onopen?.({});
        }, 0);
      }
      send(data) {
        let msg;
        try {
          msg = JSON.parse(data);
        } catch {
          return;
        }
        if (!Array.isArray(msg)) return;
        const [joinRef, ref, topic, event] = msg;
        if (event !== "phx_join" && event !== "heartbeat" && event !== "access_token") return;
        const reply = JSON.stringify([joinRef, ref, topic, "phx_reply", { status: "ok", response: {} }]);
        setTimeout(() => this.onmessage?.({ data: reply }), 0);
      }
      close() {
        this.readyState = 3;
      }
      addEventListener(type, fn) {
        if (type === "open") this.onopen = fn;
        if (type === "message") this.onmessage = fn;
      }
      removeEventListener() {}
    }
    FakeSocket.CONNECTING = 0;
    FakeSocket.OPEN = 1;
    FakeSocket.CLOSING = 2;
    FakeSocket.CLOSED = 3;
    window.WebSocket = FakeSocket;

    const media = navigator.mediaDevices;
    const orig = media.getUserMedia.bind(media);
    let basePromise = null;
    const calls = [];
    media.getUserMedia = async (constraints) => {
      const started = Date.now();
      const open = calls.some((call) => call.ended == null);
      const entry = {
        started,
        ended: null,
        overlapped: open,
        facing: constraints && constraints.video ? constraints.video.facingMode ?? null : null,
      };
      calls.push(entry);
      window.__gum = calls;
      try {
        if (!basePromise) basePromise = orig({ video: { width: 960, height: 540 }, audio: false });
        const base = await basePromise;
        entry.ended = Date.now();
        return base.clone();
      } catch (error) {
        entry.ended = Date.now();
        entry.error = String(error);
        throw error;
      }
    };
  });
  const page = await context.newPage();
  watch(page, problems);
  await installApp(page, state);
  return { context, page };
}

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name} ${detail}`);
}

async function videoLive(page, timeout) {
  const started = Date.now();
  await page.waitForFunction(
    () => {
      const video = document.querySelector("video");
      if (!video || video.videoWidth <= 0 || video.readyState < 2 || video.paused) return false;
      const box = video.getBoundingClientRect();
      return getComputedStyle(video).visibility !== "hidden" && box.width > 40 && box.height > 40;
    },
    null,
    { timeout },
  );
  return Date.now() - started;
}

const out = "/workspace/screenshots/guest-fixes";
await mkdir(out, { recursive: true });

let browser = await chromium.launch({
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
});
const problems = [];

try {
  for (const [label, device] of [
    ["iphone13", devices["iPhone 13"]],
    ["pixel7", devices["Pixel 7"]],
  ]) {
    const state = {
      jobs: [job("a", "2026-11-06T10:00:00Z"), job("b", "2026-11-06T10:05:00Z")],
    };
    const { context, page } = await boot(browser, device, problems, state);
    await page.goto(`${base}/e/count`, { waitUntil: "networkidle" });
    await page.getByText("נשארו לכם 3 מגנטים").waitFor();
    const peek = await page.locator(".guest-peek").count();
    check(`${label} no cover card`, peek === 0);
    const layout = await page.evaluate(() => {
      const scroller = document.querySelector(".guest-scroll");
      const button = document.querySelector(".guest-shoot");
      const row = document.querySelector(".guest-magnet-row");
      const photos = [...document.querySelectorAll(".guest-magnet-row .magnet-photo")];
      const empties = [...document.querySelectorAll(".guest-magnet-row .magnet-empty")];
      const sticker = photos[0]?.querySelector(".magnet-sticker");
      const line = [...document.querySelectorAll("p")].find((node) => node.textContent?.includes("נשארו לכם"));
      scroller.scrollTop = scroller.scrollHeight;
      const scrollerBox = scroller.getBoundingClientRect();
      const buttonBox = button.getBoundingClientRect();
      const lineBox = line.getBoundingClientRect();
      const photoBox = photos[0].getBoundingClientRect();
      const emptyBox = empties[0].getBoundingClientRect();
      const stickerBox = sticker.getBoundingClientRect();
      const widths = [...photos, ...empties].map((node) => Math.round(node.getBoundingClientRect().width));
      return {
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        scrollerBottom: scrollerBox.bottom,
        buttonTop: buttonBox.top,
        lineBottom: lineBox.bottom,
        lineTop: lineBox.top,
        scrollerTop: scrollerBox.top,
        rowScrolls: row.scrollWidth > row.clientWidth + 1,
        rowWrap: getComputedStyle(row).flexWrap,
        photoRight: photoBox.right,
        emptyRight: emptyBox.right,
        widths,
        stickerInside:
          stickerBox.top >= photoBox.top - 1 &&
          stickerBox.bottom <= photoBox.bottom + 1 &&
          stickerBox.left >= photoBox.left - 1 &&
          stickerBox.right <= photoBox.right + 1,
      };
    });
    check(`${label} slots clear the button`, layout.scrollerBottom <= layout.buttonTop + 2 && layout.lineBottom <= layout.buttonTop + 2, JSON.stringify(layout));
    check(`${label} one scrolling row`, layout.rowScrolls && layout.rowWrap === "nowrap" && layout.pageOverflow <= 1, JSON.stringify(layout));
    check(
      `${label} equal slots rtl`,
      layout.widths.every((width) => Math.abs(width - layout.widths[0]) <= 1) &&
        layout.widths[0] >= 90 &&
        layout.widths[0] <= 102 &&
        layout.photoRight > layout.emptyRight &&
        layout.stickerInside,
      JSON.stringify(layout),
    );
    await context.close();
  }

  const shot = {
    jobs: [job("a", "2026-11-06T10:00:00Z"), job("b", "2026-11-06T10:05:00Z")],
  };
  const narrow = {
    viewport: { width: 320, height: 700 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: devices["iPhone 13"].userAgent,
  };
  const narrowSession = await boot(browser, narrow, problems, shot);
  await narrowSession.page.goto(`${base}/e/count`, { waitUntil: "networkidle" });
  await narrowSession.page.getByText("נשארו לכם 3 מגנטים").waitFor();
  const overflow320 = await narrowSession.page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  check("320 no page scroll", overflow320 <= 1, `overflow ${overflow320}`);
  await narrowSession.context.close();

  await browser.close();
  browser = await chromium.launch({
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
  });
  const phone = {
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: devices["iPhone 13"].userAgent,
  };
  const flow = await boot(browser, phone, problems, shot);
  const page = flow.page;
  await page.goto(`${base}/e/count`, { waitUntil: "networkidle" });
  await page.getByText("נשארו לכם 3 מגנטים").waitFor();
  await page.screenshot({ path: `${out}/landing-375.png` });
  await page.getByRole("link", { name: "לצלם" }).click();
  await page.getByRole("dialog", { name: "מצלמה לאירוע" }).waitFor();
  await videoLive(page, 8000);
  await page.getByText("3 נותרו").waitFor();
  await page.screenshot({ path: `${out}/camera-pill-375.png` });
  check("pill matches landing", true);

  await page.getByRole("button", { name: "צלמו תמונה" }).click();
  await page.getByRole("button", { name: "צילום חוזר" }).waitFor();
  await page.getByRole("button", { name: "צילום חוזר" }).click();
  const retakeMs = await videoLive(page, 1000);
  check("retake live view", retakeMs <= 1000, `${retakeMs}ms`);
  await flow.context.close();

  const cycles = { jobs: [] };
  const cycleSession = await boot(browser, phone, problems, cycles);
  const cycle = cycleSession.page;
  await cycle.goto(`${base}/e/cycle`, { waitUntil: "networkidle" });
  await cycle.getByRole("link", { name: "לצלם" }).click();
  await videoLive(cycle, 8000);
  for (let round = 1; round <= 5; round += 1) {
    await cycle.getByRole("button", { name: "צלמו תמונה" }).click();
    await cycle.getByRole("button", { name: "שלחו להדפסה" }).click();
    await cycle.getByRole("button", { name: "עוד תמונה" }).waitFor();
    await cycle.getByRole("button", { name: "עוד תמונה" }).click();
    const againMs = await videoLive(cycle, 1000);
    check(`again live ${round}`, againMs <= 1000, `${againMs}ms`);
  }
  await cycle.getByText("3 נותרו").waitFor();
  await cycle.screenshot({ path: `${out}/camera-again-375.png` });
  const gum = await cycle.evaluate(() => window.__gum || []);
  const overlapped = gum.filter((call) => call.overlapped);
  check("no overlapping camera requests", overlapped.length === 0, `calls ${gum.length}`);

  await cycle.evaluate(() => {
    const video = document.querySelector("video");
    const stream = video && video.srcObject;
    if (stream) stream.getTracks().forEach((track) => track.stop());
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const wakeMs = await videoLive(cycle, 3000);
  check("wake reacquires a dead track", wakeMs <= 3000, `${wakeMs}ms`);
  await cycleSession.context.close();
} finally {
  await browser.close();
}

const noisy = problems.filter((line) => !/favicon|Download the React DevTools/.test(line));
check("console clean", noisy.length === 0, noisy.slice(0, 8).join(" | "));
const failed = results.filter((item) => !item.ok);
if (failed.length) {
  console.error(JSON.stringify(failed, null, 2));
  process.exit(1);
}
console.log("guest fixes qa ok");
