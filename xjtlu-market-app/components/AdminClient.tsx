"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Check, ClipboardList, Flag, PackageCheck, ShieldAlert, Users } from "lucide-react";
import { Booking, Product, Report } from "../lib/types";

export default function AdminClient() {
  const [products, setProducts] = useState<Product[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [message, setMessage] = useState("");
  useEffect(() => { loadQueues(); }, []);

  async function loadQueues() {
    const [productResponse, bookingResponse, reportResponse] = await Promise.all([
      fetch("/api/products?admin=1"),
      fetch("/api/bookings"),
      fetch("/api/reports")
    ]);
    setProducts(await productResponse.json());
    setBookings(await bookingResponse.json());
    setReports(await reportResponse.json());
  }

  function action(text: string) { setMessage(text); window.setTimeout(() => setMessage(""), 1600); }
  async function updateProduct(id: string, status: string) {
    const response = await fetch("/api/products", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
    action(response.ok ? `物品已更新为：${status}` : "物品状态更新失败");
    loadQueues();
  }
  async function updateBooking(id: string, status: string) {
    const response = await fetch("/api/bookings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
    action(response.ok ? `预约已更新为：${status}` : "预约状态更新失败");
    loadQueues();
  }
  async function updateReport(id: string, status: string) {
    const response = await fetch("/api/reports", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
    action(response.ok ? `举报已更新为：${status}` : "举报状态更新失败");
    loadQueues();
  }

  const pendingProducts = products.filter((item) => item.status === "审核中");
  const activeProducts = products.filter((item) => item.status === "可用");
  const openReports = reports.filter((item) => item.status !== "已处理");
  const activeBookings = bookings.filter((item) => item.status !== "已归还" && item.status !== "已取消");

  return <main className="admin-shell"><header className="admin-header"><div><p className="eyebrow">U USE / ADMIN</p><h1>运营管理</h1><p className="muted">真实 MVP 的最小后台：审核物品、确认借还、处理举报</p></div><a className="secondary link-button" href="/"><ArrowLeft size={15} />返回学生端</a></header><section className="admin-stats"><Stat icon={<Users />} label="认证用户" value="1,284" /><Stat icon={<PackageCheck />} label="可用物品" value={String(activeProducts.length)} /><Stat icon={<Flag />} label="待处理举报" value={String(openReports.length)} alert /><Stat icon={<ClipboardList />} label="进行中借还" value={String(activeBookings.length)} /></section><section className="admin-grid"><div className="admin-card"><div className="split"><div><h2>物品审核</h2><p className="muted">新发布物品默认进入审核，通过后才展示给学生</p></div><PackageCheck size={22} /></div>{pendingProducts.length ? pendingProducts.map((item) => <AdminCase key={item.id} title={item.title} meta={`${item.campus === "SIP" ? "SIP 校区" : "太仓校区"} · ${item.category} · 押金 ¥${item.deposit}`} actionLabel="通过" onClick={() => updateProduct(item.id, "可用")} />) : <p className="empty-mini">暂无待审核物品</p>}</div><div className="admin-card"><div className="split"><div><h2>借还预约</h2><p className="muted">从待确认到已归还，保留押金和交付点记录</p></div><ClipboardList size={22} /></div>{activeBookings.map((item) => <AdminCase key={item.id} title={item.productTitle} meta={`${item.requester} -> ${item.owner} · ${item.spot} · ${item.time} / ${item.returnTime} · ${item.status}`} actionLabel={item.status === "待确认" ? "确认" : item.status === "待归还" ? "归还" : "下一步"} onClick={() => updateBooking(item.id, item.status === "待确认" ? "已确认" : item.status === "待归还" ? "已归还" : "待归还")} />)}</div><div className="admin-card"><div className="split"><div><h2>举报与争议</h2><p className="muted">记录原因、说明和处理状态，避免私聊扯皮</p></div><ShieldAlert size={22} /></div>{openReports.length ? openReports.map((item) => <AdminCase key={item.id} title={item.reason} meta={`${item.target} · ${item.note}`} actionLabel="处理" onClick={() => updateReport(item.id, "已处理")} />) : <p className="empty-mini">暂无待处理举报</p>}</div><div className="admin-card"><div className="split"><div><h2>最近开放物品</h2><p className="muted">展示真实商品状态，便于 session 说明落地流程</p></div><PackageCheck size={22} /></div>{products.slice(0, 6).map((item) => <div className="admin-row" key={item.id}><span><strong>{item.title}</strong><small>{item.campus === "SIP" ? "SIP 校区" : "太仓校区"} · {item.accessMode}</small></span><span className="status-tag">{item.status}</span></div>)}</div></section>{message && <div className="toast">{message}</div>}</main>;
}

function Stat({ icon, label, value, alert = false }: { icon: React.ReactNode; label: string; value: string; alert?: boolean }) {
  return <div className="admin-stat"><span className={alert ? "stat-icon alert" : "stat-icon"}>{icon}</span><small>{label}</small><b>{value}</b></div>;
}

function AdminCase({ title, meta, actionLabel, onClick }: { title: string; meta: string; actionLabel: string; onClick: () => void }) {
  return <div className="admin-case"><div><strong>{title}</strong><small>{meta}</small></div><button className="icon-button" onClick={onClick} aria-label={actionLabel}><Check size={16} /><span>{actionLabel}</span></button></div>;
}
