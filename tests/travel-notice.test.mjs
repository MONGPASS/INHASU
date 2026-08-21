import test from "node:test";
import assert from "node:assert/strict";
import { notifyCustomerTravelNotice, guidebookUrl, sendFailReason } from "../functions/api/_solapi.js";
import {
  AUTO_TRIGGER, MANUAL_TRIGGER, recordTravelNoticeSent,
  shouldAutoSendTravelNotice, travelNoticeState,
} from "../functions/api/_travel-notice.mjs";
import { onRequestPatch } from "../functions/api/requests/[id].js";
import { onRequestPost as onSignPost } from "../functions/api/sign/[token].js";
import { onRequestPost as guidebookCron } from "../functions/api/guidebook-reminders.js";

const BASE_ENV = {
  SOLAPI_API_KEY:"api-key",
  SOLAPI_API_SECRET:"api-secret",
  SOLAPI_SENDER:"0212345678",
  SOLAPI_PF_ID:"KA01PF-test",
  SITE_URL:"https://mongolia-milkyway.com",
  NOTIFY_COMPANY:"몽골리아 은하수 여행사",
  ADMIN_TOKEN:"admin-secret",
};

/* 여행 주의사항은 카카오 알림톡 전용 — 템플릿이 설정된 환경 */
const KAKAO_ENV = { ...BASE_ENV, SOLAPI_TEMPLATE_TRAVEL_NOTICE_ID:"KA01TP-notice" };

const withFetch = async (handler, run) => {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  try { return await run(); } finally { globalThis.fetch = original; }
};

const okResponse = () => new Response(JSON.stringify({ groupId:"group-1" }), {
  status:200, headers:{ "Content-Type":"application/json" },
});

test("여행 주의사항 PDF 링크는 배포 주소 기준 절대경로로 만든다", () => {
  assert.equal(
    guidebookUrl(BASE_ENV, "https://preview.pages.dev/api/sign/abc"),
    "https://mongolia-milkyway.com/guidebooks/mongolia-travel-guidebook-2026.pdf",
  );
});

test("전용 템플릿이 없으면 문자로 대체하지 않고 아예 보내지 않는다", async () => {
  let calls = 0;
  const result = await withFetch(async () => { calls += 1; return okResponse(); }, () =>
    notifyCustomerTravelNotice(BASE_ENV, { phone:"010-1234-5678", name:"홍길동", depart:"2026-08-18" }));

  assert.equal(calls, 0, "발송 요청 자체가 나가면 안 된다");
  assert.equal(result.ok, false);
  assert.match(result.reason, /template not set/);
});

test("전용 템플릿이 설정되면 알림톡으로 보낸다", async () => {
  let body;
  const env = { ...BASE_ENV, SOLAPI_TEMPLATE_TRAVEL_NOTICE_ID:"KA01TP-notice" };
  await withFetch(async (_url, init) => { body = JSON.parse(init.body); return okResponse(); }, () =>
    notifyCustomerTravelNotice(env, { phone:"010-1234-5678", name:"홍길동", depart:"2026-08-18" }));

  assert.equal(body.message.kakaoOptions.templateId, "KA01TP-notice");
  assert.equal(body.message.kakaoOptions.variables["#{링크}"], "guidebooks/mongolia-travel-guidebook-2026.pdf");
  assert.equal(body.message.kakaoOptions.buttons, undefined, "버튼은 승인된 템플릿 것을 그대로 쓴다");
  assert.equal(body.message.kakaoOptions.disableSms, true, "알림톡 실패 시 문자로 대체하면 안 된다");
  assert.equal(body.message.text, undefined, "문자 본문이 함께 나가면 안 된다");
});

test("전용 템플릿이 없으면 기존 가이드북 템플릿으로 보낸다", async () => {
  let body;
  const env = { ...BASE_ENV, SOLAPI_TEMPLATE_GUIDEBOOK_ID:"KA01TP-guidebook" };
  await withFetch(async (_url, init) => { body = JSON.parse(init.body); return okResponse(); }, () =>
    notifyCustomerTravelNotice(env, { phone:"010-1234-5678", name:"홍길동", depart:"2026-08-18" }));

  assert.equal(body.message.kakaoOptions.templateId, "KA01TP-guidebook");
  assert.equal(body.message.kakaoOptions.disableSms, true);
  assert.equal(body.message.kakaoOptions.variables["#{링크}"], "guidebooks/mongolia-travel-guidebook-2026.pdf");
});

test("전용 템플릿이 있으면 가이드북 템플릿보다 우선한다", async () => {
  let body;
  const env = { ...BASE_ENV, SOLAPI_TEMPLATE_GUIDEBOOK_ID:"KA01TP-guidebook", SOLAPI_TEMPLATE_TRAVEL_NOTICE_ID:"KA01TP-notice" };
  await withFetch(async (_url, init) => { body = JSON.parse(init.body); return okResponse(); }, () =>
    notifyCustomerTravelNotice(env, { phone:"010-1234-5678", name:"홍길동", depart:"2026-08-18" }));

  assert.equal(body.message.kakaoOptions.templateId, "KA01TP-notice");
});

test("SOLAPI_DISABLE_SMS가 N이어도 여행 주의사항은 문자 대체를 하지 않는다", async () => {
  let body;
  const env = { ...KAKAO_ENV, SOLAPI_DISABLE_SMS:"N" };
  await withFetch(async (_url, init) => { body = JSON.parse(init.body); return okResponse(); }, () =>
    notifyCustomerTravelNotice(env, { phone:"010-1234-5678", name:"홍길동", depart:"2026-08-18" }));
  assert.equal(body.message.kakaoOptions.disableSms, true);
});

test("발송 실패 사유는 Solapi가 돌려준 메시지까지 남긴다", () => {
  assert.match(sendFailReason({ ok:false, skipped:true, reason:"invalid phone" }), /invalid phone/);
  /* errorMessage만 오는 경우 — 예전에는 send_failed로만 남아 원인을 알 수 없었다 */
  assert.match(sendFailReason({ ok:false, httpStatus:400, errorCode:"ValidationError", errorMessage:"template not found" }), /template not found/);
  assert.match(sendFailReason({ ok:false, httpStatus:400, errorCode:"ValidationError", errorMessage:"template not found" }), /HTTP 400/);
  /* 요청은 200이지만 건별로 실패한 경우 */
  assert.match(sendFailReason({ ok:true, httpStatus:200, failedMessageList:[{ statusCode:"3035", statusMessage:"변수 불일치" }] }), /변수 불일치/);
  assert.equal(sendFailReason(null), "no response");
  assert.equal(sendFailReason({ ok:false }), "send_failed");
});

test("수동 발송이 실패하면 실제 사유가 기록에 남는다", async () => {
  const DB = mockDb({
    id:"req-1", status:"예약확정", name:"홍길동", phone:"01012345678",
    booking:{ contractInfo:{} }, activities:[],
  });
  const res = await withFetch(
    async () => new Response(JSON.stringify({ errorCode:"TemplateNotApproved", errorMessage:"승인되지 않은 템플릿입니다" }), {
      status:400, headers:{ "Content-Type":"application/json" },
    }),
    () => onRequestPatch({ request:patchRequest({ notifyTravelNotice:true }), env:{ ...KAKAO_ENV, DB }, params:{ id:"req-1" } }));

  const body = await res.json();
  assert.equal(body.travelNotice.ok, false);
  assert.match(body.travelNotice.reason, /승인되지 않은 템플릿입니다/);
  assert.match(DB.record.activities.at(-1).detail, /승인되지 않은 템플릿입니다/);
});

test("자동 발송은 서명 1건당 한 번, 수동 발송은 제한 없이 기록된다", () => {
  const rec = { name:"홍길동" };
  assert.equal(shouldAutoSendTravelNotice(rec), true);

  recordTravelNoticeSent(rec, { at:"2026-07-10T00:00:00Z", trigger:AUTO_TRIGGER });
  assert.equal(shouldAutoSendTravelNotice(rec), false);
  assert.equal(travelNoticeState(rec).sentCount, 1);
  assert.equal(rec.activities.at(-1).type, "travel_notice_sent");

  recordTravelNoticeSent(rec, { at:"2026-07-20T00:00:00Z", trigger:MANUAL_TRIGGER });
  const state = travelNoticeState(rec);
  assert.equal(state.sentCount, 2);
  assert.equal(state.sentAt, "2026-07-20T00:00:00Z");
  assert.equal(state.autoSentAt, "2026-07-10T00:00:00Z");   // 수동 발송이 자동 발송 기록을 덮지 않는다
  assert.equal(shouldAutoSendTravelNotice(rec), false);
});

function mockDb(record) {
  let data = JSON.stringify(record);
  return {
    get record() { return JSON.parse(data); },
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() { return { data, status:JSON.parse(data).status || "진행중" }; },
            async run() {
              assert.match(sql, /UPDATE requests SET/);
              data = args[2];
              return { meta:{ changes:1 } };
            },
          };
        },
      };
    },
  };
}

const patchRequest = body => new Request("https://mongolia-milkyway.com/api/requests/req-1", {
  method:"PATCH",
  headers:{ "Content-Type":"application/json", "x-admin-token":"admin-secret" },
  body:JSON.stringify(body),
});

test("관리자 수동 발송은 실제로 보낸 뒤 결과와 기록을 함께 돌려준다", async () => {
  const DB = mockDb({
    id:"req-1", status:"예약확정", name:"홍길동", phone:"01012345678", depart:"2026-08-18",
    booking:{ contractInfo:{ depositStatus:"입금완료" } }, activities:[],
  });
  let sends = 0;
  const res = await withFetch(async () => { sends += 1; return okResponse(); }, () =>
    onRequestPatch({ request:patchRequest({ notifyTravelNotice:true }), env:{ ...KAKAO_ENV, DB }, params:{ id:"req-1" } }));

  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(sends, 1);
  assert.equal(body.travelNotice.ok, true);
  assert.equal(body.travelNotice.sentCount, 1);
  assert.equal(DB.record.notify.travelNoticeTrigger, MANUAL_TRIGGER);
  assert.equal(DB.record.activities.at(-1).type, "travel_notice_sent");
});

test("발송이 실패하면 기록을 남기지 않고 실패를 알린다", async () => {
  const DB = mockDb({
    id:"req-1", status:"예약확정", name:"홍길동", phone:"01012345678",
    booking:{ contractInfo:{} }, activities:[],
  });
  const res = await withFetch(
    async () => new Response(JSON.stringify({ errorMessage:"quota exceeded" }), {
      status:500, headers:{ "Content-Type":"application/json" },
    }),
    () => onRequestPatch({ request:patchRequest({ notifyTravelNotice:true }), env:{ ...KAKAO_ENV, DB }, params:{ id:"req-1" } }));

  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.travelNotice.ok, false);
  assert.equal(DB.record.notify?.travelNoticeSentAt, undefined);
  assert.equal(DB.record.activities.at(-1).type, "travel_notice_failed");
});

test("연락처가 없으면 발송을 건너뛰고 실패로 알린다", async () => {
  const DB = mockDb({ id:"req-1", status:"예약확정", name:"홍길동", phone:"", booking:{}, activities:[] });
  let sends = 0;
  const res = await withFetch(async () => { sends += 1; return okResponse(); }, () =>
    onRequestPatch({ request:patchRequest({ notifyTravelNotice:true }), env:{ ...KAKAO_ENV, DB }, params:{ id:"req-1" } }));

  const body = await res.json();
  assert.equal(sends, 0);
  assert.equal(body.travelNotice.ok, false);
});

test("알림톡 템플릿이 없으면 수동 발송이 이유와 함께 실패한다", async () => {
  const DB = mockDb({
    id:"req-1", status:"예약확정", name:"홍길동", phone:"01012345678",
    booking:{ contractInfo:{} }, activities:[],
  });
  let sends = 0;
  const res = await withFetch(async () => { sends += 1; return okResponse(); }, () =>
    onRequestPatch({ request:patchRequest({ notifyTravelNotice:true }), env:{ ...BASE_ENV, DB }, params:{ id:"req-1" } }));

  const body = await res.json();
  assert.equal(sends, 0);
  assert.equal(body.travelNotice.ok, false);
  assert.match(body.travelNotice.reason, /template not set/);
  assert.equal(DB.record.notify?.travelNoticeSentAt, undefined);
});

/* 서명 저장 후 CAS(이전 값 일치 시에만 갱신) 업데이트까지 재현하는 DB 목 */
function signDb(record) {
  let data = JSON.stringify(record);
  return {
    get record() { return JSON.parse(data); },
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() { return { id:"req-1", status:record.status || "진행중", data }; },
            async run() {
              if (!/UPDATE requests SET/.test(sql)) return { meta:{ changes:0 } };
              if (/SET status = \?, data = \?/.test(sql)) { data = args[1]; return { meta:{ changes:1 } }; }
              const [nextData, , expected] = args;          // SET data = ? WHERE id = ? AND data = ?
              if (expected !== data) return { meta:{ changes:0 } };
              data = nextData;
              return { meta:{ changes:1 } };
            },
          };
        },
      };
    },
  };
}

const signRequest = () => new Request("https://mongolia-milkyway.com/api/sign/token-1234567890123456", {
  method:"POST", headers:{ "Content-Type":"application/json" },
  body:JSON.stringify({ agree:true, signImg:"data:image/png;base64," + "A".repeat(300), signerName:"홍길동" }),
});

const runSign = async (DB, fetchHandler) => {
  const pending = [];
  const res = await withFetch(fetchHandler, async () => {
    const response = await onSignPost({
      request:signRequest(), env:{ ...KAKAO_ENV, DB }, params:{ token:"token-1234567890123456" },
      waitUntil(p) { pending.push(p); },
    });
    await Promise.all(pending);
    return response;
  });
  return res;
};

test("계약서 서명 직후 여행 주의사항이 자동 발송되고 기록된다", async () => {
  const DB = signDb({
    id:"req-1", status:"진행중", name:"홍길동", phone:"01012345678", depart:"2026-08-18",
    booking:{ contractInfo:{ depositStatus:"입금완료" } }, activities:[],
  });
  const sent = [];
  const res = await runSign(DB, async (_url, init) => { sent.push(JSON.parse(init.body)); return okResponse(); });

  assert.equal(res.status, 200);
  const notices = sent.filter(b => (b.message.kakaoOptions || {}).templateId === "KA01TP-notice");
  assert.equal(notices.length, 1, "여행 주의사항 알림톡이 한 번 발송되어야 한다");
  assert.equal(notices[0].message.kakaoOptions.disableSms, true);

  const saved = DB.record;
  assert.equal(saved.booking.contract.signedAt !== undefined, true);
  assert.equal(saved.notify.travelNoticeTrigger, AUTO_TRIGGER);
  assert.equal(saved.notify.travelNoticeSentCount, 1);
  assert.equal(saved.activities.at(-1).type, "travel_notice_sent");
});

test("발송이 실패하면 서명은 저장되고 발송 기록만 남지 않는다", async () => {
  const DB = signDb({
    id:"req-1", status:"진행중", name:"홍길동", phone:"01012345678", depart:"2026-08-18",
    booking:{ contractInfo:{ depositStatus:"입금완료" } }, activities:[],
  });
  const res = await runSign(DB, async () => new Response(JSON.stringify({ errorMessage:"down" }), {
    status:500, headers:{ "Content-Type":"application/json" },
  }));

  assert.equal(res.status, 200);
  const saved = DB.record;
  assert.ok(saved.booking.contract.signedAt, "서명은 그대로 저장되어야 한다");
  assert.equal(saved.notify.travelNoticeSentAt, undefined);
});

test("이미 자동 발송된 예약은 재서명해도 다시 자동 발송하지 않는다", async () => {
  const DB = signDb({
    id:"req-1", status:"진행중", name:"홍길동", phone:"01012345678", depart:"2026-08-18",
    booking:{ contractInfo:{ depositStatus:"입금완료" } }, activities:[],
    notify:{ travelNoticeAutoSentAt:"2026-07-01T00:00:00Z", travelNoticeSentAt:"2026-07-01T00:00:00Z", travelNoticeSentCount:1 },
  });
  const sent = [];
  await runSign(DB, async (_url, init) => { sent.push(JSON.parse(init.body)); return okResponse(); });

  assert.equal(sent.filter(b => (b.message.kakaoOptions || {}).templateId === "KA01TP-notice").length, 0);
  assert.equal(DB.record.notify.travelNoticeSentCount, 1);
});

test("출발 7일 전 자동 발송 엔드포인트는 더 이상 발송하지 않는다", async () => {
  let sends = 0;
  const res = await withFetch(async () => { sends += 1; return okResponse(); }, () => guidebookCron());
  const body = await res.json();
  assert.equal(sends, 0);
  assert.equal(body.disabled, true);
  assert.equal(body.sent, 0);
});
