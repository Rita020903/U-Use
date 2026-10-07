"use client";
import { clientFetch } from "../lib/client-fetch";
import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, RefreshCw } from "lucide-react";
import { Notification } from "../lib/types";
import { startPolling } from "../lib/client-poll";
import { mergeNotifications } from "../lib/notification-order";
export default function NotificationsPanel({
  onBookings,
  onNeeds,
  accountId,
}: {
  onBookings: () => void;
  onNeeds?: () => void;
  accountId: string;
}) {
  const [items, setItems] = useState<Notification[]>([]),
    [error, setError] = useState(""),
    [loadError, setLoadError] = useState(""),
    [reading, setReading] = useState(false),
    [hasMore, setHasMore] = useState(false),
    [oldest, setOldest] = useState(""),
    [loadingOlder, setLoadingOlder] = useState(false),
    [unread, setUnread] = useState(0),
    [loaded, setLoaded] = useState(false);
  const alive = useRef(true),
    historyLoaded = useRef(false),
    readVersion = useRef(0),
    historyAbort = useRef<AbortController>();
  useEffect(() => {
    let active = true;
    alive.current = true;
    const abort = new AbortController();
    const load = async () => {
      const version = readVersion.current;
      try {
        const r = await clientFetch("/api/notifications?limit=20", {
            cache: "no-store",
            accountId,
            signal: abort.signal,
          }),
          data = await r.json();
        if (!r.ok) throw new Error(data.error);
        if (active) {
          setItems((current) => mergeNotifications(current, data));
          if (version === readVersion.current)
            setUnread(Number(r.headers.get("X-Unread-Count") || 0));
          if (!historyLoaded.current) {
            setHasMore(r.headers.get("X-Has-More") === "true");
            setOldest(r.headers.get("X-Oldest-Notification") || "");
          }
          setLoaded(true);
          setLoadError("");
        }
      } catch (e) {
        if (active) setLoadError(e instanceof Error ? e.message : "加载失败");
      }
    };
    const stop = startPolling(load, 15000);
    return () => {
      active = false;
      alive.current = false;
      stop();
      abort.abort();
      historyAbort.current?.abort();
    };
  }, [accountId]);
  async function older() {
    if (loadingOlder || !oldest) return;
    setLoadingOlder(true);
    const abort = new AbortController();
    historyAbort.current = abort;
    try {
      const r = await clientFetch(
        "/api/notifications?" +
          new URLSearchParams({ limit: "20", before: oldest }),
        { accountId, signal: abort.signal, cache: "no-store" },
      );
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "通知加载失败");
      if (!alive.current) return;
      historyLoaded.current = true;
      setItems((current) => mergeNotifications(current, data));
      setHasMore(r.headers.get("X-Has-More") === "true");
      setOldest(r.headers.get("X-Oldest-Notification") || "");
      setLoadError("");
    } catch (e) {
      if (alive.current)
        setLoadError(e instanceof Error ? e.message : "通知加载失败");
    } finally {
      if (alive.current) setLoadingOlder(false);
    }
  }
  async function read(id?: string) {
    readVersion.current++;
    setReading(true);
    try {
      const r = await clientFetch("/api/notifications", {
        method: "PATCH",
        accountId,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(id ? { id } : { all: true }),
      });
      if (!r.ok) throw new Error("标记已读失败");
      const data = await r.json();
      if (!alive.current) return;
      readVersion.current++;
      setUnread(data.unread);
      setItems((current) =>
        current.map((n) =>
          data.ids.includes(n.id) ? { ...n, read: true } : n,
        ),
      );
      setError("");
    } catch {
      if (alive.current) setError("标记已读失败，请重试");
    } finally {
      if (alive.current) setReading(false);
    }
  }
  return (
    <section className="notification-section">
      <div className="split">
        <h2>
          <Bell size={18} /> 通知 {unread > 0 ? "· " + unread : ""}
        </h2>
        <button
          type="button"
          className="secondary"
          title="全部标记已读"
          aria-label="全部标记已读"
          disabled={reading}
          onClick={() => void read()}
        >
          <CheckCheck size={16} />
        </button>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {loadError && (
        <p role="alert" className="form-error">
          {loadError}
        </p>
      )}
      {!loaded && !loadError && <p role="status">正在加载通知…</p>}
      {loaded && !items.length && !error && !loadError && (
        <p className="muted">暂无通知</p>
      )}
      {items.map((n) => (
        <button
          type="button"
          className={"notification-row " + (n.read ? "" : "unread")}
          key={n.id}
          onClick={() => {
            void read(n.id);
            if (n.bookingId) onBookings();
            else if (n.needId) onNeeds?.();
          }}
        >
          <span>{n.title}</span>
          <small>
            {new Date(n.createdAt).toLocaleString("zh-CN", {
              timeZone: "Asia/Shanghai",
            })}
          </small>
        </button>
      ))}
      {hasMore && (
        <button
          type="button"
          className="secondary"
          disabled={loadingOlder}
          onClick={() => void older()}
        >
          <RefreshCw size={15} />
          {loadingOlder ? "加载中" : "更早通知"}
        </button>
      )}
    </section>
  );
}
