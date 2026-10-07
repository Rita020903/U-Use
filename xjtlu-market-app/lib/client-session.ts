import { clientFetch } from "./client-fetch";
import type { Person } from "./types";
let pending: Promise<Person> | undefined;
let cached: Person | undefined;
let generation = 0;
let channel: BroadcastChannel | undefined;
function invalidate() {
  pending = undefined;
  cached = undefined;
  generation++;
  window.dispatchEvent(new Event("uuse-account"));
}
export function watchSessionChanges() {
  if (!channel && typeof window.BroadcastChannel === "function") {
    channel = new window.BroadcastChannel("uuse-account");
    channel.onmessage = () => invalidate();
  }
}
export function resetSession() {
  watchSessionChanges();
  invalidate();
  channel?.postMessage("changed");
}
export function ensureSession(refresh = false): Promise<Person> {
  if (refresh) cached = undefined;
  if (pending) return pending;
  if (cached) return Promise.resolve(cached);
  const current = generation;
  const task = clientFetch("/api/session", { cache: "no-store" })
    .then(async (r) => {
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "无法加载账号");
      if (current !== generation) throw new Error("账号已切换，请重试");
      cached = data;
      return data;
    })
    .finally(() => {
      if (pending === task) pending = undefined;
    });
  pending = task;
  return task;
}
