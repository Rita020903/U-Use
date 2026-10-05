"use client";

import { useEffect, useState } from "react";
import { Booking } from "../lib/types";
import { navigationUrl } from "../lib/campuses";

export default function BookingsPanel() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/bookings", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "加载失败");
      setBookings(result);
    } catch (error) {
      setError(error instanceof Error ? error.message : "加载失败，请重试");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  const format = (value: string) =>
    Number.isNaN(Date.parse(value))
      ? value
      : new Intl.DateTimeFormat("zh-CN", {
          timeZone: "Asia/Shanghai",
          month: "numeric",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(value));
  return (
    <section className="panel">
      <div className="split">
        <h2>借还预约</h2>
        <button className="secondary" onClick={load} disabled={loading}>
          刷新
        </button>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {loading && <p role="status">正在加载预约…</p>}
      {!loading && !error && !bookings.length && (
        <div className="empty-state">还没有预约，去发现页选择需要的物品。</div>
      )}
      {!loading &&
        bookings.map((item) => (
          <article className="message-card" key={item.id}>
            <div className="split">
              <strong>{item.productTitle}</strong>
              <span className="status-tag">{item.status}</span>
            </div>
            <p>
              {item.returnRequiredSnapshot === false ? "交付" : "借出"}：
              {format(item.time)}
              <br />
              {item.returnRequiredSnapshot !== false && (
                <>
                  归还：{format(item.returnTime)}
                  <br />
                </>
              )}
              交付：{item.campus === "SIP" ? "SIP 校区" : "太仓校区"} ·{" "}
              {item.spot}
              <br />
              押金：¥{item.depositSnapshot}
            </p>
            {item.note && <p>{item.note}</p>}
            <a
              className="secondary full"
              href={navigationUrl(item.campus, item.spot)}
              target="_blank"
              rel="noreferrer"
            >
              交付地点导航
            </a>
          </article>
        ))}
    </section>
  );
}
