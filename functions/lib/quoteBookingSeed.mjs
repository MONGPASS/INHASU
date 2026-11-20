/* 견적 → 예약 승계(서버판). public/booking.js의 blankBooking·quoteMoney·seedBookingFromQuote와 같은 결과를 만든다.
   견적관리 [예약 진행 기록](브라우저)과 고객 통합 작업의 [고객이 예약하겠대요](서버 acceptQuote)가 같은 예약을 만들도록,
   tests/quote-accept.test.mjs가 두 구현의 결과를 비교한다. 한쪽을 바꾸면 다른 쪽도 함께 바꾼다. */

export const DEFAULT_DEPOSIT_ACCOUNT = Object.freeze({
  bankName: "우리은행",
  accountNumber: "1002-245-516496",
  accountHolder: "DAVAASUREN (헬로볼라)",
});

export function blankBooking() {
  return {
    confirmedAt: "",
    publishStatus: "draft",
    publishedAt: "",
    days: [],
    assign: { guide:{name:"",nameEn:"",role:"",phone:"",qr:"",img:"",desc:""},
              vehicle:{model:"",seats:"",luggage:"",plate:"",img:"",imgs:[],desc:""}, lodges:[] },
    travelers: [],
    travelerSubmission: { status:"not_requested", requestedAt:"", submittedAt:"", expectedCount:0, submittedCount:0 },
    flight: { inDate:"", inDepTime:"", inTime:"", inNo:"", outDate:"", outTime:"", outArrTime:"", outNo:"" },
    pickupLodge: "",
    travelerNote: "",
    contractPackageType: "",
    contractInfo: { productName:"", region:"", totalAmount:0, depositAmount:0, depositStatus:"미입금", balanceAmount:0, balanceStatus:"미수령", cashReceipt:"", ...DEFAULT_DEPOSIT_ACCOUNT, note:"" },
    preparedAt: "",
    depositRequest: { status:"not_sent", requestedAt:"" },
    depositReport: { status:"none", name:"", reportedAt:"" },
    contractRequest: { status:"not_sent", requestedAt:"" },
    checklist: { deposit:false, balance:false, flight:false, insurance:false, contract:false },
    contract: null,
    highlights: [],
    notes: "", adminMemo: "",
    autoSeeded: false,
  };
}

const balEco  = b => (b && b.economy != null ? b.economy : ((b && b.amount) || 0));
const balFull = b => (b && b.full    != null ? b.full    : ((b && b.amount) || 0));

/** 예약금 = 1인 예약금 × 인원, 잔금 = 해당 인원 잔금(고급/풀패키지면 full, 아니면 economy) × 인원. */
export function quoteMoney(rec) {
  rec = rec || {};
  const q = rec.quote || null;
  const p = q && q.price;
  if (!p) return { totalAmount: 0, depositAmount: 0, balanceAmount: 0 };
  const pax = Number(q.pax) || ((rec.adult||0)+(rec.child||0)+(rec.infant||0)) || 0;
  const isFull = /풀패키지|최고급|고급/.test(`${rec.pkgTier||""} ${rec.gerStay||""}`);
  const bals = Array.isArray(p.balances) ? p.balances : [];
  let row = bals.find(b => Number(b.pax) === pax);
  if (!row && bals.length) row = bals.reduce((a,b) => Math.abs(Number(b.pax)-pax) < Math.abs(Number(a.pax)-pax) ? b : a);
  const per = row ? (isFull ? balFull(row) : balEco(row)) : 0;
  const depositAmount = (Number(p.deposit) || 0) * pax;
  const balanceAmount = per * pax;
  return { totalAmount: depositAmount + balanceAmount, depositAmount, balanceAmount };
}

export function seedBookingFromQuote(rec) {
  rec = rec || {};
  const bk = blankBooking();
  const q = rec.quote || null;
  const qm = quoteMoney(rec);
  bk.days = q && Array.isArray(q.days) ? JSON.parse(JSON.stringify(q.days)) : [];
  if (q && Array.isArray(q.highlights)) bk.highlights = JSON.parse(JSON.stringify(q.highlights));
  bk.contractInfo = {
    ...bk.contractInfo,
    productName: rec.destination || "",
    region: rec.destination || "",
    totalAmount: qm.totalAmount,
    depositAmount: qm.depositAmount,
    depositStatus: "미입금",
    balanceAmount: qm.balanceAmount,
    balanceStatus: "미수령",
  };
  bk.flight = { ...bk.flight, inDate: rec.depart || "", outDate: rec.return_ || "" };
  bk.autoSeeded = true;
  return bk;
}
