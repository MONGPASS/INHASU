/* ═══════════════════════════════════════════════════════════════
   관리자 모바일 하단 탭바 (admin-nav.js)
   ---------------------------------------------------------------
   admin·코스관리·일정관리·명소관리 페이지에서 로드되어,
   모바일(820px 이하)에서 앱처럼 하단 탭 내비게이션을 표시합니다.
   (견적만들기는 자체 하단 작업바가 있어 제외 — 탭바로 이동만 가능)
   ═══════════════════════════════════════════════════════════════ */
(function () {
  const here = decodeURIComponent((location.pathname.split("/").pop() || "").toLowerCase());
  const TABS = [
    { href: "/admin",         match: ["admin", "admin.html", ""], label: "홈",
      ic: '<rect x="3" y="10" width="18" height="11" rx="2"/><path d="M3 10 12 3l9 7"/>' },
    { href: "견적만들기.html", match: ["견적만들기.html"], label: "견적서",
      ic: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/>' },
    { href: "코스관리.html",   match: ["코스관리.html"], label: "코스",
      ic: '<path d="M9 6l11 0M9 12l11 0M9 18l11 0"/><circle cx="4" cy="6" r="1.6"/><circle cx="4" cy="12" r="1.6"/><circle cx="4" cy="18" r="1.6"/>' },
    { href: "일정관리.html",   match: ["일정관리.html"], label: "일정",
      ic: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>' },
    { href: "명소관리.html",   match: ["명소관리.html"], label: "명소",
      ic: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>' },
  ];

  const css = document.createElement("style");
  css.textContent = `
    .m-tabbar { display:none; }
    @media (max-width:820px) {
      body { padding-bottom: calc(64px + env(safe-area-inset-bottom)); }
      .m-tabbar { position:fixed; left:0; right:0; bottom:0; z-index:90; display:flex;
        background:rgba(255,255,255,.96); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px);
        border-top:1px solid #e8ecef; padding:6px 4px calc(6px + env(safe-area-inset-bottom));
        box-shadow:0 -6px 20px rgba(20,50,45,.06); }
      .m-tabbar a { flex:1; display:flex; flex-direction:column; align-items:center; gap:3px;
        padding:6px 0 4px; text-decoration:none; color:#9aa5a2; font-size:10.5px; font-weight:700;
        border-radius:12px; -webkit-tap-highlight-color:transparent; }
      .m-tabbar a svg { display:block; }
      .m-tabbar a.on { color:#06c4a0; }
      .m-tabbar a.on .mt-ic { background:#eaf7f3; }
      .m-tabbar .mt-ic { width:40px; height:26px; border-radius:9px; display:flex; align-items:center; justify-content:center; }
      /* 하단바 위로 띄워야 하는 고정 요소들 */
      .mode, .storage { bottom: calc(74px + env(safe-area-inset-bottom)) !important; }
      .toast { bottom: calc(84px + env(safe-area-inset-bottom)) !important; }
    }`;
  document.head.appendChild(css);

  const nav = document.createElement("nav");
  nav.className = "m-tabbar";
  nav.innerHTML = TABS.map(t => {
    const on = t.match.some(m => m.toLowerCase() === here);
    return `<a href="${t.href}" class="${on ? "on" : ""}">
      <span class="mt-ic"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${t.ic}</svg></span>${t.label}</a>`;
  }).join("");
  document.body.appendChild(nav);
})();
