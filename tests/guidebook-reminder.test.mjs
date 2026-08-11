import test from "node:test";
import assert from "node:assert/strict";
import {
  calendarDaysBetween, guidebookEligibility, isIsoDate, kstDateString,
} from "../functions/api/_guidebook-reminder.mjs";

test("날짜 검증과 한국 기준 날짜 계산", () => {
  assert.equal(isIsoDate("2026-02-29"), false);
  assert.equal(isIsoDate("2028-02-29"), true);
  assert.equal(calendarDaysBetween("2026-08-11", "2026-08-18"), 7);
  assert.equal(kstDateString(new Date("2026-08-10T15:30:00Z")), "2026-08-11");
});

test("예약확정 고객은 출발 7일 전 대상이 된다", () => {
  const rec = { status:"예약확정", depart:"2026-08-18", phone:"01012345678" };
  assert.deepEqual(guidebookEligibility(rec, "예약확정", "2026-08-11"), {
    eligible:true, reason:"due", daysUntil:7,
  });
});

test("일시 실패를 재시도하도록 7일 이내의 미발송 예약도 대상이다", () => {
  const rec = { status:"예약확정", depart:"2026-08-16" };
  assert.deepEqual(guidebookEligibility(rec, "예약확정", "2026-08-11"), {
    eligible:true, reason:"retry_due", daysUntil:5,
  });
});

test("미확정·조기·출발 이후·이미 발송 고객은 제외된다", () => {
  assert.equal(guidebookEligibility({ depart:"2026-08-18" }, "진행중", "2026-08-11").reason, "not_confirmed");
  assert.equal(guidebookEligibility({ depart:"2026-08-19" }, "예약확정", "2026-08-11").reason, "too_early");
  assert.equal(guidebookEligibility({ depart:"2026-08-10" }, "예약확정", "2026-08-11").reason, "already_departed");
  assert.equal(guidebookEligibility({
    depart:"2026-08-18", notify:{ guidebookDepartureDate:"2026-08-18", guidebookSentAt:"2026-08-11T00:00:00Z" },
  }, "예약확정", "2026-08-11").reason, "already_sent");
});
