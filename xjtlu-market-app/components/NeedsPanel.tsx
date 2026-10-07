"use client";
import { clientFetch } from "../lib/client-fetch";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Check, Flag, Plus, RefreshCw, Send, X } from "lucide-react";
import type { NeedView } from "../lib/needs";
import { Campus, Person, Product } from "../lib/types";
import { campuses } from "../lib/campuses";
import { useConfirmation } from "./ConfirmationProvider";
import {
  restoreFields,
  restoreSubmission,
  submissionFor,
  Submission,
} from "../lib/client-drafts";

const today = () =>
  new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
const mode = { borrow: "借用", rent: "短租", buy: "买断" };
const status = {
  open: "寻找中",
  resolved: "已解决",
  withdrawn: "已撤回",
  expired: "已过期",
};
export default function NeedsPanel({
  campus,
  person,
  onLogin,
  onProduct,
  onReport,
  mineInitially = false,
}: {
  campus: Campus;
  person: Person | null;
  onLogin: () => void;
  onProduct: (p: Product) => void;
  onReport: (id: string) => void;
  mineInitially?: boolean;
}) {
  const confirm = useConfirmation();
  const [items, setItems] = useState<NeedView[]>([]),
    [mine, setMine] = useState(mineInitially),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [hasMore, setHasMore] = useState(false),
    [writing, setWriting] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [offerFor, setOfferFor] = useState<string | null>(null),
    [products, setProducts] = useState<Product[]>([]),
    [productId, setProductId] = useState("");
  const [title, setTitle] = useState(""),
    [note, setNote] = useState(""),
    [accessMode, setAccessMode] = useState<"borrow" | "rent" | "buy">("borrow"),
    [from, setFrom] = useState(today()),
    [to, setTo] = useState(today()),
    [budget, setBudget] = useState("");
  const seq = useRef(0),
    offset = useRef(0),
    lifecycle = useRef(0),
    submission = useRef<Submission>();
  const draftKey = person?.verified
    ? `uuse-need-draft:${person.id}:${campus}`
    : "";
  const [restoredKey, setRestoredKey] = useState(""),
    [draftWarning, setDraftWarning] = useState("");
  useEffect(() => {
    const defaults = {
      title: "",
      note: "",
      accessMode: "borrow" as typeof accessMode,
      from: today(),
      to: today(),
      budget: "",
    };
    let next = defaults;
    submission.current = undefined;
    setDraftWarning("");
    try {
      const raw = draftKey && localStorage.getItem(draftKey);
      if (raw) {
        next = restoreFields(raw, defaults, {
          accessMode: (v) => ["borrow", "rent", "buy"].includes(String(v)),
        });
        submission.current = restoreSubmission(raw);
      }
    } catch {
      setDraftWarning("无法恢复本机求物草稿，请重新填写");
    }
    setTitle(next.title);
    setNote(next.note);
    setAccessMode(next.accessMode);
    setFrom(next.from);
    setTo(next.to);
    setBudget(next.budget);
    setRestoredKey(draftKey);
  }, [draftKey]);
  useEffect(() => {
    if (!draftKey || restoredKey !== draftKey) return;
    try {
      if (title || note || budget)
        localStorage.setItem(
          draftKey,
          JSON.stringify({
            title,
            note,
            accessMode,
            from,
            to,
            budget,
            submission: submission.current,
          }),
        );
      else localStorage.removeItem(draftKey);
    } catch {
      setDraftWarning("浏览器无法保留求物草稿，请及时提交");
    }
  }, [draftKey, restoredKey, title, note, accessMode, from, to, budget]);
  const load = useCallback(
    async (append = false) => {
      const revision = ++seq.current;
      setLoading(true);
      setError("");
      try {
        const q = new URLSearchParams({
          campus,
          mine: mine ? "1" : "0",
          offset: String(append ? offset.current : 0),
        });
        const r = await clientFetch("/api/needs?" + q, {
            cache: "no-store",
            accountId: person?.id,
          }),
          data = await r.json();
        if (!r.ok) throw new Error(data.error);
        if (revision !== seq.current) return;
        setItems((current) =>
          append
            ? [...current, ...data.items].filter(
                (n, i, all) => all.findIndex((x) => x.id === n.id) === i,
              )
            : data.items,
        );
        offset.current = (append ? offset.current : 0) + data.items.length;
        setHasMore(data.hasMore);
      } catch (e) {
        if (revision === seq.current)
          setError(e instanceof Error ? e.message : "求物加载失败");
      } finally {
        if (revision === seq.current) setLoading(false);
      }
    },
    [campus, mine, person?.id],
  );
  useEffect(() => {
    setItems([]);
    setBusy(false);
    setOfferFor(null);
    setWriting(false);
    void load();
    return () => {
      seq.current++;
      lifecycle.current++;
    };
  }, [load]);
  async function action(id: string, action: string, productId?: string) {
    if (!person?.verified) {
      onLogin();
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    const current = lifecycle.current;
    try {
      const r = await clientFetch("/api/needs", {
        method: "PATCH",
        accountId: person.id,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, productId }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      if (current !== lifecycle.current) return;
      setMessage(
        action === "offer"
          ? "已推荐，等待求物者查看并发起预约"
          : "求物状态已更新",
      );
      setOfferFor(null);
      await load();
    } catch (e) {
      if (current === lifecycle.current)
        setError(e instanceof Error ? e.message : "操作失败");
    } finally {
      if (current === lifecycle.current) setBusy(false);
    }
  }
  async function publish(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!person?.verified) {
      onLogin();
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    const current = lifecycle.current;
    try {
      const input = {
        campus,
        title,
        note,
        accessMode,
        from,
        to,
        budget:
          accessMode !== "borrow" && budget !== "" ? Number(budget) : undefined,
      };
      submission.current = submissionFor(
        JSON.stringify(input),
        submission.current,
      );
      try {
        localStorage.setItem(
          draftKey,
          JSON.stringify({
            title,
            note,
            accessMode,
            from,
            to,
            budget,
            submission: submission.current,
          }),
        );
      } catch {}
      const r = await clientFetch("/api/needs", {
        method: "POST",
        accountId: person.id,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...input,
          requestId: submission.current.requestId,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      if (current !== lifecycle.current) return;
      submission.current = undefined;
      try {
        localStorage.removeItem(draftKey);
      } catch {
        setDraftWarning("求物已发布，但浏览器阻止清除旧草稿；请勿重复发布");
      }
      setWriting(false);
      setTitle("");
      setNote("");
      setBudget("");
      setMessage("求物已发布");
      await load();
    } catch (e) {
      if (current === lifecycle.current)
        setError(e instanceof Error ? e.message : "发布失败");
    } finally {
      if (current === lifecycle.current) setBusy(false);
    }
  }
  async function prepareOffer(n: NeedView) {
    if (!person?.verified) {
      onLogin();
      return;
    }
    setBusy(true);
    setError("");
    const current = lifecycle.current;
    try {
      const r = await clientFetch(
          "/api/products?mine=1&needId=" + encodeURIComponent(n.id),
          { cache: "no-store", accountId: person.id },
        ),
        data = await r.json();
      if (!r.ok) throw new Error(data.error);
      if (current !== lifecycle.current) return;
      const eligible = data as Product[];
      setProducts(eligible);
      setProductId(eligible[0]?.id || "");
      setOfferFor(n.id);
    } catch (e) {
      if (current === lifecycle.current)
        setError(e instanceof Error ? e.message : "物品加载失败");
    } finally {
      if (current === lifecycle.current) setBusy(false);
    }
  }
  async function openProduct(id: string) {
    setBusy(true);
    setError("");
    const current = lifecycle.current;
    try {
      const r = await clientFetch(
          "/api/products?ids=" + encodeURIComponent(id),
        ),
        data = await r.json();
      if (!r.ok || !data[0]) throw new Error("物品已不可用，请刷新求物");
      if (current === lifecycle.current) onProduct(data[0]);
    } catch (e) {
      if (current === lifecycle.current)
        setError(e instanceof Error ? e.message : "物品加载失败");
    } finally {
      if (current === lifecycle.current) setBusy(false);
    }
  }
  return (
    <section className="needs-section" aria-label="求物板">
      {draftWarning && (
        <p role="alert" className="form-error">
          {draftWarning}
        </p>
      )}
      <div className="split needs-toolbar">
        <label className="check-label">
          <input
            type="checkbox"
            checked={mine}
            disabled={!person?.verified || busy}
            onChange={(e) => setMine(e.target.checked)}
          />
          只看我的求物
        </label>
        <div className="form-actions">
          <button
            type="button"
            title="刷新求物"
            aria-label="刷新求物"
            className="secondary"
            disabled={loading || busy}
            onClick={() => void load()}
          >
            <RefreshCw size={16} />
          </button>
          <button
            type="button"
            className="primary"
            disabled={busy}
            onClick={() => {
              if (!person?.verified) onLogin();
              else {
                setWriting(!writing);
                setMessage("");
                setError("");
              }
            }}
          >
            <Plus size={16} />
            发布求物
          </button>
        </div>
      </div>
      {writing && (
        <form className="form need-form" onSubmit={publish}>
          <fieldset disabled={busy}>
            <label>
              想找的物品
              <input
                required
                maxLength={100}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例如：周末借一只 24 寸行李箱"
              />
            </label>
            <div className="form-columns">
              <label>
                使用方式
                <select
                  value={accessMode}
                  onChange={(e) =>
                    setAccessMode(e.target.value as typeof accessMode)
                  }
                >
                  <option value="borrow">借用</option>
                  <option value="rent">短租</option>
                  <option value="buy">买断</option>
                </select>
              </label>
              {accessMode !== "borrow" && (
                <label>
                  {accessMode === "rent"
                    ? "最高日租金（元，可选）"
                    : "最高价格（元，可选）"}
                  <input
                    type="number"
                    min={0}
                    max={100000}
                    step="0.01"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                  />
                </label>
              )}
              <label>
                {accessMode === "buy" ? "交付开始日期" : "使用开始日期"}
                <input
                  type="date"
                  required
                  min={today()}
                  value={from}
                  onChange={(e) => {
                    setFrom(e.target.value);
                    if (e.target.value > to) setTo(e.target.value);
                  }}
                />
              </label>
              <label>
                {accessMode === "buy" ? "交付截止日期" : "使用结束日期"}
                <input
                  type="date"
                  required
                  min={from || today()}
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </label>
            </div>
            <label>
              规格与要求
              <textarea
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <p className="privacy-note">
              公开内容：物品、要求、校区、日期和昵称。请勿填写住址、课表或私人联系方式。
            </p>
            <div className="form-actions">
              <button type="submit" className="primary">
                <Send size={16} />
                {busy ? "发布中" : "发布求物"}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => setWriting(false)}
              >
                <X size={16} />
                收起
              </button>
            </div>
          </fieldset>
        </form>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
          <button
            type="button"
            className="secondary"
            onClick={() => void load()}
          >
            重试
          </button>
        </p>
      )}
      {message && (
        <p role="status" className="success">
          {message}
        </p>
      )}
      {loading && !items.length && <p role="status">正在加载求物…</p>}
      {!loading && !error && !items.length && (
        <div className="empty-state">暂无{mine ? "你的" : "有效"}求物</div>
      )}
      <div className="need-list">
        {items.map((n) => (
          <article className="need-item" key={n.id}>
            <div className="split">
              <h3>{n.title}</h3>
              <span className="status-tag">{status[n.status]}</span>
            </div>
            <p className="need-meta">
              {n.campus === "SIP" ? "SIP 校区" : campuses.TAICANG.label} ·{" "}
              {mode[n.accessMode]} · {n.ownerName}
            </p>
            <p>
              {n.from} 至 {n.to}
              {n.budget !== undefined && (
                <>
                  {" "}
                  · 预算 ¥{n.budget}
                  {n.accessMode === "rent" ? "/天" : ""}
                </>
              )}
            </p>
            {n.note && <p className="need-note">{n.note}</p>}
            {n.offers.map((o) => (
              <div className="need-offer" key={o.id}>
                <span>
                  {n.isMine ? "收到推荐" : "你已推荐"} · {o.title}
                </span>
                <button
                  className="secondary"
                  type="button"
                  disabled={busy || !o.available}
                  onClick={() => void openProduct(o.productId)}
                >
                  {o.available ? "查看物品" : "已不可用"}
                </button>
              </div>
            ))}
            {n.status === "open" && (
              <div className="form-actions">
                {n.isMine ? (
                  <>
                    <button
                      type="button"
                      className="secondary"
                      disabled={busy}
                      onClick={async () => {
                        if (await confirm("标记已解决并结束这条求物？"))
                          void action(n.id, "resolved");
                      }}
                    >
                      <Check size={16} />
                      已找到
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      disabled={busy}
                      onClick={async () => {
                        if (
                          await confirm(
                            "撤回这条求物？已收到的推荐仍保留在你的记录中。",
                          )
                        )
                          void action(n.id, "withdrawn");
                      }}
                    >
                      <X size={16} />
                      撤回
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="secondary"
                      disabled={busy}
                      onClick={() => void prepareOffer(n)}
                    >
                      <Send size={16} />
                      推荐我的物品
                    </button>
                    <button
                      type="button"
                      title="举报求物"
                      aria-label="举报求物"
                      className="secondary"
                      onClick={() => onReport("need:" + n.id)}
                    >
                      <Flag size={16} />
                    </button>
                  </>
                )}
              </div>
            )}
            {offerFor === n.id && (
              <div className="need-response">
                {products.length ? (
                  <>
                    <label>
                      推荐物品
                      <select
                        value={productId}
                        onChange={(e) => setProductId(e.target.value)}
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="primary"
                      disabled={busy || !productId}
                      onClick={() => void action(n.id, "offer", productId)}
                    >
                      <Send size={16} />
                      发送推荐
                    </button>
                  </>
                ) : (
                  <p>暂无符合日期、预算和使用方式的已审核物品。</p>
                )}
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={() => setOfferFor(null)}
                >
                  <X size={16} />
                  收起
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
      {hasMore && (
        <button
          type="button"
          className="secondary full"
          disabled={loading || busy}
          onClick={() => void load(true)}
        >
          加载更多求物
        </button>
      )}
    </section>
  );
}
