"use client";
import { clientFetch } from "../lib/client-fetch";

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
  X,
  CalendarDays,
  Map,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { AccessMode, Campus, Product, Person } from "../lib/types";
import CampusMap from "./CampusMap";
import BookingsPanel from "./BookingsPanel";
import PublishPanel from "./PublishPanel";
import { navigationUrl } from "../lib/campuses";
import TimetablePanel from "./TimetablePanel";
import PlaceField from "./PlaceField";
import { Position } from "./NearbyMap";
import { distanceKm } from "../lib/places";
import {
  ensureSession,
  resetSession,
  watchSessionChanges,
} from "../lib/client-session";
import { useConfirmation } from "./ConfirmationProvider";
import { submissionFor, Submission } from "../lib/client-drafts";
import { Recommendation } from "../lib/matching";
import AccountPanel from "./AccountPanel";
import MyProducts from "./MyProducts";
import NotificationsPanel from "./NotificationsPanel";
import NeedsPanel from "./NeedsPanel";

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
  const [discoverView, setDiscoverView] = useState<"products" | "needs">(
    "products",
  );
  const [mapOpen, setMapOpen] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [myNeeds, setMyNeeds] = useState(false);
  const [category, setCategory] = useState("全部");
  const [accessMode, setAccessMode] = useState<"all" | AccessMode>("all");
  const [sort, setSort] = useState("near");
  const [nearbyOwner, setNearbyOwner] = useState("");
  const [position, setPosition] = useState<Position | null>(null);
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);
  const [bookingProduct, setBookingProduct] = useState<Product | null>(null);
  const [tab, setTab] = useState<
    "discover" | "publish" | "messages" | "profile"
  >("discover");
  const [toast, setToast] = useState("");
  const [person, setPerson] = useState<Person | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [draftDirty, setDraftDirty] = useState(false);
  const [showBooking, setShowBooking] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportTarget, setReportTarget] = useState("");
  const requestSeq = useRef(0);
  const pageOffset = useRef(0);
  const favoriteFilterKey = favoriteOnly ? favorites.join(",") : "";
  const confirm = useConfirmation();
  const currentPerson = useRef(person);
  currentPerson.current = person;
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    let active = true,
      accountRevision = 0;
    const account = () => {
      const revision = ++accountRevision;
      setPerson(null);
      setPosition(null);
      setNearbyOwner("");
      setSelected(null);
      setShowBooking(false);
      setShowReport(false);
      setEditingProduct(null);
      setDraftDirty(false);
      void ensureSession(true)
        .then((person) => {
          if (active && revision === accountRevision) setPerson(person);
        })
        .catch(() => {
          if (active && revision === accountRevision)
            notify("账号加载失败，请刷新重试");
        });
    };
    account();
    watchSessionChanges();
    const revalidate = () => {
      if (document.visibilityState !== "visible") return;
      void ensureSession(true)
        .then((next) => {
          const previous = currentPerson.current;
          if (
            active &&
            previous &&
            (next.id !== previous.id || next.verified !== previous.verified)
          )
            resetSession();
        })
        .catch(() => {});
    };
    window.addEventListener("focus", revalidate);
    document.addEventListener("visibilitychange", revalidate);
    window.addEventListener("uuse-account", account);
    const draft = (event: Event) =>
      setDraftDirty(!!(event as CustomEvent).detail?.dirty);
    window.addEventListener("uuse-draft-state", draft);
    try {
      const savedCampus = localStorage.getItem("uuse-campus");
      if (savedCampus === "SIP" || savedCampus === "TAICANG")
        setCampus(savedCampus);
    } catch {}
    return () => {
      active = false;
      clearTimeout(toastTimer.current);
      window.removeEventListener("uuse-account", account);
      window.removeEventListener("focus", revalidate);
      document.removeEventListener("visibilitychange", revalidate);
      window.removeEventListener("uuse-draft-state", draft);
    };
  }, []);
  useEffect(() => {
    setFavorites([]);
    if (!person) return;
    try {
      const saved = JSON.parse(
        localStorage.getItem("uuse-favorites:" + person.id) || "[]",
      );
      if (Array.isArray(saved))
        setFavorites(
          [
            ...new Set<string>(
              saved.filter((id) => typeof id === "string" && id.length <= 100),
            ),
          ].slice(0, 200),
        );
    } catch {}
  }, [person?.id]);
  async function changeTab(next: typeof tab) {
    if (
      tab === "profile" &&
      next !== "profile" &&
      draftDirty &&
      !(await confirm("课表尚未启用。草稿已保留在本机，仍要离开？"))
    )
      return;
    setTab(next);
    if (next !== "profile") setDraftDirty(false);
  }

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
      if (document.querySelector("dialog[open]")) return;
      if (event.key === "Escape") {
        setSelected(null);
        setShowBooking(false);
        setShowReport(false);
      }
      if (event.key === "Tab" && modal) {
        const nodes = Array.from(
          modal.querySelectorAll<HTMLElement>(
            "button:not(:disabled), input:not(:disabled):not([type=hidden]), select:not(:disabled), textarea:not(:disabled), a[href]",
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
    if (!favorites.includes(id) && favorites.length >= 200) {
      notify("最多收藏 200 件物品，请先移除旧收藏");
      return;
    }
    const next = favorites.includes(id)
      ? favorites.filter((item) => item !== id)
      : [...favorites, id];
    setFavorites(next);
    try {
      localStorage.setItem(
        "uuse-favorites:" + (person?.id || "guest"),
        JSON.stringify(next),
      );
    } catch {
      notify("当前浏览器无法保存收藏");
    }
  }

  async function loadProducts(append = false) {
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
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    if (favoriteOnly) {
      params.delete("campus");
      params.set("ids", favorites.join(",") || "none");
    }
    params.set("limit", "50");
    const offset = append ? pageOffset.current : 0;
    params.set("offset", String(offset));
    if (nearbyOwner) params.set("owner", nearbyOwner);
    try {
      const response = await clientFetch(`/api/products?${params}`);
      if (!response.ok) throw new Error("Failed to load products");
      const nextProducts = await response.json();
      if (requestSeq.current === requestId) {
        pageOffset.current = offset + nextProducts.length;
        setProducts((previous) =>
          append
            ? [...previous, ...nextProducts].filter(
                (p, n, all) => all.findIndex((x) => x.id === p.id) === n,
              )
            : nextProducts,
        );
        setHasMore(response.headers.get("X-Has-More") === "true");
      }
    } catch {
      if (requestSeq.current === requestId) {
        if (!append) setProducts([]);
        setLoadError(true);
        notify("加载失败，请稍后重试");
      }
    } finally {
      if (requestSeq.current === requestId) setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    setProducts([]);
    const timer = setTimeout(() => {
      loadProducts();
    }, 250);
    return () => {
      clearTimeout(timer);
      requestSeq.current += 1;
    };
  }, [
    campus,
    scope,
    category,
    accessMode,
    sort,
    search,
    favoriteOnly,
    favoriteFilterKey,
    nearbyOwner,
    fromDate,
    toDate,
  ]);

  function notify(message: string) {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3000);
  }

  function switchCampus() {
    const next = campus === "SIP" ? "TAICANG" : "SIP";
    setCampus(next);
    setNearbyOwner("");
    setMapOpen(false);
    setPosition(null);
    try {
      localStorage.setItem("uuse-campus", next);
    } catch {}
    setScope("local");
    notify(`已切换到${next === "SIP" ? "SIP" : "XEC"}校区`);
  }

  return (
    <main
      className={"app-shell" + (tab === "discover" ? " discovery-shell" : "")}
    >
      <header className="topbar">
        <div className="brand-mark">U</div>
        <div className="brand-copy">
          <strong>U Use</strong>
          <span>西浦物品使用</span>
        </div>
        <span className="verified">
          <ShieldCheck size={14} />{" "}
          {person?.verified
            ? person.verificationMode === "local"
              ? "本地开发"
              : "学生已登录"
            : "访客浏览"}
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
        {tab === "discover" && (
          <button className="campus-button" onClick={switchCampus}>
            <span>浏览校区</span>
            <b>{campus === "SIP" ? "SIP" : "XEC"}</b>
          </button>
        )}
      </section>

      {tab === "discover" && (
        <>
          <div
            className="scope-tabs discover-tabs"
            role="tablist"
            aria-label="发现内容"
          >
            <button
              type="button"
              role="tab"
              aria-selected={discoverView === "products"}
              className={discoverView === "products" ? "active" : ""}
              onClick={() => setDiscoverView("products")}
            >
              物品
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={discoverView === "needs"}
              className={discoverView === "needs" ? "active" : ""}
              onClick={() => {
                setMyNeeds(false);
                setDiscoverView("needs");
              }}
            >
              求物板
            </button>
          </div>
          {discoverView === "needs" ? (
            <NeedsPanel
              key={(person?.id || "guest") + String(myNeeds)}
              campus={campus}
              person={person}
              mineInitially={myNeeds}
              onLogin={() => {
                changeTab("profile");
                notify("请先用西浦邮箱登录");
              }}
              onProduct={setSelected}
              onReport={(id) => {
                if (!person?.verified) {
                  changeTab("profile");
                  notify("登录后可提交举报");
                  return;
                }
                setReportTarget(id);
                setShowReport(true);
              }}
            />
          ) : (
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
              <div className="date-filter" aria-label="使用日期筛选">
                <CalendarDays size={17} />
                <label>
                  开始日期
                  <input
                    type="date"
                    aria-label="筛选开始日期"
                    min={new Date(Date.now() + 8 * 3600000)
                      .toISOString()
                      .slice(0, 10)}
                    value={fromDate}
                    onChange={(e) => {
                      setFromDate(e.target.value);
                      if (toDate && e.target.value > toDate)
                        setToDate(e.target.value);
                    }}
                  />
                </label>
                <label>
                  结束日期
                  <input
                    type="date"
                    aria-label="筛选结束日期"
                    min={
                      fromDate ||
                      new Date(Date.now() + 8 * 3600000)
                        .toISOString()
                        .slice(0, 10)
                    }
                    value={toDate}
                    onChange={(e) => {
                      setToDate(e.target.value);
                      if (
                        fromDate &&
                        e.target.value &&
                        e.target.value < fromDate
                      )
                        setFromDate(e.target.value);
                    }}
                  />
                </label>
                {(fromDate || toDate) && (
                  <button
                    type="button"
                    className="secondary"
                    title="清除使用日期"
                    aria-label="清除使用日期"
                    onClick={() => {
                      setFromDate("");
                      setToDate("");
                    }}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              <section className="map-disclosure">
                <button
                  type="button"
                  className="map-toggle"
                  aria-expanded={mapOpen}
                  aria-controls="discovery-map"
                  onClick={() => {
                    setMapOpen(!mapOpen);
                    if (mapOpen) {
                      setNearbyOwner("");
                      setPosition(null);
                    }
                  }}
                >
                  <Map size={17} />
                  <span>校区地图</span>
                  <small>可选</small>
                  {mapOpen ? (
                    <ChevronUp size={17} />
                  ) : (
                    <ChevronDown size={17} />
                  )}
                </button>
                {mapOpen && (
                  <div id="discovery-map">
                    <p className="privacy-note">
                      定位默认关闭，浏览与预约无需定位。地图展开后由
                      OpenStreetMap 加载底图；定位时的瓦片请求可能反映所在区域。
                    </p>
                    <CampusMap
                      key={person?.id || "pending"}
                      accountId={person?.id || ""}
                      campus={campus}
                      products={products}
                      onProduct={setSelected}
                      onOwner={(id) => {
                        setNearbyOwner(id);
                        setCategory("全部");
                        setAccessMode("all");
                        setSearch("");
                        setFavoriteOnly(false);
                        setScope("local");
                      }}
                      onPosition={setPosition}
                    />
                  </div>
                )}
              </section>
              <details className="market-filters">
                <summary>
                  <SlidersHorizontal size={16} />
                  筛选
                  <span>
                    {scope === "cross" ? "跨校区" : "本校区"}
                    {accessMode !== "all" ? " · " + modeLabel(accessMode) : ""}
                    {sort === "new"
                      ? " · 最新"
                      : sort === "low"
                        ? " · 费用升序"
                        : sort === "high"
                          ? " · 费用降序"
                          : ""}
                  </span>
                </summary>
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
                <div className="task-strip">
                  <div>
                    <strong>使用方式</strong>
                  </div>
                  <div className="task-chips">
                    {accessModes.slice(1).map((item) => (
                      <button
                        key={item.value}
                        className={
                          accessMode === item.value
                            ? "task-chip active"
                            : "task-chip"
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
              </details>
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
              <section className="product-list" aria-live="polite">
                {nearbyOwner && (
                  <div className="owner-filter">
                    <strong>附近用户的物品</strong>
                    <button
                      type="button"
                      className="secondary"
                      title="退出用户筛选"
                      aria-label="退出用户筛选"
                      onClick={() => setNearbyOwner("")}
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
                <button
                  className={favoriteOnly ? "tool active" : "tool"}
                  aria-pressed={favoriteOnly}
                  onClick={() => setFavoriteOnly(!favoriteOnly)}
                >
                  <Heart size={15} />
                  {favoriteOnly ? "已收藏" : "只看收藏"} ({favorites.length})
                </button>
                {loading && !products.length ? (
                  <div className="empty-state">正在加载可用物品...</div>
                ) : (
                  products
                    .filter(
                      (item) => !favoriteOnly || favorites.includes(item.id),
                    )
                    .sort((a, b) =>
                      sort === "near" && position
                        ? (a.handoffCoordinates
                            ? distanceKm(position, a.handoffCoordinates)
                            : Infinity) -
                          (b.handoffCoordinates
                            ? distanceKm(position, b.handoffCoordinates)
                            : Infinity)
                        : 0,
                    )
                    .map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        currentCampus={campus}
                        position={position}
                        onClick={() => setSelected(product)}
                      />
                    ))
                )}
                {!loading && loadError && (
                  <div className="empty-state" role="alert">
                    加载失败{" "}
                    <button
                      className="secondary"
                      onClick={() => void loadProducts(products.length > 0)}
                    >
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
                          setNearbyOwner("");
                          setFromDate("");
                          setToDate("");
                        }}
                      >
                        清除筛选
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => {
                          setMyNeeds(false);
                          setDiscoverView("needs");
                        }}
                      >
                        去求物板
                      </button>
                    </div>
                  )}
                {loading && products.length > 0 && (
                  <p role="status">正在加载物品...</p>
                )}
                {hasMore && !loadError && (
                  <button
                    type="button"
                    className="secondary full"
                    disabled={loading}
                    onClick={() => void loadProducts(true)}
                  >
                    加载更多物品
                  </button>
                )}
              </section>
            </>
          )}
        </>
      )}

      {tab === "publish" && (
        <PublishPanel
          key={(person?.id || "pending") + ":" + (editingProduct?.id || "new")}
          product={editingProduct}
          campus={campus}
          onDone={(message) => {
            setEditingProduct(null);
            changeTab("profile");
            notify(message);
            loadProducts();
          }}
        />
      )}
      {tab === "messages" && person && (
        <BookingsPanel key={person.id} accountId={person.id} />
      )}
      {tab === "profile" && (
        <section className="panel">
          <h2>我的</h2>
          <AccountPanel
            key={"account:" + (person?.id || "pending")}
            person={person}
            onNotice={notify}
          />
          {person && <TimetablePanel key={"timetable:" + person.id} />}
          {person?.verified && (
            <>
              <MyProducts
                accountId={person.id}
                key={"products:" + person.id}
                onEdit={(product) => {
                  setEditingProduct(product);
                  changeTab("publish");
                }}
              />
              <NotificationsPanel
                accountId={person.id}
                key={"notifications:" + person.id}
                onBookings={() => changeTab("messages")}
                onNeeds={() => {
                  setMyNeeds(true);
                  setDiscoverView("needs");
                  changeTab("discover");
                }}
              />
            </>
          )}
          <div className="menu-list">
            <button
              onClick={() => {
                setEditingProduct(null);
                changeTab("publish");
              }}
            >
              开放新的物品 <Plus size={16} />
            </button>
            <button onClick={() => changeTab("messages")}>
              我的借还 <MessageCircle size={16} />
            </button>
            <button
              onClick={() => {
                changeTab("discover");
                setFavoriteOnly(true);
                setSearch("");
                setCategory("全部");
                setAccessMode("all");
                setNearbyOwner("");
                setFromDate("");
                setToDate("");
                setDiscoverView("products");
              }}
            >
              我的收藏 <span>{favorites.length} 件</span>
            </button>
            {person?.verified && (
              <button
                onClick={() => {
                  setMyNeeds(true);
                  setDiscoverView("needs");
                  changeTab("discover");
                }}
              >
                我的求物 <Search size={16} />
              </button>
            )}
            <a className="secondary full" href="/admin">
              运营管理
            </a>
          </div>
        </section>
      )}

      <nav className="bottom-nav">
        <button
          className={tab === "discover" ? "active" : ""}
          onClick={() => changeTab("discover")}
        >
          <Compass size={19} />
          发现
        </button>
        <button
          className={tab === "publish" ? "active" : ""}
          onClick={() => {
            setEditingProduct(null);
            changeTab("publish");
          }}
        >
          <Plus size={19} />
          开放
        </button>
        <button
          className={tab === "messages" ? "active" : ""}
          onClick={() => changeTab("messages")}
        >
          <MessageCircle size={19} />
          借还
        </button>
        <button
          className={tab === "profile" ? "active" : ""}
          onClick={() => changeTab("profile")}
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
            if (!person?.verified) {
              setSelected(null);
              changeTab("profile");
              notify("请先用西浦邮箱登录");
              return;
            }
            setBookingProduct(selected);
            setSelected(null);
            setShowBooking(true);
          }}
          onReport={() => {
            if (!person?.verified) {
              setSelected(null);
              changeTab("profile");
              notify("登录后可提交举报");
              return;
            }
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
          accountId={person?.id || ""}
          product={bookingProduct}
          campus={campus}
          currentPosition={position}
          onTimetable={() => {
            setShowBooking(false);
            setBookingProduct(null);
            changeTab("profile");
          }}
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
          accountId={person?.id || ""}
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
  position,
  onClick,
}: {
  product: Product;
  currentCampus: Campus;
  position: Position | null;
  onClick: () => void;
}) {
  const cross = product.campus !== currentCampus;
  return (
    <button
      className="product-card"
      onClick={onClick}
      aria-label={`查看${product.title}详情`}
    >
      <div className={`product-visual ${product.tone}`}>
        {product.photos?.[0] ? (
          <img src={product.photos[0]} alt={product.title} />
        ) : (
          product.emoji || "实物"
        )}
      </div>
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
          {product.isDemo && "示例物品 · "}
          {position && product.handoffCoordinates
            ? "距交付点约 " +
              distanceKm(position, product.handoffCoordinates).toFixed(1) +
              " km · "
            : ""}
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
        <div className={`detail-visual ${product.tone}`}>
          {product.photos?.[0] ? (
            <img src={product.photos[0]} alt={product.title} />
          ) : (
            product.emoji || "实物"
          )}
        </div>
        {!!product.photos?.length && product.photos.length > 1 && (
          <div className="detail-photos">
            {product.photos.slice(1).map((url, i) => (
              <img
                src={url}
                alt={product.title + " · 照片 " + (i + 2)}
                key={url}
              />
            ))}
          </div>
        )}
        <h2>{product.title}</h2>
        <strong className="detail-price">{priceLabel(product)}</strong>
        {product.isDemo && (
          <p className="development-note">示例物品，不代表真实可交易库存。</p>
        )}
        {product.swapRule && <p>希望换取：{product.swapRule}</p>}
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
            {product.campus === "SIP" ? "SIP 校区" : "XEC 校区"} ·{" "}
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
          <button
            className="primary"
            onClick={onBook}
            disabled={!product.ownerId || product.isDemo}
          >
            <MessageCircle size={15} />
            {product.isDemo ? "示例物品" : "预约使用"}
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
  accountId,
  product,
  campus,
  currentPosition,
  onClose,
  onDone,
  onTimetable,
}: {
  accountId: string;
  product: Product | null;
  campus: Campus;
  currentPosition: Position | null;
  onClose: () => void;
  onDone: (message: string) => void;
  onTimetable: () => void;
}) {
  const submission = useRef<Submission>(),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [handoffCampus, setHandoffCampus] = useState(product?.campus ?? campus);
  const [locationId, setLocationId] = useState(product?.locationId || "");
  const [spot, setSpot] = useState(product?.spot || "");
  const [time, setTime] = useState("");
  const [returnTime, setReturnTime] = useState("");
  const [currentCampus, setCurrentCampus] = useState<Campus | "">(() =>
    currentPosition &&
    distanceKm(currentPosition, { lat: 31.27558, lng: 120.73584 }) < 10
      ? "SIP"
      : currentPosition &&
          distanceKm(currentPosition, { lat: 31.48303, lng: 121.15569 }) < 10
        ? "TAICANG"
        : "",
  );
  const [duration, setDuration] = useState(24);
  const [swapItems, setSwapItems] = useState<Product[]>([]);
  const [offeredProductId, setOfferedProductId] = useState("");
  const [acceptedFees, setAcceptedFees] = useState(false);
  useEffect(() => {
    if (product?.accessMode !== "swap") return;
    let active = true;
    clientFetch("/api/products?mine=1", { cache: "no-store", accountId })
      .then((r) => r.json())
      .then((data) => {
        if (active && Array.isArray(data))
          setSwapItems(
            data.filter((p) => p.status === "可用" && p.accessMode === "swap"),
          );
      })
      .catch(() => {
        if (active) setError("无法加载你的交换物品");
      });
    return () => {
      active = false;
    };
  }, [product?.accessMode]);
  const rentalDays =
    time && returnTime
      ? Math.max(
          1,
          Math.ceil(
            (Date.parse(returnTime + ":00+08:00") -
              Date.parse(time + ":00+08:00")) /
              86400000,
          ),
        )
      : 0;
  const fee =
    product?.accessMode === "buy"
      ? product.price
      : product?.accessMode === "rent" && rentalDays > 0
        ? Math.round(rentalDays * (product.rentPrice || 0) * 100) / 100
        : 0;
  useEffect(
    () => setAcceptedFees(false),
    [time, returnTime, offeredProductId, fee],
  );
  const [suggestions, setSuggestions] = useState<Recommendation[]>([]);
  const [recommendationMessage, setRecommendationMessage] =
    useState("正在匹配课表...");
  useEffect(() => {
    let active = true;
    const abort = new AbortController();
    setSuggestions([]);
    setRecommendationMessage("正在匹配课表与交易安排…");
    ensureSession()
      .then(() =>
        clientFetch(
          "/api/recommendations?" +
            new URLSearchParams({
              productId: product?.id || "",
              campus: handoffCampus,
              ...(currentCampus ? { currentCampus } : {}),
              returnAfterHours: String(duration),
            }),
          { cache: "no-store", signal: abort.signal, accountId },
        ),
      )
      .then(async (response) => {
        const data = await response.json();
        if (!active) return;
        setSuggestions(data.items || []);
        setRecommendationMessage(
          !response.ok
            ? data.error || "匹配失败，请重试"
            : data.items.length
              ? data.mutual
                ? "双方课表空档 · 仍需对方确认预约"
                : "你的课表空档 · 对方未提供课表，待对方确认"
              : "未来 14 天未找到可核实安排，请检查课表覆盖日期或手动填写",
        );
      })
      .catch(() => {
        if (active) setRecommendationMessage("推荐暂不可用，可手动填写");
      });
    return () => {
      active = false;
      abort.abort();
    };
  }, [product?.id, handoffCampus, currentCampus, duration]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (!acceptedFees) {
      setError("请先确认费用及线下交付安排");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const input = {
        productId: product?.id ?? "manual-booking",
        campus: data.get("campus"),
        spot: data.get("spot"),
        locationId,
        time: `${data.get("time")}:00+08:00`,
        returnTime: product?.returnRequired
          ? `${data.get("returnTime")}:00+08:00`
          : `${data.get("time")}:00+08:00`,
        note: data.get("note"),
        offeredProductId,
        expectedFee: fee,
        expectedDeposit: product?.deposit,
        expectedMode: product?.accessMode,
      };
      submission.current = submissionFor(
        JSON.stringify(input),
        submission.current,
      );
      const response = await clientFetch("/api/bookings", {
        method: "POST",
        accountId,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...input,
          requestId: submission.current.requestId,
        }),
      });
      const result = await response.json();
      if (!alive.current) return;
      if (!response.ok) {
        setError(result.error || "预约失败，请重试");
        return;
      }
      onDone(
        result.status === "待确认"
          ? "预约已发送，等待对方确认"
          : "已找到之前的预约，请到「借还」查看当前状态",
      );
    } catch {
      if (alive.current)
        setError(
          "提交结果暂不确定，请先到「借还」查看预约记录，再决定是否重试",
        );
    } finally {
      if (alive.current) setBusy(false);
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
          <section className="recommendation-section">
            <strong>推荐交付安排</strong>
            <div className="form-columns">
              <label>
                当前所在校区
                <select
                  value={currentCampus}
                  onChange={(e) =>
                    setCurrentCampus(e.target.value as Campus | "")
                  }
                >
                  <option value="">校区外 / 尚未确认</option>
                  <option value="SIP">SIP 校区</option>
                  <option value="TAICANG">XEC 校区</option>
                </select>
              </label>
              {product?.returnRequired && (
                <label>
                  预计使用时长（小时）
                  <input
                    type="number"
                    value={duration}
                    min={0.5}
                    max={720}
                    step={0.5}
                    onChange={(e) =>
                      setDuration(
                        Math.min(720, Math.max(0.5, Number(e.target.value))),
                      )
                    }
                  />
                </label>
              )}
            </div>
            <p className="muted">{recommendationMessage}</p>
            {suggestions.map((s) => (
              <button
                key={s.time + s.locationId}
                type="button"
                className={
                  time === s.time.slice(0, 16)
                    ? "recommendation active"
                    : "recommendation"
                }
                onClick={() => {
                  setTime(s.time.slice(0, 16));
                  setHandoffCampus(s.campus);
                  setLocationId(s.locationId);
                  setSpot(s.spot);
                  if (s.returnTime) setReturnTime(s.returnTime.slice(0, 16));
                }}
              >
                <b>
                  {new Date(s.time).toLocaleString("zh-CN", {
                    timeZone: "Asia/Shanghai",
                    weekday: "short",
                    month: "numeric",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })}
                </b>
                <span>{s.spot}</span>
                <small>{s.reason}</small>
                {s.returnTime && (
                  <small>
                    归还：{s.returnTime.slice(0, 16).replace("T", " ")}
                  </small>
                )}
              </button>
            ))}
            <button className="secondary" type="button" onClick={onTimetable}>
              管理课表
            </button>
          </section>
          <label>
            交付校区
            <select
              name="campus"
              value={handoffCampus}
              onChange={(e) => {
                setHandoffCampus(e.target.value as Campus);
                setLocationId("");
                setSpot("");
                setTime("");
                setReturnTime("");
              }}
            >
              <option value={product?.campus ?? campus}>
                {(product?.campus ?? campus) === "SIP"
                  ? "SIP 校区"
                  : "XEC 校区"}
              </option>
              {product?.crossCampus && (
                <option value={product.campus === "SIP" ? "TAICANG" : "SIP"}>
                  {product.campus === "SIP" ? "XEC 校区" : "SIP 校区"}
                </option>
              )}
            </select>
          </label>
          <PlaceField
            campus={handoffCampus}
            locationId={locationId}
            spot={spot}
            onChange={(id, label) => {
              setLocationId(id);
              setSpot(label);
            }}
          />
          <label>
            {product?.returnRequired ? "借出时间" : "交付时间"}
            <input
              required
              name="time"
              type="datetime-local"
              value={time}
              onChange={(e) => setTime(e.target.value)}
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
                value={returnTime}
                onChange={(e) => setReturnTime(e.target.value)}
                min={`${product?.availableFrom}T00:00`}
                max={`${product?.availableTo}T23:59`}
              />
            </label>
          )}
          {product?.accessMode === "swap" && (
            <label>
              用于交换的物品
              <select
                required
                value={offeredProductId}
                onChange={(e) => setOfferedProductId(e.target.value)}
              >
                <option value="">选择自己的已审核交换物品</option>
                {swapItems.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
              {!swapItems.length && (
                <span className="muted">
                  尚无可交换物品，请先发布并通过审核。
                </span>
              )}
            </label>
          )}
          <div className="booking-quote">
            <strong>使用费用 ¥{Number.isFinite(fee) ? fee : 0}</strong>
            {product?.accessMode === "rent" && (
              <span>
                {rentalDays || 0} 天 × ¥{product.rentPrice}/天；每 24 小时计一天
              </span>
            )}
            <span>另付押金 ¥{product?.deposit || 0}</span>
          </div>
          <label className="check-label">
            <input
              type="checkbox"
              required
              checked={acceptedFees}
              onChange={(e) => setAcceptedFees(e.target.checked)}
            />{" "}
            已确认费用、交付及归还安排；款项由双方线下结算
          </label>
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
  accountId,
  target,
  onClose,
  onDone,
}: {
  accountId: string;
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
      const response = await clientFetch("/api/reports", {
        method: "POST",
        accountId,
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
