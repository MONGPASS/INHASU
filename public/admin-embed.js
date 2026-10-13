/* ═══════════════════════════════════════════════════════════
   몽골리아 은하수 · 견적 관리 도구 임베드 대응 (admin-embed.js)
   ---------------------------------------------------------------
   통합 관리자(/admin/quote-desk)가 이 페이지를 같은 출처 iframe으로
   끼워 넣었을 때만 동작합니다. 단독(새 창)으로 열면 아무것도 하지 않아
   화면과 로그인 방식이 예전 그대로입니다.

   임베드 상태에서 하는 일
   - <html>에 admin-embedded 클래스를 붙입니다.
   - 페이지 자체의 좌측 메뉴(로고·메뉴·새로고침·로그아웃)를 숨깁니다.
     메뉴 이동·새로고침·로그아웃은 바깥 통합 관리자의 것을 씁니다.
   - 메뉴 폭만큼 띄워 두었던 고정 요소를 왼쪽 끝으로 붙입니다.

   로그인은 건드리지 않습니다. 통합 관리자가 iframe을 띄우기 전에
   sessionStorage["leaders_admin_token"]을 채워 두므로(같은 탭·같은 출처의
   iframe은 sessionStorage를 함께 씁니다) 각 페이지의 기존 코드가 그대로 통과합니다.
   토큰이 없으면 기존처럼 페이지 자체 비밀번호 화면이 뜹니다.

   각 페이지의 <head> 맨 끝에서 불러 주세요(본문이 그려지기 전에 숨김 처리).
   ═══════════════════════════════════════════════════════════ */
(function () {
  var embedded = false;
  try { embedded = window.self !== window.top; } catch (e) { embedded = true; }
  if (!embedded) return;

  var root = document.documentElement;
  root.className = (root.className ? root.className + " " : "") + "admin-embedded";

  var css = [
    /* 자체 좌측 메뉴 숨김 — 좁은 화면에서 상단 바로 바뀌는 경우(견적관리)도 포함 */
    "html.admin-embedded .shell > .side { display:none !important; }",
    /* 예약목록: 메뉴 폭을 뺀 고정 너비(100vw - 232px) 대신 영역 전체를 씁니다 */
    "html.admin-embedded .shell > .content { width:100%; }",
    /* 견적만들기 하단 합계 바 · 견적관리/명소관리의 저장 상태 표시 */
    "html.admin-embedded .bottom { left:0; }",
    "html.admin-embedded .mode, html.admin-embedded .storage { left:12px; }",
    /* 로그아웃은 통합 관리자에서만 (견적관리 좌측 메뉴 · 모바일 관리자 메뉴) */
    "html.admin-embedded #navLogout, html.admin-embedded [onclick*=\"App.logout()\"] { display:none !important; }"
  ].join("\n");

  var style = document.createElement("style");
  style.setAttribute("data-admin-embed", "");
  style.appendChild(document.createTextNode(css));
  (document.head || root).appendChild(style);
})();
