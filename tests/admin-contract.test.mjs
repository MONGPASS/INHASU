import test from "node:test";
import assert from "node:assert/strict";
import { onRequestGet } from "../functions/api/requests/[id].js";

const makeEnv = () => ({
  ADMIN_TOKEN: "admin-secret",
  DB: {
    prepare() {
      return {
        bind() {
          return {
            async first() {
              return {
                data: JSON.stringify({
                  id: "req-1",
                  booking: {
                    contract: {
                      signedAt: "2026-07-13T10:00:00.000Z",
                      signImg: "data:image/png;base64,signature-original",
                    },
                  },
                }),
                status: "예약확정",
                memo: "",
              };
            },
          };
        },
      };
    },
  },
});

test("관리자 인증이 있어야 계약 서명 원본을 조회한다", async () => {
  const env = makeEnv();
  const unauthorized = await onRequestGet({
    request: new Request("https://example.com/api/requests/req-1"), env, params:{ id:"req-1" },
  });
  assert.equal(unauthorized.status, 401);

  const authorized = await onRequestGet({
    request: new Request("https://example.com/api/requests/req-1", {
      headers:{ "x-admin-token":"admin-secret" },
    }),
    env,
    params:{ id:"req-1" },
  });
  assert.equal(authorized.status, 200);
  const body = await authorized.json();
  assert.equal(body.item.booking.contract.signImg, "data:image/png;base64,signature-original");
});
