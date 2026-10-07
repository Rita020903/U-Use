import assert from "node:assert/strict";
import { testRuntime } from "./test-runtime.mjs";
const t = await testRuntime(),
  originalFetch = globalThis.fetch,
  originalWindow = globalThis.window;
let calls = 0,
  release;
try {
  globalThis.window = { dispatchEvent: () => {} };
  globalThis.fetch = async () => {
    calls++;
    await new Promise((resolve) => {
      release = resolve;
    });
    return Response.json({ id: "first", verified: false });
  };
  const { ensureSession, resetSession } = t.load("client-session"),
    one = ensureSession(true),
    two = ensureSession(true);
  assert.equal(one, two, "simultaneous refreshed callers share one request");
  assert.equal(calls, 1);
  release();
  assert.equal((await one).id, "first");
  assert.equal((await ensureSession()).id, "first");
  assert.equal(calls, 1);
  globalThis.fetch = async () => {
    calls++;
    return Response.json({ id: "second", verified: true });
  };
  resetSession();
  assert.equal((await ensureSession()).id, "second");
  assert.equal(calls, 2);
  globalThis.fetch = async () =>
    Response.json({ error: "session error" }, { status: 503 });
  await assert.rejects(ensureSession(true), /session error/);
  globalThis.fetch = async () => Response.json({ id: "recovered" });
  assert.equal((await ensureSession()).id, "recovered");
  let oldResolve;
  globalThis.fetch = () =>
    new Promise((resolve) => {
      oldResolve = resolve;
    });
  const stale = ensureSession(true);
  resetSession();
  globalThis.fetch = async () => Response.json({ id: "new-account" });
  assert.equal((await ensureSession()).id, "new-account");
  let receiver,
    posted = 0;
  window.BroadcastChannel = class {
    constructor() {
      receiver = this;
    }
    postMessage() {
      posted++;
    }
  };
  resetSession();
  assert.equal(posted, 1);
  await ensureSession();
  receiver.onmessage();
  globalThis.fetch = async () => Response.json({ id: "another-tab" });
  assert.equal((await ensureSession()).id, "another-tab");
  assert.equal(posted, 1, "incoming account change must not broadcast a loop");
  oldResolve(Response.json({ id: "old-account" }));
  await assert.rejects(stale, /账号已切换/);
  assert.equal((await ensureSession()).id, "another-tab");
  const { clientFetch } = t.load("client-fetch");
  globalThis.fetch = async () =>
    Response.json({ ok: true }, { headers: { "X-Has-More": "true" } });
  const response = await clientFetch("/test");
  assert.equal(response.headers.get("X-Has-More"), "true");
  assert.deepEqual(await response.json(), { ok: true });
  globalThis.fetch = async () => new Response(null, { status: 204 });
  assert.equal((await clientFetch("/test")).status, 204);
  globalThis.fetch = async (_url, init) => {
    assert.equal(init.headers.get("X-UUse-Account"), "another-tab");
    assert.equal(init.headers.get("Content-Type"), "application/json");
    assert.equal(init.accountId, undefined);
    return Response.json({ error: "Stock conflict" }, { status: 409 });
  };
  const postedBefore = posted;
  await clientFetch("/private", {
    accountId: "another-tab",
    headers: { "Content-Type": "application/json" },
  });
  assert.equal(
    posted,
    postedBefore,
    "ordinary conflict must not reset the session",
  );
  assert.equal((await ensureSession()).id, "another-tab");
  globalThis.fetch = async () =>
    Response.json(
      { error: "Changed", code: "ACCOUNT_CHANGED" },
      { status: 409 },
    );
  await clientFetch("/private", { accountId: "another-tab" });
  assert.equal(posted, postedBefore + 1);
  globalThis.fetch = async () => Response.json({ id: "new-cookie-account" });
  assert.equal((await ensureSession()).id, "new-cookie-account");
  globalThis.fetch = async (_url, { signal }) => ({
    status: 200,
    headers: {},
    arrayBuffer: () =>
      new Promise((_resolve, reject) => {
        if (signal.aborted) {
          reject(signal.reason);
          return;
        }
        signal.addEventListener("abort", () => reject(signal.reason), {
          once: true,
        });
      }),
  });
  await assert.rejects(clientFetch("/slow-body", {}, 20), /请求超时/);
  const abort = new AbortController();
  const cancelled = clientFetch("/cancelled", { signal: abort.signal });
  abort.abort(new Error("caller cancelled"));
  await assert.rejects(cancelled, /caller cancelled/);
  const {
    restoreFields,
    strings,
    coordinates,
    submissionFor,
    restoreSubmission,
  } = t.load("client-drafts");
  const defaults = {
    title: "",
    photos: [],
    enabled: false,
    price: 0,
    handoffCoordinates: undefined,
  };
  const validators = { photos: strings, handoffCoordinates: coordinates };
  assert.deepEqual(
    restoreFields(
      '{"title":"draft","unknown":"ignored"}',
      defaults,
      validators,
    ),
    { ...defaults, title: "draft" },
  );
  for (const raw of [
    "null",
    "[]",
    '{"title":{}}',
    '{"photos":{}}',
    '{"enabled":"yes"}',
    '{"handoffCoordinates":{"lat":999,"lng":0}}',
  ])
    assert.throws(
      () => restoreFields(raw, defaults, validators),
      /草稿格式损坏/,
    );
  const submission = submissionFor("body");
  assert.equal(
    submissionFor("body", submission).requestId,
    submission.requestId,
  );
  assert.notEqual(
    submissionFor("changed", submission).requestId,
    submission.requestId,
  );
  assert.deepEqual(
    restoreSubmission(JSON.stringify({ submission })),
    submission,
  );
  const { clearAccountStorage, hasAccountDraft } = t.load("account-storage");
  const entries = new Map([
    ["uuse-timetable-draft:a", "draft"],
    ["uuse-publish-draft:a:new", "draft"],
    ["uuse-need-draft:a:SIP", "draft"],
    ["uuse-message-draft:a:booking", "draft"],
    ["uuse-message-draft:ab:booking", "other"],
    ["uuse-need-draft:ab:SIP", "other"],
    ["uuse-favorites:a", "[]"],
  ]);
  const storage = {
    get length() {
      return entries.size;
    },
    key: (i) => [...entries.keys()][i],
    removeItem: (key) => entries.delete(key),
  };
  assert(hasAccountDraft(storage, "a"));
  assert(clearAccountStorage(storage, "a"));
  assert.deepEqual(
    [...entries.keys()],
    ["uuse-message-draft:ab:booking", "uuse-need-draft:ab:SIP"],
  );
  const blocked = {
    get length() {
      throw new Error("blocked");
    },
    removeItem: () => {
      throw new Error("blocked");
    },
  };
  assert(hasAccountDraft(blocked, "a"));
  assert.equal(clearAccountStorage(blocked, "a"), false);
  const { startPolling } = t.load("client-poll");
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  let polls = 0,
    resolvePoll;
  const stop = startPolling(() => {
    polls++;
    return new Promise((resolve) => {
      resolvePoll = resolve;
    });
  }, 5);
  try {
    await sleep(30);
    assert.equal(polls, 1, "a slow request must never overlap its next poll");
    resolvePoll();
    await sleep(30);
    assert.equal(polls, 2);
    stop();
    resolvePoll();
    await sleep(30);
    assert.equal(polls, 2, "stopping an in-flight poll prevents rescheduling");
  } finally {
    stop();
    resolvePoll?.();
  }
  let errors = 0,
    errorPolls = 0;
  const stopErrors = startPolling(
    async () => {
      errorPolls++;
      throw new Error("temporary");
    },
    5,
    () => {
      errors++;
    },
  );
  try {
    await sleep(30);
    assert(errors >= 2);
    assert.equal(errors, errorPolls);
  } finally {
    stopErrors();
  }
  console.log(
    "PASS: session single-flight, stale-account rejection, request/body timeout and cancellation, corrupted draft recovery, submission keys, account-scoped storage cleanup",
  );
} finally {
  globalThis.fetch = originalFetch;
  globalThis.window = originalWindow;
  await t.cleanup();
}
