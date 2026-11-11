/* ═══════════════════════════════════════════════════════════
   견적 도구 공통 확인 창·입력 창 (admin-dialog.js)
   ---------------------------------------------------------------
   브라우저 기본 confirm()/prompt() 대신 쓴다. React 관리자의 공통 확인 창
   (adminConfirm)과 같은 모양이고, 값은 admin-tokens.css의 변수를 쓴다.

     if (!await AdminDialog.confirm("…삭제할까요?")) return;
     const name = ((await AdminDialog.prompt("새 이름", "기본값")) || "").trim();

   - confirm: 확인이면 true, 취소·Esc·바깥 누르기는 false
   - prompt : 확인이면 입력한 글자, 취소면 null (기본 prompt와 같은 약속)
   - 문구에 ‘삭제’가 들어가면 빨간 삭제 버튼으로 보여 준다.
   답을 기다려야 하므로 부르는 함수는 async여야 한다.
   ═══════════════════════════════════════════════════════════ */
(function () {
  if (window.AdminDialog) return;

  var CSS = [
    ".admdlg-scrim{position:fixed;inset:0;z-index:2000;display:grid;place-items:center;padding:16px;background:var(--adm-scrim,rgba(26,27,30,.42));font-family:var(--adm-font,Pretendard,system-ui,sans-serif);}",
    ".admdlg{width:min(400px,100%);box-sizing:border-box;padding:24px;border-radius:var(--adm-radius-lg,16px);background:var(--adm-surface,#fff);color:var(--adm-text,#24262b);box-shadow:var(--adm-shadow-lg,0 8px 28px rgba(26,27,30,.12));}",
    ".admdlg-title{color:var(--adm-ink,#1a1b1e);font-size:16px;font-weight:700;}",
    ".admdlg-msg{margin-top:8px;color:var(--adm-text-2,#4a4e55);font-size:14px;line-height:1.6;white-space:pre-line;overflow-wrap:anywhere;}",
    ".admdlg-input{width:100%;height:var(--adm-control-h,40px);margin-top:14px;padding:0 12px;box-sizing:border-box;border:1px solid var(--adm-line,#e6e8ec);border-radius:var(--adm-radius-sm,8px);background:#fff;color:var(--adm-ink,#1a1b1e);font-family:inherit;font-size:var(--adm-fs-input,14px);outline:0;}",
    ".admdlg-input:focus{border-color:var(--adm-accent,#27ab8f);box-shadow:0 0 0 3px rgba(39,171,143,.18);}",
    ".admdlg-foot{display:flex;justify-content:flex-end;gap:8px;margin-top:24px;}",
    ".admdlg-btn{min-width:84px;height:var(--adm-control-h,40px);padding:0 14px;border:1px solid var(--adm-line-strong,#d7dae0);border-radius:var(--adm-radius-sm,8px);background:#fff;color:var(--adm-ink,#1a1b1e);font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;}",
    ".admdlg-btn:hover{background:var(--adm-gray-50,#f7f8fa);}",
    ".admdlg-btn.is-primary{border-color:var(--adm-primary-bg,#27ab8f);background:var(--adm-primary-bg,#27ab8f);color:#fff;}",
    ".admdlg-btn.is-danger{border-color:var(--adm-danger,#ff4f4f);background:var(--adm-danger,#ff4f4f);color:#fff;}",
    ".admdlg-btn:focus-visible{outline:0;box-shadow:0 0 0 3px rgba(39,171,143,.18);}",
    "@media (max-width:760px){.admdlg-scrim{place-items:end stretch;padding:0;}.admdlg{width:100%;padding:24px 16px calc(16px + env(safe-area-inset-bottom,0px));border-radius:16px 16px 0 0;}.admdlg-btn{flex:1;height:44px;}.admdlg-input{height:44px;font-size:16px;}}"
  ].join("\n");

  function ensureStyle() {
    if (document.getElementById("admdlg-style")) return;
    var style = document.createElement("style");
    style.id = "admdlg-style";
    style.appendChild(document.createTextNode(CSS));
    (document.head || document.documentElement).appendChild(style);
  }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  /* 한 번에 하나만 연다. 열려 있는데 또 부르면 앞의 것은 취소로 끝낸다. */
  var closeCurrent = null;

  function open(options) {
    ensureStyle();
    if (closeCurrent) closeCurrent(false);
    return new Promise(function (resolve) {
      var message = String(options.message == null ? "" : options.message);
      var danger = options.danger != null ? !!options.danger : /삭제/.test(message);
      var isPrompt = options.kind === "prompt";
      var scrim = el("div", "admdlg-scrim");
      var box = el("div", "admdlg");
      box.setAttribute("role", isPrompt ? "dialog" : "alertdialog");
      box.setAttribute("aria-modal", "true");
      var title = el("div", "admdlg-title", options.title || (isPrompt ? "입력" : danger ? "삭제할까요?" : "확인"));
      var body = el("div", "admdlg-msg", message);
      var input = null;
      box.appendChild(title);
      box.appendChild(body);
      if (isPrompt) {
        input = el("input", "admdlg-input");
        input.type = "text";
        input.value = options.value == null ? "" : String(options.value);
        input.setAttribute("aria-label", message.split("\n")[0]);
        box.appendChild(input);
      }
      var foot = el("div", "admdlg-foot");
      var cancel = el("button", "admdlg-btn", options.cancelLabel || "취소");
      var ok = el("button", "admdlg-btn " + (danger ? "is-danger" : "is-primary"), options.confirmLabel || (danger ? "삭제" : "확인"));
      cancel.type = "button"; ok.type = "button";
      foot.appendChild(cancel); foot.appendChild(ok);
      box.appendChild(foot);
      scrim.appendChild(box);

      var previous = document.activeElement;
      var done = false;
      function finish(accepted) {
        if (done) return;
        done = true;
        closeCurrent = null;
        document.removeEventListener("keydown", onKey, true);
        if (scrim.parentNode) scrim.parentNode.removeChild(scrim);
        try { if (previous && previous.focus) previous.focus(); } catch (e) { /* 사라진 요소 */ }
        resolve(isPrompt ? (accepted ? input.value : null) : !!accepted);
      }
      function onKey(event) {
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); finish(false); }
        else if (event.key === "Enter" && (isPrompt || document.activeElement === ok)) { event.preventDefault(); event.stopPropagation(); finish(true); }
      }
      closeCurrent = finish;
      cancel.onclick = function () { finish(false); };
      ok.onclick = function () { finish(true); };
      scrim.addEventListener("mousedown", function (event) { if (event.target === scrim) finish(false); });
      document.addEventListener("keydown", onKey, true);
      (document.body || document.documentElement).appendChild(scrim);
      if (input) { input.focus(); input.select(); } else ok.focus();
    });
  }

  window.AdminDialog = {
    confirm: function (message, options) {
      var o = options || {};
      return open({ kind: "confirm", message: message, title: o.title, danger: o.danger, confirmLabel: o.confirmLabel, cancelLabel: o.cancelLabel });
    },
    prompt: function (message, value, options) {
      var o = options || {};
      return open({ kind: "prompt", message: message, value: value, title: o.title, danger: false, confirmLabel: o.confirmLabel, cancelLabel: o.cancelLabel });
    }
  };
})();
