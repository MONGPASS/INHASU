import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeTravelers, sanitizeTripInfo, travelerTypes } from "../functions/api/_travelers.mjs";

test("예약 인원 순서대로 여행자 유형을 만든다", () => {
  assert.deepEqual(travelerTypes({ adult:2, child:1, infant:1 }), ["성인", "성인", "아동", "유아"]);
});

test("정상 입력을 표준 형식으로 정리한다", () => {
  const result = sanitizeTravelers([{
    nameKo:"홍길동", passportName:"hong gildong", birth:"1990.01.02",
    phone:"010-1234-5678", gender:"남", passportNo:"m1234-5678",
  }], { adult:1 });
  assert.equal(result.ok, true);
  assert.deepEqual(result.travelers[0], {
    type:"성인", nameKo:"홍길동", passportName:"HONG GILDONG", birth:"1990-01-02",
    phone:"01012345678", gender:"남", passportNo:"M12345678",
  });
});

test("인원 누락과 잘못된 여권정보를 거부한다", () => {
  assert.equal(sanitizeTravelers([], { adult:2 }).ok, false);
  const bad = sanitizeTravelers([{
    nameKo:"홍길동", passportName:"홍길동", birth:"1990-01-02",
    phone:"01012345678", gender:"남", passportNo:"!",
  }], { adult:1 });
  assert.equal(bad.ok, false);
});

test("항공권 시간을 24시간 형식으로 정리한다", () => {
  const result = sanitizeTripInfo({
    flight: { inDepTime:"2030", inTime:"4:30", inNo:"om-310", outTime:"20:30:00", outArrTime:"06:15", outNo:"7C2503" },
    pickupLodge:" 샹그릴라 울란바타르 ", travelerNote:"홍길동 — 고혈압\n김민지 — 채식",
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.flight, {
    inDepTime:"20:30", inTime:"04:30", outTime:"20:30", outArrTime:"06:15", inNo:"OM310", outNo:"7C2503",
  });
  assert.equal(result.pickupLodge, "샹그릴라 울란바타르");
  assert.equal(result.travelerNote, "홍길동 — 고혈압\n김민지 — 채식");
});

test("항공권 정보는 비워둘 수 있고, 잘못된 시간은 거부한다", () => {
  const empty = sanitizeTripInfo({});
  assert.equal(empty.ok, true);
  assert.deepEqual(empty.flight, { inDepTime:"", inTime:"", outTime:"", outArrTime:"", inNo:"", outNo:"" });
  assert.equal(sanitizeTripInfo({ flight:{ inTime:"25:00" } }).ok, false);
  assert.equal(sanitizeTripInfo({ flight:{ outTime:"오후 8시" } }).ok, false);
  assert.equal(sanitizeTripInfo({ flight:{ inNo:"O" } }).ok, false);
});

test("미성년 여행자는 연락처를 비워도 된다", () => {
  const result = sanitizeTravelers([{
    nameKo:"홍아동", passportName:"HONG CHILD", birth:"2018-02-03",
    phone:"", gender:"여", passportNo:"M1234567",
  }], { child:1 });
  assert.equal(result.ok, true);
});
