"use client";

import { useState } from "react";
import { ExternalLink, Minus, Plus, RotateCcw } from "lucide-react";
import { Campus } from "../lib/types";
import { campuses, navigationUrl } from "../lib/campuses";

export default function CampusMap({ campus }: { campus: Campus }) {
  const [zoom, setZoom] = useState(1);
  const [failed, setFailed] = useState(false);
  const info = campuses[campus];
  return (
    <section className="official-map" aria-label={`${info.label}官方地图`}>
      <div className="split">
        <strong>{info.label}</strong>
        <a href={navigationUrl(campus)} target="_blank" rel="noreferrer">
          导航 <ExternalLink size={14} />
        </a>
      </div>
      <div className="map-controls">
        <button
          type="button"
          title="放大地图"
          aria-label="放大地图"
          disabled={zoom >= 3}
          onClick={() => setZoom(Math.min(3, zoom + 0.5))}
        >
          <Plus size={16} />
        </button>
        <button
          type="button"
          title="缩小地图"
          aria-label="缩小地图"
          disabled={zoom <= 1}
          onClick={() => setZoom(Math.max(1, zoom - 0.5))}
        >
          <Minus size={16} />
        </button>
        <button
          type="button"
          title="重置地图"
          aria-label="重置地图"
          onClick={() => setZoom(1)}
        >
          <RotateCcw size={16} />
        </button>
        <a href={info.download} target="_blank" rel="noreferrer">
          查看原图 <ExternalLink size={14} />
        </a>
      </div>
      <div className="map-scroll">
        {failed ? (
          <p role="alert">
            地图暂时无法加载，
            <a href={info.download} target="_blank" rel="noreferrer">
              打开官方地图
            </a>
          </p>
        ) : (
          <img
            key={campus}
            src={info.map}
            alt={`${info.label}官方校园地图，包含楼宇和道路名称`}
            style={{ width: `${zoom * 100}%`, height: zoom === 1 ? "100%" : "auto", objectFit: "contain", maxWidth: "none" }}
            onError={() => setFailed(true)}
          />
        )}
      </div>
      <a
        className="map-source"
        href="https://www.xjtlu.edu.cn/zh/campus-life/our-campus"
        target="_blank"
        rel="noreferrer"
      >
        地图来源：西交利物浦大学官网
      </a>
    </section>
  );
}
