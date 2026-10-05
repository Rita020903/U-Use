"use client";

import { FormEvent, useState } from "react";
import { AccessMode, Campus } from "../lib/types";

export default function PublishPanel({
  campus,
  onDone,
}: {
  campus: Campus;
  onDone: (message: string) => void;
}) {
  const [mode, setMode] = useState<AccessMode>("borrow");
  const [from, setFrom] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.get("title"),
          category: form.get("category"),
          condition: form.get("condition"),
          campus: form.get("campus"),
          spot: form.get("spot"),
          accessMode: mode,
          availableFrom: form.get("availableFrom"),
          availableTo: form.get("availableTo"),
          availabilityLabel: form.get("availabilityLabel"),
          price: Number(form.get("price") || 0),
          rentPrice: Number(form.get("rentPrice") || 0),
          deposit: Number(form.get("deposit") || 0),
          returnRule:
            form.get("returnRule") ||
            (mode === "buy" ? "买断交付后无需归还" : ""),
          crossCampus: form.get("crossCampus") === "on",
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "提交失败，请重试");
      onDone("已提交审核，通过后可在发现页预约");
    } catch (error) {
      setError(error instanceof Error ? error.message : "网络异常，请重试");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <h2>开放物品</h2>
      <form className="form" onSubmit={submit}>
        <label>
          物品名称
          <input
            required
            maxLength={100}
            name="title"
            placeholder="例如：Casio 计算器"
          />
        </label>
        <label>
          使用方式
          <select
            value={mode}
            onChange={(event) => setMode(event.target.value as AccessMode)}
          >
            <option value="borrow">借用</option>
            <option value="rent">短租</option>
            <option value="buy">买断</option>
            <option value="swap">交换</option>
          </select>
        </label>
        <label>
          分类
          <select name="category">
            {[
              "学习考试",
              "活动服装",
              "出行用品",
              "交通",
              "数码产品",
              "活动设备",
            ].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          成色与功能
          <textarea
            required
            maxLength={500}
            name="condition"
            placeholder="功能是否正常、配件和已有损伤"
          />
        </label>
        <div className="form-columns">
          <label>
            可用开始
            <input
              required
              name="availableFrom"
              type="date"
              min={today}
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </label>
          <label>
            可用结束
            <input
              required
              name="availableTo"
              type="date"
              min={from || today}
            />
          </label>
        </div>
        <label>
          可用说明
          <input
            required
            maxLength={100}
            name="availabilityLabel"
            placeholder="例如：可借 7 天"
          />
        </label>
        {mode === "buy" && (
          <label>
            买断价格（元）
            <input
              required
              name="price"
              type="number"
              min="0"
              max="100000"
              step=".01"
            />
          </label>
        )}
        {mode === "rent" && (
          <label>
            租金（元 / 天）
            <input
              required
              name="rentPrice"
              type="number"
              min=".01"
              max="100000"
              step=".01"
            />
          </label>
        )}
        {mode !== "buy" && (
          <label>
            押金（元）
            <input
              required
              name="deposit"
              type="number"
              min="0"
              max="100000"
              step=".01"
              defaultValue="0"
            />
          </label>
        )}
        <label>
          所在校区
          <select name="campus" defaultValue={campus}>
            <option value="SIP">SIP 校区</option>
            <option value="TAICANG">太仓校区</option>
          </select>
        </label>
        <label>
          公共交付地点
          <input
            required
            name="spot"
            maxLength={120}
            placeholder="楼宇名称与具体门口，例如：CB 中心楼正门"
          />
        </label>
        {mode !== "buy" && (
          <label>
            归还规则
            <textarea
              required
              maxLength={2000}
              name="returnRule"
              placeholder="归还时检查哪些配件和功能，延期如何协商"
            />
          </label>
        )}
        <label className="check-label">
          <input name="crossCampus" type="checkbox" />
          支持跨校区交付
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="primary full" disabled={busy}>
          {busy ? "提交中…" : "提交审核"}
        </button>
      </form>
    </section>
  );
}
