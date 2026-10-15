/* Shared recovery and navigation contract for same-origin quote editors. */
(function (global) {
  'use strict';
  const sessions = new Set();
  const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const secret = key => /token|password|authorization|cookie|secret|signature|signedAt|signedBy|signImg|signData/i.test(key) || /^(contract|agreement)$/i.test(key);
  const escapeText = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const jsArgument = value => escapeText(JSON.stringify(String(value ?? '')));
  function clean(value) {
    if (typeof global.Blob !== 'undefined' && value instanceof global.Blob) return undefined;
    if (typeof value === 'string') return /(?:^|\|)(?:data:|blob:)/i.test(value) ? undefined : value;
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
    if (Array.isArray(value)) return value.map(clean).filter(item => item !== undefined);
    if (record(value)) {
      const result = {};
      Object.keys(value).sort().forEach(key => {
        if (secret(key) || ['__proto__', 'constructor', 'prototype'].includes(key)) return;
        const next = clean(value[key]); if (next !== undefined) result[key] = next;
      });
      return result;
    }
    return undefined;
  }
  function fingerprint(value) {
    const copy = clean(value) || {};
    if (record(copy)) ['step', 'coursePick', 'pickRegion', 'pickQuery'].forEach(key => delete copy[key]);
    return JSON.stringify(copy);
  }
  function keyFor(account, kind, requestId) {
    if (typeof account !== 'string' || !account.trim()) throw new Error('관리자 계정을 확인할 수 없어 초안을 보관하지 못했습니다.');
    return `inhasu:quote-editor:v1:${encodeURIComponent(account)}:${encodeURIComponent(kind)}:${requestId ? encodeURIComponent(requestId) : 'new'}`;
  }
  function storageError(reason) {
    return /QuotaExceeded|QUOTA/.test(reason?.name || '') ? '브라우저 저장 공간이 부족해 초안을 보관하지 못했습니다.' : '브라우저 저장소를 사용할 수 없어 초안을 보관하지 못했습니다.';
  }
  let account = '', identityPromise = null, identityResolve = null, leaveApproved = false;
  function setAccount(value) {
    if (typeof value !== 'string' || !value.trim()) return;
    if (account && account !== value) sessions.forEach(session => session.accountChanged());
    account = value;
    identityResolve?.(account); identityResolve = null;
  }
  function post(type, payload) {
    try { if (global.parent && global.parent !== global) global.parent.postMessage({ type, version: 1, ...payload }, global.location.origin); } catch (_) {}
  }
  function resolveAccount() {
    if (account) return Promise.resolve(account);
    if (identityPromise) return identityPromise;
    identityPromise = new Promise(resolve => {
      identityResolve = resolve;
      post('inhasu-editor-ready', {});
      Promise.resolve().then(() => global.fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' })).then(response => response.ok ? response.json() : null)
        .then(payload => { if (payload?.user?.role === 'admin' && typeof payload.user.id === 'string') setAccount(payload.user.id); })
        .catch(() => {}).finally(() => {
          if (!identityResolve) return;
          const finish = () => { if (identityResolve) { identityResolve(account); identityResolve = null; if (!account) identityPromise = null; } };
          if (global.parent && global.parent !== global) global.setTimeout(finish, 1500); else finish();
        });
    });
    return identityPromise;
  }
  function getState() {
    const states = [...sessions].map(session => session.state());
    const dirty = states.some(state => state.dirty), busy = states.some(state => state.busy);
    const error = states.map(state => state.error).filter(Boolean).join('\n');
    return { dirty, busy, error, canLeave: !busy && !error, editors: states.map(({ editorId, requestId, dirty, busy, pending }) => ({ editorId, requestId, dirty, busy, pending })) };
  }
  function broadcast() { post('inhasu-editor-state', getState()); }
  function flushAll() {
    let error = '';
    sessions.forEach(session => { const result = session.flush(); if (!result.ok) error = result.error || error; });
    const state = getState();
    return { ...state, ok: !state.busy && !error, error: error || state.error };
  }
  function validQuote(value) {
    if (!record(value)) return false;
    for (const field of ['customer', 'phone', 'destination', 'depart', 'return_', 'manager', 'quoteNo', 'vehicle', 'flightIn', 'flightOut', 'benefits', 'events', 'remark']) {
      if (value[field] !== undefined && typeof value[field] !== 'string') return false;
    }
    if (['days', 'spots', 'options', 'balances'].some(field => value[field] !== undefined && !Array.isArray(value[field]))) return false;
    if (Array.isArray(value.spots) && value.spots.some(name => typeof name !== 'string')) return false;
    if (Array.isArray(value.days) && value.days.some(day => !record(day) || ['dest', 'date', 'move', 'dist'].some(field => day[field] !== undefined && typeof day[field] !== 'string')
      || ['items', 'meals'].some(field => day[field] !== undefined && (!Array.isArray(day[field]) || day[field].some(item => typeof item !== 'string')))
      || (day.stay != null && (!record(day.stay) || (day.stay.tags !== undefined && (!Array.isArray(day.stay.tags) || day.stay.tags.some(tag => typeof tag !== 'string'))))))) return false;
    return ['options', 'balances'].every(field => !Array.isArray(value[field]) || value[field].every(record));
  }
  function validBooking(value) {
    return record(value) && ['days', 'highlights', 'travelers'].every(field => value[field] === undefined || Array.isArray(value[field]) && value[field].every(record))
      && validQuote({ days: value.days })
      && ['assign', 'contractInfo', 'flight', 'checklist'].every(field => value[field] == null || record(value[field]))
      && (value.assign?.lodges === undefined || Array.isArray(value.assign.lodges) && value.assign.lodges.every(record));
  }
  function read(storage, scope, baseline, validate, legacyKey) {
    try {
      const key = keyFor(scope.account, scope.kind, scope.requestId);
      let raw = storage.getItem(key), legacy = false;
      if (raw == null && legacyKey) { raw = storage.getItem(legacyKey); legacy = raw != null; }
      if (raw == null) return { kind: 'empty' };
      const parsed = JSON.parse(raw);
      const value = legacy ? parsed.st : parsed.value;
      if (legacy && String(parsed.reqId || '') !== String(scope.requestId || '')) return { kind: 'empty' };
      if (!record(parsed) || (!legacy && (parsed.version !== 1 || parsed.account !== scope.account || parsed.kind !== scope.kind || parsed.requestId !== scope.requestId))
        || (legacy && String(parsed.reqId || '') !== String(scope.requestId || '')) || !validate(value)) return { kind: 'error', error: '보관된 초안이 손상되었거나 현재 고객과 맞지 않아 복원하지 않았습니다.' };
      const safe = clean(value);
      if (legacy) storage.setItem(legacyKey, JSON.stringify(clean(parsed)));
      if (!legacy && fingerprint(safe) === fingerprint(baseline)) return { kind: 'empty' };
      return { kind: 'draft', value: safe, savedAt: parsed.savedAt || '', legacy, conflict: legacy || parsed.baseFingerprint !== fingerprint(baseline) };
    } catch (reason) { return { kind: 'error', error: reason instanceof SyntaxError ? '보관된 초안의 형식이 손상되어 복원하지 않았습니다.' : storageError(reason) }; }
  }
  function write(storage, scope, baseline, value) {
    try {
      const savedAt = new Date().toISOString();
      storage.setItem(keyFor(scope.account, scope.kind, scope.requestId), JSON.stringify({ version: 1, ...scope, baseFingerprint: fingerprint(baseline), savedAt, value: clean(value) }));
      return { ok: true, savedAt };
    } catch (reason) { return { ok: false, error: storageError(reason) }; }
  }
  async function create(options) {
    options.lock?.(true);
    const owner = await resolveAccount();
    const scope = { account: owner, kind: options.kind || 'quote', requestId: String(options.requestId || '') };
    let storage;
    try { storage = options.storage || global.localStorage; }
    catch (reason) { storage = { getItem() { throw reason; }, setItem() { throw reason; }, removeItem() { throw reason; } }; }
    let baseline = clean(options.get()), busy = false, closed = false, blockedAccount = false, error = '', pending = null, lastStored = '', legacyOwned = false;
    let panel = null;
    const session = {
      state() { return { editorId: scope.kind, requestId: scope.requestId, dirty: !closed && !pending && fingerprint(options.get()) !== fingerprint(baseline), busy: busy || blockedAccount, pending: !!pending, error }; },
      flush() {
        if (closed || pending) return { ok: true };
        try { options.pull?.(); } catch (_) {}
        if (blockedAccount) return { ok: false, error: '관리자 계정이 변경되어 이전 작성 내용을 다른 계정에 보관하지 않았습니다.' };
        const current = fingerprint(options.get());
        if (current === fingerprint(baseline)) return { ok: true };
        if (current === lastStored && !error) return { ok: true };
        const result = write(storage, scope, baseline, options.get());
        if (result.ok) { lastStored = current; error = ''; }
        else { error = result.error; options.notice?.(error); }
        broadcast(); return result;
      },
      changed() { if (!closed) { broadcast(); } },
      isBusy() { return busy || blockedAccount || !!pending; },
      begin() {
        if (closed || busy || blockedAccount || pending) return null;
        session.flush(); busy = true; options.lock?.(true); broadcast();
        let released = false;
        return () => { if (released) return; released = true; busy = false; options.lock?.(false); broadcast(); };
      },
      async run(work) { const release = session.begin(); if (!release) return { ignored: true }; try { return await work(); } finally { release(); } },
      commit(nextRequestId) {
        try { storage.removeItem(keyFor(scope.account, scope.kind, scope.requestId)); if (legacyOwned) storage.removeItem(options.legacyKey); error = ''; }
        catch (reason) { error = storageError(reason); options.notice?.('저장은 완료됐지만 이전 초안을 지우지 못했습니다. ' + error); }
        if (nextRequestId != null) scope.requestId = String(nextRequestId);
        baseline = clean(options.get()); lastStored = ''; broadcast();
      },
      discard() {
        try { storage.removeItem(keyFor(scope.account, scope.kind, scope.requestId)); if (legacyOwned) storage.removeItem(options.legacyKey); }
        catch (reason) { error = storageError(reason); options.notice?.(error); return false; }
        pending = null; error = ''; panel?.remove(); panel = null; options.lock?.(busy); broadcast(); return true;
      },
      restore() {
        if (!pending?.value) return false;
        options.apply(clean(pending.value)); lastStored = ''; pending = null;
        panel?.remove(); panel = null; options.lock?.(busy); session.flush(); options.notice?.('초안을 복원했습니다. 저장해야 서버에 반영됩니다.'); broadcast(); return true;
      },
      continueWithoutRecovery() {
        if (pending?.kind !== 'error') return false;
        error = pending.error; pending = null; panel?.remove(); panel = null;
        options.lock?.(busy); options.notice?.(error + ' 입력한 내용은 서버에 직접 저장해 주세요.'); broadcast(); return true;
      },
      accountChanged() { blockedAccount = true; error = '관리자 계정이 변경되었습니다. 이전 작성 화면을 닫고 다시 열어 주세요.'; options.lock?.(true); broadcast(); },
      close() { if (session.isBusy()) return false; const result = session.flush(); if (!result.ok && !global.confirm?.(result.error + '\n초안을 보관하지 못한 상태로 닫을까요?')) return false;
        closed = true; sessions.delete(session); panel?.remove(); broadcast(); return true; },
    };
    sessions.add(session);
    if (owner) pending = read(storage, scope, baseline, options.validate || (scope.kind === 'booking' ? validBooking : validQuote), options.legacyKey);
    else error = '관리자 계정을 확인할 수 없어 초안 자동 보관을 사용할 수 없습니다. 로그인한 관리자 화면에서 다시 열어 주세요.';
    if (pending?.kind === 'empty') pending = null;
    legacyOwned = !!pending?.legacy;
    if (pending && global.document) {
      panel = global.document.createElement('div');
      panel.setAttribute('role', 'alert'); panel.setAttribute('data-quote-recovery', scope.kind);
      panel.style.cssText = 'position:fixed;top:12px;left:12px;right:12px;z-index:10000;padding:16px;border:1px solid #efcf94;border-radius:12px;background:#fff8e8;color:#644318;box-shadow:0 8px 35px #0002;font:13px/1.7 sans-serif';
      const text = global.document.createElement('p');
      text.textContent = pending.kind === 'error' ? pending.error : `${pending.conflict ? '서버 원본과 다른 버전의' : '작성 중이던'} 초안이 있습니다. ${pending.legacy ? '이전 형식 초안이므로 현재 계정과 고객의 내용인지 확인해 주세요. ' : ''}복원하거나 버린 뒤 편집을 계속하세요.`;
      panel.appendChild(text);
      if (pending.kind === 'draft') { const button = global.document.createElement('button'); button.type = 'button'; button.textContent = '초안 복원'; button.onclick = () => session.restore(); panel.appendChild(button); }
      const discard = global.document.createElement('button'); discard.type = 'button'; discard.textContent = '초안 버리기'; discard.style.marginLeft = '10px'; discard.onclick = () => session.discard(); panel.appendChild(discard);
      if (pending.kind === 'error') { const proceed = global.document.createElement('button'); proceed.type = 'button'; proceed.textContent = '복원 없이 계속'; proceed.style.marginLeft = '10px'; proceed.onclick = () => session.continueWithoutRecovery(); panel.appendChild(proceed); }
      global.document.body.appendChild(panel);
    }
    options.lock?.(!!pending); if (error) options.notice?.(error); broadcast();
    return session;
  }
  global.QuoteEditorState = { create, clean, fingerprint, keyFor, read, write, validQuote, validBooking, resolveAccount, escapeText, jsArgument, getState, flushAll, approveLeaveOnce() { leaveApproved = true; } };
  global.addEventListener?.('message', event => {
    if (event.origin !== global.location?.origin || event.source !== global.parent || event.data?.type !== 'inhasu-editor-account' || event.data.version !== 1) return;
    setAccount(event.data.userId);
  });
  global.addEventListener?.('beforeunload', event => {
    const result = flushAll();
    if (leaveApproved && !result.busy) { leaveApproved = false; return; }
    if (result.busy || !result.ok) { event.preventDefault(); event.returnValue = ''; }
  });
  global.addEventListener?.('pagehide', flushAll);
  global.document?.addEventListener('dragstart', event => { if ([...sessions].some(session => session.isBusy())) { event.preventDefault(); event.stopImmediatePropagation(); } }, true);
  global.document?.addEventListener('click', event => {
    const anchor = event.target?.closest?.('a[href]');
    if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download') || anchor.getAttribute('href')?.startsWith('#')) return;
    const state = getState();
    if (state.busy) { event.preventDefault(); event.stopImmediatePropagation(); return; }
    const result = flushAll();
    if (!result.ok) {
      if (!global.confirm?.(result.error + '\n초안을 보관하지 못한 상태로 이동할까요?')) { event.preventDefault(); event.stopImmediatePropagation(); }
      else leaveApproved = true;
    }
  }, true);
  const observe = () => { global.queueMicrotask?.(() => { sessions.forEach(session => session.changed()); }); };
  ['input', 'change', 'click', 'drop'].forEach(type => global.document?.addEventListener(type, observe));
  if (global.setInterval && global.document) global.setInterval(() => { sessions.forEach(session => { if (!session.isBusy()) session.flush(); }); broadcast(); }, 1000);
})(typeof window === 'undefined' ? globalThis : window);
