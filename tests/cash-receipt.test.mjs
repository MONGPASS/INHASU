import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { guideStatementContent } from "../public/guide-statement.js";

const read = name => readFileSync(new URL(`../public/${name}`, import.meta.url), "utf8");

const { cashReceiptPayload } = new Function(`${read("booking.js")}\nreturn { cashReceiptPayload };`)();

test("현금영수증 출력 데이터가 예약의 잔금·기간·담당 가이드를 정확히 매핑한다", () => {
  const rec = { id:"req-abc12345", name:"김은하", adult:4, child:2, destination:"남고비", depart:"2026-09-03", return_:"2026-09-08" };
  const booking = {
    contractInfo:{ productName:"남고비 사막앤초원 5박 6일", balanceAmount:6650000 },
    assign:{ guide:{ name:"바트카", nameEn:"Batka" }, vehicle:{}, lodges:[] },
    flight:{ inDate:"2026-09-03", outDate:"2026-09-08" }, travelers:[],
  };
  const payload = cashReceiptPayload(rec, booking, new Date("2026-09-03T01:00:00Z"));
  assert.equal(payload.customerName, "김은하");
  assert.equal(payload.pax, 6);
  assert.equal(payload.amount, 6650000);
  assert.equal(payload.productName, "남고비 사막앤초원 5박 6일");
  assert.equal(payload.depart, "2026-09-03");
  assert.equal(payload.returnDate, "2026-09-08");
  assert.equal(payload.guideName, "바트카");
  assert.equal(payload.receiptNo, "R-2026-ABC12345");
  assert.equal(payload.issueDate, "2026-09-03");
});

test("PC 예약관리의 가이드 시트 PDF가 저장된 최신 예약을 사용한다", () => {
  const admin = read("예약관리.html");
  const shared = read("booking.js");
  assert.match(admin, /id="guideSheetBtn">가이드 시트 PDF/);
  assert.match(admin, /async function printGuideSheet\(\)/);
  assert.match(admin, /openBookingGuideSheet\(PRE, BK, printWindow\)/);
  assert.match(admin, /await save\(\{ quiet:true \}\)/);
  assert.doesNotMatch(admin, /id="cashReceiptBtn"/);
  assert.match(shared, /function cashReceiptPayload\(rec, booking/);
  assert.match(shared, /amount: Number\(ci\.balanceAmount/);
  assert.match(shared, /guideName: guide\.name/);
});

test("모바일 관리자도 별도 버튼 없이 가이드 시트 PDF에서 영수증을 출력한다", () => {
  const mobile = read("견적관리-모바일.html");
  assert.match(mobile, />가이드 시트 PDF<\/button>/);
  assert.match(mobile, /App\.docGuideSheet = id/);
  assert.match(mobile, /openBookingGuideSheet\(r, bk\)/);
  assert.doesNotMatch(mobile, /App\.docCashReceipt/);
  assert.doesNotMatch(mobile, />현금영수증<\/button>/);
});

test("잔금이 있으면 가이드 시트 거래명세서 다음에 현금영수증 2부를 붙인다", () => {
  const guide = read("가이드시트.html");
  assert.match(guide, /<script src="booking\.js"><\/script>/);
  assert.match(guide, /cashReceiptPayload\(REC, BK\)/);
  assert.match(guide, /Number\(cash\.amount\) > 0/);
  assert.match(guide, /고객용 \/ CUSTOMER COPY/);
  assert.match(guide, /회사 보관용 \/ COMPANY COPY/);
  assert.match(guide, /cash\.customerName/);
  assert.match(guide, /cash\.receiptNo/);
  assert.match(guide, /cash\.amount/);
  assert.match(guide, /cash\.productName/);
  assert.match(guide, /cash\.guideName/);
  assert.match(guide, /\.cash-page\{[^}]*page-break-before:always/);
  assert.match(guide, /page1 \+ page2 \+ statementPage \+ cashPage/);
});

test("가이드 거래명세서는 계약 총액과 예약금·잔금을 따로 표기하고 금액 미입력과 0원을 구분한다", () => {
  const content = guideStatementContent({
    productName: "중앙몽골", customerName: "김<여행>", travelers: 2, packageType: "full",
    reservationNumber: "MN001", period: "2026.11.13~2026.11.19", issueDate: "2026.11.12",
    totalAmount: "2,200,000", depositAmount: 100000, balanceAmount: 1930000,
    depositStatus: true, balanceStatus: "계좌입금", note: "할인 적용\nA & B",
  });
  for (const value of ["중앙몽골", "김&lt;여행&gt;", "MN001", "2명", "풀패키지", "2,200,000원", "100,000원",
    "1,930,000원", "입금완료", "계좌입금", "할인 적용\nA &amp; B"]) assert.ok(content.includes(value), value);
  const partial = guideStatementContent({ totalAmount: " ", depositAmount: "12,3", balanceAmount: 0, balanceStatus: false });
  assert.equal(partial.match(/미입력/g)?.length, 2);
  assert.ok(partial.includes("0원") && partial.includes("미수령"));
});

test("서로 다른 두 예약의 인쇄 창은 선택한 예약 자료만 전달받는다", () => {
  const open = new Function("location", `${read("booking.js")}\nreturn openBookingGuideSheet;`)({ href: "https://example.test/예약관리.html" });
  const printTab = () => ({ sessionStorage: new Map(), location: { replace(url) { this.url = new URL(url); } } });
  const tabs = [printTab(), printTab()];
  for (const [i, tab] of tabs.entries()) {
    tab.sessionStorage.setItem = tab.sessionStorage.set;
    const id = "예약/" + i;
    assert.ok(open({ id, name: "팀 " + i, token: "고객 링크 토큰" }, { contractInfo: { balanceAmount: i }, contract: { signImg: "서명" } }, tab));
    assert.equal(tab.location.url.searchParams.get("id"), id);
  }
  for (const [i, tab] of tabs.entries()) {
    const payload = JSON.parse(tab.sessionStorage.get("leaders_guide_sheet_print"));
    assert.equal(payload.id, "예약/" + i);
    assert.equal(payload.booking.contractInfo.balanceAmount, i);
    assert.equal(Object.hasOwn(payload, "token") || Object.hasOwn(payload.booking, "contract"), false);
  }
});
