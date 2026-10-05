"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  ClipboardList,
  Flag,
  PackageCheck,
  ShieldAlert,
  Users,
} from "lucide-react";
import { Booking, Product, Report } from "../lib/types";
import { transitionsFor } from "../lib/booking-state";

export default function AdminClient() {
  const [products, setProducts] = useState<Product[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    loadQueues();
  }, []);

  async function loadQueues() {
    setError("");
    try {
      const responses = await Promise.all([
        fetch("/api/products?admin=1"),
        fetch("/api/bookings"),
        fetch("/api/reports"),
      ]);
      if (responses.some((response) => !response.ok))
        throw new Error("加载失败，请刷新或重新登录");
      const [items, reservations, flags] = await Promise.all(
        responses.map((response) => response.json()),
      );
      setProducts(items);
      setBookings(reservations);
      setReports(flags);
    } catch (error) {
      setError(error instanceof Error ? error.message : "网络异常，请重试");
    }
  }

  function action(text: string) {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 1600);
  }
  async function updateQueue(kind: string, id: string, status: string) {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/${kind}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "更新失败");
      action(`状态已更新为：${status}`);
      await loadQueues();
    } catch (error) {
      setError(error instanceof Error ? error.message : "网络异常，请重试");
    } finally {
      setBusy(false);
    }
  }
  const updateProduct = (id: string, status: string) =>
    updateQueue("products", id, status);
  const updateBooking = (id: string, status: string) =>
    updateQueue("bookings", id, status);
  const updateReport = (id: string, status: string) =>
    updateQueue("reports", id, status);

  const pendingProducts = products.filter((item) => item.status === "审核中");
  const activeProducts = products.filter((item) => item.status === "可用");
  const openReports = reports.filter((item) => item.status !== "已处理");
  const activeBookings = bookings.filter(
    (item) =>
      item.status !== "已归还" &&
      item.status !== "已取消" &&
      item.status !== "已完成",
  );

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="eyebrow">U USE / ADMIN</p>
          <h1>运营管理</h1>
          <p className="muted">审核物品、确认借还、处理举报</p>
        </div>
        <a className="secondary link-button" href="/">
          <ArrowLeft size={15} />
          返回学生端
        </a>
      </header>
      <section className="admin-stats">
        <Stat
          icon={<Users />}
          label="预约记录"
          value={String(bookings.length)}
        />
        <Stat
          icon={<PackageCheck />}
          label="可用物品"
          value={String(activeProducts.length)}
        />
        <Stat
          icon={<Flag />}
          label="待处理举报"
          value={String(openReports.length)}
          alert
        />
        <Stat
          icon={<ClipboardList />}
          label="进行中借还"
          value={String(activeBookings.length)}
        />
      </section>
      {error && (
        <p className="form-error" role="alert">
          {error} <button onClick={loadQueues}>重试</button>
        </p>
      )}
      <fieldset disabled={busy} className="admin-grid">
        <div className="admin-card">
          <div className="split">
            <div>
              <h2>物品审核</h2>
              <p className="muted">
                新发布物品默认进入审核，通过后才展示给学生
              </p>
            </div>
            <PackageCheck size={22} />
          </div>
          {pendingProducts.length ? (
            pendingProducts.map((item) => (
              <AdminCase
                key={item.id}
                title={item.title}
                meta={`${item.campus === "SIP" ? "SIP 校区" : "太仓校区"} · ${item.category} · 押金 ¥${item.deposit}`}
                actionLabel="通过"
                onClick={() => updateProduct(item.id, "可用")}
                extra={
                  <button
                    className="danger"
                    onClick={() => updateProduct(item.id, "审核拒绝")}
                  >
                    拒绝
                  </button>
                }
              />
            ))
          ) : (
            <p className="empty-mini">暂无待审核物品</p>
          )}
        </div>
        <div className="admin-card">
          <div className="split">
            <div>
              <h2>借还预约</h2>
              <p className="muted">从待确认到已归还，保留押金和交付点记录</p>
            </div>
            <ClipboardList size={22} />
          </div>
          {activeBookings.map((item) => (
            <AdminCase
              key={item.id}
              title={item.productTitle}
              meta={`${item.requester} -> ${item.owner} · ${item.spot} · ${item.time} / ${item.returnTime} · ${item.status}`}
              actionLabel={transitionsFor(item)[0] || "已完成"}
              onClick={() => {
                const status = transitionsFor(item)[0];
                if (status) updateBooking(item.id, status);
              }}
              extra={
                transitionsFor(item).includes("已取消") && (
                  <button
                    className="danger"
                    onClick={() => updateBooking(item.id, "已取消")}
                  >
                    取消
                  </button>
                )
              }
            />
          ))}
        </div>
        <div className="admin-card">
          <div className="split">
            <div>
              <h2>举报与争议</h2>
              <p className="muted">记录原因、说明和处理状态，避免私聊扯皮</p>
            </div>
            <ShieldAlert size={22} />
          </div>
          {openReports.length ? (
            openReports.map((item) => (
              <AdminCase
                key={item.id}
                title={item.reason}
                meta={`${item.target} · ${item.note}`}
                actionLabel="处理"
                onClick={() => updateReport(item.id, "已处理")}
              />
            ))
          ) : (
            <p className="empty-mini">暂无待处理举报</p>
          )}
        </div>
        <div className="admin-card">
          <div className="split">
            <div>
              <h2>最近开放物品</h2>
              <p className="muted">
                展示真实商品状态，便于 session 说明落地流程
              </p>
            </div>
            <PackageCheck size={22} />
          </div>
          {products.slice(0, 6).map((item) => (
            <div className="admin-row" key={item.id}>
              <span>
                <strong>{item.title}</strong>
                <small>
                  {item.campus === "SIP" ? "SIP 校区" : "太仓校区"} ·{" "}
                  {item.accessMode}
                </small>
              </span>
              <span className="status-tag">{item.status}</span>
            </div>
          ))}
        </div>
      </fieldset>
      {message && <div className="toast">{message}</div>}
    </main>
  );
}

function Stat({
  icon,
  label,
  value,
  alert = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div className="admin-stat">
      <span className={alert ? "stat-icon alert" : "stat-icon"}>{icon}</span>
      <small>{label}</small>
      <b>{value}</b>
    </div>
  );
}

function AdminCase({
  title,
  meta,
  actionLabel,
  onClick,
  extra,
}: {
  title: string;
  meta: string;
  actionLabel: string;
  onClick: () => void;
  extra?: React.ReactNode;
}) {
  return (
    <div className="admin-case">
      <div>
        <strong>{title}</strong>
        <small>{meta}</small>
      </div>
      <button
        className="icon-button"
        onClick={onClick}
        aria-label={actionLabel}
      >
        <Check size={16} />
        <span>{actionLabel}</span>
      </button>
      {extra}
    </div>
  );
}
