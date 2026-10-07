import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { testRuntime } from "./test-runtime.mjs";
const t = await testRuntime(),
  {
    parseWeeks,
    parseLesson,
    validateTimetable,
    lessonsOn,
    timetableConflict,
    timetableCovers,
    normalizedTimetable,
    weekDates,
  } = t.load("timetable"),
  { parseTimetableText, weekdayAt } = t.load("timetable-text"),
  { detectCourseBoxes } = t.load("timetable-grid"),
  { recommendations } = t.load("matching");
try {
  for (const bad of ["", "not-a-date", "2026-02-30", "2026-10-"])
    assert.deepEqual(
      weekDates(bad),
      [],
      "invalid date must not crash the weekly view",
    );
  assert.deepEqual(weekDates("2026-10-06"), [
    "2026-10-05",
    "2026-10-06",
    "2026-10-07",
    "2026-10-08",
    "2026-10-09",
    "2026-10-10",
    "2026-10-11",
  ]);
  assert.equal(weekDates("2027-01-01")[0], "2026-12-28");
  assert.deepEqual(parseWeeks("第1至8周（单）"), [1, 3, 5, 7]);
  assert.deepEqual(parseWeeks("2-10双"), [2, 4, 6, 8, 10]);
  assert.deepEqual(
    parseWeeks("1–3, 4–13"),
    Array.from({ length: 13 }, (_, i) => i + 1),
  );
  for (const bad of ["", "all", "0", "1-99", "7-1", "1,", "NaN", "1-16单双"])
    assert.deepEqual(parseWeeks(bad), []);
  const rows = parseTimetableText(
    "MONDAY\nBIO101-Lab\nRoom: A-1001\nWeek: 1-16\n08:00 - 10:00\nBIO102-Lecture\nWeek: 1-16单\n10:30 - 12:00\n星期六\n高等数学\n周次：1-16双\n教室：D-2001\n14:00 - 15:50\n创新设计\n周次：3,5,7\n16:00 - 17:30",
  );
  assert.equal(rows.length, 4);
  assert.deepEqual(
    rows.map((l) => l.day),
    [1, 1, 6, 6],
  );
  assert.equal(rows[2].title, "高等数学");
  assert.equal(rows[3].title, "创新设计");
  assert(rows.every((l) => !l.reviewed));
  const table = {
    weekOne: "2026-08-31",
    termEnd: "2026-12-31",
    lessons: rows.map((l) => ({ ...l, reviewed: true })),
  };
  assert(validateTimetable(table));
  assert(!validateTimetable({ ...table, lessons: rows }));
  assert(
    !validateTimetable({
      ...table,
      weekOne: "2026-09-07",
      termEnd: "2026-09-01",
    }),
  );
  const sample = parseLesson(
    "ENT303TC-Practical-D1/4\nKai Liu\nTC-C-2012\nWeek: 1-3, 4-10\n09:00 - 12:50",
    4,
  );
  assert.equal(sample.room, "TC-C-2012");
  assert.equal(sample.weeks, "1-3,4-10");
  assert(!sample.reviewed);
  const unusual = {
    weekOne: "2026-08-31",
    termEnd: "2027-01-01",
    excludedDates: ["2026-09-14"],
    lessons: [
      {
        ...sample,
        id: "odd",
        day: 1,
        weeks: "1-16单",
        reviewed: true,
        dates: ["2026-09-08"],
        excludedDates: ["2026-09-28"],
      },
    ],
  };
  assert.equal(lessonsOn(unusual, "2026-09-07").length, 0);
  assert.equal(lessonsOn(unusual, "2026-09-08").length, 1);
  assert.equal(lessonsOn(unusual, "2026-09-14").length, 0);
  assert.equal(lessonsOn(unusual, "2026-09-28").length, 0);
  assert(timetableCovers(unusual, "2026-12-25"));
  assert(!timetableCovers(unusual, "2027-01-02"));
  assert(
    timetableConflict(unusual, "2026-09-08T10:00:00+08:00", 15, "TAICANG", "C"),
  );
  assert(
    timetableConflict(unusual, "2026-09-08T13:30:00+08:00", 15, "SIP", "CB"),
  );
  assert(
    !timetableConflict(
      unusual,
      "2026-09-08T13:15:00+08:00",
      15,
      "TAICANG",
      "C",
    ),
  );
  assert.equal(
    normalizedTimetable({
      ...unusual,
      lessons: [
        {
          ...unusual.lessons[0],
          sourceText: "private raw OCR",
          confidence: 80,
          extra: "discard",
        },
      ],
    }).lessons[0].sourceText,
    undefined,
  );
  const a = { weekOne: "2026-08-31", termEnd: "2026-12-31", lessons: [] },
    b = {
      weekOne: "2026-09-14",
      termEnd: "2026-12-31",
      lessons: [
        {
          id: "other",
          title: "Different year",
          day: 2,
          start: "09:00",
          end: "11:00",
          room: "TC-G-1010",
          weeks: "1-12",
          reviewed: true,
        },
      ],
    };
  const product = {
    id: "real",
    ownerId: "seller",
    campus: "TAICANG",
    spot: "校外学生公寓 115 号公共入口",
    locationId: "tc-residence-115",
    returnRequired: true,
    crossCampus: false,
    availableFrom: "2026-09-01",
    availableTo: "2026-12-31",
  };
  const suggestions = recommendations(
    product,
    a,
    b,
    [],
    Date.parse("2026-09-15T08:00:00+08:00"),
    { personId: "buyer", returnAfterHours: 48, currentCampus: "TAICANG" },
  );
  assert(suggestions.length > 0);
  assert(
    suggestions.every(
      (s) =>
        s.spot === product.spot &&
        s.mutual &&
        Date.parse(s.returnTime) - Date.parse(s.time) === 48 * 3600000,
    ),
  );
  assert(
    recommendations(
      product,
      a,
      b,
      [],
      Date.parse("2026-09-01T08:00:00+08:00"),
    ).every((s) => s.time.slice(0, 10) >= b.weekOne),
    "unknown seller semester is not assumed free",
  );
  assert.equal(
    weekdayAt(180, [
      { text: "周三", x: 150, width: 60, y: 0, height: 10 },
      { text: "FRI", x: 250, width: 60, y: 0, height: 10 },
    ]),
    3,
  );
  const w = 800,
    h = 650,
    pixels = new Uint8ClampedArray(w * h * 4).fill(255),
    paint = (x, y, width, height, c) => {
      for (let dy = y; dy < y + height; dy++)
        for (let dx = x; dx < x + width; dx++)
          pixels.set([...c, 255], (dy * w + dx) * 4);
    };
  paint(0, 0, w, 30, [190, 190, 190]);
  for (const x of [0, 60, 180, 300, 420, 660, 799])
    paint(x, 0, 1, 30, [10, 10, 10]);
  for (const y of [150, 300, 430]) paint(62, y, 116, 124, [150, 220, 235]);
  paint(422, 32, 116, 240, [255, 166, 60]);
  paint(542, 150, 116, 124, [150, 220, 235]);
  paint(662, 150, 135, 124, [160, 193, 245]);
  paint(662, 350, 135, 124, [233, 195, 247]);
  assert.equal(detectCourseBoxes(pixels, w, h).length, 7);
  if (process.argv[2]) {
    const require = createRequire(import.meta.url),
      sharp = require("sharp"),
      { createWorker, PSM } = require("tesseract.js"),
      file = process.argv[2],
      meta = await sharp(file).metadata();
    const { data, info } = await sharp(file)
      .resize({ width: Math.min(1000, meta.width) })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const boxes = detectCourseBoxes(
      new Uint8ClampedArray(data),
      info.width,
      info.height,
    );
    assert.equal(
      boxes.length,
      7,
      "example is a regression fixture, not a required course count",
    );
    const worker = await createWorker("eng+chi_sim", 1, {
      langPath: path.resolve("public/vendor"),
      cacheMethod: "none",
    });
    try {
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
      const lessons = [];
      for (const box of boxes) {
        const r = meta.width / info.width,
          png = await sharp(file)
            .extract({
              left: Math.floor(box.x * r),
              top: Math.floor(box.y * r),
              width: Math.floor(box.width * r),
              height: Math.floor(box.height * r),
            })
            .png()
            .toBuffer();
        const result = await worker.recognize(png);
        lessons.push({
          ...parseLesson(result.data.text, box.day),
          reviewed: true,
        });
      }
      assert(validateTimetable({ weekOne: "2026-09-07", lessons }));
      assert.equal(
        lessons.find((l) => l.title.startsWith("ENT303TC"))?.end,
        "12:50",
      );
      console.log("PASS: real screenshot bilingual OCR regression");
    } finally {
      await worker.terminate();
    }
  }
  console.log(
    "PASS: arbitrary course names/counts/days, Chinese/English, independent terms, odd/even weeks, cancellations and makeups, confirmation, privacy, off-campus matching",
  );
} finally {
  await t.cleanup();
}
