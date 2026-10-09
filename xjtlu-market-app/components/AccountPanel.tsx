"use client";
import { clientFetch } from "../lib/client-fetch";
import { useState, useEffect, useRef, FormEvent } from "react";
import {
  Mail,
  LogOut,
  ShieldCheck,
  UserRound,
  Download,
  Trash2,
  CalendarX,
  FileText,
} from "lucide-react";
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
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [email, setEmail] = useState(""),
    [code, setCode] = useState(""),
    [name, setName] = useState(""),
    [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [localCode, setLocalCode] = useState(""),
    [resendAt, setResendAt] = useState(0),
    [remaining, setRemaining] = useState(0);
  const [deleteCode, setDeleteCode] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deletionSent, setDeletionSent] = useState(false);
  const [deletionLocalCode, setDeletionLocalCode] = useState("");
  const [deletionResendAt, setDeletionResendAt] = useState(0);
  const [deletionRemaining, setDeletionRemaining] = useState(0);
  const [notice, setNotice] = useState("");
  async function accountAction(
    action: "export" | "clear-timetable" | "send-delete-code" | "delete",
  ) {
    if (busy || !person?.verified) return;
    if (action === "send-delete-code" && Date.now() < deletionResendAt) return;
    if (
      action === "clear-timetable" &&
      !(await confirm(
        "清除已启用课表和本机课表草稿？已约定的交易时间不会改变。",
      ))
    )
      return;
    if (
      action === "delete" &&
      !(await confirm(
        "注销后无法恢复账号。你的发布和照片会移除，已结束交易会保留去标识存档。确定注销？",
      ))
    )
      return;
    if (!mounted.current) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await clientFetch("/api/account", {
        method:
          action === "export" ? "GET" : action === "delete" ? "DELETE" : "POST",
        accountId: person.id,
        ...(action !== "export"
          ? {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(
                action === "delete"
                  ? { confirmation: deleteConfirmation, code: deleteCode }
                  : { action },
              ),
            }
          : {}),
      });
      const result = await response.json();
      if (!mounted.current) return;
      if (!response.ok) throw new Error(result.error || "操作失败，请重试");
      if (action === "export") {
        const url = URL.createObjectURL(
          new Blob([JSON.stringify(result, null, 2)], {
            type: "application/json",
          }),
        );
        const link = document.createElement("a");
        link.href = url;
        link.download = "uuse-account.json";
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 10000);
        setNotice("资料已导出，请妥善保管，不要公开分享");
      } else if (action === "send-delete-code") {
        setDeletionSent(true);
        setDeleteCode("");
        setDeletionLocalCode(result.localCode || "");
        setDeletionResendAt(Date.now() + 60000);
        setNotice("注销验证码已发送，10分钟内有效");
      } else if (action === "clear-timetable") {
        let cleared = true;
        try {
          localStorage.removeItem("uuse-timetable-draft:" + person.id);
        } catch {
          cleared = false;
        }
        resetSession();
        onNotice(
          cleared
            ? "课表已清除，已有交易约定不变"
            : "服务器课表已清除，但本机草稿清理失败，请清除本站存储",
        );
      } else {
        let cleared = false;
        try {
          cleared = clearAccountStorage(localStorage, person.id);
        } catch {}
        resetSession();
        onNotice(
          cleared
            ? "账号已注销"
            : "账号已注销；本机草稿清理失败，请清除本站存储",
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败，请重试");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    const update = () => {
      setRemaining(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)));
      setDeletionRemaining(
        Math.max(0, Math.ceil((deletionResendAt - Date.now()) / 1000)),
      );
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [resendAt, deletionResendAt]);
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
      if (!mounted.current) return;
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
      if (!mounted.current) return;
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
    if (!mounted.current) return;
    setBusy(true);
    try {
      const response = await clientFetch("/api/auth", {
        method: "DELETE",
        accountId: person?.id,
      });
      if (!mounted.current) return;
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
        <div className="account-data-actions">
          <h3>资料与隐私</h3>
          <div className="form-actions">
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => void accountAction("export")}
            >
              <Download size={16} /> 导出我的资料
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => void accountAction("clear-timetable")}
            >
              <CalendarX size={16} /> 清除课表
            </button>
            <a className="secondary link-button" href="/privacy">
              <ShieldCheck size={16} /> 隐私说明
            </a>
            <a className="secondary link-button" href="/terms">
              <FileText size={16} /> 交易规则
            </a>
          </div>
          <details className="account-deletion">
            <summary>注销账号</summary>
            <p>
              先结束全部交易与争议。注销会移除邮箱、课表、照片和会话，已结束交易及必要审计保留去标识记录；备份按运营保留周期处理。
            </p>
            <div className="form">
              <button
                type="button"
                className="secondary"
                disabled={busy || deletionRemaining > 0}
                onClick={() => void accountAction("send-delete-code")}
              >
                <Mail size={16} />{" "}
                {deletionRemaining > 0
                  ? `${deletionRemaining} 秒后可重发`
                  : "发送注销验证码"}
              </button>
              {deletionLocalCode && (
                <p className="development-note">
                  本地开发注销验证码：{deletionLocalCode}
                </p>
              )}
              {deletionSent && (
                <label>
                  注销验证码
                  <input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    disabled={busy}
                    value={deleteCode}
                    onChange={(e) =>
                      setDeleteCode(e.target.value.replace(/\D/g, ""))
                    }
                  />
                </label>
              )}
              <label>
                输入“删除我的账号”确认
                <input
                  disabled={busy}
                  value={deleteConfirmation}
                  maxLength={20}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="danger-button"
                disabled={
                  busy ||
                  deleteConfirmation !== "删除我的账号" ||
                  deleteCode.length !== 6
                }
                onClick={() => void accountAction("delete")}
              >
                <Trash2 size={16} /> 注销账号
              </button>
            </div>
          </details>
        </div>
        {notice && <p role="status">{notice}</p>}
        {error && <p role="alert">{error}</p>}
      </section>
    );
  return (
    <section className="account-section">
      <h2>
        <Mail size={18} /> 学生登录
      </h2>
      <p className="account-policy-links">
        <a href="/privacy">隐私说明</a> · <a href="/terms">交易规则</a>
      </p>
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
