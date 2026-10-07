import { Home } from "lucide-react";
export default function NotFound() {
  return (
    <main className="app-shell">
      <section className="panel">
        <h1>找不到这个页面</h1>
        <a className="secondary" href="/">
          <Home size={16} />
          返回首页
        </a>
      </section>
    </main>
  );
}
