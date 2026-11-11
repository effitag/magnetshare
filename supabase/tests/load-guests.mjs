#!/usr/bin/env node
// Full guest load test. MagnetimShare Lab only. Not part of CI.
//
// Simulates N guests who follow the same requests and timings as the guest
// app, without a browser and without Realtime:
//   1. arrive within --arrival-seconds: load the event card, sign in
//      anonymously (retrying 429 and dropped connections after about 2, 5 and
//      10 s, as the app does), load the frame, read their own magnets, sign and
//      download the cover and the frame image;
//   2. send --photos photos, --gap-min..--gap-max seconds apart: upload the photo
//      and the thumbnail at the same time, then create the magnet, with the
//      app's retry rules (timeouts 45 s / 15 s / 20 s, waits of about 1, 3 and
//      7 s for about 2 minutes, "photo_not_uploaded" uploads again, a real
//      refusal stops), then read their magnets and download the new thumbnail;
//   3. follow their magnets until --follow-minutes after the last send:
//      read every 20 ± 3 s while a magnet is pending. --lock-share of the
//      guests "lock the phone" for 1-5 minutes at a time (no reads) and read
//      at once when they come back.
//
// Every read checks that a guest only ever gets their own magnets.
//
// Usage (from the repository root, Node 22, real JPEG files for the payload):
//   SUPABASE_URL=https://gexvrhhnmezkugldjjax.supabase.co SUPABASE_ANON_KEY=<Lab publishable key> \
//   node supabase/tests/load-guests.mjs --event-slug <slug> --photo photo.jpg --thumb thumb.jpg \
//     [--guests 30] [--arrival-seconds 60] [--photos 3] [--gap-min 30] [--gap-max 180]
//     [--follow-minutes 5] [--lock-share 0.3] [--downloads all|none] [--cover-path <media path>]
//     [--label A] [--out result.json] [--ids guest-ids.txt]
//
// Anonymous sign-ins used: --guests (Lab allows 500 per hour per IP address).
// The test event must be a live Lab event made for this test. Its files stay
// under the event's folder in Lab Storage: remove them, its rows and the
// guests (--ids) in the cleanup.

import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const LAB_REF = "gexvrhhnmezkugldjjax";

function fail(message) {
  console.error(`load-guests: ${message}`);
  process.exit(2);
}

if (process.env.CI) fail("not for CI");

function parseArgs(argv) {
  const args = {
    guests: 30,
    "arrival-seconds": 60,
    photos: 3,
    "gap-min": 30,
    "gap-max": 180,
    "follow-minutes": 5,
    "lock-share": 0.3,
    downloads: "all",
    label: "run",
  };
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    if (!key.startsWith("--") || argv[i + 1] === undefined) fail(`bad argument ${key}`);
    args[key.slice(2)] = argv[i + 1];
  }
  for (const name of [
    "guests",
    "arrival-seconds",
    "photos",
    "gap-min",
    "gap-max",
    "follow-minutes",
    "lock-share",
  ]) {
    args[name] = Number(args[name]);
    if (!Number.isFinite(args[name]) || args[name] < 0) fail(`--${name} must be a number`);
  }
  if (args.guests < 1 || args.guests > 300) fail("--guests must be 1..300");
  if (!args["event-slug"]) fail("--event-slug is required");
  if (!args.photo || !args.thumb) fail("--photo and --thumb (JPEG files) are required");
  return args;
}

const args = parseArgs(process.argv.slice(2));
const BASE = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
if (!BASE || !KEY) fail("set SUPABASE_URL and SUPABASE_ANON_KEY (Lab)");
if (new URL(BASE).hostname !== `${LAB_REF}.supabase.co`)
  fail(`this test runs only against Lab (${LAB_REF})`);
if (KEY.split(".").length === 3) {
  const ref = JSON.parse(Buffer.from(KEY.split(".")[1], "base64url").toString("utf8")).ref;
  if (ref !== LAB_REF) fail("the anon key is not a Lab key");
}
const PHOTO = readFileSync(args.photo);
const THUMB = readFileSync(args.thumb);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const jitter = (ms, share = 0.25) => Math.round(ms * (1 - share + Math.random() * 2 * share));
const t0 = Date.now();

// --- measurements -----------------------------------------------------------
const steps = {};
const codes = {};
const counters = {
  retries: 0,
  signInRetries: 0,
  signIn429: 0,
  reads: 0,
  leaks: 0,
  downloadBytes: 0,
  uploadBytes: 0,
};
function record(step, ms, code) {
  steps[step] ??= { ms: [], ok: 0, failed: 0 };
  steps[step].ms.push(ms);
  if (code === "ok") steps[step].ok += 1;
  else steps[step].failed += 1;
  const key = `${step}:${code}`;
  codes[key] = (codes[key] ?? 0) + 1;
}
const readsPerMinute = new Map();

// --- HTTP, with the app's timeouts -------------------------------------------
async function call(path, init = {}, timeoutMs = 20_000) {
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(path.startsWith("http") ? path : `${BASE}${path}`, {
      ...init,
      signal: controller.signal,
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    let body = null;
    const type = response.headers.get("content-type") || "";
    if (type.includes("json")) {
      try {
        body = JSON.parse(buffer.toString("utf8"));
      } catch {
        body = null;
      }
    }
    return { status: response.status, body, bytes: buffer.length, ms: performance.now() - started };
  } catch (error) {
    const timeout = error?.name === "AbortError";
    return {
      status: 0,
      body: { code: timeout ? "timeout" : "network" },
      bytes: 0,
      ms: performance.now() - started,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** retry | reupload | stop, as in src/lib/sendRetry.ts. */
function classify(result) {
  const text = JSON.stringify(result.body ?? {}).toLowerCase();
  if (
    /print_quota_exceeded|event_not_live|event_not_found|frame_not_in_event|storage_path_not_yours|invalid_storage_path|invalid_copies/.test(
      text,
    )
  ) {
    return "stop";
  }
  if (text.includes("photo_not_uploaded")) return "reupload";
  if (result.status === 0 || result.status === 408 || result.status === 429 || result.status >= 500)
    return "retry";
  if (/pgrst003|57014|40p01|40001/.test(text)) return "retry";
  return "stop";
}

function codeOf(result) {
  if (result.status >= 200 && result.status < 300) return "ok";
  const body = result.body ?? {};
  const message = String(body.message ?? body.error ?? body.code ?? "");
  const known = message.match(
    /print_quota_exceeded|event_not_live|frame_not_in_event|photo_not_uploaded|storage_path_not_yours/,
  );
  return known ? known[0] : `${result.status}${body.code ? ` ${body.code}` : ""}`;
}

const auth = (guest) => ({ apikey: KEY, authorization: `Bearer ${guest?.token ?? KEY}` });

// --- one guest ----------------------------------------------------------------
async function signIn() {
  const delays = [2_000, 5_000, 10_000];
  for (let attempt = 0; ; attempt += 1) {
    const r = await call("/auth/v1/signup", {
      method: "POST",
      headers: { apikey: KEY, "content-type": "application/json" },
      body: JSON.stringify({ data: {} }),
    });
    if (r.status === 429) counters.signIn429 += 1;
    if (r.status === 200 && r.body?.access_token) {
      record("sign_in", r.ms, "ok");
      return { id: r.body.user.id, token: r.body.access_token };
    }
    record("sign_in", r.ms, codeOf(r));
    if (attempt >= delays.length || classify(r) !== "retry") return null;
    counters.signInRetries += 1;
    await sleep(jitter(delays[attempt]));
  }
}

async function download(guest, path, step) {
  if (args.downloads !== "all" || !path) return;
  const signed = await call(`/storage/v1/object/sign/media/${path}`, {
    method: "POST",
    headers: { ...auth(guest), "content-type": "application/json" },
    body: JSON.stringify({ expiresIn: 1800 }),
  });
  record(`${step}_sign`, signed.ms, codeOf(signed));
  const url = signed.body?.signedURL;
  if (!url) return;
  const file = await call(`${BASE}/storage/v1${url}`, {});
  record(`${step}_download`, file.ms, codeOf(file));
  counters.downloadBytes += file.bytes;
}

async function readOwn(guest, eventId) {
  const r = await call(
    `/rest/v1/print_jobs?select=id,guest_id,status,photo:guest_photos(storage_path)&event_id=eq.${eventId}&order=created_at.desc`,
    { headers: auth(guest) },
  );
  record("read_own", r.ms, codeOf(r));
  counters.reads += 1;
  const minute = Math.floor((Date.now() - t0) / 60_000);
  readsPerMinute.set(minute, (readsPerMinute.get(minute) ?? 0) + 1);
  if (!Array.isArray(r.body)) return null;
  if (r.body.some((row) => row.guest_id !== guest.id)) counters.leaks += 1;
  return r.body;
}

async function upload(guest, path, bytes) {
  const r = await call(
    `/storage/v1/object/media/${path}`,
    {
      method: "POST",
      headers: { ...auth(guest), "content-type": "image/jpeg", "x-upsert": "false" },
      body: bytes,
    },
    45_000,
  );
  const exists = r.body && String(r.body.statusCode) === "409";
  if (r.status === 200 || exists) {
    counters.uploadBytes += bytes.length;
    return { ...r, status: 200 };
  }
  return r;
}

/** One send with the app's rules. Returns the magnet id, or null. */
async function send(guest, card) {
  const sendId = randomUUID();
  const photoPath = `${card.id}/${guest.id}/${sendId}_photo.jpg`;
  const thumbPath = `${card.id}/${guest.id}/${sendId}_thumb.webp`;
  const started = performance.now();
  const done = { photo: false, thumb: false };
  let attempt = 0;
  for (;;) {
    let failure = null;
    const uploadOne = async (kind, path, bytes) => {
      const r = await upload(guest, path, bytes);
      record(`upload_${kind}`, r.ms, codeOf(r));
      if (r.status === 200) done[kind] = true;
      else failure ??= r;
    };
    // The photo and the thumbnail at the same time, as the app does.
    await Promise.all([
      done.photo ? null : uploadOne("photo", photoPath, PHOTO),
      done.thumb ? null : uploadOne("thumb", thumbPath, THUMB),
    ]);
    if (!failure) {
      const r = await call(
        "/rest/v1/rpc/create_guest_print",
        {
          method: "POST",
          headers: { ...auth(guest), "content-type": "application/json" },
          body: JSON.stringify({
            p_event_id: card.id,
            p_storage_path: photoPath,
            p_copies: 1,
            p_frame_id: card.frame_id,
          }),
        },
        15_000,
      );
      record("create_magnet", r.ms, codeOf(r));
      if (r.status === 200 && typeof r.body === "string") {
        record("send_total", performance.now() - started, "ok");
        return { job: r.body, thumbPath };
      }
      failure = r;
      if (classify(r) === "reupload") {
        done.photo = false;
        done.thumb = false;
      }
    }
    const kind = classify(failure);
    if (kind === "stop" || performance.now() - started > 120_000) {
      record("send_total", performance.now() - started, codeOf(failure));
      return null;
    }
    counters.retries += 1;
    await sleep(jitter([1_000, 3_000, 7_000][Math.min(attempt, 2)]));
    attempt += 1;
  }
}

async function runGuest(index, endsAtFn) {
  await sleep(Math.random() * args["arrival-seconds"] * 1000);
  const arrived = performance.now();
  const cardCall = await call("/rest/v1/rpc/get_event_card", {
    method: "POST",
    headers: { apikey: KEY, "content-type": "application/json" },
    body: JSON.stringify({ p_slug: args["event-slug"] }),
  });
  record("event_card", cardCall.ms, codeOf(cardCall));
  const card = Array.isArray(cardCall.body) ? cardCall.body[0] : cardCall.body;
  if (!card?.id) return { index, ok: false, reason: "no event card" };
  const guest = await signIn();
  if (!guest) return { index, ok: false, reason: "sign-in failed" };
  guestIds.push(guest.id);
  const frame = await call("/rest/v1/rpc/get_frame_window", {
    method: "POST",
    headers: { ...auth(guest), "content-type": "application/json" },
    body: JSON.stringify({ p_id: card.frame_id }),
  });
  record("frame_window", frame.ms, codeOf(frame));
  await readOwn(guest, card.id);
  await Promise.all([
    download(guest, args["cover-path"] ?? card.cover_path, "cover"),
    download(guest, card.screen_path, "frame"),
  ]);
  record("landing_ready", performance.now() - arrived, "ok");

  const sent = new Set();
  let lastSend = Date.now();
  for (let photo = 0; photo < args.photos; photo += 1) {
    const gap =
      photo === 0
        ? Math.random() * 20_000
        : (args["gap-min"] + Math.random() * (args["gap-max"] - args["gap-min"])) * 1000;
    await sleep(gap);
    const result = await send(guest, card);
    lastSend = Date.now();
    if (result) {
      sent.add(result.job);
      await readOwn(guest, card.id);
      await download(guest, result.thumbPath, "thumb");
    }
  }

  // Follow: read every 20 ± 3 s while visible and a magnet is pending.
  const locker = Math.random() < args["lock-share"];
  let lockedUntil = 0;
  let jobs = await readOwn(guest, card.id);
  while (Date.now() < endsAtFn(lastSend)) {
    const now = Date.now();
    if (locker && now >= lockedUntil && Math.random() < 0.15) {
      lockedUntil = now + (60 + Math.random() * 240) * 1000;
    }
    if (now < lockedUntil) {
      await sleep(Math.min(lockedUntil - now, endsAtFn(lastSend) - now));
      if (Date.now() < endsAtFn(lastSend)) jobs = await readOwn(guest, card.id); // back to the page: read at once
      continue;
    }
    const pending = (jobs ?? []).some(
      (job) => job.status !== "delivered" && job.status !== "rejected",
    );
    if (!pending) break;
    await sleep(jitter(20_000, 0.15));
    jobs = await readOwn(guest, card.id);
  }

  const final = (await readOwn(guest, card.id)) ?? [];
  const finalIds = new Set(final.map((job) => job.id));
  const missing = [...sent].filter((id) => !finalIds.has(id)).length;
  const extra = final.filter((job) => !sent.has(job.id)).length;
  return { index, ok: true, sent: sent.size, magnets: final.length, missing, extra };
}

// --- run ----------------------------------------------------------------------
const guestIds = [];
const followMs = args["follow-minutes"] * 60_000;
const startedAt = new Date().toISOString();
const results = await Promise.all(
  Array.from({ length: args.guests }, (_, i) => runGuest(i, (lastSend) => lastSend + followMs)),
);

function stats(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const pick = (p) =>
    Math.round(sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)]);
  return {
    n: sorted.length,
    p50_ms: pick(0.5),
    p95_ms: pick(0.95),
    max_ms: Math.round(sorted[sorted.length - 1]),
  };
}
const ok = results.filter((r) => r.ok);
const report = {
  label: args.label,
  target: LAB_REF,
  started_at: startedAt,
  finished_at: new Date().toISOString(),
  guests: args.guests,
  realtime_connections: 0,
  guests_ok: ok.length,
  guests_failed: results.filter((r) => !r.ok).map((r) => r.reason),
  sends_ok: ok.reduce((sum, r) => sum + r.sent, 0),
  sends_failed: Object.entries(codes)
    .filter(([key]) => key.startsWith("send_total:") && !key.endsWith(":ok"))
    .reduce((sum, [, n]) => sum + n, 0),
  magnets_seen_at_end: ok.reduce((sum, r) => sum + r.magnets, 0),
  sent_but_missing: ok.reduce((sum, r) => sum + r.missing, 0),
  magnets_not_sent_by_guest: ok.reduce((sum, r) => sum + r.extra, 0),
  leaks: counters.leaks,
  anonymous_sign_ins_ok: steps.sign_in?.ok ?? 0,
  sign_in_429: counters.signIn429,
  sign_in_retries: counters.signInRetries,
  send_retries: counters.retries,
  reads: counters.reads,
  reads_per_minute: Object.fromEntries([...readsPerMinute.entries()].sort((a, b) => a[0] - b[0])),
  upload_mb: Math.round((counters.uploadBytes / 1024 / 1024) * 10) / 10,
  download_mb: Math.round((counters.downloadBytes / 1024 / 1024) * 10) / 10,
  steps: Object.fromEntries(
    Object.entries(steps).map(([name, s]) => [
      name,
      { ok: s.ok, failed: s.failed, ...stats(s.ms) },
    ]),
  ),
  codes,
};
const json = JSON.stringify(report, null, 2);
console.log(json);
if (args.out) writeFileSync(args.out, `${json}\n`);
if (args.ids) writeFileSync(args.ids, `${guestIds.join("\n")}\n`);
