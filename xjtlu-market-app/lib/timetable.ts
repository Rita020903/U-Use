import { Campus } from "./types";
import { placeFor } from "./places";
export type Lesson = {
  id: string;
  title: string;
  day: number;
  start: string;
  end: string;
  room: string;
  weeks: string;
  campus?: Campus;
  locationId?: string;
  reviewed?: boolean;
  sourceText?: string;
  confidence?: number;
  dates?: string[];
  excludedDates?: string[];
};
export type Timetable = {
  weekOne: string;
  lessons: Lesson[];
  termEnd?: string;
  excludedDates?: string[];
};
export function isTimetableDraft(value: unknown): value is Timetable {
  if (!value || typeof value !== "object") return false;
  const t = value as Timetable;
  const dates = (v: unknown) =>
    v === undefined ||
    (Array.isArray(v) && v.every((s) => typeof s === "string"));
  return (
    typeof t.weekOne === "string" &&
    (t.termEnd === undefined || typeof t.termEnd === "string") &&
    dates(t.excludedDates) &&
    Array.isArray(t.lessons) &&
    t.lessons.length <= 200 &&
    t.lessons.every(
      (l) =>
        !!l &&
        typeof l === "object" &&
        [l.id, l.title, l.start, l.end, l.room, l.weeks].every(
          (s) => typeof s === "string",
        ) &&
        Number.isInteger(l.day) &&
        l.day >= 0 &&
        l.day <= 7 &&
        dates(l.dates) &&
        dates(l.excludedDates) &&
        (l.reviewed === undefined || typeof l.reviewed === "boolean") &&
        (l.campus === undefined ||
          l.campus === "SIP" ||
          l.campus === "TAICANG") &&
        (l.locationId === undefined || typeof l.locationId === "string") &&
        (l.sourceText === undefined || typeof l.sourceText === "string") &&
        (l.confidence === undefined || Number.isFinite(l.confidence)),
    )
  );
}
export function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(value + "T00:00:00Z");
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
export function weekDates(value: string) {
  if (!validDate(value)) return [];
  const monday = new Date(value + "T00:00:00Z");
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, day) =>
    new Date(monday.getTime() + day * 86400000).toISOString().slice(0, 10),
  );
}
export const weekdays = [
  "周一",
  "周二",
  "周三",
  "周四",
  "周五",
  "周六",
  "周日",
];
export function minutes(value: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return NaN;
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}
export function parseWeeks(value: string): number[] {
  const normalized = value
    .replace(/[–—−~至]/g, "-")
    .replace(/[，、]/g, ",")
    .replace(/第|周/g, "")
    .replace(/\s/g, "");
  const odd = /单/.test(normalized),
    even = /双/.test(normalized),
    range = normalized.replace(/[单双()（）]/g, "");
  if ((odd && even) || !/^\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*$/.test(range))
    return [];
  const result = new Set<number>();
  for (const part of range.split(",")) {
    const [a, b = a] = part.split("-").map(Number);
    if (a < 1 || b > 53 || b < a) return [];
    for (let n = a; n <= b; n++) result.add(n);
  }
  return [...result]
    .filter((n) => (odd ? n % 2 === 1 : even ? n % 2 === 0 : true))
    .sort((a, b) => a - b);
}
export function validWeekOne(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return (
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value &&
    date.getUTCDay() === 1
  );
}
export function validateTimetable(value: unknown): value is Timetable {
  const t = value as Timetable;
  return (
    !!t &&
    validWeekOne(t.weekOne) &&
    Array.isArray(t.lessons) &&
    t.lessons.length <= 200 &&
    (t.lessons.length > 0 || !!t.termEnd) &&
    (t.termEnd === undefined ||
      (validDate(t.termEnd) && t.termEnd >= t.weekOne)) &&
    (t.excludedDates === undefined ||
      (Array.isArray(t.excludedDates) &&
        t.excludedDates.length <= 100 &&
        t.excludedDates.every(validDate))) &&
    new Set(t.lessons.map((l) => l?.id)).size === t.lessons.length &&
    t.lessons.every(
      (l) =>
        l &&
        typeof l.id === "string" &&
        l.id.length > 0 &&
        l.id.length <= 100 &&
        l.reviewed === true &&
        typeof l.title === "string" &&
        !!l.title.trim() &&
        l.title.length <= 150 &&
        Number.isInteger(l.day) &&
        l.day >= 1 &&
        l.day <= 7 &&
        typeof l.start === "string" &&
        typeof l.end === "string" &&
        minutes(l.start) < minutes(l.end) &&
        typeof l.room === "string" &&
        l.room.length <= 100 &&
        typeof l.weeks === "string" &&
        l.weeks.length <= 160 &&
        (parseWeeks(l.weeks).length > 0 ||
          (Array.isArray(l.dates) && l.dates.length > 0)) &&
        (l.dates === undefined ||
          (Array.isArray(l.dates) &&
            l.dates.length <= 100 &&
            l.dates.every(validDate))) &&
        (l.excludedDates === undefined ||
          (Array.isArray(l.excludedDates) &&
            l.excludedDates.length <= 100 &&
            l.excludedDates.every(validDate))) &&
        (l.campus === undefined || ["SIP", "TAICANG"].includes(l.campus)) &&
        (l.locationId === undefined ||
          (!!placeFor(l.locationId) &&
            (!l.campus || placeFor(l.locationId)?.campus === l.campus))),
    )
  );
}
export function parseLesson(text: string, day: number): Lesson {
  const normalized = text.replace(/[–—−~至]/g, "-");
  const times = normalized.match(
    /([0-2]?\d)[:.]([0-5]\d)\s*(?:-\s*)+([0-2]?\d)[:.]([0-5]\d)/,
  );
  const room =
    normalized
      .match(
        /(?:TC|SIP)\s*-\s*[A-Z]{1,3}\s*-\s*\d{3,5}|(?:Room|教室|地点)\s*[:：]?\s*([A-Z]{1,4}[- ]?\d{2,5}|[^\n,，]{2,25})/i,
      )?.[0]
      .replace(/^(?:Room|教室|地点)\s*[:：]?\s*/i, "")
      .replace(/\s/g, "")
      .toUpperCase() || "";
  const weeks =
    normalized
      .match(
        /(?:Weeks?|授课周次|周次)[ \t]*[:：][ \t]*([\d,，、 \t\-单双()（）周]+)/i,
      )?.[1]
      ?.trim()
      .replace(/\s/g, "") || "";
  const title =
    normalized
      .split("\n")
      .map((s) => s.trim())
      .find(
        (s) => /[A-Z]{2,6}\s*\d{2,5}/i.test(s) && !/^(Room|教室|地点)/i.test(s),
      ) ||
    normalized
      .split("\n")
      .map((s) => s.trim())
      .find(
        (s) =>
          s.length > 1 &&
          !/^(Week|周次|授课周次|教室|Room|\d{1,2}[:.]|周[一二三四五六日天]|星期[一二三四五六日天]|(?:MON|TUE|WED|THU|FRI|SAT|SUN)(?:DAY|SDAY|NESDAY|RSDAY|URDAY)?\s*$)/i.test(
            s,
          ),
      ) ||
    "";
  return {
    id: crypto.randomUUID(),
    title,
    day: day || parseWeekday(normalized),
    room,
    weeks,
    start: times ? times[1].padStart(2, "0") + ":" + times[2] : "",
    end: times ? times[3].padStart(2, "0") + ":" + times[4] : "",
    campus: room.startsWith("TC-")
      ? "TAICANG"
      : room.startsWith("SIP-")
        ? "SIP"
        : undefined,
    reviewed: false,
    sourceText: normalized.slice(0, 2000),
  };
}
export function parseWeekday(text: string) {
  const chinese = text.match(/(?:星期|周)([一二三四五六日天])/);
  if (chinese)
    return "一二三四五六日".indexOf(chinese[1].replace("天", "日")) + 1;
  const english = text.match(
    /\b(mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b/i,
  );
  return english
    ? ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].indexOf(
        english[1].slice(0, 3).toLowerCase(),
      ) + 1
    : 0;
}
export function lessonsOn(t: Timetable, date: string) {
  if (t.excludedDates?.includes(date) || (t.termEnd && date > t.termEnd))
    return [];
  const day = new Date(date + "T00:00:00Z");
  const week =
    Math.floor(
      (day.getTime() - new Date(t.weekOne + "T00:00:00Z").getTime()) /
        604800000,
    ) + 1;
  const weekday = ((day.getUTCDay() + 6) % 7) + 1;
  return t.lessons.filter(
    (l) =>
      !l.excludedDates?.includes(date) &&
      (l.dates?.includes(date) ||
        (l.day === weekday && parseWeeks(l.weeks).includes(week))),
  );
}
export function timetableConflict(
  t: Timetable,
  instant: string,
  duration = 15,
  campus?: string,
  building?: string,
) {
  const local = new Date(Date.parse(instant) + 8 * 3600000);
  if (!Number.isFinite(local.getTime())) return true;
  const date = local.toISOString().slice(0, 10);
  const start = local.getUTCHours() * 60 + local.getUTCMinutes();
  const days = [-1, 0, 1].flatMap((offset) => {
    const d = new Date(local.getTime() + offset * 86400000)
      .toISOString()
      .slice(0, 10);
    return lessonsOn(t, d).map((l) => ({ l, offset }));
  });
  return days.some(({ l, offset }) => {
    const selected = placeFor(l.locationId);
    const roomCampus =
      l.campus ||
      selected?.campus ||
      (l.room.startsWith("TC-")
        ? "TAICANG"
        : l.room.startsWith("SIP-")
          ? "SIP"
          : undefined);
    const roomBuilding = selected?.building || l.room.split("-")[1];
    // Conservative buffers, not a claim about shuttle or walking schedules.
    const buffer =
      campus && (!roomCampus || roomCampus !== campus)
        ? 90
        : building && roomBuilding && roomBuilding !== building
          ? 25
          : 15;
    return (
      start < offset * 1440 + minutes(l.end) + buffer &&
      start + duration > offset * 1440 + minutes(l.start) - buffer
    );
  });
}
export function timetableCovers(t: Timetable, date: string) {
  if (date < t.weekOne || (t.termEnd && date > t.termEnd)) return false;
  const week =
    Math.floor(
      (Date.parse(date + "T00:00:00Z") - Date.parse(t.weekOne + "T00:00:00Z")) /
        604800000,
    ) + 1;
  return (
    !!t.termEnd ||
    t.lessons.some(
      (l) =>
        parseWeeks(l.weeks).some((w) => w >= week) ||
        l.dates?.some((d) => d >= date),
    )
  );
}
export function normalizedTimetable(t: Timetable): Timetable {
  return {
    weekOne: t.weekOne,
    termEnd: t.termEnd,
    excludedDates: t.excludedDates,
    lessons: t.lessons.map((l) => ({
      id: l.id,
      title: l.title.trim(),
      day: l.day,
      start: l.start,
      end: l.end,
      room: l.room.trim(),
      weeks: l.weeks,
      campus: l.campus,
      locationId: l.locationId,
      reviewed: l.reviewed,
      dates: l.dates,
      excludedDates: l.excludedDates,
    })),
  };
}
