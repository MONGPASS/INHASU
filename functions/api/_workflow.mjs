export const WORKFLOW = Object.freeze({
  REQUESTED: "REQUESTED",
  QUOTE_SENT: "QUOTE_SENT",
  QUOTE_ACCEPTED: "QUOTE_ACCEPTED",
  CONTRACT_SIGNED: "CONTRACT_SIGNED",
  DEPOSIT_PAID: "DEPOSIT_PAID",
  BOOKING_CONFIRMED: "BOOKING_CONFIRMED",
  ITINERARY_PUBLISHED: "ITINERARY_PUBLISHED",
  TRIP_COMPLETED: "TRIP_COMPLETED",
});

export function workflowStatus(rec = {}, rowStatus = "") {
  const booking = rec.booking || {};
  if (rowStatus === "완료" || rec.status === "완료") return WORKFLOW.TRIP_COMPLETED;
  if (booking.publishStatus === "published") return WORKFLOW.ITINERARY_PUBLISHED;
  if (rowStatus === "예약확정" || rec.status === "예약확정") return WORKFLOW.BOOKING_CONFIRMED;
  if (booking.contractInfo && booking.contractInfo.depositStatus === "입금완료") return WORKFLOW.DEPOSIT_PAID;
  if (booking.contract && booking.contract.signedAt) return WORKFLOW.CONTRACT_SIGNED;
  if (rec.decision && rec.decision.status === "accepted") return WORKFLOW.QUOTE_ACCEPTED;
  if (rec.quote) return WORKFLOW.QUOTE_SENT;
  return WORKFLOW.REQUESTED;
}

export function quoteExpiry(rec = {}) {
  return rec.quoteExpiresAt || (rec.quote && rec.quote.expiresAt) || "";
}

export function isQuoteExpired(rec = {}, now = new Date()) {
  const value = quoteExpiry(rec);
  if (!value) return false;
  const end = new Date(value);
  return !Number.isNaN(end.getTime()) && end.getTime() < now.getTime();
}

export function defaultQuoteExpiry(now = new Date(), days = 7) {
  return new Date(now.getTime() + days * 86400000).toISOString();
}
