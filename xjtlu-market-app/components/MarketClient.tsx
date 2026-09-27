"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Compass, Heart, LocateFixed, MessageCircle, Plus, Search, ShieldCheck, SlidersHorizontal, UserRound } from "lucide-react";
import { AccessMode, Campus, Product } from "../lib/types";

const categories = ["全部", "学习考试", "活动服装", "出行用品", "交通", "数码产品", "活动设备"];
const accessModes: { value: "all" | AccessMode; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "borrow", label: "可借" },
  { value: "rent", label: "短租" },
  { value: "buy", label: "买断" },
  { value: "swap", label: "交换" }
];

function modeLabel(mode: AccessMode) {
  return mode === "borrow" ? "借用" : mode === "rent" ? "短租" : mode === "swap" ? "交换" : "买断";
}

function priceLabel(product: Product) {
  if (product.accessMode === "rent") return product.rentPrice ? `¥${product.rentPrice}/天` : "短租";
  if (product.accessMode === "buy") return product.price > 0 ? `¥${product.price}` : "买断";
  return modeLabel(product.accessMode);
}

export default function MarketClient() {
  const [campus, setCampus] = useState<Campus>("SIP");
  const [scope, setScope] = useState<"local" | "cross">("local");
  const [category, setCategory] = useState("全部");
  const [accessMode, setAccessMode] = useState<"all" | AccessMode>("all");
  const [sort, setSort] = useState("near");
  const [search, setSearch] = useState("");
  const [located, setLocated] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Product | null>(null);
  const [bookingProduct, setBookingProduct] = useState<Product | null>(null);
  const [tab, setTab] = useState<"discover" | "publish" | "messages" | "profile">("discover");
  const [toast, setToast] = useState("");
  const [showBooking, setShowBooking] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const requestSeq = useRef(0);

  const campusLabel = campus === "SIP" ? "SIP 校区" : "太仓校区";

  async function loadProducts() {
    const requestId = requestSeq.current + 1;
    requestSeq.current = requestId;
    setLoading(true);
    const params = new URLSearchParams({ campus, scope, category, accessMode, sort, search });
    try {
      const response = await fetch(`/api/products?${params}`);
      if (!response.ok) throw new Error("Failed to load products");
      const nextProducts = await response.json();
      if (requestSeq.current === requestId) setProducts(nextProducts);
    } catch {
      if (requestSeq.current === requestId) {
        setProducts([]);
        notify("加载失败，请稍后重试");
      }
    } finally {
      if (requestSeq.current === requestId) setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, [campus, scope, category, accessMode, sort, search]);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 1800);
  }

  function switchCampus() {
    const next = campus === "SIP" ? "TAICANG" : "SIP";
    setCampus(next);
    setScope("local");
    notify(`已切换到${next === "SIP" ? "SIP" : "太仓"}校区`);
  }

  function handleLocate() {
    if (!navigator.geolocation) {
      notify("当前浏览器不支持定位");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => {
        setLocated(true);
        notify(`已定位到${campusLabel}`);
      },
      () => notify("定位未开启，仍可手动选择校区")
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark">U</div>
        <div className="brand-copy"><strong>U Use</strong><span>西浦物品使用</span></div>
        <span className="verified"><ShieldCheck size={14} /> 邮箱已验证</span>
      </header>

      <section className="hero-row">
        <div>
          <p className="eyebrow">XJTLU ITEM ACCESS</p>
          <h1>{tab === "discover" ? "今天用什么" : tab === "publish" ? "开放物品" : tab === "messages" ? "借还预约" : "我的"}</h1>
          <p className="muted">{tab === "discover" ? "买、借、短租、交换都在这里" : "面向已认证的西浦学生"}</p>
        </div>
        <button className="campus-button" onClick={switchCampus}><span>当前校区</span><b>{campus === "SIP" ? "SIP" : "太仓"}</b></button>
      </section>

      {tab === "discover" && (
        <>
          <label className="search-box"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜计算器、正装、行李箱、自行车" /></label>
          <section className="scope-tabs">
            <button className={scope === "local" ? "active" : ""} onClick={() => setScope("local")}>本校区优先</button>
            <button className={scope === "cross" ? "active" : ""} onClick={() => setScope("cross")}>跨校区可交易</button>
          </section>
          <section className={`campus-map ${campus === "TAICANG" ? "taicang" : ""}`}>
            <span className="map-title">{scope === "cross" ? "跨校区物品 · 约公共交付点" : `${campusLabel} · 附近可用物品`}</span>
            <span className="map-place place-a">图书馆</span><span className="map-place place-b">学生中心</span>
            <span className="map-place place-c">宿舍区</span><span className="map-place place-d">校车点</span>
            <span className="map-pin pin-one">1</span><span className="map-pin pin-two">2</span><span className="map-pin pin-three">3</span>
            {located && <span className="my-location"><LocateFixed size={14} /></span>}
            <span className="map-note">示意地图 · 不展示精确位置</span>
          </section>
          <section className="toolbar">
            <button className={located ? "tool active" : "tool"} onClick={handleLocate}><LocateFixed size={15} />{located ? "已开启定位" : "开启定位"}</button>
<label className="sort-control"><SlidersHorizontal size={15} /><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="near">就近推荐</option><option value="new">最新发布</option><option value="high">使用成本高到低</option><option value="low">使用成本低到高</option></select></label>
          </section>
          <div className="chip-row">{categories.map((item) => <button key={item} className={category === item ? "chip active" : "chip"} onClick={() => setCategory(item)}>{item}</button>)}</div>
          <div className="task-strip"><div><strong>按使用方式找</strong><span>不是每件东西都要买，很多东西只需要用一下</span></div><div className="task-chips">{accessModes.slice(1).map((item) => <button key={item.value} className={accessMode === item.value ? "task-chip active" : "task-chip"} onClick={() => setAccessMode(accessMode === item.value ? "all" : item.value)}>{item.label}</button>)}</div></div>
          <section className="product-list" aria-live="polite">
            {loading ? <div className="empty-state">正在加载可用物品...</div> : products.map((product) => <ProductCard key={product.id} product={product} currentCampus={campus} onClick={() => setSelected(product)} />)}
            {!loading && !products.length && <div className="empty-state">没有找到合适的物品，换个关键词或筛选条件试试。</div>}
          </section>
        </>
      )}

      {tab === "publish" && <PublishPanel onDone={(message) => { setTab("discover"); notify(message); loadProducts(); }} />}
      {tab === "messages" && <MessagesPanel onBooking={() => { setBookingProduct(null); setShowBooking(true); }} onReport={() => setShowReport(true)} onNotify={notify} />}
      {tab === "profile" && <ProfilePanel onPublish={() => setTab("publish")} onNotify={notify} />}

      <nav className="bottom-nav">
        <button className={tab === "discover" ? "active" : ""} onClick={() => setTab("discover")}><Compass size={19} />发现</button>
        <button className={tab === "publish" ? "active" : ""} onClick={() => setTab("publish")}><Plus size={19} />开放</button>
        <button className={tab === "messages" ? "active" : ""} onClick={() => setTab("messages")}><MessageCircle size={19} />借还</button>
        <button className={tab === "profile" ? "active" : ""} onClick={() => setTab("profile")}><UserRound size={19} />我的</button>
      </nav>

      {selected && <ProductModal product={selected} campus={campus} onClose={() => setSelected(null)} onBook={() => { setBookingProduct(selected); setSelected(null); setShowBooking(true); }} onReport={() => { setSelected(null); setShowReport(true); }} onFavorite={() => notify("已加入收藏")} />}
      {showBooking && <BookingModal product={bookingProduct} campus={campus} onClose={() => { setShowBooking(false); setBookingProduct(null); }} onDone={(message) => { setShowBooking(false); setBookingProduct(null); notify(message); }} />}
      {showReport && <ReportModal onClose={() => setShowReport(false)} onDone={(message) => { setShowReport(false); notify(message); }} />}
      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}

function ProductCard({ product, currentCampus, onClick }: { product: Product; currentCampus: Campus; onClick: () => void }) {
  const cross = product.campus !== currentCampus;
  return <button className="product-card" onClick={onClick} aria-label={`查看${product.title}详情`}>
    <div className={`product-visual ${product.tone}`}>{product.emoji}</div>
    <div className="product-body"><div className="product-title-row"><h3>{product.title}</h3><Heart size={16} /></div><strong className="price">{priceLabel(product)}</strong><div className="product-meta"><span>{product.availabilityLabel}</span><span className={cross ? "cross-tag" : ""}>{cross ? "跨校区" : product.spot}</span></div><small>{modeLabel(product.accessMode)} · 押金 ¥{product.deposit} · {product.availableFrom} 至 {product.availableTo}</small></div>
  </button>;
}

function ProductModal({ product, campus, onClose, onBook, onReport, onFavorite }: { product: Product; campus: Campus; onClose: () => void; onBook: () => void; onReport: () => void; onFavorite: () => void }) {
  const cross = product.campus !== campus;
  return <div className="modal-backdrop"><div className="modal"><button className="modal-close" onClick={onClose} aria-label="关闭">×</button><span className="verified"><ShieldCheck size={14} /> 西浦学生邮箱已验证</span><div className={`detail-visual ${product.tone}`}>{product.emoji}</div><h2>{product.title}</h2><strong className="detail-price">{priceLabel(product)}</strong><div className="detail-line"><b>方式</b><span>{modeLabel(product.accessMode)} · 押金 ¥{product.deposit}<br /><small>{product.availabilityLabel}：{product.availableFrom} 至 {product.availableTo}</small></span></div><div className="detail-line"><b>位置</b><span>{product.campus === "SIP" ? "SIP 校区" : "太仓校区"} · {product.spot}<br /><small>{cross ? "跨校区，建议约固定公共交付点" : `${product.distanceKm} km，适合当面验货`}</small></span></div><div className="detail-line"><b>成色</b><span>{product.condition}</span></div><div className="detail-line"><b>归还</b><span>{product.returnRule}</span></div><div className="agreement-list">{product.agreement.map((item) => <span key={item}>✓ {item}</span>)}</div><div className="modal-actions"><button className="secondary" onClick={onFavorite}><Heart size={15} />收藏</button><button className="primary" onClick={onBook}><MessageCircle size={15} />预约使用</button></div><button className="danger full" onClick={onReport}>举报物品</button></div></div>;
}

function PublishPanel({ onDone }: { onDone: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: data.get("title"), category: data.get("category"), price: Number(data.get("price") || 0), rentPrice: Number(data.get("rentPrice") || 0), deposit: Number(data.get("deposit") || 0), campus: data.get("campus"), spot: data.get("spot"), condition: data.get("condition"), accessMode: data.get("accessMode"), availableFrom: data.get("availableFrom"), availableTo: data.get("availableTo"), availabilityLabel: data.get("availabilityLabel"), returnRule: data.get("returnRule"), crossCampus: data.get("crossCampus") === "on" }) });
      onDone(response.ok ? "已提交，等待管理员审核" : "提交失败，请检查填写内容");
    } catch {
      onDone("网络异常，请稍后重试");
    } finally {
      setBusy(false);
    }
  }
  return <section className="panel"><p className="eyebrow">OPEN AN ITEM</p><h2>开放物品</h2><p className="muted">你可以选择买断、借用、短租或交换，让同学只在需要时使用它。</p><form className="form" onSubmit={submit}><label>物品名称<input required name="title" placeholder="例如：计算器 / 正装 / 行李箱" /></label><label>使用方式<select name="accessMode"><option value="borrow">借用</option><option value="rent">短租</option><option value="buy">买断</option><option value="swap">交换</option></select></label><label>可用说明<input required name="availabilityLabel" placeholder="例如：可借 7 天 / 短租 1-3 天" /></label><label>可用开始日期<input required name="availableFrom" type="date" /></label><label>可用结束日期<input required name="availableTo" type="date" /></label><label>买断价格<input name="price" type="number" min="0" placeholder="买断时填写，可借/短租可填 0" /></label><label>短租价格 / 天<input name="rentPrice" type="number" min="0" placeholder="短租时填写" /></label><label>押金<input name="deposit" type="number" min="0" placeholder="借用/短租/交换建议填写" /></label><label>分类<select name="category">{categories.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label><label>成色<input required name="condition" placeholder="例如：功能正常，有轻微划痕" /></label><label>所在校区<select name="campus"><option value="SIP">SIP 校区</option><option value="TAICANG">太仓校区</option></select></label><label>交付地点<input required name="spot" placeholder="例如：图书馆门口 / 校车点" /></label><label>归还规则<textarea name="returnRule" placeholder="例如：归还时检查外观和功能，逾期需重新协商" /></label><label className="check-label"><input name="crossCampus" type="checkbox" /> 支持跨校区借还</label><button className="primary full" disabled={busy}>{busy ? "提交中..." : "提交审核"}</button></form></section>;
}

function MessagesPanel({ onBooking, onReport, onNotify }: { onBooking: () => void; onReport: () => void; onNotify: (message: string) => void }) {
  return <section className="panel"><p className="eyebrow">INBOX</p><h2>借还预约</h2><p className="muted">确认借出、归还时间和物品状态。</p><div className="message-card"><div className="split"><strong>王同学</strong><small>刚刚</small></div><p>计算器这周还能借吗？我周五考完归还。</p><button className="secondary full" onClick={() => onNotify("课程原型：实时聊天与消息推送将在下一版接入")}>打开会话</button></div><div className="message-card"><div className="split"><strong>归还提醒</strong><span className="status-tag">待确认</span></div><p>通勤自行车 · 明天 18:00 太仓校车点归还</p><button className="secondary full" onClick={onBooking}>查看借还单</button></div><button className="danger full" onClick={onReport}>举报聊天内容</button></section>;
}

function ProfilePanel({ onPublish, onNotify }: { onPublish: () => void; onNotify: (message: string) => void }) {
  return <section className="panel"><p className="eyebrow">PROFILE</p><h2>我的</h2><div className="profile-card"><div className="avatar">林</div><div><strong>林同学</strong><span className="verified inline"><ShieldCheck size={14} /> 西浦学生邮箱已验证</span></div></div><div className="stats"><div><b>3</b><small>开放中</small></div><div><b>8</b><small>完成借还</small></div><div><b>12</b><small>收藏</small></div></div><div className="menu-list"><button onClick={onPublish}>开放新的物品 <span>›</span></button><button onClick={() => onNotify("我的借还：原型中以借还单形式展示 2 条记录")}>我的借还 <span>2 条 ›</span></button><button onClick={() => onNotify("我的收藏：原型中保存 12 件收藏物品")}>我的收藏 <span>12 件 ›</span></button><button onClick={() => window.location.href = "/admin"}>运营管理 <span>管理员入口 ›</span></button></div></section>;
}

function BookingModal({ product, campus, onClose, onDone }: { product: Product | null; campus: Campus; onClose: () => void; onDone: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const response = await fetch("/api/bookings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: product?.id ?? "manual-booking", campus: data.get("campus"), spot: data.get("spot"), time: data.get("time"), note: data.get("note") }) });
      onDone(response.ok ? "预约已发送，等待对方确认" : "预约失败，请检查信息");
    } catch {
      onDone("网络异常，请稍后重试");
    } finally {
      setBusy(false);
    }
  }
  return <div className="modal-backdrop"><div className="modal"><button className="modal-close" onClick={onClose} aria-label="关闭">×</button><p className="eyebrow">USE BOOKING</p><h2>确认使用预约</h2><p className="muted">{product ? product.title : "借还单"} · 请确认借出、归还和公共交付点。</p><form className="form" onSubmit={submit}><label>交付校区<select name="campus" defaultValue={product?.campus ?? campus}><option value="SIP">SIP 校区</option><option value="TAICANG">太仓校区</option></select></label><label>交付地点<input required name="spot" defaultValue="图书馆门口" /></label><label>借出时间<input required name="time" defaultValue="今晚 19:00" /></label><label>归还说明<textarea name="note" placeholder="例如：周五 18:00 前归还，归还时双方确认物品状态" /></label><button className="primary full" disabled={busy}>{busy ? "发送中..." : "发送使用预约"}</button></form></div></div>;
}

function ReportModal({ onClose, onDone }: { onClose: () => void; onDone: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const response = await fetch("/api/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ target: "student-content", reason: data.get("reason"), note: data.get("note") }) });
      onDone(response.ok ? "举报已提交，平台会尽快处理" : "举报失败，请检查填写内容");
    } catch {
      onDone("网络异常，请稍后重试");
    } finally {
      setBusy(false);
    }
  }
  return <div className="modal-backdrop"><div className="modal"><button className="modal-close" onClick={onClose} aria-label="关闭">×</button><p className="eyebrow">SAFETY</p><h2>举报与反馈</h2><form className="form" onSubmit={submit}><label>举报原因<select name="reason"><option>疑似诈骗</option><option>商品与描述不符</option><option>违禁商品</option><option>骚扰或辱骂</option><option>诱导站外交易</option></select></label><label>补充说明<textarea required name="note" placeholder="请描述你发现的问题" /></label><button className="danger full" disabled={busy}>{busy ? "提交中..." : "提交举报"}</button></form></div></div>;
}
