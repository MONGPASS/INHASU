import test from "node:test";
import assert from "node:assert/strict";
import {
  canSendKakao, customerPageUrl,
  notifyCustomerQuoteReady, notifyCustomerItineraryReady, notifyCustomerGuidebook,
} from "../functions/api/_solapi.js";

const ENV = {
  SOLAPI_API_KEY:"api-key",
  SOLAPI_API_SECRET:"api-secret",
  SOLAPI_SENDER:"0212345678",
  SOLAPI_PF_ID:"KA01PF-test",
  SOLAPI_TEMPLATE_QUOTE_ID:"KA01TP-quote",
  SOLAPI_TEMPLATE_ITINERARY_ID:"KA01TP-itinerary",
  SOLAPI_TEMPLATE_GUIDEBOOK_ID:"KA01TP-guidebook",
  SITE_URL:"https://mongolia-milkyway.com",
  NOTIFY_COMPANY:"몽골리아 은하수 여행사",
};

test("고객 링크는 배포 주소와 토큰으로 안전하게 만든다", () => {
  assert.equal(
    customerPageUrl(ENV, "https://preview.pages.dev/api/requests/1", "견적서.html", "abc 123"),
    "https://mongolia-milkyway.com/%EA%B2%AC%EC%A0%81%EC%84%9C.html?t=abc+123",
  );
});

test("가이드북 알림톡은 출발일과 공개 PDF 경로를 보낸다", async () => {
  const originalFetch = globalThis.fetch;
  let body;
  globalThis.fetch = async (_url, init) => {
    body = JSON.parse(init.body);
    return new Response(JSON.stringify({ groupId:"group-guidebook" }), { status:200, headers:{ "Content-Type":"application/json" } });
  };
  try {
    await notifyCustomerGuidebook(ENV, { phone:"010-1234-5678", name:"홍길동", depart:"2026-08-18" });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(body.message.kakaoOptions.templateId, "KA01TP-guidebook");
  assert.deepEqual(body.message.kakaoOptions.variables, {
    "#{고객명}":"홍길동",
    "#{출발일}":"2026-08-18",
    "#{회사명}":"몽골리아 은하수 여행사",
    "#{링크}":"guidebooks/mongolia-travel-guidebook-2026.pdf",
  });
  assert.equal(body.message.kakaoOptions.buttons, undefined);
});

test("알림톡 설정과 전화번호가 모두 있어야 발송 가능하다", () => {
  assert.equal(canSendKakao(ENV, { phone:"010-1234-5678", templateId:ENV.SOLAPI_TEMPLATE_QUOTE_ID }), true);
  assert.equal(canSendKakao({ ...ENV, SOLAPI_PF_ID:"" }, { phone:"01012345678", templateId:"tpl" }), false);
  assert.equal(canSendKakao(ENV, { phone:"123", templateId:"tpl" }), false);
});

test("견적과 확정일정표 알림톡은 승인 템플릿 변수와 기존 버튼을 사용한다", async () => {
  const originalFetch = globalThis.fetch;
  const bodies = [];
  globalThis.fetch = async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ groupId:"group-1" }), { status:200, headers:{ "Content-Type":"application/json" } });
  };
  try {
    await notifyCustomerQuoteReady(ENV, {
      phone:"010-1234-5678", name:"홍길동", token:"quote-token",
    });
    await notifyCustomerItineraryReady(ENV, {
      phone:"01012345678", name:"홍길동", token:"itinerary-token",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(bodies.length, 2);
  const quote = bodies[0].message;
  assert.equal(quote.to, "01012345678");
  assert.equal(quote.text, undefined);
  assert.equal(quote.kakaoOptions.templateId, "KA01TP-quote");
  assert.deepEqual(quote.kakaoOptions.variables, {
    "#{고객명}":"홍길동",
    "#{회사명}":"몽골리아 은하수 여행사",
    "#{링크}":"%EB%82%B4%EA%B2%AC%EC%A0%81.html?t=quote-token",
  });
  assert.equal(quote.kakaoOptions.buttons, undefined);
  assert.equal(bodies[1].message.kakaoOptions.templateId, "KA01TP-itinerary");
  assert.equal(bodies[1].message.kakaoOptions.variables["#{링크}"], "%EB%82%B4%EA%B2%AC%EC%A0%81.html?t=itinerary-token");
});
