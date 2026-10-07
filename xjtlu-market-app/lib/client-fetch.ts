export async function clientFetch(
  input: RequestInfo | URL,
  init: RequestInit & { accountId?: string } = {},
  timeout = 30000,
) {
  const controller = new AbortController();
  const cancel = () => controller.abort(init.signal?.reason);
  if (init.signal?.aborted) cancel();
  else init.signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(
    () => controller.abort(new Error("请求超时，请刷新确认结果后重试")),
    timeout,
  );
  try {
    const { accountId, ...options } = init;
    const headers = new Headers(options.headers);
    if (accountId) headers.set("X-UUse-Account", accountId);
    const response = await fetch(input, {
      ...options,
      headers,
      signal: controller.signal,
    });
    // Keep the deadline active while the body arrives, not just until headers.
    const body = await response.arrayBuffer();
    if (accountId && response.status === 409) {
      let changed = false;
      try {
        changed =
          JSON.parse(new TextDecoder().decode(body)).code === "ACCOUNT_CHANGED";
      } catch {}
      if (changed) resetSession();
    }
    return new Response(
      [204, 205, 304].includes(response.status) ? null : body,
      {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      },
    );
  } catch (error) {
    if (controller.signal.aborted) throw controller.signal.reason;
    throw error;
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener("abort", cancel);
  }
}
import { resetSession } from "./client-session";
