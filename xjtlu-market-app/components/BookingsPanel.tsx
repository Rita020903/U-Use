"use client";
import { clientFetch } from "../lib/client-fetch";
import { useEffect, useLayoutEffect, useState, useRef, FormEvent } from "react";
import {
  Check,
  X,
  Handshake,
  Undo2,
  Flag,
  Banknote,
  Send,
  RefreshCw,
  Navigation,
} from "lucide-react";
import { Booking, BookingMessage } from "../lib/types";
import { actionsFor, BookingAction } from "../lib/booking-rules";
import { ensureSession } from "../lib/client-session";
import { navigationUrl } from "../lib/campuses";
import { useConfirmation } from "./ConfirmationProvider";
import { startPolling } from "../lib/client-poll";
import { mergeMessages } from "../lib/message-order";
import {
  restoreFields,
  restoreSubmission,
  submissionFor,
  Submission,
} from "../lib/client-drafts";
const format = (value: string) =>
  Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleString("zh-CN", {
        timeZone: "Asia/Shanghai",
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : value;
const labels: Record<BookingAction, string> = {
  accept: "接受预约",
  reject: "拒绝预约",
  cancel: "取消预约",
  handoff: "确认实物交付",
  return: "确认归还",
  dispute: "发起争议",
  payment: "确认线下收付款",
};
const icons = {
  accept: Check,
  reject: X,
  cancel: X,
  handoff: Handshake,
  return: Undo2,
  dispute: Flag,
  payment: Banknote,
};
export default function BookingsPanel({ accountId }: { accountId: string }) {
  const revision = useRef(0);
  const controller = useRef<AbortController>();
  const [bookings, setBookings] = useState<Booking[]>([]),
    [personId, setPersonId] = useState(""),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [filter, setFilter] = useState<"all" | "borrowed" | "lent">("all");
  async function load(initial = false, force = true) {
    if (!force && controller.current) return;
    const current = ++revision.current;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    if (initial) setLoading(true);
    try {
      const person = await ensureSession();
      if (!person.verified) throw new Error("请先到「我的」用西浦邮箱登录");
      const r = await clientFetch("/api/bookings", {
          cache: "no-store",
          signal: abort.signal,
          accountId,
        }),
        data = await r.json();
      if (!r.ok) {
        if (
          current === revision.current &&
          [401, 403, 409].includes(r.status)
        ) {
          setBookings([]);
          setPersonId("");
        }
        throw new Error(data.error);
      }
      if (current !== revision.current) return;
      setPersonId(accountId);
      setBookings(data);
      setError("");
    } catch (e) {
      if (current === revision.current)
        setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      if (current === revision.current) {
        controller.current = undefined;
        setLoading(false);
      }
    }
  }
  useEffect(() => {
    const stop = startPolling(() => load(false, false), 15000);
    return () => {
      stop();
      revision.current++;
      controller.current?.abort();
    };
  }, []);
  const visible = bookings.filter(
    (b) =>
      filter === "all" ||
      (filter === "borrowed" && b.requesterId === personId) ||
      (filter === "lent" && b.ownerId === personId),
  );
  return (
    <section className="panel">
      <div className="split">
        <h2>我的交易</h2>
        <button
          className="secondary"
          onClick={() => void load(true)}
          disabled={loading}
          title="刷新预约"
          aria-label="刷新预约"
        >
          <RefreshCw size={16} />
        </button>
      </div>
      <div className="scope-tabs">
        <button
          className={filter === "all" ? "active" : ""}
          onClick={() => setFilter("all")}
        >
          全部
        </button>
        <button
          className={filter === "borrowed" ? "active" : ""}
          onClick={() => setFilter("borrowed")}
        >
          我预约的
        </button>
        <button
          className={filter === "lent" ? "active" : ""}
          onClick={() => setFilter("lent")}
        >
          我收到的
        </button>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {loading && <p role="status">正在加载交易…</p>}
      {!loading && !error && !visible.length && (
        <p className="empty-state">暂无交易</p>
      )}
      {visible.map((b) => (
        <BookingRow
          booking={b}
          personId={personId}
          key={b.id}
          onChanged={() => void load()}
        />
      ))}
    </section>
  );
}
function BookingRow({
  booking: b,
  personId,
  onChanged,
}: {
  booking: Booking;
  personId: string;
  onChanged: () => void;
}) {
  const confirm = useConfirmation();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [reason, setReason] = useState(""),
    [disputing, setDisputing] = useState(false),
    [chat, setChat] = useState(false);
  async function act(action: BookingAction) {
    if (
      action === "cancel" &&
      !(await confirm("取消这次预约？对方将收到通知。"))
    )
      return;
    setBusy(true);
    setError("");
    try {
      const r = await clientFetch("/api/bookings", {
          method: "PATCH",
          accountId: personId,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: b.id, action, reason }),
        }),
        data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setDisputing(false);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusy(false);
    }
  }
  const overdue =
    b.returnRequiredSnapshot !== false &&
    ["使用中", "待归还", "已交付"].includes(b.status) &&
    Date.parse(b.returnTime) < Date.now();
  return (
    <article className="booking-row">
      <div className="split">
        <h3>{b.productTitle}</h3>
        <span className={"status-tag " + (overdue ? "warning" : "")}>
          {overdue ? "已逾期 · " : ""}
          {b.status}
        </span>
      </div>
      <p className="muted">
        {b.ownerId === personId
          ? "预约人：" + b.requester
          : "发布者：" + b.owner}
      </p>
      <dl className="booking-details">
        <dt>交付</dt>
        <dd>{format(b.time)}</dd>
        {b.returnRequiredSnapshot !== false && (
          <>
            <dt>归还</dt>
            <dd>{format(b.returnTime)}</dd>
          </>
        )}
        <dt>地点</dt>
        <dd>
          {b.campus === "SIP" ? "SIP 校区" : "XEC 校区"} · {b.spot}
        </dd>
        <dt>使用费用</dt>
        <dd>
          ¥{b.feeSnapshot || 0}
          {b.rentalDays ? " · " + b.rentalDays + " 天" : ""}
        </dd>
        <dt>押金</dt>
        <dd>¥{b.depositSnapshot}</dd>
      </dl>
      {b.offeredProductTitle && <p>交换物品：{b.offeredProductTitle}</p>}
      {b.expiresAt && b.status === "待确认" && (
        <p className="muted">
          确认截止：{format(new Date(b.expiresAt).toISOString())}
        </p>
      )}
      {b.note && <p>{b.note}</p>}
      {b.handoffConfirmedBy?.length === 1 && b.status === "已确认" && (
        <p className="muted">一方已确认交付，等待另一方确认。</p>
      )}
      {b.returnConfirmedBy?.length === 1 && (
        <p className="muted">一方已确认归还，等待另一方检查实物。</p>
      )}
      {(b.feeSnapshot || b.depositSnapshot) > 0 && (
        <p className="muted">
          线下收付款：
          {b.paymentConfirmedBy?.length === 2
            ? "双方已确认"
            : b.paymentConfirmedBy?.length === 1
              ? "一方已确认"
              : "尚未确认"}
        </p>
      )}
      {b.disputeReason && (
        <p className="form-error">争议说明：{b.disputeReason}</p>
      )}
      <div className="booking-actions">
        {actionsFor(b, personId).map((action) => {
          const Icon = icons[action];
          return (
            <button
              key={action}
              type="button"
              disabled={busy}
              className={action === "accept" ? "primary" : "secondary"}
              onClick={() =>
                action === "dispute"
                  ? setDisputing(!disputing)
                  : void act(action)
              }
            >
              <Icon size={16} />
              {labels[action]}
            </button>
          );
        })}
        <a
          className="secondary"
          href={navigationUrl(b.campus, b.spot)}
          target="_blank"
          rel="noreferrer"
        >
          <Navigation size={16} /> 地点导航
        </a>
        <button
          type="button"
          className="secondary"
          onClick={() => setChat(!chat)}
        >
          <Send size={16} /> 交易消息
        </button>
      </div>
      {disputing && (
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            void act("dispute");
          }}
        >
          <label>
            争议说明
            <textarea
              required
              minLength={5}
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <button className="primary" disabled={busy}>
            提交争议
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {chat && <Conversation bookingId={b.id} personId={personId} />}
    </article>
  );
}
function Conversation({
  bookingId,
  personId,
}: {
  bookingId: string;
  personId: string;
}) {
  const log = useRef<HTMLDivElement>(null),
    keepBottom = useRef(true),
    anchor = useRef<{ height: number; top: number }>();
  const alive = useRef(true),
    controller = useRef<AbortController>(),
    historyController = useRef<AbortController>(),
    revision = useRef(0),
    historyLoaded = useRef(false),
    sending = useRef(false),
    submission = useRef<Submission>();
  const draftKey = `uuse-message-draft:${personId}:${bookingId}`;
  const [messages, setMessages] = useState<BookingMessage[]>([]),
    [text, setText] = useState(""),
    [error, setError] = useState(""),
    [loadError, setLoadError] = useState(""),
    [draftWarning, setDraftWarning] = useState(""),
    [ready, setReady] = useState(false),
    [hasOlder, setHasOlder] = useState(false),
    [oldest, setOldest] = useState(""),
    [loadingOlder, setLoadingOlder] = useState(false),
    [busy, setBusy] = useState(false);
  useLayoutEffect(() => {
    const node = log.current;
    if (!node) return;
    if (anchor.current) {
      node.scrollTop =
        anchor.current.top + node.scrollHeight - anchor.current.height;
      anchor.current = undefined;
    } else if (keepBottom.current) node.scrollTop = node.scrollHeight;
  }, [messages]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        setText(restoreFields(raw, { text: "" }).text);
        submission.current = restoreSubmission(raw);
      }
    } catch {
      setDraftWarning("无法恢复本机消息草稿，请重新填写");
    }
    setReady(true);
  }, [draftKey]);
  useEffect(() => {
    if (!ready) return;
    try {
      if (text)
        localStorage.setItem(
          draftKey,
          JSON.stringify({ text, submission: submission.current }),
        );
      else localStorage.removeItem(draftKey);
    } catch {
      setDraftWarning("浏览器无法保留消息草稿，请勿在发送前离开");
    }
  }, [text, ready, draftKey]);
  async function load(force = true) {
    if (!force && controller.current) return;
    const current = ++revision.current;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    try {
      const r = await clientFetch(
          "/api/messages?bookingId=" + encodeURIComponent(bookingId),
          { cache: "no-store", signal: abort.signal, accountId: personId },
        ),
        data = await r.json();
      if (!r.ok) {
        if (
          alive.current &&
          current === revision.current &&
          [401, 403, 409].includes(r.status)
        )
          setMessages([]);
        throw new Error(data.error);
      }
      if (!alive.current || current !== revision.current) return;
      setMessages((previous) => mergeMessages(previous, data));
      if (!historyLoaded.current) {
        setHasOlder(r.headers.get("X-Has-More") === "true");
        setOldest(r.headers.get("X-Oldest-Message") || "");
      }
      setLoadError("");
    } catch (e) {
      if (alive.current && current === revision.current)
        setLoadError(e instanceof Error ? e.message : "消息加载失败");
    } finally {
      if (current === revision.current) controller.current = undefined;
    }
  }
  async function older() {
    if (loadingOlder || !oldest) return;
    setLoadingOlder(true);
    const abort = new AbortController();
    historyController.current = abort;
    try {
      const q = new URLSearchParams({ bookingId, before: oldest });
      const r = await clientFetch("/api/messages?" + q, {
          cache: "no-store",
          signal: abort.signal,
          accountId: personId,
        }),
        data = await r.json();
      if (!r.ok) throw new Error(data.error);
      if (!alive.current) return;
      historyLoaded.current = true;
      if (log.current)
        anchor.current = {
          height: log.current.scrollHeight,
          top: log.current.scrollTop,
        };
      setMessages((previous) => mergeMessages(previous, data));
      setHasOlder(r.headers.get("X-Has-More") === "true");
      setOldest(r.headers.get("X-Oldest-Message") || "");
      setLoadError("");
    } catch (e) {
      if (alive.current)
        setLoadError(e instanceof Error ? e.message : "历史消息加载失败");
    } finally {
      if (alive.current) setLoadingOlder(false);
    }
  }
  useEffect(() => {
    alive.current = true;
    const stop = startPolling(() => load(false), 10000);
    return () => {
      alive.current = false;
      revision.current++;
      stop();
      controller.current?.abort();
      historyController.current?.abort();
    };
  }, [bookingId]);
  async function send(event: FormEvent) {
    event.preventDefault();
    if (sending.current || !text.trim()) return;
    sending.current = true;
    setBusy(true);
    setError("");
    try {
      const input = { bookingId, text };
      submission.current = submissionFor(
        JSON.stringify(input),
        submission.current,
      );
      try {
        localStorage.setItem(
          draftKey,
          JSON.stringify({ text, submission: submission.current }),
        );
      } catch {}
      const r = await clientFetch("/api/messages", {
          method: "POST",
          accountId: personId,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...input,
            requestId: submission.current.requestId,
          }),
        }),
        data = await r.json();
      if (!r.ok) throw new Error(data.error);
      if (!alive.current) return;
      keepBottom.current = true;
      setMessages((previous) => mergeMessages(previous, [data]));
      setText("");
      submission.current = undefined;
      await load();
    } catch (e) {
      if (alive.current)
        setError(
          e instanceof Error ? e.message : "发送结果暂不确定，刷新查看后再重试",
        );
    } finally {
      sending.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <section className="conversation">
      <h4>交易消息</h4>
      {hasOlder && (
        <button
          type="button"
          className="secondary"
          disabled={loadingOlder}
          onClick={() => void older()}
        >
          <RefreshCw size={15} />
          {loadingOlder ? "加载中" : "更早消息"}
        </button>
      )}
      <div
        className="message-log"
        ref={log}
        role="log"
        aria-label="交易消息记录"
        aria-live="polite"
        onScroll={(event) => {
          const node = event.currentTarget;
          keepBottom.current =
            node.scrollHeight - node.scrollTop - node.clientHeight < 48;
        }}
      >
        {messages.map((m) => (
          <div
            className={"chat-message " + (m.senderId === personId ? "own" : "")}
            key={m.id}
          >
            <small>
              {m.senderName} · {format(m.createdAt)}
            </small>
            <p>{m.text}</p>
          </div>
        ))}
        {!messages.length && <p className="muted">暂无消息</p>}
      </div>
      <form onSubmit={send} className="message-compose">
        <input
          aria-label="交易消息内容"
          required
          disabled={busy}
          value={text}
          maxLength={1000}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          className="primary"
          disabled={busy || !text.trim()}
          title="发送消息"
          aria-label="发送消息"
        >
          <Send size={16} />
        </button>
      </form>
      {loadError && (
        <p role="alert" className="form-error">
          {loadError}{" "}
          <button
            type="button"
            className="secondary"
            onClick={() => void load()}
          >
            <RefreshCw size={14} />
            刷新消息
          </button>
        </p>
      )}
      {draftWarning && (
        <p role="alert" className="form-error">
          {draftWarning}
        </p>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </section>
  );
}
