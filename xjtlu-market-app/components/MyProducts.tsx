"use client";
import { clientFetch } from "../lib/client-fetch";
import { useEffect, useState } from "react";
import { Edit3, Archive, RefreshCw } from "lucide-react";
import { Product } from "../lib/types";
import { useConfirmation } from "./ConfirmationProvider";
export default function MyProducts({
  onEdit,
  accountId,
}: {
  onEdit: (product: Product) => void;
  accountId: string;
}) {
  const confirm = useConfirmation();
  const [items, setItems] = useState<Product[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    try {
      const r = await clientFetch("/api/products?mine=1", {
          cache: "no-store",
          accountId,
        }),
        data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setItems(data);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function withdraw(p: Product) {
    if (!(await confirm("下架「" + p.title + "」？重新开放需要提交审核。")))
      return;
    setBusy(true);
    try {
      const r = await clientFetch("/api/products", {
          method: "PATCH",
          accountId: p.ownerId,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: p.id, action: "withdraw" }),
        }),
        data = await r.json();
      if (!r.ok) throw new Error(data.error);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "下架失败");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="my-products">
      <div className="split">
        <h2>我的发布 · {items.length}</h2>
        <button
          type="button"
          className="secondary"
          aria-label="刷新我的发布"
          title="刷新"
          onClick={() => void load()}
        >
          <RefreshCw size={16} />
        </button>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {!items.length && !error && <p className="muted">暂无发布</p>}
      {items.map((p) => (
        <article className="owned-product" key={p.id}>
          {p.photos?.[0] && <img src={p.photos[0]} alt={p.title} />}
          <div>
            <strong>{p.title}</strong>
            <p className="muted">{p.spot}</p>
            <span className="status-tag">{p.status}</span>
          </div>
          <div className="owned-actions">
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => onEdit(p)}
            >
              <Edit3 size={15} /> 修改
            </button>
            {p.status !== "已下架" && (
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => void withdraw(p)}
              >
                <Archive size={15} /> 下架
              </button>
            )}
          </div>
        </article>
      ))}
    </section>
  );
}
