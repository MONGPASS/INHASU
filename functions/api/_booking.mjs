/* ══════════ 예약(booking) 서버 공유 로직 · /functions/api/_booking.mjs ══════════
   고객 수락 시점에 서버가 견적에서 예약금·계좌가 채워진 booking을 자동 생성할 때 사용.
   ⚠ 브라우저용 booking.js(리포지토리 루트)와 같은 "정답 모양"을 유지해야 합니다 —
     blankBooking / quoteMoney / seedBookingFromQuote 를 고치면 booking.js도 함께 고치세요. */

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
              vehicle:{model:"",seats:"",plate:"",img:"",imgs:[],desc:""}, lodges:[] },
    travelers: [],
    travelerSubmission: { status:"not_requested", requestedAt:"", submittedAt:"", expectedCount:0, submittedCount:0 },
    flight: { inDate:"", inTime:"", inNo:"", outDate:"", outTime:"", outNo:"" },
    contractInfo: { productName:"", region:"", totalAmount:0, depositAmount:0, depositStatus:"미입금", balanceAmount:0, balanceStatus:"미수령", cashReceipt:"", ...DEFAULT_DEPOSIT_ACCOUNT, note:"" },
    preparedAt: "",
    depositRequest: { status:"not_sent", requestedAt:"" },
    depositReport: { status:"none", name:"", reportedAt:"" },   // 고객 "입금했어요" 신고
    contractRequest: { status:"not_sent", requestedAt:"" },
    checklist: { deposit:false, balance:false, flight:false, insurance:false, contract:false },
    contract: null,
    highlights: [],
    notes: "", adminMemo: "",
    autoSeeded: false,
  };
}

const daysFromQuote = q => (q && Array.isArray(q.days)) ? JSON.parse(JSON.stringify(q.days)) : [];
const balEco  = b => (b && b.economy != null ? b.economy : ((b && b.amount) || 0));
const balFull = b => (b && b.full    != null ? b.full    : ((b && b.amount) || 0));

/* 견적(quote.price)에서 계약 정산 금액 환산 — booking.js quoteMoney와 동일 */
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

/* 견적과 문의 레코드에서 booking 스켈레톤 생성 — booking.js seedBookingFromQuote와 동일 */
export function seedBookingFromQuote(rec) {
  rec = rec || {};
  const bk = blankBooking();
  const q = rec.quote || null;
  const qm = quoteMoney(rec);
  bk.days = daysFromQuote(q);
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
