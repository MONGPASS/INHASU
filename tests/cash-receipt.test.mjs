import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), "utf8");

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
  assert.match(admin, /id="guideSheetBtn">📋 가이드 시트 PDF/);
  assert.match(admin, /async function printGuideSheet\(\)/);
  assert.match(admin, /leaders_guide_sheet_print/);
  assert.match(admin, /await save\(\{ quiet:true \}\)/);
  assert.doesNotMatch(admin, /id="cashReceiptBtn"/);
  assert.match(shared, /function cashReceiptPayload\(rec, booking/);
  assert.match(shared, /amount: Number\(ci\.balanceAmount/);
  assert.match(shared, /guideName: guide\.name/);
});

test("모바일 관리자도 별도 버튼 없이 가이드 시트 PDF에서 영수증을 출력한다", () => {
  const mobile = read("admin-mobile.html");
  assert.match(mobile, />가이드 시트 PDF<\/button>/);
  assert.match(mobile, /App\.docGuideSheet = id/);
  assert.match(mobile, /leaders_guide_sheet_print/);
  assert.doesNotMatch(mobile, /App\.docCashReceipt/);
  assert.doesNotMatch(mobile, />현금영수증<\/button>/);
});

test("잔금이 있으면 가이드 시트 마지막 A4 페이지에 현금영수증 2부를 붙인다", () => {
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
  assert.match(guide, /page1 \+ page2 \+ cashPage/);
});
