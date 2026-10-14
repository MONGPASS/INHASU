/* 견적만들기 STEP 4의 대표 명소 선택. 상품과 견적이 같은 위젯을 사용합니다. */
(function (global) {
  "use strict";
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const strings = value => Array.isArray(value) ? value.filter(item => typeof item === "string" && item) : [];
  const isRecord = value => value && typeof value === "object" && !Array.isArray(value);
  const categoryOf = value => typeof value?.region === "string" ? value.region.trim() : "";

  function groupsFor(options) {
    const spots = isRecord(options.spots) ? options.spots : {};
    const entries = Object.entries(spots).filter(([name, value]) => name && isRecord(value));
    const order = [...new Set(strings(options.categories).map(value => value.trim()).filter(Boolean))];
    entries.forEach(([, value]) => { const category = categoryOf(value); if (category && !order.includes(category)) order.push(category); });
    const selected = strings(options.selected);
    const groups = [...order.map(name => ({ label: name, items: entries.filter(([, value]) => categoryOf(value) === name) })),
      { label: "미분류", items: entries.filter(([, value]) => !categoryOf(value)) }].filter(group => group.items.length);
    const names = new Set(entries.map(([name]) => name));
    const missing = [...new Set(selected.filter(name => !names.has(name)))];
    if (missing.length) groups.push({ label: "저장된 명소", missing: true, items: missing.map(name => [name, { short: "저장된 명소 · 눌러 선택을 해제할 수 있습니다." }]) });
    return { groups, spots, selected };
  }

  function mount(host, initialOptions) {
    if (!host || typeof host.querySelectorAll !== "function") throw new Error("대표 명소를 표시할 영역이 필요합니다.");
    let options = initialOptions || {};
    let previousShape = "";
    let destroyed = false;
    const owner = host.ownerDocument;
    host.classList.add("quote-spot-selector");
    const onClick = event => {
      const button = event.target.closest?.("button.spot-chk");
      if (!button || !host.contains(button) || options.disabled || button.disabled) return;
      const name = button.dataset.s;
      const spots = isRecord(options.spots) ? options.spots : {};
      options.onToggle?.(name, Object.prototype.hasOwnProperty.call(spots, name) && isRecord(spots[name]) ? spots[name] : undefined);
    };
    host.addEventListener("click", onClick);

    const paint = () => {
      if (destroyed) return;
      const { groups, selected } = groupsFor(options);
      const shape = JSON.stringify(groups.map(group => ({ label: group.label, missing: !!group.missing,
        items: group.items.map(([name, value]) => [name, typeof value.short === "string" ? value.short : ""]) })));
      if (shape !== previousShape) {
        const focused = host.contains(owner.activeElement) ? owner.activeElement?.closest?.("button.spot-chk")?.dataset.s : null;
        previousShape = shape;
        host.innerHTML = groups.length ? groups.map(group => `<div class="spot-cat${group.missing ? " spot-missing" : ""}">
          <div class="spot-cat-head">${esc(group.label)}<span class="ln"></span><span class="cc"></span></div>
          <div class="spot-grid">${group.items.map(([name, value]) => `<button type="button" class="spot-chk" data-s="${esc(name)}" aria-pressed="false">
            <span class="box" aria-hidden="true"></span>
            <span class="nm"><b>${esc(name)}</b><small>${esc(typeof value.short === "string" ? value.short : "")}</small></span>
          </button>`).join("")}</div>
        </div>`).join("") : `<div class="spot-empty">등록된 명소가 없습니다. 명소 관리에서 추가하세요.</div>`;
        if (focused && !options.disabled) {
          const buttons = [...host.querySelectorAll("button.spot-chk")];
          (buttons.find(button => button.dataset.s === focused) || buttons[0])?.focus();
        }
      }
      host.querySelectorAll(".spot-cat").forEach(group => {
        const buttons = [...group.querySelectorAll("button.spot-chk")];
        let count = 0;
        buttons.forEach(button => {
          const index = selected.indexOf(button.dataset.s);
          const active = index >= 0;
          if (active) count++;
          button.classList.toggle("on", active);
          button.setAttribute("aria-pressed", active ? "true" : "false");
          button.disabled = !!options.disabled;
          button.querySelector(".box").textContent = active ? String(index + 1) : "";
        });
        group.querySelector(".cc").textContent = `${count ? `${count}개 선택 · ` : ""}${buttons.length}곳`;
      });
    };
    paint();
    return {
      update(nextOptions) { if (destroyed) return; options = { ...options, ...nextOptions }; paint(); },
      destroy() { if (destroyed) return; destroyed = true; host.removeEventListener("click", onClick); host.replaceChildren(); host.classList.remove("quote-spot-selector"); },
    };
  }
  global.QuoteSpotSelector = { mount };
})(typeof window === "undefined" ? globalThis : window);
