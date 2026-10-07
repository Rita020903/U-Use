"use client";
import { clientFetch } from "../lib/client-fetch";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Camera, X, Save, Upload } from "lucide-react";
import { AccessMode, Campus, Product } from "../lib/types";
import PlaceField from "./PlaceField";
import NearbyMap from "./NearbyMap";
import { ensureSession } from "../lib/client-session";
import {
  restoreFields,
  strings,
  coordinates,
  restoreSubmission,
  submissionFor,
  Submission,
} from "../lib/client-drafts";
type Draft = {
  title: string;
  category: string;
  condition: string;
  campus: Campus;
  spot: string;
  locationId: string;
  handoffCoordinates?: { lat: number; lng: number };
  accessMode: AccessMode;
  availableFrom: string;
  availableTo: string;
  availabilityLabel: string;
  price: number;
  rentPrice: number;
  deposit: number;
  returnRule: string;
  swapRule: string;
  crossCampus: boolean;
  photos: string[];
};
export default function PublishPanel({
  campus,
  onDone,
  product,
}: {
  campus: Campus;
  onDone: (message: string) => void;
  product?: Product | null;
}) {
  const [draft, setDraft] = useState<Draft>({
    title: product?.title || "",
    category: product?.category || "学习考试",
    condition: product?.condition || "",
    campus: product?.campus || campus,
    spot: product?.spot || "",
    locationId: product?.locationId || "",
    handoffCoordinates: product?.handoffCoordinates,
    accessMode: product?.accessMode || "borrow",
    availableFrom: product?.availableFrom || "",
    availableTo: product?.availableTo || "",
    availabilityLabel: product?.availabilityLabel || "",
    price: product?.price || 0,
    rentPrice: product?.rentPrice || 0,
    deposit: product?.deposit || 0,
    returnRule: product?.returnRule || "",
    swapRule: product?.swapRule || "",
    crossCampus: product?.crossCampus || false,
    photos: product?.photos || [],
  });
  const [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState(""),
    [ready, setReady] = useState(false),
    [saved, setSaved] = useState(false),
    [mapOpen, setMapOpen] = useState(false);
  const key = useRef(""),
    account = useRef(""),
    alive = useRef(true),
    submission = useRef<Submission>(),
    input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let active = true;
    alive.current = true;
    ensureSession()
      .then((p) => {
        if (!active) return;
        if (!p.verified) {
          setError("请先到「我的」用西浦邮箱登录");
          return;
        }
        key.current =
          "uuse-publish-draft:" + p.id + ":" + (product?.id || "new");
        account.current = p.id;
        try {
          const value = localStorage.getItem(key.current);
          if (value) {
            submission.current = restoreSubmission(value);
            setDraft(
              restoreFields(value, draft, {
                photos: (v) => strings(v) && v.length <= 5,
                handoffCoordinates: coordinates,
                campus: (v) => v === "SIP" || v === "TAICANG",
                accessMode: (v) =>
                  ["borrow", "rent", "buy", "swap"].includes(String(v)),
              }),
            );
          }
        } catch {
          setError("无法恢复本机草稿，请重新填写；已提交的物品不受影响");
        }
        setReady(true);
      })
      .catch((e) => {
        if (active)
          setError(e instanceof Error ? e.message : "账号加载失败，请刷新重试");
      });
    return () => {
      active = false;
      alive.current = false;
    };
  }, [product?.id]);
  useEffect(() => {
    if (!ready || !key.current) return;
    try {
      localStorage.setItem(
        key.current,
        JSON.stringify({ ...draft, submission: submission.current }),
      );
      setSaved(true);
    } catch {
      setError("浏览器无法保存发布草稿，请及时提交");
    }
  }, [draft, ready]);
  function update(value: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...value }));
    setSaved(false);
  }
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError("");
    try {
      if (draft.photos.length + files.length > 5)
        throw new Error("最多上传 5 张实物照片");
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        if (file.size > 5 * 1024 * 1024)
          throw new Error("每张照片不能超过 5 MB");
        const form = new FormData();
        form.set("photo", file);
        const r = await clientFetch("/api/photos", {
            method: "POST",
            accountId: account.current,
            body: form,
          }),
          data = await r.json();
        if (!r.ok) throw new Error(data.error);
        urls.push(data.url);
      }
      if (alive.current) update({ photos: [...draft.photos, ...urls] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "上传失败");
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await ensureSession(true);
      submission.current = submissionFor(
        JSON.stringify(draft),
        submission.current,
      );
      try {
        localStorage.setItem(
          key.current,
          JSON.stringify({ ...draft, submission: submission.current }),
        );
      } catch {}
      const r = await clientFetch("/api/products", {
          method: product ? "PATCH" : "POST",
          accountId: account.current,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...draft,
            requestId: submission.current.requestId,
            ...(product ? { id: product.id, action: "edit" } : {}),
          }),
        }),
        data = await r.json();
      if (!r.ok) throw new Error(data.error || "提交失败");
      if (!alive.current) return;
      try {
        localStorage.removeItem(key.current);
      } catch {}
      onDone(
        product ? "修改已提交重新审核" : "已提交审核，可在「我的发布」查看进度",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "提交失败");
    } finally {
      setBusy(false);
    }
  }
  const returnRequired =
    draft.accessMode === "borrow" || draft.accessMode === "rent";
  return (
    <section className="panel">
      <div className="split">
        <h2>{product ? "修改物品" : "开放物品"}</h2>
        {saved && (
          <span className="status-tag">
            <Save size={13} /> 草稿已保留
          </span>
        )}
      </div>
      <form className="form" onSubmit={submit}>
        <fieldset disabled={!ready || busy || uploading}>
          <label>
            物品名称
            <input
              required
              maxLength={100}
              value={draft.title}
              onChange={(e) => update({ title: e.target.value })}
            />
          </label>
          <label>
            使用方式
            <select
              value={draft.accessMode}
              onChange={(e) =>
                update({ accessMode: e.target.value as AccessMode })
              }
            >
              <option value="borrow">借用</option>
              <option value="rent">短租</option>
              <option value="buy">买断</option>
              <option value="swap">永久交换</option>
            </select>
          </label>
          <label>
            分类
            <select
              value={draft.category}
              onChange={(e) => update({ category: e.target.value })}
            >
              {[
                "学习考试",
                "活动服装",
                "出行用品",
                "交通",
                "数码产品",
                "活动设备",
              ].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            成色与功能
            <textarea
              required
              maxLength={500}
              value={draft.condition}
              onChange={(e) => update({ condition: e.target.value })}
            />
          </label>
          <div className="photo-strip">
            {draft.photos.map((url, index) => (
              <div className="photo-thumb" key={url}>
                <img src={url} alt={"实物照片 " + (index + 1)} />
                <button
                  type="button"
                  title="移除照片"
                  aria-label={"移除照片 " + (index + 1)}
                  onClick={() =>
                    update({ photos: draft.photos.filter((p) => p !== url) })
                  }
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="secondary"
              disabled={draft.photos.length >= 5}
              onClick={() => input.current?.click()}
            >
              <Camera size={18} /> 实物照片 {draft.photos.length}/5
            </button>
            <input
              ref={input}
              hidden
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              aria-label="上传实物照片"
              onChange={(e) => void upload(e.target.files)}
            />
          </div>
          <div className="form-columns">
            <label>
              可用开始
              <input
                required
                type="date"
                value={draft.availableFrom}
                onChange={(e) => update({ availableFrom: e.target.value })}
              />
            </label>
            <label>
              可用结束
              <input
                required
                type="date"
                min={draft.availableFrom}
                value={draft.availableTo}
                onChange={(e) => update({ availableTo: e.target.value })}
              />
            </label>
          </div>
          <label>
            可用说明
            <input
              maxLength={100}
              value={draft.availabilityLabel}
              onChange={(e) => update({ availabilityLabel: e.target.value })}
              placeholder="例如：周末可借"
            />
          </label>
          {draft.accessMode === "buy" && (
            <label>
              买断价格（元）
              <input
                required
                type="number"
                min={0}
                max={100000}
                step=".01"
                value={draft.price}
                onChange={(e) => update({ price: Number(e.target.value) })}
              />
            </label>
          )}
          {draft.accessMode === "rent" && (
            <label>
              租金（元 / 24 小时，不足一天按一天）
              <input
                required
                type="number"
                min=".01"
                max={100000}
                step=".01"
                value={draft.rentPrice}
                onChange={(e) => update({ rentPrice: Number(e.target.value) })}
              />
            </label>
          )}
          {returnRequired && (
            <label>
              押金（元）
              <input
                required
                type="number"
                min={0}
                max={100000}
                step=".01"
                value={draft.deposit}
                onChange={(e) => update({ deposit: Number(e.target.value) })}
              />
            </label>
          )}
          {draft.accessMode === "swap" && (
            <label>
              希望换取的物品
              <textarea
                required
                maxLength={500}
                value={draft.swapRule}
                onChange={(e) => update({ swapRule: e.target.value })}
              />
            </label>
          )}
          <label>
            所在校区
            <select
              value={draft.campus}
              onChange={(e) =>
                update({
                  campus: e.target.value as Campus,
                  locationId: "",
                  spot: "",
                  handoffCoordinates: undefined,
                })
              }
            >
              <option value="SIP">SIP 校区</option>
              <option value="TAICANG">XEC 校区</option>
            </select>
          </label>
          <PlaceField
            campus={draft.campus}
            locationId={draft.locationId}
            spot={draft.spot}
            onChange={(locationId, spot) =>
              update({ locationId, spot, handoffCoordinates: undefined })
            }
          />
          <details
            className="pin-picker"
            open={mapOpen}
            onToggle={(event) => setMapOpen(event.currentTarget.open)}
          >
            <summary>
              公共交付点地图标记{" "}
              {draft.handoffCoordinates ? "· 已标记" : "· 可选"}
            </summary>
            {mapOpen && (
              <p className="privacy-note">
                地图标记为公开交付点，不是住址或实时位置。底图由 OpenStreetMap
                提供，定位后的瓦片请求可能反映所在区域；无需开启定位也可手动选择公共点。
              </p>
            )}
            {mapOpen && (
              <NearbyMap
                campus={draft.campus}
                onPick={(point) => update({ handoffCoordinates: point })}
                picked={draft.handoffCoordinates}
              />
            )}
            {draft.handoffCoordinates && (
              <button
                type="button"
                className="secondary"
                onClick={() => update({ handoffCoordinates: undefined })}
              >
                移除地图标记
              </button>
            )}
          </details>
          {returnRequired && (
            <label>
              归还规则
              <textarea
                required
                maxLength={2000}
                value={draft.returnRule}
                onChange={(e) => update({ returnRule: e.target.value })}
              />
            </label>
          )}
          <label className="check-label">
            <input
              type="checkbox"
              checked={draft.crossCampus}
              onChange={(e) => update({ crossCampus: e.target.checked })}
            />{" "}
            支持跨校区交付
          </label>
        </fieldset>
        {uploading && <p role="status">正在处理实物照片…</p>}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="primary full" disabled={!ready || busy || uploading}>
          <Upload size={16} />
          {busy ? "提交中" : "提交审核"}
        </button>
      </form>
    </section>
  );
}
