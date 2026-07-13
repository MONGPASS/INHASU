import test from "node:test";
import assert from "node:assert/strict";
import { WORKFLOW, workflowStatus, defaultQuoteExpiry, isQuoteExpired } from "../functions/api/_workflow.mjs";

test("workflow follows the customer booking sequence", () => {
  const rec = {};
  assert.equal(workflowStatus(rec), WORKFLOW.REQUESTED);
  rec.quote = {};
  assert.equal(workflowStatus(rec), WORKFLOW.QUOTE_SENT);
  rec.decision = { status:"accepted" };
  assert.equal(workflowStatus(rec), WORKFLOW.QUOTE_ACCEPTED);
  rec.booking = { contract:null, contractInfo:{ depositStatus:"미입금" }, publishStatus:"draft" };
  assert.equal(workflowStatus(rec), WORKFLOW.BOOKING_PREPARED);
  rec.booking.depositRequest = { status:"requested" };
  assert.equal(workflowStatus(rec), WORKFLOW.DEPOSIT_REQUESTED);
  rec.booking.contractInfo.depositStatus = "입금완료";
  assert.equal(workflowStatus(rec), WORKFLOW.DEPOSIT_PAID);
  rec.booking.contract = { signedAt:"2026-07-13" };
  assert.equal(workflowStatus(rec), WORKFLOW.CONTRACT_SIGNED);
  rec.status = "예약확정";
  assert.equal(workflowStatus(rec), WORKFLOW.BOOKING_CONFIRMED);
  rec.booking.publishStatus = "published";
  assert.equal(workflowStatus(rec), WORKFLOW.ITINERARY_PUBLISHED);
});

test("quote expiry defaults to seven days and blocks past quotes", () => {
  const now = new Date("2026-07-13T00:00:00Z");
  assert.equal(defaultQuoteExpiry(now), "2026-07-20T00:00:00.000Z");
  assert.equal(isQuoteExpired({ quoteExpiresAt:"2026-07-12T23:59:59Z" }, now), true);
  assert.equal(isQuoteExpired({ quoteExpiresAt:"2026-07-14T00:00:00Z" }, now), false);
});
