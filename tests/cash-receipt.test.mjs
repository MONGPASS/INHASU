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

test("예약관리에서 저장된 고객·잔금·담당 가이드로 현금영수증을 연다", () => {
  const admin = read("예약관리.html");
  const shared = read("booking.js");
  assert.match(admin, /id="cashReceiptBtn"/);
  assert.match(admin, /async function printCashReceipt\(\)/);
  assert.match(shared, /function cashReceiptPayload\(rec, booking/);
  assert.match(shared, /amount: Number\(ci\.balanceAmount/);
  assert.match(shared, /guideName: guide\.name/);
  assert.match(shared, /function storeCashReceiptPayload\(payload\)/);
  assert.match(admin, /await save\(\{ quiet:true \}\)/);
  assert.match(shared, /function storeCashReceiptPayload\(payload\)/);
  assert.match(shared, /leaders_cash_receipt_print_/);
  assert.match(admin, /storeCashReceiptPayload\(payload\)/);
  assert.match(admin, /현금영수증\.html\?print=1/);
});

test("모바일 관리자에서도 같은 현금영수증을 출력한다", () => {
  const mobile = read("admin-mobile.html");
  assert.match(mobile, /App\.docCashReceipt = async id/);
  assert.match(mobile, /cashReceiptPayload\(r, bk\)/);
  assert.match(mobile, /현금영수증\.html\?print=1/);
  assert.match(mobile, />현금영수증<\/button>/);
});

test("현금영수증은 고객용과 회사 보관용에 예약 데이터를 자동 채운다", () => {
  const receipt = read("현금영수증.html");
  assert.match(receipt, /고객용 \/ CUSTOMER COPY/);
  assert.match(receipt, /회사 보관용 \/ COMPANY COPY/);
  assert.match(receipt, /data\.customerName/);
  assert.match(receipt, /data\.receiptNo/);
  assert.match(receipt, /data\.amount/);
  assert.match(receipt, /data\.productName/);
  assert.match(receipt, /data\.depart/);
  assert.match(receipt, /data\.returnDate/);
  assert.match(receipt, /data\.guideName/);
  assert.match(receipt, /localStorage\.removeItem\(storageKey\)/);
  assert.match(receipt, /PDF 다운로드 \/ 인쇄/);
  assert.match(receipt, /@page \{ size:A4 portrait/);
});
