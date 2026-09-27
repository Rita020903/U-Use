"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Check, ClipboardList, Flag, PackageCheck, ShieldAlert, Users } from "lucide-react";

export default function AdminClient() {
  const [products, setProducts] = useState<{ id: string; title: string; status: string; campus: string }[]>([]);
  const [message, setMessage] = useState("");
  useEffect(() => { fetch("/api/products?campus=SIP&scope=local").then((response) => response.json()).then(setProducts); }, []);
  function action(text: string) { setMessage(text); window.setTimeout(() => setMessage(""), 1600); }
  return <main className="admin-shell"><header className="admin-header"><div><p className="eyebrow">U USE / ADMIN</p><h1>运营管理</h1><p className="muted">学生认证、物品审核、借还预约与押金争议</p></div><a className="secondary link-button" href="/"><ArrowLeft size={15} />返回学生端</a></header><section className="admin-stats"><Stat icon={<Users />} label="认证用户" value="1,284" /><Stat icon={<PackageCheck />} label="开放物品" value="386" /><Stat icon={<Flag />} label="待处理争议" value="7" alert /><Stat icon={<ClipboardList />} label="本周借还" value="96" /></section><section className="admin-grid"><div className="admin-card"><div className="split"><div><h2>待处理事项</h2><p className="muted">优先处理归还异常、押金争议和认证异常</p></div><ShieldAlert size={22} /></div><AdminCase title="Casio fx-991CN X" meta="借用审核 · 王同学 · 10 分钟前" onClick={() => action("已通过开放物品审核")} /><AdminCase title="正装衬衫归还异常" meta="押金争议 · 需要查看借出前后照片" onClick={() => action("已打开争议证据")} /><AdminCase title="邮箱异常登录" meta="账号风控 · 同一邮箱多设备" onClick={() => action("已标记为待复核")} /></div><div className="admin-card"><div className="split"><div><h2>最近开放物品</h2><p className="muted">可接入真实审核队列和借还记录</p></div><PackageCheck size={22} /></div>{products.slice(0, 5).map((item) => <div className="admin-row" key={item.id}><span><strong>{item.title}</strong><small>{item.campus === "SIP" ? "SIP 校区" : "太仓校区"}</small></span><span className="status-tag">{item.status}</span></div>)}</div></section>{message && <div className="toast">{message}</div>}</main>;
}

function Stat({ icon, label, value, alert = false }: { icon: React.ReactNode; label: string; value: string; alert?: boolean }) {
  return <div className="admin-stat"><span className={alert ? "stat-icon alert" : "stat-icon"}>{icon}</span><small>{label}</small><b>{value}</b></div>;
}

function AdminCase({ title, meta, onClick }: { title: string; meta: string; onClick: () => void }) {
  return <div className="admin-case"><div><strong>{title}</strong><small>{meta}</small></div><button className="icon-button" onClick={onClick}><Check size={16} /></button></div>;
}
