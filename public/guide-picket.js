/* ══════════ 가이드 피켓 — 공항 미팅용 A4 가로 피켓 ══════════
   디자인: Claude Design ‘이전 안 · 3단 밴드’(1123×794, A4 가로 96dpi).
   한 곳(캔버스)에서 그려서 미리보기·인쇄·PNG 저장이 모두 같은 모습이 되게 한다.
   - React(가이드 배정 현황·상품 가이드용 일정표)는 src/utils/guidePicket.ts가 이 파일을 불러 쓴다.
   - 견적 가이드 시트(public/가이드시트.html)는 <script src="guide-picket.js">로 바로 쓴다.
   입력: { customerName, startDate, endDate, guideName, guidePhone } (날짜는 YYYY-MM-DD) */
(function (root) {
  "use strict";
  var W = 1123, H = 794;                  // 디자인 좌표(A4 가로 96dpi)
  var PNG_W = 3508, PNG_H = 2480;         // A4 가로 300dpi
  var LOGO = "/img/brand/guide-picket-logo.png";
  var MINT = "#06C4A0", MINT_TEXT = "#007F75", INK = "#123B3A", LIGHT = "#BFE0D8";
  // 글꼴은 사이트와 같은 Pretendard 하나만 쓴다(디자인의 영문·손글씨 글꼴 자리도 Pretendard).
  var KR = '"Pretendard Variable", Pretendard, "Malgun Gothic", sans-serif';
  var EN = KR, PEN = KR;
  var FONT_CSS = [
    "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css",
  ];

  function text(v) { return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim(); }
  function parse(v) {
    var m = text(v).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    return m ? { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) } : null;
  }
  function pad(n) { return String(n).padStart(2, "0"); }

  /** 피켓에 들어갈 글자: 고객 이름(님), 날짜 범위, 박·일, 가이드 이름·연락처 */
  function fields(input) {
    input = input || {};
    var name = text(input.customerName).replace(/\s*님$/, "");
    var s = parse(input.startDate), e = parse(input.endDate);
    var dateText = "";
    if (s) {
      dateText = s.y + "." + pad(s.m) + "." + pad(s.d);
      if (e) dateText += " – " + (e.y !== s.y ? e.y + "." : "") + pad(e.m) + "." + pad(e.d);
    }
    var nightsText = "";
    if (s && e) {
      var nights = Math.round((Date.UTC(e.y, e.m - 1, e.d) - Date.UTC(s.y, s.m - 1, s.d)) / 864e5);
      if (nights >= 0) nightsText = nights + "박 " + (nights + 1) + "일";
    }
    var guideName = text(input.guideName);
    return {
      name: name ? name + "님" : "고객님",
      dateText: dateText,
      nightsText: nightsText,
      guideName: guideName || "가이드 배정 전",
      guidePhone: guideName ? text(input.guidePhone) : "",
    };
  }

  /** PNG 파일 이름: 가이드피켓_고객_출발일.png */
  function fileName(input) {
    var f = fields(input), s = parse(input && input.startDate);
    var base = ["가이드피켓", f.name.replace(/님$/, ""), s ? s.y + pad(s.m) + pad(s.d) : ""].filter(Boolean).join("_");
    return base.replace(/[\\/:*?"<>|\s]+/g, "") + ".png";
  }

  // ── 그리기 도구 ──
  function font(ctx, weight, size, family, spacingEm) {
    ctx.font = weight + " " + size + "px " + family;
    if ("letterSpacing" in ctx) ctx.letterSpacing = (spacingEm || 0) * size + "px";
  }
  function width(ctx, value) { return ctx.measureText(value).width; }
  function dots(ctx, list, r0) { list.forEach(function (c) { ctx.beginPath(); ctx.arc(c[0], c[1], c[2] || r0, 0, Math.PI * 2); ctx.fill(); }); }
  function star(ctx, points) {
    ctx.beginPath();
    points.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); });
    ctx.closePath(); ctx.fill();
  }
  function shift(points, dx, dy) { return points.map(function (p) { return [p[0] + dx, p[1] + dy]; }); }
  var STAR = [[0, 0], [3, 9], [12, 10], [5, 16], [7, 25], [0, 20], [-7, 25], [-5, 16], [-12, 10], [-3, 9]];
  var STAR_BIG = [[0, 0], [4, 11], [16, 12], [7, 20], [10, 32], [0, 26], [-10, 32], [-7, 20], [-16, 12], [-4, 11]];
  var STAR_MID = [[0, 0], [3, 8], [12, 9], [5, 15], [7, 24], [0, 19], [-7, 24], [-5, 15], [-12, 9], [-3, 8]];

  /** 디자인 좌표(1123×794)로 피켓을 그린다. 호출하는 쪽에서 배율을 맞춘다. */
  function draw(ctx, f, logo) {
    ctx.save();
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, W, H);

    // ① 위 밴드(민트) — 로고 · 회사명 · WELCOME
    ctx.fillStyle = MINT; ctx.fillRect(0, 0, W, 176);
    ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = "#FFFFFF";
    dots(ctx, [[430, 30, 1.6], [520, 140, 2], [600, 50, 1.3], [690, 120, 1.8], [760, 26, 1.4], [1080, 150, 1.6], [40, 150, 1.4], [1090, 24, 1.2]]);
    star(ctx, shift(STAR, 646, 84));
    ctx.restore();
    if (logo) {
      // 로고 칸 124×126에 비율을 지켜 넣는다(object-fit: contain).
      var ratio = Math.min(124 / (logo.naturalWidth || logo.width || 124), 126 / (logo.naturalHeight || logo.height || 126));
      var lw = (logo.naturalWidth || logo.width || 124) * ratio, lh = (logo.naturalHeight || logo.height || 126) * ratio;
      try { ctx.drawImage(logo, 64 + (124 - lw) / 2, 25 + (126 - lh) / 2, lw, lh); } catch (e) { /* 로고가 없어도 나머지는 그린다 */ }
    }
    ctx.fillStyle = "rgba(255,255,255,0.45)"; ctx.fillRect(216, 46, 2, 84);
    ctx.fillStyle = "#FFFFFF"; ctx.textAlign = "left";
    font(ctx, 700, 16, EN, 0.24); ctx.fillText("MILKYWAY MONGOLIA", 246, 51);
    font(ctx, 700, 34, KR, -0.02); ctx.fillText("몽골리아 은하수 여행", 246, 88);
    font(ctx, 500, 17, KR, 0.02); ctx.fillText("100% 프라이빗 맞춤 투어 · 한국어 전용 가이드", 246, 124);
    ctx.textAlign = "right";
    font(ctx, 800, 64, EN, -0.02); ctx.fillText("WELCOME", 1059, 77);
    font(ctx, 600, 16, EN, 0.28); ctx.fillText("TO MONGOLIA", 1059 + 0.28 * 16, 122);

    // ② 가운데 — 은하수 띠 · “드디어 만났어요!” · 고객 이름 · 날짜
    ctx.save(); ctx.translate(0, 176);
    ctx.beginPath(); ctx.rect(0, 0, W, 522); ctx.clip();
    ctx.beginPath(); ctx.moveTo(-40, 420); ctx.bezierCurveTo(200, 300, 460, 240, 720, 230); ctx.bezierCurveTo(880, 224, 1000, 200, 1160, 140);
    ctx.strokeStyle = "rgba(6,196,160,0.08)"; ctx.lineWidth = 120; ctx.lineCap = "round"; ctx.stroke();
    ctx.save(); ctx.globalAlpha = 0.7; ctx.fillStyle = MINT;
    dots(ctx, [[110, 380, 2.4], [250, 330, 1.5], [400, 280, 2.2], [560, 250, 1.4], [720, 232, 2.4], [880, 214, 1.5], [1020, 180, 2.2], [170, 420, 1.2], [640, 260, 1.2], [960, 230, 1.2], [80, 60, 1.6], [1050, 470, 1.8]]);
    ctx.restore();
    ctx.fillStyle = MINT; star(ctx, shift(STAR_BIG, 1000, 400)); star(ctx, shift(STAR_MID, 80, 110));
    ctx.restore();

    ctx.textAlign = "center";
    ctx.save(); ctx.translate(W / 2, 265); ctx.rotate(-2.5 * Math.PI / 180);
    ctx.fillStyle = MINT_TEXT; font(ctx, 700, 46, PEN, -0.02); ctx.fillText("드디어 만났어요!", 0, 0);
    ctx.restore();

    var size = 236; font(ctx, 800, size, KR, -0.045);
    var nameW = width(ctx, f.name);
    if (nameW > W - 96) { size = Math.max(96, Math.floor(size * (W - 96) / nameW)); font(ctx, 800, size, KR, -0.045); }
    ctx.fillStyle = INK; ctx.fillText(f.name, W / 2 + 0.0225 * size, 426);

    if (f.dateText || f.nightsText) {
      font(ctx, 700, 40, EN, -0.02); var dateW = f.dateText ? width(ctx, f.dateText) : 0;
      font(ctx, 600, 26, KR, 0); var nightsW = f.nightsText ? width(ctx, f.nightsText) : 0;
      var inner = 26 + (dateW ? 16 + dateW : 0) + (nightsW ? 16 + 1 + 16 + nightsW : 0);
      var pillW = inner + 60 + 4, pillH = 72, px = (W - pillW) / 2, py = 566, cy = py + pillH / 2;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(px + 1, py + 1, pillW - 2, pillH - 2, (pillH - 2) / 2) : ctx.rect(px + 1, py + 1, pillW - 2, pillH - 2);
      ctx.fillStyle = "#FFFFFF"; ctx.fill(); ctx.strokeStyle = MINT; ctx.lineWidth = 2; ctx.stroke();
      var x = px + 32;
      // 달력 아이콘(24 기준 → 26px)
      ctx.save(); ctx.translate(x, cy - 13); ctx.scale(26 / 24, 26 / 24);
      ctx.strokeStyle = MINT_TEXT; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(3, 5, 18, 16, 3) : ctx.rect(3, 5, 18, 16); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(3, 10); ctx.lineTo(21, 10); ctx.moveTo(8, 3); ctx.lineTo(8, 7); ctx.moveTo(16, 3); ctx.lineTo(16, 7); ctx.stroke();
      ctx.restore();
      x += 26; ctx.textAlign = "left";
      if (dateW) { x += 16; font(ctx, 700, 40, EN, -0.02); ctx.fillStyle = MINT_TEXT; ctx.fillText(f.dateText, x, cy + 1); x += dateW; }
      if (nightsW) {
        x += 16; ctx.fillStyle = "#B9EDE2"; ctx.fillRect(x, cy - 15, 1, 30); x += 17;
        font(ctx, 600, 26, KR, 0); ctx.fillStyle = "#4F6B69"; ctx.fillText(f.nightsText, x, cy + 1);
      }
    }

    // ③ 아래 밴드(진녹) — 함께할 가이드 · 연락처 · 사이트
    ctx.fillStyle = INK; ctx.fillRect(0, 698, W, 96);
    var by = 746, gx = 64; ctx.textAlign = "left";
    font(ctx, 600, 16, KR, 0.1); ctx.fillStyle = MINT; ctx.fillText("함께할 가이드", gx, by); gx += width(ctx, "함께할 가이드") + 18;
    font(ctx, 600, 30, KR, -0.01); ctx.fillStyle = "#FFFFFF"; ctx.fillText(f.guideName, gx, by); gx += width(ctx, f.guideName) + 18;
    if (f.guidePhone) { font(ctx, 500, 26, EN, 0); ctx.fillStyle = LIGHT; ctx.fillText(f.guidePhone, gx, by); }
    ctx.textAlign = "right"; font(ctx, 600, 16, EN, 0.18); ctx.fillStyle = LIGHT; ctx.fillText("MONGOLIASKY.CO.KR", 1059 + 0.18 * 16, by);
    ctx.restore();
  }

  // ── 브라우저: 글꼴·로고를 준비하고 A4 300dpi PNG로 만든다 ──
  var fontsReady = null;
  function ensureFonts(f) {
    var doc = root.document;
    if (!doc || !doc.fonts) return Promise.resolve();
    // 글꼴 스타일시트(@font-face)가 붙은 뒤에야 fonts.load가 실제 파일을 받는다.
    var sheets = FONT_CSS.map(function (href) {
      var link = doc.querySelector('link[href="' + href + '"]');
      if (link && link.sheet) return Promise.resolve();
      if (!link) { link = doc.createElement("link"); link.rel = "stylesheet"; link.href = href; doc.head.appendChild(link); }
      return new Promise(function (resolve) { link.addEventListener("load", resolve, { once: true }); link.addEventListener("error", resolve, { once: true }); });
    });
    var sample = [f.name, f.nightsText, f.guideName, f.dateText, f.guidePhone, "몽골리아 은하수 여행 100% 프라이빗 맞춤 투어 · 한국어 전용 가이드 함께할 가이드 드디어 만났어요!",
      "MILKYWAY MONGOLIA WELCOME TO MONGOLIASKY.CO.KR 0123456789 .–+-"].join(" ");
    var wanted = [800, 700, 600, 500].map(function (weight) { return [weight + " 40px " + KR, sample]; });
    // 실제 글자로 글꼴(부분 집합)을 받는다. 늦어도 4초 안에 그린다.
    var load = Promise.all(sheets).then(function () {
      return Promise.all(wanted.map(function (w) { return doc.fonts.load(w[0], w[1]).catch(function () { return []; }); }));
    }).then(function () { return doc.fonts.ready; });
    var cap = new Promise(function (resolve) { setTimeout(resolve, 4000); });
    fontsReady = Promise.race([load, cap]);
    return fontsReady;
  }
  var logoReady = null;
  function loadLogo() {
    if (logoReady) return logoReady;
    logoReady = new Promise(function (resolve) {
      if (typeof root.Image !== "function") { resolve(null); return; }
      var img = new root.Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = LOGO;
    });
    return logoReady;
  }

  function render(input) {
    var f = fields(input);
    return Promise.all([ensureFonts(f), loadLogo()]).then(function (r) {
      var canvas = root.document.createElement("canvas");
      canvas.width = PNG_W; canvas.height = PNG_H;
      var ctx = canvas.getContext("2d");
      ctx.scale(PNG_W / W, PNG_H / H);
      draw(ctx, f, r[1]);
      return canvas;
    });
  }
  function toDataUrl(input) { return render(input).then(function (c) { return c.toDataURL("image/png"); }); }
  function toBlob(input) {
    return render(input).then(function (c) {
      return new Promise(function (resolve, reject) { c.toBlob(function (b) { b ? resolve(b) : reject(new Error("피켓 이미지를 만들지 못했습니다.")); }, "image/png"); });
    });
  }
  /** PNG로 저장(내려받기) */
  function download(input) {
    return toBlob(input).then(function (blob) {
      var url = URL.createObjectURL(blob), a = root.document.createElement("a");
      a.href = url; a.download = fileName(input); root.document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    });
  }
  /** 새 창에서 A4 가로 한 장으로 인쇄 */
  function print(input) {
    var w = root.open("", "_blank");
    if (!w) return Promise.reject(new Error("팝업이 막혀 있어요. 팝업을 허용해 주세요."));
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>가이드 피켓</title><style>@page{size:A4 landscape;margin:0}html,body{margin:0;background:#fff}img{display:block;width:297mm;height:210mm}</style></head><body><p style="font:14px sans-serif;padding:24px">피켓을 만드는 중…</p></body></html>');
    w.document.close();
    return toDataUrl(input).then(function (url) {
      w.document.body.innerHTML = "";
      var img = w.document.createElement("img"); img.alt = "가이드 피켓";
      img.onload = function () { setTimeout(function () { w.focus(); w.print(); }, 150); };
      img.src = url; w.document.body.appendChild(img);
    }, function (error) { w.close(); throw error; });
  }

  root.GuidePicket = { W: W, H: H, PNG_W: PNG_W, PNG_H: PNG_H, fields: fields, fileName: fileName, draw: draw, render: render, toDataUrl: toDataUrl, toBlob: toBlob, download: download, print: print };
})(typeof window !== "undefined" ? window : globalThis);
