"use client";
import { clientFetch } from "../lib/client-fetch";
import { useState, useEffect, FormEvent } from "react";
import { Mail, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { Person } from "../lib/types";
import { resetSession } from "../lib/client-session";
import { clearAccountStorage, hasAccountDraft } from "../lib/account-storage";
import { useConfirmation } from "./ConfirmationProvider";
export default function AccountPanel({
  person,
  onNotice,
}: {
  person: Person | null;
  onNotice: (message: string) => void;
}) {
  const confirm = useConfirmation();
  const [email, setEmail] = useState(""),
    [code, setCode] = useState(""),
    [name, setName] = useState(""),
    [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [localCode, setLocalCode] = useState(""),
    [resendAt, setResendAt] = useState(0),
    [remaining, setRemaining] = useState(0);
  useEffect(() => {
    const update = () =>
      setRemaining(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [resendAt]);
  async function send() {
    if (busy || remaining) return;
    setBusy(true);
    setError("");
    try {
      const response = await clientFetch("/api/auth", {
        method: "POST",
        accountId: person?.id,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setSent(true);
      setResendAt(Date.now() + 60000);
      setLocalCode(data.localCode || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "发送失败");
    } finally {
      setBusy(false);
    }
  }
  async function login(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!sent) {
      await send();
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await clientFetch("/api/auth", {
        method: "POST",
        accountId: person?.id,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", email, code, name }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setCode("");
      setLocalCode("");
      resetSession();
    } catch (e) {
      setError(e instanceof Error ? e.message : "登录失败");
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    if (busy) return;
    let hasDraft = true;
    try {
      hasDraft = !!person?.id && hasAccountDraft(localStorage, person.id);
    } catch {}
    if (
      hasDraft &&
      !(await confirm(
        "退出后会清除本机课表、物品、求物和消息草稿。已提交的内容仍在账号中。确定退出？",
      ))
    )
      return;
    setBusy(true);
    try {
      const response = await clientFetch("/api/auth", {
        method: "DELETE",
        accountId: person?.id,
      });
      if (!response.ok) throw new Error("退出失败");
      let cleared = true;
      try {
        if (person?.id) cleared = clearAccountStorage(localStorage, person.id);
      } catch {
        cleared = false;
      }
      resetSession();
      if (!cleared)
        onNotice("已退出，但浏览器阻止清除本机草稿；共用设备请清除本站存储");
    } catch (e) {
      setError(e instanceof Error ? e.message : "退出失败");
    } finally {
      setBusy(false);
    }
  }
  if (person?.verified)
    return (
      <section className="account-section">
        <div className="split">
          <div>
            <h2>
              <UserRound size={18} /> {person.name}
            </h2>
            <p className="muted">{person.email}</p>
            <span className="status-tag">
              <ShieldCheck size={14} />
              {person.verificationMode === "local"
                ? "本地开发账号"
                : "学生邮箱已验证"}
            </span>
          </div>
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => void logout()}
          >
            <LogOut size={16} /> 退出
          </button>
        </div>
        {error && <p role="alert">{error}</p>}
      </section>
    );
  return (
    <section className="account-section">
      <h2>
        <Mail size={18} /> 学生登录
      </h2>
      <form className="form" onSubmit={login}>
        <label>
          西浦学生邮箱
          <input
            type="email"
            disabled={busy}
            autoComplete="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setSent(false);
              setLocalCode("");
              setCode("");
            }}
            placeholder="name@student.xjtlu.edu.cn"
            maxLength={254}
          />
        </label>
        <label>
          昵称
          <input
            value={name}
            disabled={busy}
            maxLength={40}
            autoComplete="nickname"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="secondary"
          disabled={busy || !email || remaining > 0}
          onClick={() => void send()}
        >
          <Mail size={16} />{" "}
          {remaining
            ? `${remaining} 秒后可重发`
            : sent
              ? "重新发送验证码"
              : "发送验证码"}
        </button>
        {sent && (
          <>
            <label>
              验证码
              <input
                required
                disabled={busy}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />
            </label>
            <button className="primary" disabled={busy}>
              {busy ? "登录中" : "登录"}
            </button>
          </>
        )}
        {localCode && (
          <p className="development-note" role="status">
            本地开发验证码：{localCode}。正式部署仅通过邮件发送。
          </p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}
