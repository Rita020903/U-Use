import Link from "next/link";
import { ArrowLeft } from "lucide-react";
export default function PolicyPage({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const support = process.env.SUPPORT_EMAIL || "";
  return (
    <main className="policy-page">
      <Link className="secondary link-button" href="/">
        <ArrowLeft size={16} /> 返回 U Use
      </Link>
      <h1>{title}</h1>
      <p className="muted">更新日期：2026-10-09</p>
      {children}
      <section>
        <h2>联系与反馈</h2>
        {/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(support) ? (
          <p>
            <a href={"mailto:" + support}>{support}</a>
          </p>
        ) : (
          <p>
            运营联系邮箱尚未配置；正式开放前须由运营者设置。账号内可自助导出资料、清除课表和申请注销。
          </p>
        )}
      </section>
    </main>
  );
}
