import { Lesson, parseLesson, parseWeekday } from "./timetable";
export function parseTimetableText(source: string): Lesson[] {
  const lines = source
    .replace(/\r/g, "")
    .split("\n")
    .map((s) => s.trim());
  const blocks: { lines: string[]; day: number }[] = [];
  let day = 0,
    current: { lines: string[]; day: number } = { lines: [], day: 0 };
  const flush = () => {
    if (current.lines.length) blocks.push(current);
    current = { lines: [], day };
  };
  for (const line of lines) {
    const hasTime = () =>
      current.lines.some((s) => /\d{1,2}[:.]\d{2}\s*[-–—~至]/.test(s));
    if (!line) {
      if (hasTime()) flush();
      continue;
    }
    const weekday = parseWeekday(line);
    if (
      weekday &&
      /^(?:MON(?:DAY)?|TUE(?:SDAY)?|WED(?:NESDAY)?|THU(?:RSDAY)?|FRI(?:DAY)?|SAT(?:URDAY)?|SUN(?:DAY)?|(?:周|星期)[一二三四五六日天])\s*[:：]?$/i.test(
        line,
      )
    ) {
      flush();
      day = weekday;
      current.day = day;
      continue;
    }
    const course =
      /^[A-Z]{2,6}\s*\d{2,5}(?:[A-Z]{0,3})\b/i.test(line) &&
      !/^(?:TC|SIP)[- ]/.test(line);
    const metadata =
      /^(?:Weeks?|授课周次|周次|Room|教室|地点|Teacher|教师|讲师|TC[- ]|SIP[- ])\b|^(?:授课周次|周次|教室|地点|教师|讲师)/i.test(
        line,
      );
    if (
      hasTime() &&
      (course ||
        /\d{1,2}[:.]\d{2}\s*[-–—~至]/.test(line) ||
        (!metadata &&
          current.lines.some((s) => /(?:Weeks?|周次)\s*[:：]/i.test(s))))
    )
      flush();
    current.lines.push(line);
  }
  flush();
  return blocks
    .map((b) => parseLesson(b.lines.join("\n"), b.day))
    .filter((l) => l.start || l.end);
}
export type PositionedText = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
};
export function weekdayAt(x: number, headers: PositionedText[]) {
  const days = headers
    .map((h) => ({ day: parseWeekday(h.text), x: h.x + h.width / 2 }))
    .filter((h) => h.day);
  if (!days.length) return 0;
  return days.sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x))[0].day;
}
export function positionedLines(items: PositionedText[]) {
  const rows: { y: number; items: PositionedText[] }[] = [];
  for (const item of [...items].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const row = rows.find(
      (r) => Math.abs(r.y - item.y) <= Math.max(3, item.height * 0.45),
    );
    if (row) row.items.push(item);
    else rows.push({ y: item.y, items: [item] });
  }
  return rows
    .sort((a, b) => a.y - b.y)
    .map((r) =>
      r.items
        .sort((a, b) => a.x - b.x)
        .map((i) => i.text)
        .join(" "),
    )
    .join("\n");
}
