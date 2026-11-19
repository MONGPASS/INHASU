import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { onRequestGet as getData } from "../functions/api/data/[key].js";
import { quoteVehicleCards } from "../public/quote-vehicles.js";

const read = name => readFileSync(new URL(`../public/${name}`, import.meta.url), "utf8");

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

test("차량 공개 조회는 기사 이름·연락처를 숨기고 관리자 조회는 보존한다", async () => {
  const env = dataEnv({ 스타렉스:{ driver:"Bat", phone:"+976 2", seats:"6인" } });
  const publicBody = await (await getData({ request:new Request("https://example.com/api/data/vehicles"), params:{ key:"vehicles" }, env })).json();
  assert.deepEqual(publicBody.data.스타렉스, { seats:"6인" });
  const adminBody = await (await getData({ request:new Request("https://example.com/api/data/vehicles", { headers:{ "x-admin-token":"admin-secret" } }), params:{ key:"vehicles" }, env })).json();
  assert.equal(adminBody.data.스타렉스.driver, "Bat"); assert.equal(adminBody.data.스타렉스.phone, "+976 2");
});

test("발송 견적서용 차량 목록은 모든 등록 차종의 고객용 항목과 대표 사진 세 장만 반환한다", async () => {
  const env = dataEnv({
    '하이에스 6인승': { seats: 6, luggage: '캐리어 4개', desc: '여유로운 좌석', img: '/a.webp', imgs: ['/a.webp','/b.webp','/c.webp','/archive.webp'], plate: '내부 번호', driver: '내부 기사', phone: '내부 전화', memo: '내부 메모' },
    'Starex': {},
  });
  for (const headers of [{}, { 'x-admin-token': env.ADMIN_TOKEN }]) {
    const response = await getData({ request: new Request("https://example.com/api/data/vehicles?view=quote", { headers }), params: { key: "vehicles" }, env });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).vehicles, [
      { name: '하이에스 6인승', seats: '6', luggage: '캐리어 4개', description: '여유로운 좌석', photos: ['/a.webp','/b.webp','/c.webp'] },
      { name: 'Starex', seats: '', luggage: '', description: '', photos: [] },
    ]);
  }
});

test("견적서 차량 카드는 동일한 차종만 표시하고 등록 문구를 텍스트로 그린다", () => {
  const row = { name: 'Starex', seats: '6', luggage: '캐리어 4개', description: '<b>차량 소개</b>', photos: ['javascript:invalid'] };
  const cards = quoteVehicleCards([row, { ...row, name: 'Starex Plus' }], 'starex');
  assert.equal((cards.match(/견적 기재 차량/g) || []).length, 1);
  assert.match(cards, /Starex Plus/);
  assert.match(cards, /6인승/);
  assert.match(cards, /&lt;b&gt;차량 소개&lt;\/b&gt;/);
  assert.doesNotMatch(cards, /<img|<b>차량 소개/);
  assert.equal(quoteVehicleCards([], ''), '');
});

test("예약관리는 인증된 리소스를 읽고 차량·숙소의 PDF 필드를 저장한다", () => {
  const admin = read("예약관리.html");
  assert.match(admin, /headers: adminHeaders/);
  assert.match(admin, /luggage:g\("v_luggage"\)/);
  assert.match(admin, /region: lib\.region \|\| ""/);
  assert.match(admin, /fillEmpty\("g_phone", assignedGuide\.phone/);
  assert.match(admin, /fillEmpty\("g_qr", assignedGuide\.qr/);
});

test("숙소를 영구 저장되는 지역 카테고리로 분류하고 예약 선택기에 같은 순서를 사용한다", async () => {
  const resources = read("리소스관리.html");
  const presets = read("presets.js");
  const admin = read("예약관리.html");

  assert.match(resources, /id="lodgeCats"/);
  assert.match(resources, /function renderLodgeCats\(\)/);
  assert.match(resources, /function renameLodgeCat\(cat\)/);
  assert.match(resources, /function deleteLodgeCat\(cat\)/);
  assert.match(resources, /activeLodgeCat === "__none"/);
  assert.match(presets, /window\.getLodgeCats/);
  assert.match(presets, /lodge_cats: "leaders_lodge_cats"/);
  assert.match(admin, /const savedOrder = window\.getLodgeCats/);

  const res = await getData({
    request:new Request("https://example.com/api/data/lodge_cats"),
    params:{ key:"lodge_cats" },
    env:dataEnv(["테를지", "울란바토르"]),
  });
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).data, ["테를지", "울란바토르"]);
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
