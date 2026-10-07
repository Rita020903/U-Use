type Validator = (value: unknown) => boolean;
export type Submission = { requestId: string; payload: string };
export function restoreSubmission(raw: string): Submission | undefined {
  const s = JSON.parse(raw)?.submission;
  return s &&
    typeof s.requestId === "string" &&
    /^[a-f0-9-]{36}$/i.test(s.requestId) &&
    typeof s.payload === "string"
    ? s
    : undefined;
}
export function submissionFor(
  payload: string,
  previous?: Submission,
): Submission {
  return previous?.payload === payload
    ? previous
    : { requestId: crypto.randomUUID(), payload };
}
export function restoreFields<T extends object>(
  raw: string,
  defaults: T,
  validators: Partial<Record<keyof T, Validator>> = {},
): T {
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new Error("草稿格式损坏");
  const fields = parsed as Record<string, unknown>,
    result = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof T)[]) {
    if (!Object.hasOwn(fields, key)) continue;
    const value = fields[key as string],
      initial = defaults[key],
      validate = validators[key];
    if (
      validate
        ? !validate(value)
        : typeof value !== typeof initial ||
          (typeof value === "number" && !Number.isFinite(value))
    )
      throw new Error("草稿格式损坏");
    result[key] = value as T[keyof T];
  }
  return result;
}
export const strings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((s) => typeof s === "string");
export const coordinates = (value: unknown) => {
  if (value === undefined) return true;
  if (!value || typeof value !== "object") return false;
  const p = value as { lat: number; lng: number };
  return (
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    Math.abs(p.lat) <= 90 &&
    Math.abs(p.lng) <= 180
  );
};
