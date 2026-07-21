import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { onRequestGet as getData } from "../functions/api/data/[key].js";

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), "utf8");

function dataEnv(data) {
  return {
    ADMIN_TOKEN: "admin-secret",
    DB: {
      prepare(sql) {
        if (sql.includes("CREATE TABLE")) return { run: async () => ({ success:true }) };
        return {
          bind() {
            return { first: async () => ({ v:JSON.stringify(data), updated_at:"2026-07-21T00:00:00.000Z" }) };
          },
        };
      },
    },
  };
}

test("가이드 공개 조회는 연락처를 숨기고 관리자 조회는 전화와 QR을 보존한다", async () => {
  const guides = { Bagi:{ phone:"88109985", qr:"/api/img/bagi.webp", desc:"guide" } };
  const env = dataEnv(guides);
  const publicRes = await getData({ request:new Request("https://example.com/api/data/guides"), params:{ key:"guides" }, env });
  const publicBody = await publicRes.json();
  assert.equal(publicBody.data.Bagi.phone, undefined);
  assert.equal(publicBody.data.Bagi.qr, undefined);

  const adminRes = await getData({ request:new Request("https://example.com/api/data/guides", { headers:{ "x-admin-token":"admin-secret" } }), params:{ key:"guides" }, env });
  const adminBody = await adminRes.json();
  assert.equal(adminBody.data.Bagi.phone, "88109985");
  assert.equal(adminBody.data.Bagi.qr, "/api/img/bagi.webp");
});

test("예약관리는 인증된 리소스를 읽고 차량·숙소의 PDF 필드를 저장한다", () => {
  const admin = read("예약관리.html");
  assert.match(admin, /headers: adminHeaders/);
  assert.match(admin, /luggage:g\("v_luggage"\)/);
  assert.match(admin, /region: lib\.region \|\| ""/);
  assert.match(admin, /fillEmpty\("g_phone", assignedGuide\.phone/);
  assert.match(admin, /fillEmpty\("g_qr", assignedGuide\.qr/);
});

test("PC와 모바일 확정일정표는 등록 필드를 사용하고 인쇄 전 이미지를 기다린다", () => {
  for (const name of ["확정일정표.html", "확정일정표-모바일.html"]) {
    const page = read(name);
    assert.match(page, /infoLine\(VIC\.bag, "수하물", v\.luggage\)/);
    assert.match(page, /infoLine\(VIC\.feat, "차량 특징", v\.desc\)/);
    assert.match(page, /l\.region/);
    assert.match(page, /const tags = String\(l\.tags/);
    assert.match(page, /waitForScheduleImages/);
    assert.doesNotMatch(page, /infoLine\(VIC\.bag, "수하물", "대형 캐리어 적재 가능"\)/);
  }
});

test("예약관리에서 현재 저장본으로 가이드용 PDF 인쇄를 시작한다", () => {
  const admin = read("예약관리.html");
  const schedule = read("확정일정표.html");
  assert.match(admin, /id="guidePdfBtn"/);
  assert.match(admin, /async function printGuideSchedule/);
  assert.match(admin, /await save\(\{ quiet:true \}\)/);
  assert.match(admin, /leaders_confirmed_print/);
  assert.match(schedule, /_adminPrint/);
  assert.match(schedule, /scheduleLayoutReady\.then\(\(\) => window\.printSchedule\(\)\)/);
});
