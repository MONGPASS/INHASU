/* 견적 고객 페이지(내견적·계약서·여행자정보·확정일정표)의 머리·바닥을 사이트(React)와 같은 모양으로 그린다.
   - 사이트 원본: src/components/layout-desktop/DesktopHeader.tsx · DesktopFooter.tsx, src/components/mobile/MobileShell.tsx · MobileTabBar.tsx
     (메뉴·문구·회사 정보를 바꾸면 이 파일도 함께 바꾼다. tests/site-chrome.test.mjs가 메뉴 주소와 회사 정보를 비교한다.)
   - 각 문서의 <header class="mw-header">·<footer class="mw-footer"> 안쪽만 바꾼다. 문서 본문·id·스크립트·주소는 건드리지 않는다.
   - 관리자 미리보기(iframe, adminId·adminPrint·preview)와 인쇄에서는 바꾸지 않는다. */
(function () {
  "use strict";
  var KAKAO = "https://pf.kakao.com/_BSLaxl";
  var LOGO = "/img/brand/site-logo.webp";
  var NAV = [["홈", "/"], ["투어 상품", "/products"], ["동행 찾기", "/travel-mates"], ["여행 후기", "/reviews"], ["여행 가이드", "/travel-guide"], ["맞춤 견적", "/custom-estimate"], ["여행 기획전", "/promotions"]];
  var MENU = [
    ["TOURS", "투어 상품", [["전체 투어", "/products"], ["맞춤 견적", "/custom-estimate"]]],
    ["GUIDE", "여행 정보", [["여행 기획전", "/promotions"], ["여행 가이드", "/travel-guide"], ["여행 후기", "/reviews"], ["동행 찾기", "/travel-mates"], ["회사 소개", "/about"]]],
    ["SUPPORT", "고객 지원", [["맞춤 견적", "/custom-estimate"], ["예약 내역 확인", "/mypage/reservations"], ["자주 묻는 질문 (FAQ)", "/faq"], ["문의", KAKAO + "/chat"]]],
  ];
  var FOOT = [
    ["몽골 여행", [["몽골 여행 가이드", "/travel-guide"], ["몽골 투어 상품 목록", "/products"], ["몽골 승마 여행", "/category/horse-riding-tour"], ["고비사막 투어", "/category/gobi-desert"], ["동행 찾기", "/travel-mates"], ["맞춤 견적 요청", "/custom-estimate"]]],
    ["이용 안내", [["예약 안내", "/booking-flow"], ["자주 묻는 질문 (FAQ)", "/faq"], ["이용약관", "/terms-of-service"], ["개인정보처리방침", "/privacy-policy"], ["예약 내역 확인", "/mypage/reservations"]]],
    ["회사 정보", [["회사 소개", "/about"], ["여행 후기", "/reviews"], ["마이페이지", "/mypage"], ["카카오톡 문의", KAKAO + "/chat"]]],
  ];
  var TABS = [
    ["홈", "/", "M3.5 10.2L12 3.5l8.5 6.7M5.5 8.7V19a1.5 1.5 0 001.5 1.5h3.2v-5.2a1.8 1.8 0 013.6 0v5.2H17a1.5 1.5 0 001.5-1.5V8.7"],
    ["투어 상품", "/products", "M5 7.5h14a2 2 0 012 2v8.5a2 2 0 01-2 2H5a2 2 0 01-2-2V9.5a2 2 0 012-2zM8.5 7.5V6a2 2 0 012-2h3a2 2 0 012 2v1.5M3 12.5h18M10.5 12.5v1.5h3v-1.5"],
    ["동행 찾기", "/travel-mates", "M9 11.5a3.25 3.25 0 100-6.5 3.25 3.25 0 000 6.5zM3 19.5c.4-3.2 2.9-5.5 6-5.5s5.6 2.3 6 5.5M15.5 5.2a3.25 3.25 0 010 6.1M17.5 14.4c1.9.7 3.2 2.6 3.5 5.1"],
    ["여행 후기", "/reviews", "M12 3.8c4.6 0 8.2 3.3 8.2 7.4s-3.6 7.4-8.2 7.4c-1 0-2-.2-2.9-.5L4.5 20l1.3-3.6C4.6 15 3.8 13.2 3.8 11.2c0-4.1 3.6-7.4 8.2-7.4zM12 7.8l1.1 2.2 2.4.4-1.75 1.7.4 2.4-2.15-1.1-2.15 1.1.4-2.4-1.75-1.7 2.4-.4z"],
  ];
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var link = function (pair, cls) {
    var out = /^https?:/.test(pair[1]);
    return '<a' + (cls ? ' class="' + cls + '"' : '') + ' href="' + esc(pair[1]) + '"' + (out ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' + esc(pair[0]) + '</a>';
  };
  var svg = function (d, size, width) { return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (width || 1.6) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>'; };
  var path = function (d) { return '<path d="' + d + '"/>'; };
  var brand = function (size) {
    return '<a class="sc-brand" href="/" aria-label="몽골리아 은하수 홈"><img src="' + LOGO + '" alt="" width="' + size + '" height="' + size + '">' +
      '<span class="sc-brand-text"><span class="sc-brand-name">몽골리아<b> 은하수</b></span><span class="sc-brand-tag">몽골 여행·몽골 투어 전문</span></span></a>';
  };
  var SEARCH = '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>';
  var searchForm = function (cls) {
    return '<form class="' + cls + '" role="search" action="/products" method="get"><input name="q" type="search" placeholder="고비사막, 승마, 별밤 투어 검색" aria-label="투어 검색" autocomplete="off">' +
      '<button type="submit" aria-label="검색">' + svg(SEARCH, 24, 2.2) + '</button></form>';
  };
  var company = '<div><strong>[몽골본사]</strong><br>상호명: 몽골리아 은하수(SUUN ZAM) | 대표: Davaasuren Bilguun<br>사업자등록번호: 9011640064 | 관광사업등록번호: 6124313<br>전화번호: +976 9594 5838 | Tel: +976-8010-7766<br>위치: 울란바토르 바양주르흐구 13동 DACO센터 3층 306호</div>' +
    '<div><strong>[한국대리점]</strong><br>상호명: 헬로볼라 | 대표자: Davaasuren Bolor<br>사업자등록번호: 730-54-00614 | 통신판매업번호: 제2022-서울중랑-1776호<br>이메일: bolor1@hanmail.net<br>문의: <a class="sc-kakao" href="' + KAKAO + '" target="_blank" rel="noopener noreferrer">카카오톡 채널</a> 또는 채팅으로 문의해 주세요.</div>';

  function render(header, footer) {
    header.innerHTML =
      '<div class="sc-pc">' +
        '<div class="sc-util"><span>한국어 완벽 지원·현지 여행사</span><div>' + link(["로그인", "/login"]) + link(["회원가입", "/login"]) + link(["고객센터", "/faq"]) + '</div></div>' +
        '<div class="sc-top">' + brand(44) + searchForm("sc-search") +
          '<a class="sc-hot" href="/products?q=' + encodeURIComponent("고비사막") + '"><span>HOT</span>고비사막</a>' +
          '<div class="sc-icons">' +
            '<a href="/mypage">' + svg('<circle cx="10" cy="8" r="4"/><path d="M3 20c0-3.9 3.1-6.5 7-6.5"/><path d="M15 15h6M15 18h6M15 21h6"/>', 26) + '마이페이지</a>' +
            '<a href="/mypage/reservations">' + svg('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>', 26) + '예약 확인</a>' +
            '<a href="/mypage/wishlist">' + svg('<path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z"/>', 26) + '찜 목록</a>' +
          '</div></div>' +
      '</div>' +
      '<div class="sc-mo">' + brand(34) +
        '<button type="button" class="sc-ico" data-sc="search" aria-label="검색" aria-expanded="false">' + svg('<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>', 21, 1.9) + '</button>' +
        '<a class="sc-ico" href="/mypage/notifications" aria-label="알림">' + svg(path("M6 16.5V11a6 6 0 1112 0v5.5l1.5 2h-15zM10 20.5a2 2 0 004 0"), 23, 1.7) + '</a>' +
        '<button type="button" class="sc-ico" data-sc="menu" aria-label="전체 메뉴">' + svg(path("M4 7h16M4 12h16M4 17h16"), 22, 1.8) + '</button>' +
      '</div>' +
      '<div class="sc-mo-search" hidden>' + searchForm("sc-search") + '</div>';

    var nav = document.createElement("div");
    nav.className = "sc-nav" + (header.classList.contains("no-print") ? " no-print" : "");
    nav.innerHTML = '<div class="sc-nav-in"><button type="button" class="sc-all" data-sc="mega" aria-expanded="false"><span class="sc-burger"><i></i><i></i><i></i></span>전체 메뉴</button>' +
      '<nav aria-label="사이트 메뉴">' + NAV.map(function (item) { return link(item, item[1] === "/promotions" ? "sc-promo" : ""); }).join("") + '</nav>' +
      '<a class="sc-tel" href="tel:+97695945838"><i></i>+976 9594 5838</a></div>' +
      '<div class="sc-mega" hidden><div class="sc-mega-in">' + MENU.map(function (group) {
        return '<div><span class="sc-en">' + group[0] + '</span><span class="sc-h">' + group[1] + '</span>' + group[2].map(function (item) { return link(item); }).join("") + '</div>';
      }).join("") + '</div></div>';
    header.insertAdjacentElement("afterend", nav);

    if (footer) footer.innerHTML = '<div class="sc-foot">' +
      '<div class="sc-foot-cols"><div class="sc-foot-brand"><span class="sc-brand-name">몽골리아<b> 은하수</b></span><span class="sc-foot-en">Mongolia Milky Way (SUUN ZAM)</span>' +
        '<p>몽골 여행·몽골 투어 전문 현지 여행사입니다. 한국어에 능통한 전문 가이드가 동행하여 안심하고 떠날 수 있는 안전한 여행을 제안합니다.</p></div>' +
        FOOT.map(function (col) { return '<div class="sc-foot-col"><span>' + col[0] + '</span>' + col[1].map(function (item) { return link(item); }).join("") + '</div>'; }).join("") + '</div>' +
      '<div class="sc-foot-company">' + company + '</div>' +
      '<div class="sc-foot-legal"><span>© 2026 Mongolia Milky Way. All rights reserved.</span><div>' + link(["회사 소개", "/about"]) + link(["이용약관", "/terms-of-service"]) + link(["개인정보처리방침", "/privacy-policy"]) + '</div></div></div>';

    var tabbar = document.createElement("nav");
    tabbar.className = "sc-tabbar"; tabbar.setAttribute("aria-label", "메인 메뉴");
    tabbar.innerHTML = TABS.map(function (tab) { return '<a href="' + tab[1] + '"><span class="sc-tab-ico">' + svg(path(tab[2]), 22) + '</span>' + tab[0] + '</a>'; }).join("") +
      '<a href="/mypage" data-sc="my"><span class="sc-tab-ico"><span class="sc-avatar">' + svg(path("M12 12a4 4 0 100-8 4 4 0 000 8zM4.5 20.5c.8-3.7 3.9-6 7.5-6s6.7 2.3 7.5 6"), 16, 2) + '</span></span><span data-sc="my-label">마이페이지</span></a>';
    document.body.appendChild(tabbar);

    var drawer = document.createElement("div");
    drawer.className = "sc-drawer"; drawer.hidden = true; drawer.setAttribute("role", "dialog"); drawer.setAttribute("aria-modal", "true"); drawer.setAttribute("aria-label", "전체 메뉴");
    drawer.innerHTML = '<div class="sc-drawer-panel"><div class="sc-drawer-head">' + brand(34) + '<button type="button" class="sc-ico" data-sc="close" aria-label="닫기">×</button></div>' +
      MENU.map(function (group) { return '<div class="sc-drawer-group"><span class="sc-en">' + group[0] + '</span><span class="sc-h">' + group[1] + '</span>' + group[2].map(function (item) { return link(item); }).join("") + '</div>'; }).join("") +
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

    // 로그인 여부에 따라 하단 탭의 마지막 칸을 사이트와 같게: 로그인 전 ‘로그인’, 로그인 후 프로필 사진(없으면 이름 첫 글자).
    fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" }).then(function (response) { return response.ok ? response.json() : null; }).then(function (data) {
      var user = data && (data.user || (data.id ? data : null)), my = tabbar.querySelector('[data-sc="my"]');
      if (!user) { my.setAttribute("href", "/login"); my.querySelector('[data-sc="my-label"]').textContent = "로그인"; my.classList.add("is-guest"); return; }
      var avatar = my.querySelector(".sc-avatar"), image = user.avatarUrl || user.image;
      if (typeof image === "string" && /^https:\/\//.test(image)) { var img = new Image(); img.alt = ""; img.referrerPolicy = "no-referrer"; img.onload = function () { avatar.textContent = ""; avatar.appendChild(img); }; img.src = image; }
      else if (user.name) { avatar.textContent = String(user.name).trim().slice(0, 1).toUpperCase(); avatar.classList.add("is-initial"); }
    }).catch(function () { /* 탭은 기본(마이페이지) 그대로 둔다 */ });

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
