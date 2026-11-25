/* 견적 고객 페이지(내견적·계약서·여행자정보·확정일정표)의 머리·바닥을 사이트(React)와 같은 모양으로 그린다.
   - 사이트 원본(2026-11-25 새 디자인): src/components/layout-desktop/DesktopHeader.tsx · DesktopFooter.tsx, src/components/mobile/MobileShell.tsx · MobileTabBar.tsx
     (메뉴·문구·회사 정보를 바꾸면 이 파일도 함께 바꾼다. tests/site-chrome.test.mjs가 메뉴 주소와 회사 정보를 비교한다.)
   - 각 문서의 <header class="mw-header">·<footer class="mw-footer"> 안쪽만 바꾼다. 문서 본문·id·스크립트·주소는 건드리지 않는다.
   - 관리자 미리보기(iframe, adminId·adminPrint·preview)와 인쇄에서는 바꾸지 않는다. */
(function () {
  "use strict";
  var KAKAO = "https://pf.kakao.com/_BSLaxl";
  var NAV = [["투어 상품", "/products"], ["동행 찾기", "/travel-mates"], ["여행 후기", "/reviews"], ["여행 가이드", "/travel-guide"], ["맞춤 견적", "/custom-estimate"]];
  var SUB = [["여행 기획전", "/promotions"], ["고객센터", "/faq"]];
  var MENU = [
    ["투어 상품", [["전체 투어", "/products"], ["맞춤 견적", "/custom-estimate"]]],
    ["여행 정보", [["여행 기획전", "/promotions"], ["여행 가이드", "/travel-guide"], ["여행 후기", "/reviews"], ["동행 찾기", "/travel-mates"], ["회사 소개", "/about"]]],
    ["고객 지원", [["맞춤 견적", "/custom-estimate"], ["예약 내역 확인", "/mypage/reservations"], ["자주 묻는 질문 (FAQ)", "/faq"], ["문의", KAKAO + "/chat"]]],
  ];
  var FOOT = [
    ["여행 상품", [["몽골 여행 가이드", "/travel-guide"], ["투어 상품 목록", "/products"], ["승마 여행", "/category/horse-riding-tour"], ["고비사막 투어", "/category/gobi-desert"]]],
    ["예약·이용", [["맞춤 견적 요청", "/custom-estimate"], ["동행 찾기", "/travel-mates"], ["예약 안내", "/booking-flow"], ["예약 내역 확인", "/mypage/reservations"], ["자주 묻는 질문", "/faq"]]],
    ["회사", [["회사 소개", "/about"], ["여행 후기", "/reviews"], ["마이페이지", "/mypage"], ["카카오톡 문의", KAKAO + "/chat"]]],
  ];
  var HEAD_OFFICE = [["상호", "몽골리아 은하수 (SUUN ZAM)"], ["대표", "Davaasuren Bilguun"], ["사업자등록번호", "9011640064"], ["관광사업등록번호", "6124313"], ["전화", "+976 9594 5838 · +976 8010 7766"], ["주소", "울란바토르 바양주르흐구 13동 DACO센터 3층 306호"]];
  var KOREA_AGENCY = [["상호", "헬로볼라"], ["대표", "Davaasuren Bolor"], ["사업자등록번호", "730-54-00614"], ["통신판매업신고", "제2022-서울중랑-1776호"], ["이메일", "bolor1@hanmail.net"]];
  // 선 아이콘(24 격자) — src/components/site-seed/seed.tsx와 같은 모양
  var ICON = {
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    bell: '<path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 8 2.5 8h-17S6 15 6 9z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/><path d="M9 15l2 2 4-4"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    gift: '<rect x="3.5" y="8" width="17" height="4" rx="1"/><path d="M5 12v8.5h14V12M12 8v12.5"/><path d="M12 8C10 4 6.5 4.5 7.5 7c.4 1 2.5 1 4.5 1zM12 8c2-4 5.5-3.5 4.5-1-.4 1-2.5 1-4.5 1z"/>',
    support: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/><path d="M19 20a3 3 0 0 1-3 2h-3"/>',
    home: '<path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  };
  var SUB_ICON = [ICON.gift, ICON.support];
  var TABS = [["홈", "/", ICON.home], ["검색", "/products", ICON.search], ["예약 확인", "/mypage/reservations", ICON.calendar], ["찜 목록", "/mypage/wishlist", ICON.heart]];
  var FLAG_MN = '<svg width="32" height="16" viewBox="0 0 48 24" role="img" aria-label="몽골 국기"><rect width="48" height="24" fill="#C4272F"/><rect x="16" width="16" height="24" fill="#015197"/>' +
    '<g fill="#F9CF02"><path d="M8 2.2l0.9 1.8h-1.8z"/><path d="M6.6 3.6l0.7 1.4h-1.4zM9.4 3.6l0.7 1.4h-1.4z"/><circle cx="8" cy="6.8" r="1.3"/><path d="M5.8 8.2a2.2 2.2 0 0 0 4.4 0a2.2 1.4 0 0 1 -4.4 0z"/><path d="M6 10.6h4l-2 1.6z"/><rect x="6" y="12.6" width="4" height="0.8"/>' +
    '<circle cx="8" cy="16" r="2"/><rect x="6" y="18.6" width="4" height="0.8"/><path d="M6 20h4l-2 1.6z"/><rect x="3.6" y="10.6" width="1.2" height="11"/><rect x="11.2" y="10.6" width="1.2" height="11"/></g><path d="M8 14a1 1 0 0 1 0 2a1 1 0 0 0 0 2a2 2 0 0 1 0-4z" fill="#C4272F"/></svg>';
  var bars = function (x, y, rotate, spec) {
    return '<g transform="translate(' + x + ' ' + y + ') rotate(' + rotate + ')">' + spec.map(function (full, i) {
      var top = (-3.1 + i * 2.4).toFixed(1);
      return full ? '<rect x="-3.6" y="' + top + '" width="7.2" height="1.4"/>' : '<rect x="-3.6" y="' + top + '" width="3.1" height="1.4"/><rect x="0.5" y="' + top + '" width="3.1" height="1.4"/>';
    }).join("") + '</g>';
  };
  var FLAG_KR = '<svg class="sc-flag-kr" width="24" height="16" viewBox="0 0 36 24" role="img" aria-label="대한민국 국기"><rect width="36" height="24" fill="#ffffff"/>' +
    '<g transform="rotate(33.69 18 12)"><circle cx="18" cy="12" r="6" fill="#0047A0"/><path d="M12 12A6 6 0 0 1 24 12A3 3 0 0 1 18 12A3 3 0 0 0 12 12Z" fill="#CD2E3A"/></g>' +
    '<g fill="#000000">' + bars(7.85, 5.23, 303.69, [1, 1, 1]) + bars(28.15, 5.23, 56.31, [0, 1, 0]) + bars(7.85, 18.77, 236.31, [1, 0, 1]) + bars(28.15, 18.77, 123.69, [0, 0, 0]) + '</g></svg>';

  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var link = function (pair, cls, inner) {
    var out = /^https?:/.test(pair[1]);
    return '<a' + (cls ? ' class="' + cls + '"' : '') + ' href="' + esc(pair[1]) + '"' + (out ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' + (inner || "") + esc(pair[0]) + '</a>';
  };
  var svg = function (d, size, width) { return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (width || 1.6) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>'; };
  var brand = '<a class="sc-brand" href="/" aria-label="몽골리아 은하수 홈"><span class="sc-brand-name">몽골리아 은하수</span><span class="sc-brand-tag">몽골 여행·몽골 투어 전문</span></a>';
  var searchForm = function () {
    return '<form class="sc-search" role="search" action="/products" method="get"><input name="q" type="search" placeholder="겨울 은하수 투어 예약 받고 있어요" aria-label="투어 검색" autocomplete="off">' +
      '<button type="submit" aria-label="검색">' + svg(ICON.search, 20, 1.8) + '</button></form>';
  };
  var rows = function (list, extra) {
    return '<dl>' + list.map(function (row) { return '<dt>' + esc(row[0]) + '</dt><dd>' + esc(row[1]) + '</dd>'; }).join("") + (extra || "") + '</dl>';
  };

  function render(header, footer) {
    header.innerHTML =
      '<div class="sc-pc"><div class="sc-top">' + brand + searchForm() +
        '<div class="sc-icons">' +
          '<a href="/mypage/notifications">' + svg(ICON.bell, 26, 1.5) + '알림</a>' +
          '<a href="/mypage/wishlist">' + svg(ICON.heart, 26, 1.5) + '찜 목록</a>' +
          '<a href="/mypage" data-sc="account">' + svg(ICON.user, 26, 1.5) + '<span data-sc="account-label">마이페이지</span></a>' +
          '<a href="/mypage/reservations">' + svg(ICON.calendar, 26, 1.5) + '예약 확인</a>' +
        '</div></div></div>' +
      '<div class="sc-mo">' + brand + '<div class="sc-mo-btns">' +
        '<button type="button" class="sc-ico" data-sc="search" aria-label="검색" aria-expanded="false">' + svg(ICON.search, 24) + '</button>' +
        '<a class="sc-ico" href="/mypage/notifications" aria-label="알림">' + svg(ICON.bell, 24) + '</a>' +
        '<button type="button" class="sc-ico" data-sc="menu" aria-label="전체 메뉴">' + svg(ICON.menu, 24) + '</button>' +
      '</div></div>' +
      '<div class="sc-mo-search" hidden>' + searchForm() + '</div>';

    var nav = document.createElement("div");
    nav.className = "sc-nav" + (header.classList.contains("no-print") ? " no-print" : "");
    nav.innerHTML = '<div class="sc-nav-in"><nav aria-label="주 메뉴"><button type="button" class="sc-all" data-sc="mega" aria-expanded="false">' + svg(ICON.menu, 24, 2) + '전체 메뉴</button>' +
      NAV.map(function (item) { return link(item); }).join("") + '</nav>' +
      '<nav class="sc-sub" aria-label="보조 메뉴">' + SUB.map(function (item, i) { return link(item, i === 0 ? "sc-promo" : "", svg(SUB_ICON[i], 20, 1.7)); }).join("") + '</nav></div>' +
      '<div class="sc-mega" hidden><div class="sc-mega-in">' + MENU.map(function (group) {
        return '<div><span class="sc-h">' + group[0] + '</span>' + group[1].map(function (item) { return link(item); }).join("") + '</div>';
      }).join("") + '</div></div>';
    header.insertAdjacentElement("afterend", nav);

    if (footer) footer.innerHTML = '<div class="sc-foot">' +
      '<div class="sc-foot-cols"><div class="sc-foot-brand"><p class="sc-foot-name">몽골리아 은하수</p><p class="sc-foot-en">Mongolia Milky Way (SUUN ZAM)</p>' +
        '<p>한국어에 능통한 현지 가이드가 함께하는 몽골 여행·투어 전문 여행사예요.</p></div>' +
        FOOT.map(function (col) { return '<div class="sc-foot-col"><span>' + col[0] + '</span>' + col[1].map(function (item) { return link(item); }).join("") + '</div>'; }).join("") + '</div>' +
      '<div class="sc-foot-company">' +
        '<div><h3>' + FLAG_MN + '<span>몽골 본사</span></h3>' + rows(HEAD_OFFICE) + '</div>' +
        '<div><h3>' + FLAG_KR + '<span>한국 대리점</span></h3>' + rows(KOREA_AGENCY, '<dt>문의</dt><dd><a class="sc-kakao" href="' + KAKAO + '" target="_blank" rel="noopener noreferrer">카카오톡 채널</a></dd>') + '</div>' +
      '</div>' +
      '<div class="sc-foot-legal"><span>© 2026 Mongolia Milky Way. All rights reserved.</span><div>' + link(["이용약관", "/terms-of-service"]) + link(["개인정보처리방침", "/privacy-policy"], "sc-strong") + '</div></div></div>';

    var tabbar = document.createElement("nav");
    tabbar.className = "sc-tabbar"; tabbar.setAttribute("aria-label", "하단 메뉴");
    tabbar.innerHTML = TABS.map(function (tab) { return '<a href="' + tab[1] + '">' + svg(tab[2], 24) + '<span>' + tab[0] + '</span></a>'; }).join("") +
      '<a href="/mypage" data-sc="my">' + svg(ICON.user, 24) + '<span data-sc="my-label">마이페이지</span></a>';
    document.body.appendChild(tabbar);

    var drawer = document.createElement("div");
    drawer.className = "sc-drawer"; drawer.hidden = true; drawer.setAttribute("role", "dialog"); drawer.setAttribute("aria-modal", "true"); drawer.setAttribute("aria-label", "전체 메뉴");
    drawer.innerHTML = '<div class="sc-drawer-panel"><div class="sc-drawer-head">' + brand + '<button type="button" class="sc-ico" data-sc="close" aria-label="닫기">' + svg(ICON.close, 24) + '</button></div>' +
      MENU.map(function (group) { return '<div class="sc-drawer-group"><span class="sc-h">' + group[0] + '</span>' + group[1].map(function (item) { return link(item); }).join("") + '</div>'; }).join("") +
      '<a class="sc-drawer-talk" href="' + KAKAO + '/chat" target="_blank" rel="noopener noreferrer">카카오톡 상담</a></div>';
    document.body.appendChild(drawer);

    var mega = nav.querySelector(".sc-mega"), megaButton = nav.querySelector('[data-sc="mega"]');
    var moSearch = header.querySelector(".sc-mo-search"), searchButton = header.querySelector('[data-sc="search"]');
    var setMega = function (open) { mega.hidden = !open; megaButton.setAttribute("aria-expanded", String(open)); };
    var setDrawer = function (open) { drawer.hidden = !open; document.documentElement.classList.toggle("sc-lock", open); if (open) drawer.querySelector('[data-sc="close"]').focus(); };
    megaButton.addEventListener("click", function () { setMega(mega.hidden); });
    searchButton.addEventListener("click", function () {
      moSearch.hidden = !moSearch.hidden; searchButton.setAttribute("aria-expanded", String(!moSearch.hidden));
      if (!moSearch.hidden) moSearch.querySelector("input").focus();
    });
    header.querySelector('[data-sc="menu"]').addEventListener("click", function () { setDrawer(true); });
    drawer.addEventListener("click", function (event) { if (event.target === drawer || event.target.closest('[data-sc="close"]')) setDrawer(false); });
    document.addEventListener("click", function (event) { if (!mega.hidden && !nav.contains(event.target)) setMega(false); });
    document.addEventListener("keydown", function (event) { if (event.key === "Escape") { setMega(false); if (!drawer.hidden) setDrawer(false); } });
    [].forEach.call(document.querySelectorAll(".sc-search"), function (form) {
      form.addEventListener("submit", function (event) { if (!form.querySelector("input").value.trim()) event.preventDefault(); });
    });

    // 로그인 전이면 사이트와 같게 ‘마이페이지’ 칸을 ‘로그인’으로 바꾼다(PC 머리 아이콘과 휴대폰 하단 메뉴).
    fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" }).then(function (response) { return response.ok ? response.json() : null; }).then(function (data) {
      var user = data && (data.user || (data.id ? data : null));
      if (user) return;
      [[tabbar.querySelector('[data-sc="my"]'), '[data-sc="my-label"]'], [header.querySelector('[data-sc="account"]'), '[data-sc="account-label"]']].forEach(function (pair) {
        pair[0].setAttribute("href", "/login"); pair[0].querySelector(pair[1]).textContent = "로그인";
      });
    }).catch(function () { /* 기본(마이페이지) 그대로 둔다 */ });

    document.documentElement.classList.add("sc-on");
  }

  function start() {
    var header = document.querySelector("header.mw-header"), footer = document.querySelector("footer.mw-footer");
    var ready = function () { [header, footer].forEach(function (el) { if (el) el.classList.add("sc-ready"); }); };
    var params = new URLSearchParams(location.search), embedded = false;
    try { embedded = window.top !== window.self; } catch (error) { embedded = true; }
    if (header && !embedded && !["adminId", "adminPrint", "preview", "print"].some(function (key) { return params.has(key); })) {
      try { render(header, footer); } catch (error) { /* 실패하면 문서에 적힌 기존 머리·바닥을 그대로 보여 준다 */ }
    }
    ready();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
