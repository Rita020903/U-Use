"use client";
import { clientFetch } from "../lib/client-fetch";
import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import {
  LocateFixed,
  MapPin,
  RefreshCw,
  ShoppingBag,
  Pause,
} from "lucide-react";
import { Campus, Product } from "../lib/types";
import { distanceKm } from "../lib/places";
import { ensureSession } from "../lib/client-session";
import { coarsePosition, PRESENCE_TTL } from "../lib/presence";
export type Position = {
  lat: number;
  lng: number;
  accuracy: number;
  measuredAt: number;
};
type NearbyPerson = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  updatedAt: number;
};
// OSM campus centroids, not entrance coordinates or a user's inferred position.
const centers: Record<Campus, [number, number]> = {
  SIP: [31.27558, 120.73584],
  TAICANG: [31.48303, 121.15569],
};
export default function NearbyMap({
  campus,
  accountId,
  products = [],
  onProduct,
  onOwner,
  onPosition,
  onPick,
  picked,
}: {
  campus: Campus;
  accountId?: string;
  products?: Product[];
  onProduct?: (p: Product) => void;
  onOwner?: (id: string) => void;
  onPosition?: (p: Position | null) => void;
  onPick?: (p: { lat: number; lng: number }) => void;
  picked?: { lat: number; lng: number };
}) {
  const element = useRef<HTMLDivElement>(null),
    map = useRef<Leaflet.Map>(),
    layers = useRef<Leaflet.LayerGroup>();
  const lib = useRef<typeof Leaflet>(),
    tiles = useRef<Leaflet.TileLayer>();
  const [ready, setReady] = useState(false),
    [position, setPosition] = useState<Position | null>(null);
  const [people, setPeople] = useState<NearbyPerson[]>([]),
    [sharing, setSharing] = useState(false);
  const [error, setError] = useState(""),
    [locating, setLocating] = useState(false),
    [tileError, setTileError] = useState(false);
  const watch = useRef<number>(),
    expiry = useRef<ReturnType<typeof setTimeout>>();
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const publishing = useRef<Promise<Response>>();
  const leaseId = useRef(crypto.randomUUID());
  const sharingRef = useRef(sharing);
  sharingRef.current = sharing;
  const [clock, setClock] = useState(Date.now());
  function withdraw(keepalive = false) {
    return clientFetch("/api/presence", {
      method: "DELETE",
      accountId,
      keepalive,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leaseId: leaseId.current }),
    });
  }
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);
  const latestPosition = useRef(position);
  latestPosition.current = position;
  const onPositionRef = useRef(onPosition);
  onPositionRef.current = onPosition;
  const previousCampus = useRef(campus);
  useEffect(() => {
    if (previousCampus.current !== campus) {
      previousCampus.current = campus;
      setPeople([]);
      setSharing(false);
      if (sharingRef.current)
        void Promise.resolve(publishing.current)
          .catch(() => {})
          .then(() => withdraw())
          .catch(() => {});
    }
  }, [campus]);
  useEffect(() => {
    let removed = false;
    import("leaflet")
      .then((L) => {
        if (removed || !element.current) return;
        lib.current = L;
        map.current = L.map(element.current, {
          scrollWheelZoom: false,
        }).setView(centers[campus], 16);
        tiles.current = L.tileLayer(
          "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
          {
            maxZoom: 19,
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          },
        ).addTo(map.current);
        tiles.current.on("tileerror", () => setTileError(true));
        layers.current = L.layerGroup().addTo(map.current);
        map.current.on("click", (e: Leaflet.LeafletMouseEvent) =>
          onPickRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng }),
        );
        setReady(true);
      })
      .catch(() => setError("交互地图加载失败，请使用官方地图或刷新"));
    return () => {
      removed = true;
      map.current?.remove();
      if (watch.current !== undefined)
        navigator.geolocation.clearWatch(watch.current);
      clearTimeout(expiry.current);
      onPositionRef.current?.(null);
      // TTL is a fallback if the browser closes before this request reaches the server.
      if (!onPickRef.current && sharingRef.current)
        void Promise.resolve(publishing.current)
          .catch(() => {})
          .then(() => withdraw(true))
          .catch(() => {});
    };
  }, []);
  useEffect(() => {
    if (ready && !position) map.current?.setView(centers[campus], 16);
  }, [campus, ready, position]);
  useEffect(() => {
    if (!ready) return;
    layers.current?.clearLayers();
    const L = lib.current!,
      group = layers.current!;
    function pin(
      lat: number,
      lng: number,
      color: string,
      label: string,
      click?: () => void,
    ) {
      const content = document.createElement("span");
      content.textContent = label;
      const marker = L.circleMarker([lat, lng], {
        radius: 8,
        color: "#fff",
        weight: 2,
        fillColor: color,
        fillOpacity: 1,
      })
        .bindTooltip(content)
        .addTo(group);
      if (click) marker.on("click", click);
    }
    if (position) {
      L.circle([position.lat, position.lng], {
        radius: position.accuracy,
        color: "#2673bc",
        weight: 1,
        fillOpacity: 0.08,
      }).addTo(group);
      pin(
        position.lat,
        position.lng,
        "#2673bc",
        "我当前位置 · 精度约 " + Math.round(position.accuracy) + " 米",
      );
    }
    for (const person of people)
      if (
        position &&
        person.updatedAt > clock - PRESENCE_TTL &&
        distanceKm(position, person) <= 5
      )
        pin(
          person.lat,
          person.lng,
          "#8256a8",
          person.name + " · 约200米网格",
          () => onOwner?.(person.id),
        );
    for (const product of products)
      if (product.handoffCoordinates)
        pin(
          product.handoffCoordinates.lat,
          product.handoffCoordinates.lng,
          "#176b51",
          product.title + " · " + product.spot,
          () => onProduct?.(product),
        );
    if (picked) pin(picked.lat, picked.lng, "#bd5b36", "所选公共交付点");
  }, [ready, position, people, products, picked, onProduct, onOwner, clock]);
  useEffect(() => {
    if (onPick) return;
    let active = true;
    let syncing = false;
    async function sync() {
      if (syncing) return;
      syncing = true;
      try {
        const person = await ensureSession();
        if (!active) return;
        if (!accountId || person.id !== accountId) return;
        const current = latestPosition.current;
        if (!current || current.measuredAt <= Date.now() - 90000) {
          setPeople([]);
          return;
        }
        if (!person.verified) {
          setPeople([]);
          setError("登录后可查看附近主动分享位置的同学");
          return;
        }
        if (sharing && current && current.measuredAt > Date.now() - 90000) {
          publishing.current = clientFetch("/api/presence", {
            method: "POST",
            accountId,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...coarsePosition(current.lat, current.lng),
              campus,
              leaseId: leaseId.current,
            }),
          });
          const response = await publishing.current;
          if (!response.ok) {
            setSharing(false);
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || "位置分享失败，请重试");
          }
        }
        if (!active) return;
        const grid = coarsePosition(current.lat, current.lng);
        const response = await clientFetch(
          "/api/presence?" +
            new URLSearchParams({
              campus,
              lat: String(grid.lat),
              lng: String(grid.lng),
            }),
          {
            cache: "no-store",
            accountId,
          },
        );
        if (!response.ok) throw new Error("附近用户加载失败，请重试");
        const next = await response.json();
        if (active) {
          setPeople(next);
          setError("");
        }
      } catch (e) {
        if (active) {
          setPeople([]);
          setError(e instanceof Error ? e.message : "网络异常，请重试");
        }
      } finally {
        syncing = false;
      }
    }
    void sync();
    const timer = setInterval(sync, 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [campus, sharing, onPick, !!position, accountId]);
  function locate() {
    setError("");
    if (!navigator.geolocation) {
      setError("浏览器不支持定位");
      return;
    }
    setLocating(true);
    if (watch.current !== undefined)
      navigator.geolocation.clearWatch(watch.current);
    let centered = false;
    watch.current = navigator.geolocation.watchPosition(
      (result) => {
        const next = {
          lat: result.coords.latitude,
          lng: result.coords.longitude,
          accuracy: result.coords.accuracy,
          measuredAt: result.timestamp,
        };
        setPosition(next);
        onPositionRef.current?.(next);
        setLocating(false);
        if (!centered) {
          map.current?.setView([next.lat, next.lng], 17);
          centered = true;
        }
        clearTimeout(expiry.current);
        expiry.current = setTimeout(() => {
          if (watch.current !== undefined)
            navigator.geolocation.clearWatch(watch.current);
          watch.current = undefined;
          setPosition(null);
          onPositionRef.current?.(null);
          setSharing(false);
          void Promise.resolve(publishing.current)
            .catch(() => {})
            .then(() => withdraw())
            .catch(() => {});
          setError("定位已过期，请重新定位");
        }, 90000);
      },
      (e) => {
        if (watch.current !== undefined)
          navigator.geolocation.clearWatch(watch.current);
        watch.current = undefined;
        setLocating(false);
        setSharing(false);
        setPosition(null);
        onPositionRef.current?.(null);
        void Promise.resolve(publishing.current)
          .catch(() => {})
          .then(() => withdraw())
          .catch(() => {});
        setError(
          e.code === 1
            ? "定位权限未开放，请在浏览器设置中允许定位后重试"
            : e.code === 3
              ? "定位超时，请重试"
              : "暂时无法获取位置，请重试",
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 15000 },
    );
  }
  async function toggleShare(next: boolean) {
    setSharing(next);
    setError("");
    if (!next) {
      try {
        await publishing.current?.catch(() => {});
        const r = await withdraw();
        if (!r.ok) throw new Error();
      } catch {
        setError("撤回请求未成功；公开位置将在最后更新后 2 分钟内过期");
      }
    }
  }
  const nearbyPeople = position
    ? people.filter(
        (p) =>
          p.updatedAt > clock - PRESENCE_TTL && distanceKm(position, p) <= 5,
      )
    : [];
  return (
    <div className="nearby-surface">
      <p className="privacy-note" role="status">
        定位：{position ? "仅本机使用" : "未开启"} · 位置分享：
        {sharing ? "约 200 米网格，2 分钟到期" : "未开启"}
      </p>
      <div className="map-action-row">
        <button
          type="button"
          className="secondary"
          onClick={locate}
          disabled={locating}
        >
          <LocateFixed size={16} /> {locating ? "定位中" : "我的位置"}
        </button>
        {position && (
          <button
            type="button"
            className="secondary"
            title="停止定位"
            aria-label="停止定位"
            onClick={() => {
              if (watch.current !== undefined)
                navigator.geolocation.clearWatch(watch.current);
              watch.current = undefined;
              clearTimeout(expiry.current);
              setPosition(null);
              onPositionRef.current?.(null);
              setPeople([]);
              void toggleShare(false);
            }}
          >
            <Pause size={16} />
          </button>
        )}
        <button
          type="button"
          className="secondary"
          title="查看当前校区"
          aria-label="查看当前校区"
          onClick={() => map.current?.setView(centers[campus], 16)}
        >
          <MapPin size={16} />
        </button>
        <button
          type="button"
          className="secondary"
          title="重载地图"
          aria-label="重载地图"
          onClick={() => {
            setTileError(false);
            tiles.current?.redraw();
            map.current?.invalidateSize();
          }}
        >
          <RefreshCw size={16} />
        </button>
      </div>
      <div
        ref={element}
        className="live-map"
        aria-label={onPick ? "公共交付点地图" : "当前位置及附近用户地图"}
      />
      <div className="map-legend">
        <span>
          <i className="legend-self" />
          我的位置
        </span>
        {!onPick && (
          <>
            <span>
              <i className="legend-person" />
              附近用户
            </span>
            <span>
              <i className="legend-product" />
              交付点
            </span>
          </>
        )}
        {onPick && (
          <span>
            <i className="legend-picked" />
            所选地点
          </span>
        )}
      </div>
      {tileError && (
        <p role="alert" className="form-error">
          部分地图瓦片未加载，可重载或切换官方地图。
        </p>
      )}
      {position && (
        <p className="location-status">
          我的位置：{position.lat.toFixed(5)}, {position.lng.toFixed(5)} ·
          精度约 {Math.round(position.accuracy)} 米
        </p>
      )}
      {!onPick && (
        <>
          <label className="check-label presence-optin">
            <input
              type="checkbox"
              checked={sharing}
              disabled={!position}
              onChange={(e) => void toggleShare(e.target.checked)}
            />{" "}
            向附近同学分享约 200 米网格位置
          </label>
          <div className="nearby-list">
            <strong>
              主动分享位置的同学 {position ? "· " + nearbyPeople.length : ""}
            </strong>
            {!position ? (
              <p>尚未定位</p>
            ) : !nearbyPeople.length ? (
              <p>5 公里内暂无主动分享位置的用户</p>
            ) : (
              nearbyPeople.map((p) => (
                <div key={p.id}>
                  <span>{p.name}</span>
                  <span>
                    约 {distanceKm(position, p).toFixed(1)} km ·{" "}
                    {Math.max(0, Math.floor((clock - p.updatedAt) / 1000))}{" "}
                    秒前更新
                  </span>
                  {onOwner && (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => onOwner(p.id)}
                    >
                      <ShoppingBag size={14} /> 查看物品
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}
      {picked && (
        <p className="location-status">
          交付点：{picked.lat.toFixed(5)}, {picked.lng.toFixed(5)}
        </p>
      )}
      {!onPick && position && (
        <p className="privacy-note">
          附近查询仅发送模糊网格；公开分享可随时关闭，2
          分钟不更新自动过期。底图由 OpenStreetMap 提供。
        </p>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </div>
  );
}
