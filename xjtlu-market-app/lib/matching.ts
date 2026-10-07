import { Product, Booking, Campus } from "./types";
import { places, placeFor } from "./places";
import {
  Timetable,
  timetableConflict,
  lessonsOn,
  minutes,
  timetableCovers,
} from "./timetable";
import { occupiedProduct, meetingConflict } from "./booking-rules";
export type Recommendation = {
  time: string;
  returnTime?: string;
  spot: string;
  locationId: string;
  campus: Campus;
  reason: string;
  mutual: boolean;
};
type Options = {
  personId?: string;
  campus?: Campus;
  currentCampus?: Campus;
  returnAfterHours?: number;
};
export function recommendations(
  product: Product,
  own: Timetable,
  other: Timetable | undefined,
  bookings: Booking[],
  now = Date.now(),
  options: Options = {},
): Recommendation[] {
  const candidates: (Recommendation & { score: number })[] = [],
    campus = options.campus || product.campus;
  if (campus !== product.campus && !product.crossCampus) return [];
  const preferred = placeFor(product.locationId);
  const handoffPoints =
    campus === product.campus
      ? [
          {
            id: product.locationId || "",
            label: product.spot,
            building: preferred?.building || "",
            campus,
          },
        ]
      : places.filter((p) => p.campus === campus);
  const lead =
    (!options.currentCampus || options.currentCampus !== campus ? 90 : 30) *
    60000;
  for (let offset = 0; offset < 14; offset++) {
    const date = new Date(now + 8 * 3600000 + offset * 86400000)
      .toISOString()
      .slice(0, 10);
    if (
      date < product.availableFrom ||
      date > product.availableTo ||
      !timetableCovers(own, date) ||
      (other && !timetableCovers(other, date))
    )
      continue;
    const lessons = lessonsOn(own, date);
    for (let m = 9 * 60; m <= 20 * 60; m += 15) {
      const time =
        date +
        "T" +
        String(Math.floor(m / 60)).padStart(2, "0") +
        ":" +
        String(m % 60).padStart(2, "0") +
        ":00+08:00";
      const start = Date.parse(time);
      if (start < now + lead) continue;
      const end = product.returnRequired
        ? start + (options.returnAfterHours || 24) * 3600000
        : start;
      const returnTime =
          new Date(end + 8 * 3600000).toISOString().slice(0, 19) + "+08:00",
        returnDate = returnTime.slice(0, 10);
      if (
        returnDate > product.availableTo ||
        (product.returnRequired &&
          (!timetableCovers(own, returnDate) ||
            (other && !timetableCovers(other, returnDate))))
      )
        continue;
      if (
        bookings.some((b) =>
          occupiedProduct(
            b,
            product.id,
            start,
            end,
            !product.returnRequired,
            now,
          ),
        )
      )
        continue;
      const ids = [options.personId || "", product.ownerId || ""];
      if (
        [time, ...(product.returnRequired ? [returnTime] : [])].some((t) =>
          meetingConflict(bookings, ids, t, campus),
        )
      )
        continue;
      for (const place of handoffPoints) {
        if (
          [time, ...(product.returnRequired ? [returnTime] : [])].some(
            (t) =>
              timetableConflict(own, t, 15, campus, place.building) ||
              (other &&
                timetableConflict(other, t, 15, campus, place.building)),
          )
        )
          continue;
        const nearLesson = lessons.find(
          (l) =>
            m - minutes(l.end) >= 15 &&
            m - minutes(l.end) <= 90 &&
            !!l.locationId &&
            l.locationId === place.id,
        );
        candidates.push({
          time,
          returnTime: product.returnRequired ? returnTime : undefined,
          campus,
          locationId: place.id,
          spot: place.label,
          mutual: !!other,
          score:
            offset * 100 + (nearLesson ? -10 : 0) + Math.abs(m - 13 * 60) / 60,
          reason: nearLesson
            ? "已核对的下课出口；避开双方课表与交易安排"
            : campus === product.campus
              ? "发布者约定的交付点；避开课表与交易安排"
              : "跨校区备选公共地点，须发布者同意",
        });
      }
    }
  }
  const selected: Recommendation[] = [];
  for (const { score: _, ...candidate } of candidates.sort(
    (a, b) => a.score - b.score,
  )) {
    if (
      selected.some(
        (s) =>
          Math.abs(Date.parse(s.time) - Date.parse(candidate.time)) < 3600000,
      )
    )
      continue;
    selected.push(candidate);
    if (selected.length === 4) break;
  }
  return selected;
}
