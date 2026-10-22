export const TIME_ZONE = "America/Santiago";
export function dateKey(value: Date | string = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export const chileTime = (utc: string) =>
  new Intl.DateTimeFormat("es-CL", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(utc));
export function shiftDate(day: string, offset: number): string {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}
export function dayLabel(day: string, today = dateKey()): string {
  return day === today
    ? "Hoy"
    : day === shiftDate(today, -1)
      ? "Ayer"
      : day === shiftDate(today, 1)
        ? "Mañana"
        : new Intl.DateTimeFormat("es-CL", {
            day: "numeric",
            month: "long",
            timeZone: TIME_ZONE,
          }).format(new Date(day + "T12:00:00Z"));
}
export const longDate = (day: string) =>
  new Intl.DateTimeFormat("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: TIME_ZONE,
  }).format(new Date(day + "T12:00:00Z"));
