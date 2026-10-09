"use client";
import { clientFetch } from "../lib/client-fetch";

import { useEffect, useState } from "react";
import { useConfirmation } from "./ConfirmationProvider";
import {
  ArrowLeft,
  Check,
  ClipboardList,
  Flag,
  PackageCheck,
  ShieldAlert,
  Users,
  MailWarning,
  RotateCw,
} from "lucide-react";
import { Booking, Product, Report } from "../lib/types";
import { transitionsFor } from "../lib/booking-state";
import type { MailTask } from "../lib/notifications";
type Operations = {
  mailConfigured: boolean;
  maintenance: { at: string; removed: number } | null;
  queue: MailTask[];
};

export default function AdminClient() {
  const [products, setProducts] = useState<Product[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [operations, setOperations] = useState<Operations | null>(null);
  useEffect(() => {
    loadQueues();
  }, []);

  async function loadQueues() {
    setError("");
    try {
      const responses = await Promise.all([
        clientFetch("/api/products?admin=1"),
        clientFetch("/api/bookings"),
        clientFetch("/api/reports"),
        clientFetch("/api/admin/operations"),
      ]);
      if (responses.some((response) => !response.ok))
        throw new Error("加载失败，请刷新或重新登录");
      const [items, reservations, flags, status] = await Promise.all(
        responses.map((response) => response.json()),
      );
      setProducts(items);
      setBookings(reservations);
      setReports(flags);
      setOperations(status);
    } catch (error) {
      setError(error instanceof Error ? error.message : "网络异常，请重试");
    }
  }

  async function retryNotification(id: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await clientFetch("/api/admin/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "重试失败");
      action("邮件已重新进入投递队列");
      await loadQueues();
    } catch (e) {
      setError(e instanceof Error ? e.message : "网络异常，请重试");
    } finally {
      setBusy(false);
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
      const response = await clientFetch(`/api/${kind}`, {
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
          <p className="muted">SIP / XEC</p>
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
      <section className="operations-section">
        <div className="split">
          <h2>
            <MailWarning size={18} /> 运行与邮件
          </h2>
          <button
            type="button"
            className="icon-button"
            disabled={busy}
            title="刷新运行状态"
            aria-label="刷新运行状态"
            onClick={() => void loadQueues()}
          >
            <RotateCw size={16} />
          </button>
        </div>
        {operations ? (
          <>
            <p role="status">
              邮件配置：
              {operations.mailConfigured
                ? "已配置（投递状态见队列）"
                : "未配置"}{" "}
              · 最近维护：
              {operations.maintenance
                ? new Date(operations.maintenance.at).toLocaleString("zh-CN")
                : "暂无执行记录"}
            </p>
            {operations.maintenance &&
              Date.now() - Date.parse(operations.maintenance.at) >
                5 * 60000 && (
                <p className="form-error">
                  维护任务超过5分钟未执行，请检查定时任务。
                </p>
              )}
            {!operations.maintenance && (
              <p className="form-error">尚未检测到定时维护，请配置后核验。</p>
            )}
            <div className="mail-queue">
              {operations.queue.length ? (
                operations.queue.map((task) => (
                  <div className="mail-queue-row" key={task.id}>
                    <div>
                      <strong>{task.title}</strong>
                      <small>{task.to}</small>
                      <small>
                        {task.attempts >= 5
                          ? "投递失败，需人工处理"
                          : (task.leaseUntil || 0) > Date.now()
                            ? "正在投递"
                            : "等待重试"}{" "}
                        · 失败次数 {task.attempts}
                      </small>
                    </div>
                    {task.attempts >= 5 && (
                      <button
                        type="button"
                        className="secondary"
                        disabled={busy}
                        onClick={() => void retryNotification(task.id)}
                      >
                        <RotateCw size={16} /> 重试
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <p className="empty-mini">暂无待处理邮件</p>
              )}
            </div>
          </>
        ) : (
          <p>运行状态尚未加载</p>
        )}
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
              <p className="muted">{pendingProducts.length} 条待审核</p>
            </div>
            <PackageCheck size={22} />
          </div>
          {pendingProducts.length ? (
            pendingProducts.map((item) => (
              <AdminCase
                key={item.id}
                title={item.title}
                detail={
                  <>
                    <p>{item.condition}</p>
                    <p>
                      {item.spot} · {item.returnRule} {item.swapRule}
                    </p>
                    <div className="detail-photo-strip">
                      {item.photos?.map((url) => (
                        <a
                          href={url}
                          key={url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <img src={url} alt={item.title} />
                        </a>
                      ))}
                    </div>
                  </>
                }
                meta={`${item.campus === "SIP" ? "SIP 校区" : "XEC 校区"} · ${item.category} · 押金 ¥${item.deposit}`}
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
              <h2>交易与仲裁</h2>
              <p className="muted">{activeBookings.length} 笔进行中</p>
            </div>
            <ClipboardList size={22} />
          </div>
          {activeBookings
            .filter((item) => !item.ownerId || item.status === "有争议")
            .map((item) => (
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
              <p className="muted">{openReports.length} 条待处理</p>
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
                detail={
                  item.target.startsWith("need:") ? (
                    <NeedReview id={item.target.slice(5)} />
                  ) : undefined
                }
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
              <p className="muted">{activeProducts.length} 件可用</p>
            </div>
            <PackageCheck size={22} />
          </div>
          {products.slice(0, 6).map((item) => (
            <div className="admin-row" key={item.id}>
              <span>
                <strong>{item.title}</strong>
                <small>
                  {item.campus === "SIP" ? "SIP 校区" : "XEC 校区"} ·{" "}
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

function NeedReview({ id }: { id: string }) {
  const confirm = useConfirmation();
  const [details, setDetails] = useState<{
      title: string;
      note: string;
      status: string;
    } | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    clientFetch("/api/needs?reviewId=" + encodeURIComponent(id))
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        if (active) setDetails(data);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : "加载失败");
      });
    return () => {
      active = false;
    };
  }, [id]);
  async function hide() {
    if (!(await confirm("隐藏这条求物？记录会保留，发布者将收到通知。")))
      return;
    setBusy(true);
    setError("");
    try {
      const r = await clientFetch("/api/needs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "hide" }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setDetails((n) => n && { ...n, status: "withdrawn" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "隐藏失败");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      {error && <p role="alert">{error}</p>}
      {details ? (
        <>
          <strong>{details.title}</strong>
          <p>{details.note}</p>
          <button
            type="button"
            className="danger"
            disabled={busy || details.status === "withdrawn"}
            onClick={() => void hide()}
          >
            {details.status === "withdrawn" ? "已隐藏" : "隐藏求物"}
          </button>
        </>
      ) : (
        !error && <p>正在读取求物内容…</p>
      )}
    </div>
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
  detail,
}: {
  title: string;
  meta: string;
  actionLabel: string;
  onClick: () => void;
  extra?: React.ReactNode;
  detail?: React.ReactNode;
}) {
  return (
    <div className="admin-case">
      <div>
        <strong>{title}</strong>
        <small>{meta}</small>
        {detail}
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
