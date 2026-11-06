/* ═══════════════════════════════════════════════════════════
   몽골리아 은하수 · 옛 견적 관리 도구 단독 접속 차단 (admin-legacy-redirect.js)
   ---------------------------------------------------------------
   옛 견적 관리 도구(견적관리·예약목록·견적만들기·코스관리·일정관리·명소관리·리소스관리·
   예약관리·견적관리-모바일)를 새 탭·주소 입력·예전 즐겨찾기로 단독으로 열면 옛 관리자 메뉴가 보인다.
   데스크톱에서는 같은 메뉴의 새 관리자(/admin) 화면으로 바로 보낸다.

   - 새 관리자 안(같은 출처 iframe)에서는 아무것도 하지 않는다. 새 관리자가 이 문서들을 안쪽에 끼워 쓴다.
   - 휴대폰(화면 폭 820px 이하)은 새 관리자가 반응형이 아니므로 모바일 관리자(견적관리-모바일)를 그대로 쓴다.
   - 고객 문서(내견적·견적서·확정일정표 등)에는 넣지 않는다.

   각 문서 <head>의 charset 바로 다음에 불러 본문이 그려지기 전에 이동한다.
   ═══════════════════════════════════════════════════════════ */
(function () {
  var embedded = false;
  try { embedded = window.self !== window.top; } catch (e) { embedded = true; }
  if (embedded) return;
  var width = (window.screen && window.screen.width) || window.innerWidth || 9999;
  if (width <= 820) return;

  var path = window.location.pathname;
  try { path = decodeURIComponent(path); } catch (e) { /* 잘못된 인코딩은 원문으로 비교 */ }
  path = path.replace(/\.html$/i, "").replace(/\/+$/, "");
  var query = new URLSearchParams(window.location.search);
  var id = query.get("id") || "", qe = query.get("qe") || "", resourceType = query.get("resourceType") || "";
  var enc = encodeURIComponent;
  var targets = {
    "/견적관리": "/admin/quote-desk/inbox" + (id ? "?id=" + enc(id) : ""),
    "/견적관리-모바일": "/admin/quote-desk/inbox" + (qe ? "?qe=" + enc(qe) : id ? "?id=" + enc(id) : ""),
    "/예약목록": "/admin/quote-desk/bookings",
    "/예약관리": id ? "/admin/customer-workspace/quote/" + enc(id) : "/admin/quote-desk/bookings",
    "/견적만들기": "/admin/quote-desk/builder" + (id ? "?id=" + enc(id) : ""),
    "/코스관리": "/admin/quote-desk/courses",
    "/일정관리": "/admin/quote-desk/itinerary",
    "/명소관리": "/admin/quote-desk/spots",
    "/리소스관리": "/admin/quote-desk/resources" + (/^(guides|lodges|vehicles)$/.test(resourceType) ? "?resourceType=" + resourceType : ""),
  };
  var target = targets[path];
  if (target) window.location.replace(target);
})();
