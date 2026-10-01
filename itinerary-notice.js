/* Shared authenticated admin UI. Opening only previews; sending requires review.
   A stable booking-scoped key keeps repeated clicks, reloads and other tabs to one
   attempt, without storing or exposing the admin credential in the URL. */
(() => {
  const keyFor = id => `itinerary-admin-v1-${id}`;
  let active;
  window.ItineraryNotice = { open: async ({ id, token }) => {
    if (active?.open) { active.focus(); return; }
    const dialog = document.createElement("dialog");
    dialog.className = "itinerary-notice";
    dialog.setAttribute("aria-labelledby", "itinerary-notice-title");
    dialog.innerHTML = `
      <header><h2 id="itinerary-notice-title">확정일정표 알림</h2><button type="button" data-notice="close" aria-label="닫기">닫기</button></header>
      <p data-notice="status" role="status" aria-live="polite">발송 정보를 확인하고 있어요.</p>
      <div data-notice="preview" hidden>
        <p data-notice="recipient"></p><p data-notice="trip"></p>
        <p><strong>실제 템플릿 문구</strong></p><pre data-notice="wording"></pre>
        <p data-notice="template"></p>
        <a data-notice="link" target="_blank" rel="noopener">저장된 확정일정표 보기</a>
        <details><summary>템플릿·링크 설정 확인</summary><pre data-notice="config"></pre></details>
        <details data-notice="discovery"><summary>현재 채널 템플릿 조회 (읽기 전용)</summary>
          <p data-notice="discovery-status"></p><div data-notice="discovery-list"></div>
        </details>
        <p>저장된 예약 정보로 발송합니다. 예약 단계는 바뀌지 않습니다.</p>
        <label><input type="checkbox" data-notice="review" disabled>수신자와 확정일정표 안내 문구를 확인했습니다.</label>
        <button type="button" data-notice="send" disabled>확정일정표 알림 1회 발송</button>
      </div>`;
    const el = name => dialog.querySelector(`[data-notice="${name}"]`);
    document.body.append(dialog);
    active = dialog;
    dialog.addEventListener("close", () => { dialog.remove(); if (active === dialog) active = null; });
    el("close").onclick = () => dialog.close();
    dialog.showModal();
    const endpoint = `/api/requests/${encodeURIComponent(id)}/itinerary-notice`;
    const idempotencyKey = keyFor(id);
    const headers = { "x-admin-token":token };
    let busy = false, attempted = false, ready = false, preview;
    const showOutcome = data => {
      if (data.state === "accepted") {
        el("status").textContent = "발송 요청이 접수됐어요. 실제 수신 여부는 고객 또는 발송 이력에서 확인해 주세요.";
      } else {
        el("status").textContent = "이 알림의 발송 요청 이력이 있어요. 중복 발송을 막았습니다. 발송 서비스에서 결과를 확인해 주세요.";
      }
    };
    el("review").onchange = () => { el("send").disabled = !ready || busy || attempted || !el("review").checked; };
    el("send").onclick = async () => {
      if (!ready || busy || attempted || !el("review").checked) return;
      busy = true; attempted = true;
      el("send").disabled = true; el("review").disabled = true;
      el("status").textContent = "발송 요청 중…";
      try {
        const response = await fetch(endpoint, {
          method:"POST", headers:{ ...headers, "Content-Type":"application/json" },
          body:JSON.stringify({ idempotencyKey, templateId:preview.payload.templateId }),
        });
        const result = await response.json();
        if (result.state) showOutcome(result);
        else el("status").textContent = response.status === 401
          ? "로그인이 만료됐어요. 다시 로그인한 뒤 확인해 주세요."
          : "발송이 진행되지 않았어요. 예약·템플릿 설정을 다시 확인해 주세요.";
      } catch {
        el("status").textContent = "발송 결과를 확인할 수 없어요. 중복 발송을 막기 위해 발송 이력을 먼저 확인해 주세요.";
      } finally { busy = false; }
    };
    try {
      const response = await fetch(`${endpoint}?idempotencyKey=${encodeURIComponent(idempotencyKey)}`, { headers, cache:"no-store" });
      preview = await response.json();
      if (!response.ok || !preview.ok) throw new Error(response.status === 401 ? "로그인이 만료됐어요. 다시 로그인해 주세요." : "발송 정보를 불러오지 못했어요.");
      if (!dialog.open) return;
      const b = preview.booking, template = preview.template;
      el("recipient").textContent = `수신자: ${b.name || "-"} · ${preview.payload.phone || "전화번호 없음"}`;
      el("trip").textContent = `${b.depart || "-"} ~ ${b.return_ || "-"} · ${[b.adult,b.child,b.infant].reduce((n,v) => n + (Number(v)||0),0)}명 · ${b.status || "-"}`;
      let wording = template?.content || "템플릿 문구를 확인할 수 없습니다.";
      for (const [key,value] of Object.entries(preview.payload.variables || {})) wording = wording.split(key).join(String(value));
      el("wording").textContent = wording;
      el("template").textContent = `템플릿: ${template?.name || "-"} · 상태: ${template?.status || "확인 불가"}`;
      const link = preview.payload.variables?.["#{링크}"] || "";
      // Only the server's known relative itinerary path can become a clickable link.
      if (link.startsWith(`${encodeURI("확정일정표.html")}?t=`)) el("link").href = `/${link}`;
      else el("link").hidden = true;
      el("config").textContent = JSON.stringify({ configuration:preview.configuration, itineraryTemplate:template, quoteTemplate:preview.quoteTemplate, variables:preview.payload.variables, templateError:preview.templateError, templatesError:preview.templatesError }, null, 2);
      const discovery = preview.discovery;
      const items = discovery?.templates || [];
      el("discovery-status").textContent = !discovery?.ok
        ? "템플릿 목록을 불러오지 못했어요. Solapi에서 확인해 주세요."
        : `채널: ${discovery.profileId || "설정 없음"} · 일치 ${items.length}건 / 조회 ${discovery.fetchedCount}건. 최대 ${discovery.limit}건의 첫 조회 결과이며 전체 목록임을 보장하지 않습니다. 다른 채널·채널 미확인 템플릿 ${discovery.excludedCount}건은 제외했습니다. 목록에 없으면 Solapi에서 추가 확인해 주세요. 설정이나 발송은 변경되지 않습니다.`;
      for (const item of items) {
        const card = document.createElement("details");
        const summary = document.createElement("summary");
        summary.textContent = `${item.name || "이름 없음"} · ${item.status || "상태 미확인"} · ${item.templateId}`;
        const content = document.createElement("pre");
        content.textContent = JSON.stringify({
          "템플릿 ID":item.templateId, "채널 ID":item.pfId, "상태":item.status,
          "제목":item.title, "부제목":item.subtitle, "등록 본문":item.content,
          "본문·버튼에서 확인한 변수":item.variables, "등록 버튼":item.buttons,
        }, null, 2);
        card.append(summary, content);
        el("discovery-list").append(card);
      }
      el("preview").hidden = false;
      ready = !!(preview.ready && template?.content && !preview.configuration?.sameTemplate);
      attempted = !!preview.dispatch;
      if (attempted) showOutcome(preview.dispatch);
      else el("status").textContent = ready ? "발송 준비 완료 · 아래 문구와 수신자를 확인해 주세요."
        : !preview.eligible ? "확정일정표가 공개된 예약에서 발송할 수 있어요."
        : preview.configuration?.sameTemplate ? "견적서와 같은 템플릿이 설정돼 있어요. 확정일정표 템플릿을 확인해 주세요."
        : "발송 준비가 안 됐어요. 전화번호·템플릿 문구·알림 설정을 확인해 주세요.";
      el("review").disabled = !ready || attempted;
    } catch (error) { el("status").textContent = error.message || "발송 정보를 불러오지 못했어요."; }
  } };
})();
