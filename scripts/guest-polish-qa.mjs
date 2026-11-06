import { mkdir } from "node:fs/promises";
import { chromium, devices } from "playwright";

const GUEST = "11111111-1111-4111-8111-111111111111";
const EVENT = "22222222-2222-4222-8222-222222222222";
const FRAME_L = "33333333-3333-4333-8333-333333333333";
const FRAME_P = "44444444-4444-4444-8444-444444444444";
const base = "http://127.0.0.1:8080";

function card(slug) {
  const portrait = slug !== "one";
  const quota = slug === "send" || slug === "slow" ? 2 : 8;
  return {
    id: EVENT,
    slug,
    title: "החתונה של נועה",
    event_date: "2026-11-20",
    place: null,
    frame_id: FRAME_L,
    frame_portrait_id: portrait ? FRAME_P : null,
    print_quota: quota,
    status: "live",
    cover_path: "events/x/cover.jpg",
    screen_path: `frames/${FRAME_L}/screen.webp`,
    screen_path_portrait: portrait ? `frames/${FRAME_P}/screen.webp` : null,
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
    window_h: 0.7,
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
      const slug = url.searchParams.get("slug")?.replace(/^eq\./, "") || "scroll";
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
      if (state.slow) await new Promise((resolve) => setTimeout(resolve, 1200));
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
        copies: 1,
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

async function boot(browser, device, problems, state, userAgent) {
  const context = await browser.newContext({
    ...device,
    userAgent: userAgent || device.userAgent,
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
  });
  const page = await context.newPage();
  watch(page, problems);
  await installApp(page, state);
  return { context, page };
}

async function scrollTop(page) {
  return page.evaluate(() => window.scrollY);
}

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name} ${detail}`);
}

const out = "/workspace/screenshots/guest-polish";
await mkdir(out, { recursive: true });

let browser = await chromium.launch({
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
});
const problems = [];
const launch = () =>
  chromium.launch({
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
  });

try {
  for (const [label, device] of [
    ["iphone13", devices["iPhone 13"]],
    ["pixel7", devices["Pixel 7"]],
  ]) {
    if (label === "pixel7") {
      await browser.close();
      browser = await launch();
    }
    const state = { jobs: [], slow: false };
    const { context, page } = await boot(browser, device, problems, state);
    await page.goto(`${base}/e/scroll`, { waitUntil: "networkidle" });
    await page.getByRole("link", { name: "לצלם" }).waitFor();
    check(`${label} fresh top`, (await scrollTop(page)) === 0);

    await page.evaluate(() => window.scrollTo(0, 600));
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("link", { name: "לצלם" }).waitFor();
    check(`${label} refresh top`, (await scrollTop(page)) === 0);

    await page.evaluate(() => window.scrollTo(0, 600));
    await page.getByRole("link", { name: "לצלם" }).click();
    await page.getByRole("dialog", { name: "מצלמה לאירוע" }).waitFor();
    await page.goBack({ waitUntil: "networkidle" });
    await page.getByRole("link", { name: "לצלם" }).waitFor();
    check(`${label} back top`, (await scrollTop(page)) === 0);
    await context.close();

    const { context: wa, page: waPage } = await boot(
      browser,
      device,
      problems,
      { jobs: [], slow: false },
      `${device.userAgent} WhatsApp/2.24.1`,
    );
    await waPage.goto(`${base}/e/scroll`, { waitUntil: "networkidle" });
    await waPage.getByText("נשארו לכם 8 מגנטים").waitFor();
    check(`${label} whatsapp top`, (await scrollTop(waPage)) === 0);
    await wa.close();

    const one = await boot(browser, device, problems, { jobs: [], slow: false });
    await one.page.goto(`${base}/e/one`, { waitUntil: "networkidle" });
    await one.page.getByRole("link", { name: "לצלם" }).click();
    await one.page.getByRole("dialog", { name: "מצלמה לאירוע" }).waitFor();
    check(`${label} toggle hidden`, (await one.page.getByRole("button", { name: "לאורך" }).count()) === 0);
    await one.context.close();

    const sendState = { jobs: [], slow: false };
    await browser.close();
    browser = await launch();
    const send = await boot(browser, device, problems, sendState);
    await send.page.goto(`${base}/e/send`, { waitUntil: "networkidle" });
    await send.page.getByText("נשארו לכם 2 מגנטים").waitFor();
    await send.page.getByRole("link", { name: "לצלם" }).click();
    await send.page.getByRole("button", { name: "לרוחב" }).waitFor();
    check(`${label} toggle starts wide`, (await send.page.locator("[data-orient=landscape]").count()) === 1);
    await send.page.getByRole("button", { name: "לאורך" }).click();
    await send.page.locator("[data-orient=portrait]").waitFor();
    check(`${label} toggle portrait`, true);
    await send.page.waitForFunction(() => {
      const video = document.querySelector("video");
      return Boolean(video && video.videoWidth > 0);
    });
    await send.page.getByRole("button", { name: "צלמו תמונה" }).click();
    await send.page.getByRole("button", { name: "שלחו להדפסה" }).waitFor();
    await send.page.getByRole("button", { name: "צילום חוזר" }).waitFor();
    await send.page.getByRole("button", { name: "שלחו להדפסה" }).click();
    await send.page.getByRole("heading", { name: "המגנט בדרך אליכם!" }).waitFor();
    await send.page.getByText("נשאר לכם מגנט אחד").waitFor();
    await send.page.getByText("בתור").waitFor();
    check(`${label} send count`, sendState.jobs.length === 1 && sendState.jobs[0].frame_id === FRAME_P);
    await send.page.getByRole("button", { name: "חזרה לאירוע" }).click();
    await send.page.getByRole("link", { name: "לצלם" }).waitFor();
    await send.page.getByText("נשאר לכם מגנט אחד").waitFor();
    await send.page.locator(".magnet-photo").waitFor();
    check(`${label} landing thumb`, (await send.page.locator(".magnet-photo img").count()) === 1);
    await send.context.close();
  }

  const shot = { jobs: [], slow: false };
  await browser.close();
  browser = await launch();
  const { context, page } = await boot(browser, {
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: devices["iPhone 13"].userAgent,
  }, problems, shot);
  shot.jobs = [
    {
      id: "job-1",
      event_id: EVENT,
      photo_id: "photo-1",
      guest_id: GUEST,
      copies: 1,
      status: "queued",
      created_at: "2026-11-06T01:00:00Z",
      frame_id: FRAME_L,
      photo: { storage_path: `${EVENT}/${GUEST}/171_photo.jpg` },
    },
  ];
  await page.goto(`${base}/e/scroll`, { waitUntil: "networkidle" });
  await page.getByText("בתור").waitFor();
  await page.screenshot({ path: `${out}/landing-375.png` });

  shot.slow = true;
  shot.jobs = [];
  await page.goto(`${base}/e/slow`, { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "לצלם" }).click();
  await page.getByRole("button", { name: "לרוחב" }).waitFor();
  await page.screenshot({ path: `${out}/camera-landscape-375.png` });
  await page.getByRole("button", { name: "לאורך" }).click();
  await page.locator("[data-orient=portrait]").waitFor();
  await page.screenshot({ path: `${out}/camera-portrait-375.png` });
  await page.waitForFunction(() => {
    const video = document.querySelector("video");
    return Boolean(video && video.videoWidth > 0);
  });
  await page.getByRole("button", { name: "צלמו תמונה" }).click();
  await page.getByRole("button", { name: "שלחו להדפסה" }).waitFor();
  const sendShot = page.getByRole("button", { name: "שלחו להדפסה" }).click();
  await page.getByText("שולחים להדפסה").waitFor();
  await page.screenshot({ path: `${out}/sending-375.png` });
  await sendShot;
  await page.getByRole("heading", { name: "המגנט בדרך אליכם!" }).waitFor();
  await page.screenshot({ path: `${out}/confirmation-375.png` });

  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto(`${base}/e/scroll`, { waitUntil: "networkidle" });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check("320 no horizontal scroll", overflow <= 1, `overflow ${overflow}`);
  await context.close();
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
console.log("guest polish qa ok");
