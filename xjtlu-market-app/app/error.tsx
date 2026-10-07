"use client";
import { RotateCcw, Home } from "lucide-react";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="app-shell">
      <section className="panel" role="alert">
        <h1>页面暂时无法打开</h1>
        <p>已提交的物品和预约仍在账号中。</p>
        <div className="form-actions">
          <button type="button" className="primary" onClick={reset}>
            <RotateCcw size={16} />
            重试
          </button>
          <a className="secondary" href="/">
            <Home size={16} />
            返回首页
          </a>
        </div>
      </section>
    </main>
  );
}
