import { validDate } from "./timetable";
export function parseBookingTime(value: string) {
  const parts =
    /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|([+-])(\d{2}):(\d{2}))$/.exec(
      value,
    );
  if (
    !parts ||
    !validDate(parts[1]) ||
    Number(parts[2]) > 23 ||
    Number(parts[3]) > 59 ||
    Number(parts[4]) > 59 ||
    (parts[6] &&
      (Number(parts[7]) > 14 ||
        Number(parts[8]) > 59 ||
        (Number(parts[7]) === 14 && Number(parts[8]) !== 0)))
  )
    return NaN;
  return Date.parse(value);
}
