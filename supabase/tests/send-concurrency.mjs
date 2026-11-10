#!/usr/bin/env node
// Guest send concurrency test. MagnetimShare Lab only. Not part of CI.
//
// Signs in anonymous guests and calls create_guest_print the way the guest
// app does, many at the same moment. It only calls the RPC with paths: it
// uploads no files and opens no Realtime connection, so the organization's
// Realtime quota is not touched.
//
// Scenarios:
//   many     N guests send at the same moment, for R rounds (one send each per round).
//   idem     One guest sends the same photo path twice at the same moment, then once more: one magnet.
//   quota    One new guest sends 7 different photos at the same moment: 5 magnets, 2 print_quota_exceeded.
//   foreign  A guest sends paths outside their own folder: storage_path_not_yours and no magnet.
//
// Every scenario reads each guest's own print_jobs back through RLS and checks
// that no guest sees another guest's magnet.
//
// Usage (from the repository root):
//   SUPABASE_URL=https://gexvrhhnmezkugldjjax.supabase.co \
//   SUPABASE_ANON_KEY=<Lab publishable key> \
//   node supabase/tests/send-concurrency.mjs --event <uuid> --frame <uuid> \
//     [--guests 30] [--rounds 3] [--scenarios many,idem,quota,foreign] [--label before] [--out result.json]
//
// Anonymous sign-ins used: guests + 2 (idem and quota use a new guest each).
// Lab allows 500 anonymous sign-ins per hour.
//
// The test event must be a live Lab event made for this test, with print quota
// 5 and the given frame. Clean up its rows afterwards.

import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";

const LAB_REF = "gexvrhhnmezkugldjjax";
const REQUEST_TIMEOUT_MS = 30_000;
const SIGN_IN_CONCURRENCY = 10;

function fail(message) {
  console.error(`send-concurrency: ${message}`);
  process.exit(2);
}

function parseArgs(argv) {
  const args = { guests: 30, rounds: 3, scenarios: "many,idem,quota,foreign", label: "run" };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key.startsWith("--") || value === undefined) fail(`bad argument ${key}`);
    args[key.slice(2)] = value;
    i += 1;
  }
  args.guests = Number(args.guests);
  args.rounds = Number(args.rounds);
  if (!Number.isInteger(args.guests) || args.guests < 2 || args.guests > 300)
    fail("--guests must be 2..300");
  if (!Number.isInteger(args.rounds) || args.rounds < 1 || args.rounds > 5)
    fail("--rounds must be 1..5");
  return args;
}

/** Refuses to run anywhere but MagnetimShare Lab. */
function labOnly(url, key) {
  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    fail("SUPABASE_URL is not a URL");
  }
  if (host !== `${LAB_REF}.supabase.co`)
    fail(`refusing ${host}: this test runs only against Lab (${LAB_REF})`);
  const parts = key.split(".");
  if (parts.length === 3) {
    let ref;
    try {
      ref = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")).ref;
    } catch {
      fail("the anon key is not readable");
    }
    if (ref !== LAB_REF) fail("the anon key is not a Lab key");
  }
}

if (process.env.CI) fail("not for CI");
const args = parseArgs(process.argv.slice(2));
const BASE = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
if (!BASE || !KEY) fail("set SUPABASE_URL and SUPABASE_ANON_KEY (Lab)");
labOnly(BASE, KEY);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
if (!UUID.test(args.event || "")) fail("--event <uuid> is required");
if (!UUID.test(args.frame || "")) fail("--frame <uuid> is required");
const scenarios = new Set(String(args.scenarios).split(","));

let signIns = 0;

async function call(path, init) {
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${BASE}${path}`, { ...init, signal: controller.signal });
    const text = await response.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    return { status: response.status, body, ms: performance.now() - started };
  } catch (error) {
    const timeout = error?.name === "AbortError";
    return {
      status: 0,
      body: { code: timeout ? "client_timeout" : "network_error", message: String(error) },
      ms: performance.now() - started,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function signInGuest() {
  signIns += 1;
  const result = await call("/auth/v1/signup", {
    method: "POST",
    headers: { apikey: KEY, "content-type": "application/json" },
    body: JSON.stringify({ data: {} }),
  });
  const token = result.body?.access_token;
  const id = result.body?.user?.id;
  if (result.status !== 200 || !token || !id) {
    fail(`anonymous sign-in failed: ${result.status} ${JSON.stringify(result.body).slice(0, 200)}`);
  }
  return { id, token };
}

async function signInGuests(count) {
  const guests = [];
  for (let i = 0; i < count; i += SIGN_IN_CONCURRENCY) {
    const batch = Math.min(SIGN_IN_CONCURRENCY, count - i);
    guests.push(...(await Promise.all(Array.from({ length: batch }, signInGuest))));
  }
  return guests;
}

function photoPath(guest, sendId) {
  return `${args.event}/${guest.id}/${sendId}_photo.jpg`;
}

/** One send, as the guest app calls it. Returns { ok, job, code, ms }. */
async function send(guest, storagePath) {
  const result = await call("/rest/v1/rpc/create_guest_print", {
    method: "POST",
    headers: {
      apikey: KEY,
      authorization: `Bearer ${guest.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      p_event_id: args.event,
      p_storage_path: storagePath,
      p_copies: 1,
      p_frame_id: args.frame,
    }),
  });
  if (result.status === 200 && typeof result.body === "string") {
    return { ok: true, job: result.body, code: "ok", status: 200, ms: result.ms };
  }
  return { ok: false, job: null, code: errorCode(result), status: result.status, ms: result.ms };
}

function errorCode(result) {
  const body = result.body ?? {};
  const message = typeof body === "object" ? String(body.message ?? "") : String(body);
  const known = [
    "print_quota_exceeded",
    "storage_path_not_yours",
    "invalid_storage_path",
    "event_not_live",
    "event_not_found",
    "frame_not_in_event",
    "not_authenticated",
  ].find((code) => message.includes(code));
  if (known) return known;
  if (typeof body === "object" && body.code)
    return `${body.code}${/deadlock/i.test(message) ? " deadlock" : ""}`;
  return `http_${result.status}`;
}

/** The guest's own magnets for the test event, read through RLS. */
async function ownJobs(guest) {
  const result = await call(
    `/rest/v1/print_jobs?select=id,guest_id,photo_id&event_id=eq.${args.event}`,
    { headers: { apikey: KEY, authorization: `Bearer ${guest.token}` } },
  );
  if (result.status !== 200 || !Array.isArray(result.body)) {
    return {
      ok: false,
      jobs: [],
      leak: false,
      error: `${result.status} ${JSON.stringify(result.body).slice(0, 120)}`,
    };
  }
  const leak = result.body.some((job) => job.guest_id !== guest.id);
  return { ok: true, jobs: result.body, leak };
}

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)]);
}

function tally(results) {
  const codes = {};
  for (const r of results) codes[r.code] = (codes[r.code] ?? 0) + 1;
  const ms = results.map((r) => r.ms);
  return {
    sends: results.length,
    codes,
    p50_ms: percentile(ms, 50),
    p95_ms: percentile(ms, 95),
    max_ms: percentile(ms, 100),
  };
}

async function many(guests) {
  const rounds = [];
  const all = [];
  const okByGuest = new Map(guests.map((g) => [g.id, new Set()]));
  for (let round = 1; round <= args.rounds; round += 1) {
    const started = performance.now();
    const results = await Promise.all(
      guests.map(async (guest) => {
        const r = await send(guest, photoPath(guest, randomUUID()));
        if (r.ok) okByGuest.get(guest.id).add(r.job);
        return r;
      }),
    );
    all.push(...results);
    rounds.push({ round, wall_ms: Math.round(performance.now() - started), ...tally(results) });
  }
  let mismatched = 0;
  let leaks = 0;
  let readErrors = 0;
  await Promise.all(
    guests.map(async (guest) => {
      const own = await ownJobs(guest);
      if (!own.ok) readErrors += 1;
      if (own.leak) leaks += 1;
      const seen = new Set(own.jobs.map((job) => job.id));
      const sent = okByGuest.get(guest.id);
      if (seen.size !== sent.size || [...sent].some((id) => !seen.has(id))) mismatched += 1;
    }),
  );
  return {
    guests: guests.length,
    rounds,
    total: tally(all),
    check: {
      guests_whose_magnets_differ_from_ok_sends: mismatched,
      guests_seeing_other_guests_jobs: leaks,
      read_errors: readErrors,
    },
  };
}

async function idem() {
  const guest = await signInGuest();
  const path = photoPath(guest, randomUUID());
  const together = await Promise.all([send(guest, path), send(guest, path)]);
  const again = await send(guest, path);
  const results = [...together, again];
  const jobs = new Set(results.filter((r) => r.ok).map((r) => r.job));
  const own = await ownJobs(guest);
  const pass = results.every((r) => r.ok) && jobs.size === 1 && own.jobs.length === 1 && !own.leak;
  return {
    sends: results.map((r) => r.code),
    distinct_jobs_returned: jobs.size,
    magnets_in_db: own.jobs.length,
    pass,
  };
}

async function quota() {
  const guest = await signInGuest();
  const results = await Promise.all(
    Array.from({ length: 7 }, () => send(guest, photoPath(guest, randomUUID()))),
  );
  const own = await ownJobs(guest);
  const ok = results.filter((r) => r.ok).length;
  const over = results.filter((r) => r.code === "print_quota_exceeded").length;
  const pass = ok === 5 && over === 2 && own.jobs.length === 5 && !own.leak;
  return { ...tally(results), magnets_in_db: own.jobs.length, pass };
}

async function foreign(owner, intruder) {
  const before = (await ownJobs(intruder)).jobs.length;
  const ownerBefore = (await ownJobs(owner)).jobs.length;
  const otherEvent = randomUUID();
  const cases = {
    other_guests_folder: `${args.event}/${owner.id}/${randomUUID()}_photo.jpg`,
    escape_with_dots: `${args.event}/${intruder.id}/../${owner.id}/${randomUUID()}_photo.jpg`,
    sub_folder: `${args.event}/${intruder.id}/x/${randomUUID()}_photo.jpg`,
    other_event_folder: `${otherEvent}/${intruder.id}/${randomUUID()}_photo.jpg`,
  };
  const results = {};
  for (const [name, path] of Object.entries(cases))
    results[name] = (await send(intruder, path)).code;
  const after = (await ownJobs(intruder)).jobs.length;
  const ownerAfter = (await ownJobs(owner)).jobs.length;
  const pass =
    Object.values(results).every((code) => code === "storage_path_not_yours") &&
    after === before &&
    ownerAfter === ownerBefore;
  return {
    results,
    intruder_new_magnets: after - before,
    owner_new_magnets: ownerAfter - ownerBefore,
    pass,
  };
}

const report = {
  label: args.label,
  started_at: new Date().toISOString(),
  target: LAB_REF,
  event: args.event,
  realtime_connections: 0,
  uploads: 0,
};
const guests =
  scenarios.has("many") || scenarios.has("foreign") ? await signInGuests(args.guests) : [];
if (scenarios.has("many")) report.many = await many(guests);
if (scenarios.has("idem")) report.idem = await idem();
if (scenarios.has("quota")) report.quota = await quota();
if (scenarios.has("foreign")) report.foreign = await foreign(guests[0], guests[1]);
report.anonymous_sign_ins = signIns;
report.finished_at = new Date().toISOString();

const json = JSON.stringify(report, null, 2);
console.log(json);
if (args.out) writeFileSync(args.out, `${json}\n`);
