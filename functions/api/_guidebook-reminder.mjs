const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

export function isIsoDate(value) {
  const text = String(value || "");
  if (!DATE_RE.test(text)) return false;
  const [year, month, day] = text.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function kstDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const value = type => parts.find(part => part.type === type)?.value || "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function calendarDaysBetween(from, to) {
  if (!isIsoDate(from) || !isIsoDate(to)) return null;
  const utc = value => {
    const [year, month, day] = value.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((utc(to) - utc(from)) / DAY_MS);
}

export function guidebookEligibility(rec, rowStatus, today, windowDays = 7) {
  const status = rowStatus || rec?.status || "";
  if (status !== "예약확정") return { eligible:false, reason:"not_confirmed" };
  if (!isIsoDate(today)) return { eligible:false, reason:"invalid_today" };
  if (!isIsoDate(rec?.depart)) return { eligible:false, reason:"invalid_departure" };

  const daysUntil = calendarDaysBetween(today, rec.depart);
  if (daysUntil < 0) return { eligible:false, reason:"already_departed", daysUntil };
  if (daysUntil > windowDays) return { eligible:false, reason:"too_early", daysUntil };

  const notify = rec.notify && typeof rec.notify === "object" ? rec.notify : {};
  if (notify.guidebookDepartureDate === rec.depart && notify.guidebookSentAt) {
    return { eligible:false, reason:"already_sent", daysUntil };
  }
  if (notify.guidebookClaimDepartureDate === rec.depart && notify.guidebookClaimedAt) {
    const claimedAt = Date.parse(notify.guidebookClaimedAt);
    if (Number.isFinite(claimedAt) && Date.now() - claimedAt < 15 * 60 * 1000) {
      return { eligible:false, reason:"sending", daysUntil };
    }
  }
  return { eligible:true, reason:daysUntil === windowDays ? "due" : "retry_due", daysUntil };
}
