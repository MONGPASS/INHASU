/* 견적만들기 STEP 2의 일자별 카드. 정적 견적 화면과 React 예약 화면이 함께 사용합니다. */
(function (global) {
  "use strict";
  let mountSequence = 0;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const strings = value => Array.isArray(value) ? value.filter(item => typeof item === "string") : [];
  const datePlaceholder = (start, index) => {
    if (!start) return "";
    const date = new Date(String(start).slice(0, 10) + "T00:00:00Z");
    if (!Number.isFinite(date.getTime())) return "";
    date.setUTCDate(date.getUTCDate() + index);
    return `${String(date.getUTCMonth() + 1).padStart(2, "0")}.${String(date.getUTCDate()).padStart(2, "0")}(${["일", "월", "화", "수", "목", "금", "토"][date.getUTCDay()]})`;
  };
  const parseMove = value => {
    const match = String(value || "").match(/^(.*?)(\(.*\))?\s*$/);
    return { move: (match?.[1] || "").trim(), dist: (match?.[2] || "").trim() };
  };
  const snippetOptions = options => {
    const map = options.snippets && typeof options.snippets === "object" && !Array.isArray(options.snippets) ? options.snippets : {};
    const categories = strings(options.snippetCats);
    const byCategory = Object.create(null);
    Object.entries(map).forEach(([name, value]) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return;
      const category = String(value.cat || "").trim() || "기타";
      (byCategory[category] ||= []).push(name);
    });
    const order = [...new Set([...categories.filter(name => byCategory[name]), ...Object.keys(byCategory).filter(name => !categories.includes(name) && name !== "기타")])];
    if (byCategory["기타"] && !order.includes("기타")) order.push("기타");
    return `<option value="">📋 일정 불러오기…</option>` + order.map(category => `<optgroup label="${esc(category)}">${byCategory[category].map(name => `<option value="${esc(name)}">${esc(name)}</option>`).join("")}</optgroup>`).join("");
  };

  function mount(root, initialOptions) {
    if (!root || typeof root.querySelectorAll !== "function") throw new Error("일정 카드를 표시할 영역이 필요합니다.");
    const fieldPrefix = `qde-${++mountSequence}`;
    let options = initialOptions || {};
    let cards = [];
    let listeners = null;
    let previousExtras = !!options.extras;
    let dragIndex = null;
    let keyboardTarget = null;
    let destroyed = false;
    root.classList.add("quote-day-editor");
    const listen = (element, event, callback) => element?.addEventListener(event, callback, { signal: listeners.signal });
    const field = (index, name, value) => { if (!options.disabled) options.onField?.(index, name, value); };
    const clearDrag = () => {
      dragIndex = null;
      cards.forEach(card => { card.draggable = false; card.classList.remove("dragging", "drag-over"); });
    };
    const setValue = (control, value) => {
      // Input updates come back through React after each keystroke. Keep the
      // focused textarea's raw newline/blank lines and its selection unchanged.
      if (!options.forceValues && root.ownerDocument.activeElement === control) return;
      const next = String(value ?? "");
      if (control.value !== next) control.value = next;
    };
    const paint = () => {
      if (destroyed) return;
      const days = Array.isArray(options.days) ? options.days : [];
      const extras = !!options.extras;
      if (days.length !== cards.length || extras !== previousExtras || !listeners) {
        listeners?.abort();
        listeners = new AbortController();
        previousExtras = extras;
        clearDrag();
        root.innerHTML = days.map((day, index) => `
          <div class="day-edit" data-i="${index}">
            <div class="dh">
              <span class="drag-handle" title="드래그해서 순서 변경" role="button" tabindex="0" aria-label="${index + 1}일차 순서 변경 · 위아래 화살표 키">⠿</span>
              <span class="badge">${esc(day.d || index + 1)}일차</span>
              <label class="qde-field-label qde-label-date" for="${fieldPrefix}-${index}-date">날짜</label>
              <input id="${fieldPrefix}-${index}-date" class="ddate" aria-label="${index + 1}일차 날짜" title="고객 여행일자 (선택) — 입력하면 견적서 일정표에 함께 표시됩니다">
              <label class="qde-field-label qde-label-dest" for="${fieldPrefix}-${index}-dest">방문 지역</label>
              <input id="${fieldPrefix}-${index}-dest" class="dest" aria-label="${index + 1}일차 목적지" placeholder="목적지">
              <label class="qde-field-label qde-label-move" for="${fieldPrefix}-${index}-move">이동 시간·거리</label>
              <input id="${fieldPrefix}-${index}-move" class="move" aria-label="${index + 1}일차 이동 시간과 거리" placeholder="이동 6시간 (300 km)">
              <button type="button" class="day-del" title="이 일자 삭제" aria-label="${index + 1}일차 삭제">✕</button>
            </div>
            <div class="snip-row">
              <label class="qde-field-label qde-label-snip" for="${fieldPrefix}-${index}-snip">저장된 일정 불러오기</label>
              <select id="${fieldPrefix}-${index}-snip" class="snip-sel" aria-label="${index + 1}일차 일정 불러오기"></select>
              <span class="snip-hint">클릭 한 번에 이 일자를 채웁니다. 없으면 아래에 직접 작성하세요.</span>
            </div>
            <label class="qde-field-label qde-label-items" for="${fieldPrefix}-${index}-items">상세 일정</label>
            <textarea id="${fieldPrefix}-${index}-items" class="items" aria-label="${index + 1}일차 세부 일정"></textarea>
            <div class="sub">숙소 / 식사(조·중·석)</div>
            <div class="row c2">
              <label class="qde-field-label qde-label-stay" for="${fieldPrefix}-${index}-stay">일정표 숙소</label>
              <input id="${fieldPrefix}-${index}-stay" class="stay" aria-label="${index + 1}일차 숙소" placeholder="숙소명">
              <label class="qde-field-label qde-label-meals" for="${fieldPrefix}-${index}-meals">식사</label>
              <input id="${fieldPrefix}-${index}-meals" class="meals" aria-label="${index + 1}일차 식사" placeholder="캠프식, 현지식당, 캠프식">
            </div>
            ${extras ? '<div class="quote-day-extra"></div>' : ""}
          </div>`).join("") + `<button type="button" class="day-add"${options.addButtonId ? ` id="${esc(options.addButtonId)}"` : ""}>＋ 일자 추가</button>`;
        cards = [...root.querySelectorAll(".day-edit")];
        cards.forEach((card, index) => {
          listen(card.querySelector(".ddate"), "input", event => field(index, "date", event.target.value.trim()));
          listen(card.querySelector(".dest"), "input", event => field(index, "dest", event.target.value.replace(/ \/ /g, "<br>")));
          listen(card.querySelector(".move"), "input", event => field(index, "move", parseMove(event.target.value)));
          listen(card.querySelector(".items"), "input", event => field(index, "items", event.target.value.split("\n").filter(line => line.trim())));
          listen(card.querySelector(".stay"), "input", event => field(index, "stay", { name: event.target.value, tags: [...strings(options.days?.[index]?.stay?.tags)] }));
          listen(card.querySelector(".meals"), "input", event => field(index, "meals", event.target.value.split(",").map(value => value.trim())));
          listen(card.querySelector(".snip-sel"), "change", event => {
            const name = event.target.value;
            if (!options.disabled && name && options.snippets?.[name]) options.onSnippet?.(index, name);
            event.target.value = "";
          });
          listen(card.querySelector(".day-del"), "click", () => { if (!options.disabled) options.onDelete?.(index); });
          const handle = card.querySelector(".drag-handle");
          const arm = () => { if (!options.disabled) card.draggable = true; };
          const disarm = () => { if (dragIndex === null) card.draggable = false; };
          listen(handle, "pointerdown", arm);
          listen(handle, "mousedown", arm);
          listen(handle, "pointerup", disarm);
          listen(handle, "mouseup", disarm);
          listen(handle, "keydown", event => {
            if (options.disabled || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
            event.preventDefault();
            const target = index + (event.key === "ArrowUp" ? -1 : 1);
            if (target < 0 || target >= cards.length) return;
            keyboardTarget = target;
            options.onReorder?.(index, target);
          });
          listen(card, "dragstart", event => {
            if (options.disabled || !card.draggable) { event.preventDefault(); return; }
            dragIndex = index;
            card.classList.add("dragging");
            if (event.dataTransfer) { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", String(index)); }
          });
          listen(card, "dragend", clearDrag);
          listen(card, "dragover", event => {
            if (options.disabled || dragIndex === null) return;
            event.preventDefault();
            if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
            if (dragIndex !== index) card.classList.add("drag-over");
          });
          listen(card, "dragleave", () => card.classList.remove("drag-over"));
          listen(card, "drop", event => {
            event.preventDefault();
            const from = dragIndex;
            clearDrag();
            if (!options.disabled && from !== null && from !== index) options.onReorder?.(from, index);
          });
        });
        listen(root.querySelector(".day-add"), "click", () => { if (!options.disabled) options.onAdd?.(); });
      }
      const snippetHtml = snippetOptions(options);
      cards.forEach((card, index) => {
        const day = days[index] || {};
        card.querySelector(".badge").textContent = `${day.d || index + 1}일차`;
        const dateInput = card.querySelector(".ddate");
        dateInput.placeholder = `${datePlaceholder(options.startDate, index) || "날짜"} (선택)`;
        setValue(dateInput, day.date || "");
        setValue(card.querySelector(".dest"), String(day.dest || "").replace(/<br\s*\/?>/gi, " / "));
        setValue(card.querySelector(".move"), `${day.move || ""} ${day.dist || ""}`);
        setValue(card.querySelector(".items"), strings(day.items).join("\n"));
        setValue(card.querySelector(".stay"), String(day.stay?.name || "").replace(/<br\s*\/?>/gi, " "));
        setValue(card.querySelector(".meals"), strings(day.meals).join(", "));
        const select = card.querySelector(".snip-sel");
        if (select.dataset.options !== snippetHtml) { select.innerHTML = snippetHtml; select.dataset.options = snippetHtml; }
        // Scope this to the original controls, leaving React portal contents owned by React.
        card.querySelectorAll(".dh > input, .dh > button, .snip-sel, textarea.items, .row.c2 > input").forEach(control => { control.disabled = !!options.disabled; });
        card.querySelector(".drag-handle").tabIndex = options.disabled ? -1 : 0;
        card.querySelector(".drag-handle").setAttribute("aria-disabled", options.disabled ? "true" : "false");
      });
      root.querySelector(".day-add").disabled = !!options.disabled;
      if (options.disabled) clearDrag();
      options.afterRender?.(cards);
      if (keyboardTarget !== null) { cards[keyboardTarget]?.querySelector(".drag-handle")?.focus(); keyboardTarget = null; }
    };
    paint();
    return {
      update(nextOptions) { if (destroyed) return; options = { ...options, ...nextOptions }; paint(); },
      destroy() { if (destroyed) return; destroyed = true; listeners?.abort(); clearDrag(); root.replaceChildren(); root.classList.remove("quote-day-editor"); cards = []; },
    };
  }
  global.QuoteDayEditor = { mount, parseMove, datePlaceholder };
})(typeof window === "undefined" ? globalThis : window);
