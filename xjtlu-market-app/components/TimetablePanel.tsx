"use client";
import { clientFetch } from "../lib/client-fetch";
import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
  Check,
  ClipboardPaste,
  RefreshCw,
} from "lucide-react";
import {
  Lesson,
  Timetable,
  weekdays,
  validateTimetable,
  minutes,
  lessonsOn,
  isTimetableDraft,
  weekDates,
} from "../lib/timetable";
import { readTimetable } from "../lib/timetable-import";
import { parseTimetableText } from "../lib/timetable-text";
import { ensureSession } from "../lib/client-session";
import { useConfirmation } from "./ConfirmationProvider";
import { places } from "../lib/places";
import { Campus } from "../lib/types";
const dateList = (value: string) => value.split(/[\s,，]+/).filter(Boolean);
export default function TimetablePanel() {
  const confirm = useConfirmation();
  const [lessons, setLessons] = useState<Lesson[]>([]),
    [weekOne, setWeekOne] = useState(""),
    [termEnd, setTermEnd] = useState(""),
    [excluded, setExcluded] = useState("");
  const [busy, setBusy] = useState(false),
    [saving, setSaving] = useState(false),
    [message, setMessage] = useState(""),
    [dirty, setDirty] = useState(false),
    [enabled, setEnabled] = useState(false),
    [ready, setReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false),
    [loadingAttempt, setLoadingAttempt] = useState(0);
  const [previews, setPreviews] = useState<string[]>([]),
    [rawText, setRawText] = useState(""),
    [textInput, setTextInput] = useState("");
  const [language, setLanguage] = useState<"eng" | "eng+chi_sim">(
      "eng+chi_sim",
    ),
    [importMode, setImportMode] = useState<"replace" | "merge">("merge"),
    [view, setView] = useState<"list" | "week">("list"),
    [weekDate, setWeekDate] = useState(
      new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10),
    );
  const controller = useRef<AbortController>(),
    input = useRef<HTMLInputElement>(null),
    key = useRef(""),
    account = useRef(""),
    revision = useRef(0);
  const draft = useRef<Timetable>({ weekOne: "", lessons: [] });
  draft.current = {
    weekOne,
    lessons,
    termEnd: termEnd || undefined,
    excludedDates: dateList(excluded),
  };
  useEffect(() => {
    let active = true;
    setReady(false);
    setLoadFailed(false);
    const current = revision.current;
    ensureSession()
      .then(async (person) => {
        const response = await clientFetch("/api/session", {
          cache: "no-store",
          accountId: person.id,
        });
        if (!response.ok) throw new Error("课表加载失败");
        return response.json();
      })
      .then((person) => {
        if (!active || current !== revision.current) return;
        key.current = "uuse-timetable-draft:" + person.id;
        account.current = person.id;
        let cached: { timetable: Timetable } | undefined;
        try {
          const value = localStorage.getItem(key.current);
          if (value) {
            const stored = JSON.parse(value);
            if (!isTimetableDraft(stored?.timetable))
              throw new Error("损坏的课表草稿");
            cached = stored;
          }
        } catch {
          setMessage("本机草稿无法恢复，已加载账号中的课表；请重新导入草稿");
        }
        const timetable = cached?.timetable || person.timetable;
        if (timetable && Array.isArray(timetable.lessons)) {
          setLessons(
            timetable.lessons.map((l: Lesson) => ({
              ...l,
              reviewed: cached ? l.reviewed === true : l.reviewed !== false,
            })),
          );
          setWeekOne(timetable.weekOne);
          setTermEnd(timetable.termEnd || "");
          setExcluded((timetable.excludedDates || []).join(", "));
        }
        if (cached) {
          setDirty(true);
          setMessage("已恢复未保存草稿");
        }
        setEnabled(!!person.timetable);
        setReady(true);
      })
      .catch(() => {
        if (active) {
          setMessage("无法加载课表，请刷新后重试");
          setLoadFailed(true);
        }
      });
    return () => {
      active = false;
      controller.current?.abort();
    };
  }, [loadingAttempt]);
  useEffect(() => {
    if (!ready) return;
    window.dispatchEvent(
      new CustomEvent("uuse-draft-state", { detail: { dirty } }),
    );
    if (!dirty || !key.current) return;
    try {
      localStorage.setItem(
        key.current,
        JSON.stringify({ timetable: draft.current }),
      );
    } catch {
      setMessage("浏览器无法保留草稿，请及时保存");
    }
  }, [lessons, weekOne, termEnd, excluded, dirty, ready]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function changed() {
    revision.current++;
    setDirty(true);
    setMessage("草稿已保留，尚未启用新课表");
  }
  function edit(id: string, changes: Partial<Lesson>) {
    changed();
    setLessons((previous) =>
      previous.map((l) =>
        l.id === id
          ? {
              ...l,
              ...changes,
              ...("reviewed" in changes ? {} : { reviewed: false }),
            }
          : l,
      ),
    );
  }
  function applyImport(next: Lesson[]) {
    changed();
    setLessons((previous) =>
      importMode === "replace"
        ? next
        : [...previous, ...next].filter(
            (l, n, all) =>
              all.findIndex(
                (x) =>
                  x.title === l.title &&
                  x.day === l.day &&
                  x.start === l.start &&
                  x.end === l.end &&
                  x.room === l.room &&
                  x.weeks === l.weeks,
              ) === n,
          ),
    );
    setMessage(
      "提取到 " + next.length + " 条课程，请逐条核对；未识别内容可以补录",
    );
  }
  async function importFile(file?: File) {
    if (!file) return;
    if (
      importMode === "replace" &&
      lessons.length &&
      !(await confirm("用新文件替换当前课程草稿？已启用课表不会立即改变。"))
    )
      return;
    controller.current?.abort();
    const ctrl = new AbortController();
    controller.current = ctrl;
    setBusy(true);
    setPreviews([]);
    setRawText("");
    try {
      const next = await readTimetable(
        file,
        setMessage,
        ctrl.signal,
        (url, page = 0) =>
          setPreviews((p) => {
            const next = [...p];
            next[page] = url;
            return next;
          }),
        { language, rawText: setRawText },
      );
      if (!ctrl.signal.aborted) applyImport(next);
    } catch (e) {
      setMessage(
        ctrl.signal.aborted
          ? "已取消识别"
          : e instanceof Error
            ? e.message
            : "识别失败，请重试",
      );
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  async function save() {
    if (!ready || busy || saving) return;
    const timetable = draft.current;
    if (!validateTimetable(timetable)) {
      setMessage(
        "请核对每条课程，填写星期、时间、周次或指定日期，并设置第 1 周周一日期",
      );
      return;
    }
    setSaving(true);
    try {
      await ensureSession();
      const normalized = {
        ...timetable,
        lessons: timetable.lessons.map(
          ({ sourceText, confidence, ...lesson }) => lesson,
        ),
      };
      const response = await clientFetch("/api/session", {
        method: "POST",
        accountId: account.current,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalized),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "保存失败");
      setDirty(false);
      setEnabled(true);
      try {
        localStorage.removeItem(key.current);
        setMessage("已启用当前课表");
      } catch {
        setMessage("课表已启用，但浏览器阻止清除旧草稿；下次打开请核对草稿");
      }
      window.dispatchEvent(new Event("uuse-timetable"));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }
  async function clear() {
    if (!ready || busy || saving) return;
    if (!(await confirm("删除已启用课表和本地草稿，停用课表匹配？"))) return;
    setSaving(true);
    try {
      const response = await clientFetch("/api/session", {
        method: "DELETE",
        accountId: account.current,
      });
      if (!response.ok) throw new Error("删除失败");
      setLessons([]);
      setWeekOne("");
      setTermEnd("");
      setExcluded("");
      setDirty(false);
      setEnabled(false);
      setPreviews([]);
      setRawText("");
      try {
        localStorage.removeItem(key.current);
        setMessage("已删除课表");
      } catch {
        setMessage("课表已停用，但浏览器阻止清除本机草稿");
      }
      window.dispatchEvent(new Event("uuse-timetable"));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "删除失败");
    } finally {
      setSaving(false);
    }
  }
  const dates = weekDates(weekDate);
  if (!ready)
    return (
      <section className="timetable-section">
        <h2>
          <CalendarDays size={19} />
          我的课表
        </h2>
        <p role={loadFailed ? "alert" : "status"}>
          {loadFailed ? message : "正在加载课表…"}
        </p>
        {loadFailed && (
          <button
            type="button"
            className="secondary"
            onClick={() => setLoadingAttempt((n) => n + 1)}
          >
            <RefreshCw size={16} />
            重试加载
          </button>
        )}
      </section>
    );
  return (
    <section className="timetable-section">
      <div className="split">
        <h2>
          <CalendarDays size={19} /> 我的课表
        </h2>
        <span className="status-tag">
          {dirty ? "未启用草稿" : enabled ? "已启用" : "尚未启用"}
        </span>
      </div>
      <div className="schedule-tools">
        <button
          type="button"
          className="secondary"
          disabled={!ready || busy || saving}
          onClick={() => input.current?.click()}
        >
          <Upload size={16} /> 导入截图 / PDF
        </button>
        <input
          ref={input}
          type="file"
          hidden
          aria-label="导入课表文件"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={(e) => void importFile(e.target.files?.[0])}
        />
        <select
          aria-label="课表识别语言"
          value={language}
          disabled={busy || saving}
          onChange={(e) => setLanguage(e.target.value as typeof language)}
        >
          <option value="eng+chi_sim">中英双语</option>
          <option value="eng">英文</option>
        </select>
        <select
          aria-label="课表导入方式"
          value={importMode}
          disabled={busy || saving}
          onChange={(e) => setImportMode(e.target.value as typeof importMode)}
        >
          <option value="merge">追加课程</option>
          <option value="replace">替换课程</option>
        </select>
        {busy && (
          <button
            className="secondary"
            onClick={() => controller.current?.abort()}
          >
            <X size={16} /> 取消识别
          </button>
        )}
        <button
          type="button"
          className="secondary"
          disabled={!ready || busy || saving || lessons.length >= 200}
          onClick={() => {
            changed();
            setLessons((ls) => [
              ...ls,
              {
                id: crypto.randomUUID(),
                title: "",
                day: 0,
                start: "",
                end: "",
                room: "",
                weeks: "",
                reviewed: false,
              },
            ]);
          }}
        >
          <Plus size={16} /> 补录
        </button>
      </div>
      <details className="text-import">
        <summary>导入课程文字</summary>
        <textarea
          aria-label="课程原文"
          disabled={busy || saving}
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          maxLength={100000}
        />
        <button
          className="secondary"
          disabled={busy || saving || !textInput.trim()}
          onClick={() => {
            const parsed = parseTimetableText(textInput);
            if (parsed.length) applyImport(parsed);
            else setMessage("未提取到时间段，请手动补录");
          }}
        >
          <ClipboardPaste size={16} /> 提取课程
        </button>
      </details>
      {!!previews.length && (
        <details className="schedule-preview">
          <summary>原始课表预览 · {previews.length} 页</summary>
          {previews.map((url, n) => (
            <img src={url} key={n} alt={"原始课表第 " + (n + 1) + " 页"} />
          ))}
        </details>
      )}
      {rawText && (
        <details>
          <summary>识别原文</summary>
          <pre className="ocr-source">{rawText}</pre>
        </details>
      )}
      <div className="form form-columns">
        <label>
          第 1 周周一日期
          <input
            type="date"
            value={weekOne}
            disabled={busy || saving}
            onChange={(e) => {
              changed();
              setWeekOne(e.target.value);
            }}
          />
        </label>
        <label>
          学期结束日期
          <input
            type="date"
            value={termEnd}
            min={weekOne}
            disabled={busy || saving}
            onChange={(e) => {
              changed();
              setTermEnd(e.target.value);
            }}
          />
        </label>
      </div>
      <label className="form">
        全校停课日期
        <input
          aria-label="全校停课日期"
          disabled={busy || saving}
          placeholder="YYYY-MM-DD, YYYY-MM-DD"
          value={excluded}
          onChange={(e) => {
            changed();
            setExcluded(e.target.value);
          }}
        />
      </label>
      <div className="scope-tabs">
        <button
          className={view === "list" ? "active" : ""}
          onClick={() => setView("list")}
        >
          课程列表 · {lessons.length}
        </button>
        <button
          className={view === "week" ? "active" : ""}
          onClick={() => setView("week")}
        >
          周视图
        </button>
      </div>
      {view === "week" ? (
        <div>
          <label className="form">
            查看日期
            <input
              type="date"
              value={weekDate}
              onInput={(e) => setWeekDate(e.currentTarget.value)}
              onChange={(e) => setWeekDate(e.target.value)}
            />
          </label>
          <div className="week-grid">
            {dates.map((date, i) => {
              const d = weekdays[i];
              return (
                <section key={d}>
                  <strong>{d}</strong>
                  <small>{date.slice(5)}</small>
                  {weekOne &&
                    lessonsOn(draft.current, date).map((l) => (
                      <article className="week-lesson" key={l.id}>
                        <b>
                          {l.start}–{l.end}
                        </b>
                        <span>{l.title}</span>
                        <small>{l.room || "地点待确认"}</small>
                      </article>
                    ))}
                </section>
              );
            })}
          </div>
          {!dates.length && <p role="status">请选择有效的查看日期</p>}
        </div>
      ) : (
        <div className="lesson-list">
          {lessons.map((l, index) => (
            <details className="lesson-detail" key={l.id} open={!l.reviewed}>
              <summary>
                <span>{l.title || "新课程"}</span>
                <small>
                  {weekdays[l.day - 1] || "星期待校对"} · {l.start || "--:--"}–
                  {l.end || "--:--"}
                </small>
                <span className="status-tag">
                  {l.reviewed ? "已核对" : "待核对"}
                </span>
              </summary>
              <fieldset className="lesson-row" disabled={busy || saving}>
                <legend>课程 {index + 1}</legend>
                <label>
                  课程
                  <input
                    aria-label={"课程 " + (index + 1) + " 名称"}
                    value={l.title}
                    maxLength={150}
                    onChange={(e) => edit(l.id, { title: e.target.value })}
                  />
                </label>
                <div className="form-columns">
                  <label>
                    星期
                    <select
                      value={l.day}
                      onChange={(e) =>
                        edit(l.id, { day: Number(e.target.value) })
                      }
                    >
                      <option value={0}>待校对</option>
                      {weekdays.map((d, i) => (
                        <option value={i + 1} key={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    教室代码
                    <input
                      value={l.room}
                      maxLength={100}
                      placeholder="学校课表中的原始代码"
                      onChange={(e) => edit(l.id, { room: e.target.value })}
                    />
                  </label>
                </div>
                <div className="form-columns">
                  <label>
                    上课校区
                    <select
                      value={l.campus || ""}
                      onChange={(e) =>
                        edit(l.id, {
                          campus: (e.target.value || undefined) as
                            | Campus
                            | undefined,
                          locationId: undefined,
                        })
                      }
                    >
                      <option value="">待确认 / 线上</option>
                      <option value="SIP">SIP 校区</option>
                      <option value="TAICANG">XEC 校区</option>
                    </select>
                  </label>
                  <label>
                    实际下课出口
                    <select
                      value={l.locationId || ""}
                      onChange={(e) =>
                        edit(l.id, { locationId: e.target.value || undefined })
                      }
                    >
                      <option value="">尚未确定</option>
                      {places
                        .filter((p) => p.campus === l.campus)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>
                <div className="form-columns">
                  <label>
                    开始
                    <input
                      type="time"
                      value={l.start}
                      onChange={(e) => edit(l.id, { start: e.target.value })}
                    />
                  </label>
                  <label>
                    结束
                    <input
                      type="time"
                      value={l.end}
                      onChange={(e) => edit(l.id, { end: e.target.value })}
                    />
                  </label>
                </div>
                <label>
                  授课周次
                  <input
                    value={l.weeks}
                    maxLength={160}
                    placeholder="1-16 / 1-16单 / 1,3,5"
                    onChange={(e) => edit(l.id, { weeks: e.target.value })}
                  />
                </label>
                <details>
                  <summary>补课与停课</summary>
                  <label>
                    额外上课日期
                    <input
                      defaultValue={(l.dates || []).join(", ")}
                      placeholder="YYYY-MM-DD"
                      onBlur={(e) =>
                        edit(l.id, { dates: dateList(e.target.value) })
                      }
                    />
                  </label>
                  <label>
                    本课程停课日期
                    <input
                      defaultValue={(l.excludedDates || []).join(", ")}
                      placeholder="YYYY-MM-DD"
                      onBlur={(e) =>
                        edit(l.id, { excludedDates: dateList(e.target.value) })
                      }
                    />
                  </label>
                </details>
                {l.sourceText && (
                  <details>
                    <summary>
                      这条课程的识别原文
                      {l.confidence !== undefined
                        ? " · OCR " + Math.round(l.confidence) + "%"
                        : ""}
                    </summary>
                    <pre className="ocr-source">{l.sourceText}</pre>
                  </details>
                )}
                <div className="split">
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={!!l.reviewed}
                      onChange={(e) =>
                        edit(l.id, { reviewed: e.target.checked })
                      }
                    />
                    <Check size={14} /> 已核对课程、星期、时间、周次和地点
                  </label>
                  <button
                    type="button"
                    className="secondary"
                    aria-label={"删除课程 " + (index + 1)}
                    title="删除这条课程"
                    onClick={() => {
                      changed();
                      setLessons((ls) => ls.filter((x) => x.id !== l.id));
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </fieldset>
            </details>
          ))}
        </div>
      )}
      <p className="privacy-note">
        原文件和识别原文仅在本机处理。仅保存你确认的课程与日期；其他用户看不到你的课表。
      </p>
      <div className="schedule-tools">
        <button
          type="button"
          className="primary"
          disabled={!ready || busy || saving}
          onClick={() => void save()}
        >
          <Save size={16} /> {saving ? "保存中" : "确认并启用匹配"}
        </button>
        <button
          type="button"
          className="secondary"
          disabled={busy || saving}
          onClick={() => void clear()}
        >
          <Trash2 size={16} /> 删除课表
        </button>
      </div>
      {message && (
        <p role="status" className="schedule-status">
          {message}
        </p>
      )}
    </section>
  );
}
