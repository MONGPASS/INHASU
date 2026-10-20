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
  root.classList.add("admin-embedded");

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

  if (!document.querySelector("style[data-admin-embed]")) {
    var style = document.createElement("style");
    style.setAttribute("data-admin-embed", "");
    style.appendChild(document.createTextNode(css));
    (document.head || root).appendChild(style);
  }

  // Only the existing admin tools inside the same-origin, guarded quote workspace
  // receive the shared visual theme. Customer documents and standalone pages keep
  // their original document styles. This does not read or alter authentication.
  var managedFrame = false;
  try {
    var path = decodeURIComponent(window.location.pathname).replace(/\.html$/i, "").replace(/\/+$/, "");
    var tools = ["/견적관리", "/견적관리-모바일", "/견적만들기", "/예약목록", "/예약관리", "/코스관리", "/일정관리", "/명소관리", "/리소스관리"];
    managedFrame = window.top.location.origin === window.location.origin
      && /^\/admin\/(?:quote-desk(?:\/|$)|customer-workspace\/quote(?:\/|$))/.test(window.top.location.pathname)
      && tools.indexOf(path) !== -1;
  } catch (e) { /* A different-origin frame is not an admin styling target. */ }
  if (!managedFrame) return;

  root.classList.add("admin-redesigned");
  if (document.querySelector("link[data-admin-redesign]")) return;
  var theme = document.createElement("link");
  theme.rel = "stylesheet";
  theme.href = "/admin-redesign.css";
  theme.setAttribute("data-admin-redesign", "");
  (document.head || root).appendChild(theme);

  // Move the real controls, rather than recreating them: listeners, input values,
  // editor recovery and all request handlers remain owned by the original page.
  function node(tag, name, text) {
    var el = document.createElement(tag);
    if (name) el.className = name;
    if (text) el.textContent = text;
    return el;
  }
  function redesignInquiry() {
    var content = document.querySelector("#dash .content");
    var welcome = content && content.querySelector(".welcome");
    if (!content || !welcome || content.querySelector(".qr-inquiry-list")) return;
    root.classList.add("qr-inquiry-page");
    var title = welcome.querySelector("h1");
    if (title) { title.hidden = true; title.insertAdjacentElement("afterend", node("h1", "qr-inquiry-title", "견적 문의")); }
    var actions = node("div", "qr-inquiry-actions");
    var refresh = document.getElementById("navRefresh");
    if (refresh) { refresh.className = "btn"; actions.appendChild(refresh); }
    var booking = node("a", "btn", "통합 예약 목록"); booking.href = "/admin/reservations"; booking.target = "_top"; actions.appendChild(booking);
    var originalActions = document.querySelector("#overviewSection .btns");
    if (originalActions) {
      var extra = node("details", "qr-inquiry-extra"); extra.appendChild(node("summary", "btn", "내보내기 · 도구"));
      var menu = node("div", "qr-inquiry-extra-menu");
      Array.from(originalActions.children).forEach(function (control) {
        if (control.matches("a.primary")) actions.appendChild(control);
        else menu.appendChild(control);
      });
      extra.appendChild(menu); actions.appendChild(extra);
      var oldHead = document.querySelector("#overviewSection .sec-head"); if (oldHead) oldHead.hidden = true;
    }
    welcome.appendChild(actions);
    var list = document.getElementById("list"), anchor = document.getElementById("listAnchor"), toolbar = content.querySelector(".toolbar");
    if (list && anchor && toolbar) {
      var section = node("section", "qr-inquiry-list"); anchor.before(section);
      var heading = anchor.querySelector("h2"); if (heading) toolbar.prepend(heading);
      section.append(toolbar, list, node("p", "qr-inquiry-list-foot", "문의 항목을 선택하면 고객 정보와 진행 업무를 확인할 수 있습니다."));
      anchor.hidden = true;
    }
  }
  function redesignBuilder() {
    var main = document.querySelector(".ecol > main");
    if (!main || main.classList.contains("qr-builder-main")) return;
    main.classList.add("qr-builder-main"); root.classList.add("qr-builder-page");
    var header = document.querySelector(".ecol > header");
    if (header) {
      var back = node("a", "qr-builder-back", "‹ 견적 문의"); back.href = "견적관리.html";
      var heading = node("div", "qr-builder-title"); heading.append(node("small", "", "고객별 견적서"), node("strong", "", "견적서 작성"));
      header.prepend(back, heading);
      function updateBuilderHeading() {
        var customer = document.getElementById("f_customer"), destination = document.getElementById("f_destination"), quoteNo = document.getElementById("f_quoteNo");
        heading.querySelector("small").textContent = "견적서 작성" + (quoteNo && quoteNo.value.trim() ? " · " + quoteNo.value.trim() : "");
        heading.querySelector("strong").textContent = customer && customer.value.trim() ? customer.value.trim() + " 고객 견적" : destination && destination.value.trim() ? destination.value.trim() + " 여행 견적" : "견적서 작성";
      }
      main.addEventListener("input", updateBuilderHeading); main.addEventListener("change", updateBuilderHeading);
      var stepRow = document.getElementById("stepRow");
      if (stepRow) new MutationObserver(updateBuilderHeading).observe(stepRow, { childList: true });
      updateBuilderHeading();
    }
    var panels = Array.from(main.querySelectorAll(".panel"));
    panels.forEach(function (panel, index) {
      var heading = panel.querySelector(".phead");
      if (index !== 0) {
        var card = node("section", "qr-builder-card");
        Array.from(panel.childNodes).forEach(function (item) { if (item !== heading) card.appendChild(item); });
        panel.appendChild(card); return;
      }
      var info = node("section", "qr-builder-card");
      function fields(title, names) {
        info.appendChild(node("h3", "qr-builder-section-title", title));
        var row = node("div", "qr-builder-fields");
        names.forEach(function (name) { var input = document.getElementById(name); var label = input && input.closest("label.f"); if (label) row.appendChild(label); });
        info.appendChild(row);
      }
      fields("고객 · 일정", ["f_customer", "f_phone", "f_destination", "f_quoteNo", "f_depart", "f_return", "f_pax", "f_paxNote"]);
      fields("항공 · 이동", ["f_vehicle", "f_flightIn", "f_flightOut", "f_manager", "f_pickup", "f_drop"]);
      var intensity = document.getElementById("intDots"); if (intensity) info.appendChild(intensity.closest("label.f"));
      var nights = document.getElementById("nightsNote"); if (nights) info.appendChild(nights);
      var courses = node("section", "qr-builder-card qr-builder-course-card");
      var courseHeader = node("div", "qr-builder-course-head"); courseHeader.appendChild(node("h3", "qr-builder-section-title", "코스 불러오기"));
      var regions = node("div", "qr-builder-regions"); courseHeader.appendChild(regions); courses.appendChild(courseHeader);
      courses.appendChild(node("p", "hint", "코스를 고르면 저장된 일정·대표 명소·기본 요금이 함께 채워집니다."));
      var picks = document.getElementById("coursePick"); if (picks) courses.appendChild(picks);
      var clone = document.getElementById("cloneBtn"); if (clone) { var cloneBox = clone.parentElement.parentElement; cloneBox.classList.add("qr-builder-clone"); courses.appendChild(cloneBox); }
      panel.replaceChildren(heading, info, courses);
      if (picks) {
        var selected = "";
        function drawRegions() {
          var choices = Array.from(picks.querySelectorAll("[data-region]"));
          var names = [""].concat(Array.from(new Set(choices.map(function (item) { return item.getAttribute("data-region"); }).filter(Boolean))));
          if (names.indexOf(selected) === -1) selected = "";
          regions.replaceChildren();
          names.forEach(function (name) { var button = node("button", "", name || "전체"); button.type = "button"; button.setAttribute("aria-pressed", String(name === selected));
            button.onclick = function () { selected = name; drawRegions(); }; regions.appendChild(button); });
          choices.forEach(function (item) { item.hidden = !!selected && item.getAttribute("data-region") !== selected; });
        }
        new MutationObserver(drawRegions).observe(picks, { childList: true }); drawRegions();
      }
    });
  }
  function layoutTools() {
    if (path === "/견적관리") redesignInquiry();
    if (path === "/견적만들기") redesignBuilder();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", layoutTools, { once: true });
  else layoutTools();
})();
