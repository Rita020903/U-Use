"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  Compass,
  Heart,
  LocateFixed,
  MessageCircle,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import { AccessMode, Campus, Product } from "../lib/types";
import CampusMap from "./CampusMap";
import BookingsPanel from "./BookingsPanel";
import PublishPanel from "./PublishPanel";
import { navigationUrl } from "../lib/campuses";

const categories = [
  "全部",
  "学习考试",
  "活动服装",
  "出行用品",
  "交通",
  "数码产品",
  "活动设备",
];
const accessModes: { value: "all" | AccessMode; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "borrow", label: "可借" },
  { value: "rent", label: "短租" },
  { value: "buy", label: "买断" },
  { value: "swap", label: "交换" },
];

function modeLabel(mode: AccessMode) {
  return mode === "borrow"
    ? "借用"
    : mode === "rent"
      ? "短租"
      : mode === "swap"
        ? "交换"
        : "买断";
}

function priceLabel(product: Product) {
  if (product.accessMode === "rent")
    return product.rentPrice ? `¥${product.rentPrice}/天` : "短租";
  if (product.accessMode === "buy")
    return product.price > 0 ? `¥${product.price}` : "买断";
  return modeLabel(product.accessMode);
}

export default function MarketClient() {
  const [campus, setCampus] = useState<Campus>("SIP");
  const [scope, setScope] = useState<"local" | "cross">("local");
  const [category, setCategory] = useState("全部");
  const [accessMode, setAccessMode] = useState<"all" | AccessMode>("all");
  const [sort, setSort] = useState("near");
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);
  const [bookingProduct, setBookingProduct] = useState<Product | null>(null);
  const [tab, setTab] = useState<
    "discover" | "publish" | "messages" | "profile"
  >("discover");
  const [toast, setToast] = useState("");
  const [showBooking, setShowBooking] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportTarget, setReportTarget] = useState("");
  const requestSeq = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("uuse-favorites") || "[]");
      if (Array.isArray(saved))
        setFavorites(saved.filter((id) => typeof id === "string"));
    } catch {}
    try {
      const savedCampus = localStorage.getItem("uuse-campus");
      if (savedCampus === "SIP" || savedCampus === "TAICANG")
        setCampus(savedCampus);
    } catch {}
    return () => clearTimeout(toastTimer.current);
  }, []);

  useEffect(() => {
    if (!selected && !showBooking && !showReport) return;
    const previous = document.activeElement as HTMLElement | null;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const modal = document.querySelector<HTMLElement>(".modal");
    modal
      ?.querySelector<HTMLElement>("button, input, select, textarea")
      ?.focus();
    function keyboard(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelected(null);
        setShowBooking(false);
        setShowReport(false);
      }
      if (event.key === "Tab" && modal) {
        const nodes = Array.from(
          modal.querySelectorAll<HTMLElement>(
            "button:not(:disabled), input, select, textarea, a[href]",
          ),
        );
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        }
        if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }
    window.addEventListener("keydown", keyboard);
    return () => {
      document.body.style.overflow = original;
      window.removeEventListener("keydown", keyboard);
      previous?.focus();
    };
  }, [selected, showBooking, showReport]);

  function toggleFavorite(id: string) {
    const next = favorites.includes(id)
      ? favorites.filter((item) => item !== id)
      : [...favorites, id];
    setFavorites(next);
    try {
      localStorage.setItem("uuse-favorites", JSON.stringify(next));
    } catch {
      notify("当前浏览器无法保存收藏");
    }
  }

  async function loadProducts() {
    const requestId = requestSeq.current + 1;
    requestSeq.current = requestId;
    setLoading(true);
    setLoadError(false);
    const params = new URLSearchParams({
      campus,
      scope,
      category,
      accessMode,
      sort,
      search,
    });
    if (favoriteOnly) params.delete("campus");
    try {
      const response = await fetch(`/api/products?${params}`);
      if (!response.ok) throw new Error("Failed to load products");
      const nextProducts = await response.json();
      if (requestSeq.current === requestId) setProducts(nextProducts);
    } catch {
      if (requestSeq.current === requestId) {
        setProducts([]);
        setLoadError(true);
        notify("加载失败，请稍后重试");
      }
    } finally {
      if (requestSeq.current === requestId) setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      loadProducts();
    }, 250);
    return () => {
      clearTimeout(timer);
      requestSeq.current += 1;
    };
  }, [campus, scope, category, accessMode, sort, search, favoriteOnly]);

  function notify(message: string) {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3000);
  }

  function switchCampus() {
    const next = campus === "SIP" ? "TAICANG" : "SIP";
    setCampus(next);
    try {
      localStorage.setItem("uuse-campus", next);
    } catch {}
    setScope("local");
    notify(`已切换到${next === "SIP" ? "SIP" : "太仓"}校区`);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark">U</div>
        <div className="brand-copy">
          <strong>U Use</strong>
          <span>西浦物品使用</span>
        </div>
        <span className="verified">
          <ShieldCheck size={14} /> 试用体验
        </span>
      </header>

      <section className="hero-row">
        <div>
          <p className="eyebrow">XJTLU ITEM ACCESS</p>
          <h1>
            {tab === "discover"
              ? "今天用什么"
              : tab === "publish"
                ? "开放物品"
                : tab === "messages"
                  ? "借还预约"
                  : "我的"}
          </h1>
          <p className="muted">
            {tab === "discover"
              ? "买、借、短租、交换都在这里"
              : "校内物品共享与借还"}
          </p>
        </div>
        <button className="campus-button" onClick={switchCampus}>
          <span>当前校区</span>
          <b>{campus === "SIP" ? "SIP" : "太仓"}</b>
        </button>
      </section>

      {tab === "discover" && (
        <>
          <label className="search-box">
            <Search size={17} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="搜索物品"
              placeholder="搜计算器、正装、行李箱、自行车"
            />
          </label>
          <section className="scope-tabs">
            <button
              className={scope === "local" ? "active" : ""}
              onClick={() => setScope("local")}
            >
              本校区优先
            </button>
            <button
              className={scope === "cross" ? "active" : ""}
              onClick={() => setScope("cross")}
            >
              跨校区可交易
            </button>
          </section>
          <CampusMap key={campus} campus={campus} />
          <section className="toolbar">
            <a
              className="tool"
              href={navigationUrl(campus)}
              target="_blank"
              rel="noreferrer"
            >
              <LocateFixed size={15} />
              校区导航
            </a>
            <label className="sort-control">
              <SlidersHorizontal size={15} />
              <select
                aria-label="物品排序"
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                <option value="near">推荐顺序</option>
                <option value="new">最新发布</option>
                <option value="high">使用成本高到低</option>
                <option value="low">使用成本低到高</option>
              </select>
            </label>
          </section>
          <div className="chip-row">
            {categories.map((item) => (
              <button
                key={item}
                className={category === item ? "chip active" : "chip"}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="task-strip">
            <div>
              <strong>使用方式</strong>
            </div>
            <div className="task-chips">
              {accessModes.slice(1).map((item) => (
                <button
                  key={item.value}
                  className={
                    accessMode === item.value ? "task-chip active" : "task-chip"
                  }
                  onClick={() =>
                    setAccessMode(
                      accessMode === item.value ? "all" : item.value,
                    )
                  }
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <section className="product-list" aria-live="polite">
            <button
              className={favoriteOnly ? "tool active" : "tool"}
              aria-pressed={favoriteOnly}
              onClick={() => setFavoriteOnly(!favoriteOnly)}
            >
              <Heart size={15} />
              {favoriteOnly ? "已收藏" : "只看收藏"} ({favorites.length})
            </button>
            {loading ? (
              <div className="empty-state">正在加载可用物品...</div>
            ) : (
              products
                .filter((item) => !favoriteOnly || favorites.includes(item.id))
                .map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    currentCampus={campus}
                    onClick={() => setSelected(product)}
                  />
                ))
            )}
            {!loading && loadError && (
              <div className="empty-state" role="alert">
                加载失败{" "}
                <button className="secondary" onClick={loadProducts}>
                  重试
                </button>
              </div>
            )}
            {!loading &&
              !loadError &&
              !products.filter(
                (item) => !favoriteOnly || favorites.includes(item.id),
              ).length && (
                <div className="empty-state">
                  没有找到合适的物品。
                  <button
                    className="secondary"
                    onClick={() => {
                      setSearch("");
                      setCategory("全部");
                      setAccessMode("all");
                      setFavoriteOnly(false);
                    }}
                  >
                    清除筛选
                  </button>
                </div>
              )}
          </section>
        </>
      )}

      {tab === "publish" && (
        <PublishPanel
          campus={campus}
          onDone={(message) => {
            setTab("discover");
            notify(message);
            loadProducts();
          }}
        />
      )}
      {tab === "messages" && <BookingsPanel />}
      {tab === "profile" && (
        <section className="panel">
          <h2>我的</h2>
          <div className="menu-list">
            <button onClick={() => setTab("publish")}>
              开放新的物品 <Plus size={16} />
            </button>
            <button onClick={() => setTab("messages")}>
              我的借还 <MessageCircle size={16} />
            </button>
            <button
              onClick={() => {
                setTab("discover");
                setFavoriteOnly(true);
                setSearch("");
                setCategory("全部");
                setAccessMode("all");
              }}
            >
              我的收藏 <span>{favorites.length} 件</span>
            </button>
            <a className="secondary full" href="/admin">
              运营管理
            </a>
          </div>
        </section>
      )}

      <nav className="bottom-nav">
        <button
          className={tab === "discover" ? "active" : ""}
          onClick={() => setTab("discover")}
        >
          <Compass size={19} />
          发现
        </button>
        <button
          className={tab === "publish" ? "active" : ""}
          onClick={() => setTab("publish")}
        >
          <Plus size={19} />
          开放
        </button>
        <button
          className={tab === "messages" ? "active" : ""}
          onClick={() => setTab("messages")}
        >
          <MessageCircle size={19} />
          借还
        </button>
        <button
          className={tab === "profile" ? "active" : ""}
          onClick={() => setTab("profile")}
        >
          <UserRound size={19} />
          我的
        </button>
      </nav>

      {selected && (
        <ProductModal
          favorite={favorites.includes(selected.id)}
          product={selected}
          campus={campus}
          onClose={() => setSelected(null)}
          onBook={() => {
            setBookingProduct(selected);
            setSelected(null);
            setShowBooking(true);
          }}
          onReport={() => {
            setReportTarget(selected.id);
            setSelected(null);
            setShowReport(true);
          }}
          onFavorite={() => {
            toggleFavorite(selected.id);
            notify(
              favorites.includes(selected.id) ? "已取消收藏" : "已加入收藏",
            );
          }}
        />
      )}
      {showBooking && (
        <BookingModal
          product={bookingProduct}
          campus={campus}
          onClose={() => {
            setShowBooking(false);
            setBookingProduct(null);
          }}
          onDone={(message) => {
            setShowBooking(false);
            setBookingProduct(null);
            notify(message);
          }}
        />
      )}
      {showReport && (
        <ReportModal
          target={reportTarget}
          onClose={() => setShowReport(false)}
          onDone={(message) => {
            setShowReport(false);
            notify(message);
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </main>
  );
}

function ProductCard({
  product,
  currentCampus,
  onClick,
}: {
  product: Product;
  currentCampus: Campus;
  onClick: () => void;
}) {
  const cross = product.campus !== currentCampus;
  return (
    <button
      className="product-card"
      onClick={onClick}
      aria-label={`查看${product.title}详情`}
    >
      <div className={`product-visual ${product.tone}`}>{product.emoji}</div>
      <div className="product-body">
        <div className="product-title-row">
          <h3>{product.title}</h3>
          <Heart size={16} />
        </div>
        <strong className="price">{priceLabel(product)}</strong>
        <div className="product-meta">
          <span>{product.availabilityLabel}</span>
          <span className={cross ? "cross-tag" : ""}>
            {cross ? "跨校区" : product.spot}
          </span>
        </div>
        <small>
          {modeLabel(product.accessMode)} · 押金 ¥{product.deposit} ·{" "}
          {product.availableFrom} 至 {product.availableTo}
        </small>
      </div>
    </button>
  );
}

function ProductModal({
  favorite,
  product,
  campus,
  onClose,
  onBook,
  onReport,
  onFavorite,
}: {
  favorite: boolean;
  product: Product;
  campus: Campus;
  onClose: () => void;
  onBook: () => void;
  onReport: () => void;
  onFavorite: () => void;
}) {
  const cross = product.campus !== campus;
  return (
    <div className="modal-backdrop">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="物品详情"
      >
        <button className="modal-close" onClick={onClose} aria-label="关闭">
          ×
        </button>
        <span className="verified">
          <ShieldCheck size={14} /> 物品详情
        </span>
        <div className={`detail-visual ${product.tone}`}>{product.emoji}</div>
        <h2>{product.title}</h2>
        <strong className="detail-price">{priceLabel(product)}</strong>
        <div className="detail-line">
          <b>方式</b>
          <span>
            {modeLabel(product.accessMode)} · 押金 ¥{product.deposit}
            <br />
            <small>
              {product.availabilityLabel}：{product.availableFrom} 至{" "}
              {product.availableTo}
            </small>
          </span>
        </div>
        <div className="detail-line">
          <b>位置</b>
          <span>
            {product.campus === "SIP" ? "SIP 校区" : "太仓校区"} ·{" "}
            {product.spot}
            <br />
            <a
              href={navigationUrl(product.campus, product.spot)}
              target="_blank"
              rel="noreferrer"
            >
              交付点导航
            </a>
            <br />
            <small>
              {cross
                ? "跨校区，建议约固定公共交付点"
                : "公共地点交付，双方确认物品状态"}
            </small>
          </span>
        </div>
        <div className="detail-line">
          <b>成色</b>
          <span>{product.condition}</span>
        </div>
        <div className="detail-line">
          <b>{product.returnRequired ? "归还" : "交付"}</b>
          <span>{product.returnRule}</span>
        </div>
        <div className="agreement-list">
          {product.agreement.map((item) => (
            <span key={item}>✓ {item}</span>
          ))}
        </div>
        <div className="modal-actions">
          <button className="secondary" onClick={onFavorite}>
            <Heart size={15} fill={favorite ? "currentColor" : "none"} />
            {favorite ? "取消收藏" : "收藏"}
          </button>
          <button className="primary" onClick={onBook}>
            <MessageCircle size={15} />
            预约使用
          </button>
        </div>
        <button className="danger full" onClick={onReport}>
          举报物品
        </button>
      </div>
    </div>
  );
}

function BookingModal({
  product,
  campus,
  onClose,
  onDone,
}: {
  product: Product | null;
  campus: Campus;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product?.id ?? "manual-booking",
          campus: data.get("campus"),
          spot: data.get("spot"),
          time: `${data.get("time")}:00+08:00`,
          returnTime: `${data.get("returnTime")}:00+08:00`,
          note: data.get("note"),
          requester: "试用用户",
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "预约失败，请重试");
        return;
      }
      onDone("预约已发送，等待对方确认");
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-title"
      >
        <button className="modal-close" onClick={onClose} aria-label="关闭">
          ×
        </button>
        <h2 id="booking-title">确认使用预约</h2>
        <p className="muted">
          {product?.title} · 可用日期 {product?.availableFrom} 至{" "}
          {product?.availableTo}
        </p>
        <form className="form" onSubmit={submit}>
          <label>
            交付校区
            <select name="campus" defaultValue={product?.campus ?? campus}>
              <option value={product?.campus ?? campus}>
                {(product?.campus ?? campus) === "SIP"
                  ? "SIP 校区"
                  : "太仓校区"}
              </option>
              {product?.crossCampus && (
                <option value={product.campus === "SIP" ? "TAICANG" : "SIP"}>
                  {product.campus === "SIP" ? "太仓校区" : "SIP 校区"}
                </option>
              )}
            </select>
          </label>
          <label>
            交付地点
            <input
              required
              maxLength={120}
              name="spot"
              defaultValue={product?.spot}
            />
          </label>
          <label>
            {product?.returnRequired ? "借出时间" : "交付时间"}
            <input
              required
              name="time"
              type="datetime-local"
              min={`${product?.availableFrom}T00:00`}
              max={`${product?.availableTo}T23:59`}
            />
          </label>
          {product?.returnRequired && (
            <label>
              归还时间
              <input
                required
                name="returnTime"
                type="datetime-local"
                min={`${product?.availableFrom}T00:00`}
                max={`${product?.availableTo}T23:59`}
              />
            </label>
          )}
          <label>
            {product?.returnRequired ? "归还说明" : "交付备注"}
            <textarea
              maxLength={2000}
              name="note"
              placeholder="归还时双方确认物品状态"
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary full" disabled={busy}>
            {busy ? "发送中..." : "发送使用预约"}
          </button>
        </form>
      </div>
    </div>
  );
}

function ReportModal({
  target,
  onClose,
  onDone,
}: {
  target: string;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target,
          reason: data.get("reason"),
          note: data.get("note"),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "举报失败，请重试");
        return;
      }
      onDone("举报已提交，平台会尽快处理");
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="举报与反馈"
      >
        <button className="modal-close" onClick={onClose} aria-label="关闭">
          ×
        </button>
        <p className="eyebrow">SAFETY</p>
        <h2>举报与反馈</h2>
        <form className="form" onSubmit={submit}>
          <label>
            举报原因
            <select name="reason">
              <option>疑似诈骗</option>
              <option>商品与描述不符</option>
              <option>违禁商品</option>
              <option>骚扰或辱骂</option>
              <option>诱导站外交易</option>
            </select>
          </label>
          <label>
            补充说明
            <textarea
              required
              maxLength={2000}
              name="note"
              placeholder="请描述你发现的问题"
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="danger full" disabled={busy}>
            {busy ? "提交中..." : "提交举报"}
          </button>
        </form>
      </div>
    </div>
  );
}
