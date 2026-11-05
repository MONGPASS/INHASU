import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// 견적 고객 편집 화면: 옛 머리·아래 바의 버튼은 바깥 도구줄 메뉴가 InhasuQuoteBookingWorkspace.run/links로 대신 누른다.
const workspaceContext = vm.createContext({});
vm.runInContext(fs.readFileSync(new URL('../public/quote-booking-workspace.js', import.meta.url), 'utf8'), workspaceContext);
const workspace = workspaceContext.QuoteBookingWorkspace;
const bookingHtml = fs.readFileSync(new URL('../public/예약관리.html', import.meta.url), 'utf8');
const apiStart = bookingHtml.indexOf('window.InhasuQuoteBookingWorkspace = {');
const apiEnd = bookingHtml.indexOf("document.addEventListener('input'", apiStart);
assert.ok(apiStart > 0 && apiEnd > apiStart, '예약관리.html의 InhasuQuoteBookingWorkspace 정의를 찾지 못했습니다');
const apiSource = bookingHtml.slice(apiStart, apiEnd);

const editorApi = ({ busy = false, token = true, saved = '' } = {}) => {
    const clicks = [];
    const buttons = {
        itineraryNoticeBtn: { disabled: false }, copyLinkBtn: { disabled: true }, guideSheetBtn: { disabled: false }, guidePdfBtn: { disabled: false },
        travelNoticeBtn: { disabled: false, textContent: '주의사항 재발송' }, undoBtn: { disabled: false },
        confirmLink: { href: 'https://local.invalid/확정일정표.html?t=LOCAL-TOKEN', getAttribute: () => token ? '확정일정표.html?t=LOCAL-TOKEN' : '#' },
        contractLink: { href: 'https://local.invalid/계약서.html?t=LOCAL-TOKEN&adminId=local', getAttribute: () => token ? '계약서.html?t=LOCAL-TOKEN' : '#' },
    };
    for (const [id, element] of Object.entries(buttons)) element.click = () => clicks.push(id);
    const context = vm.createContext({ window: {}, $: id => buttons[id] || null, PRE: { id: 'local', token: token ? 'LOCAL-TOKEN' : '', phone: 'PRIVATE-PHONE', name: 'PRIVATE-NAME', quote: { days: [] } },
        BK: null, SAVED_BK_JSON: saved, bookingEditorBooting: false, bookingRecovery: { isBusy: () => busy }, pullForm() {}, quoteWorkspaceState: () => null });
    vm.runInContext(apiSource, context);
    return { api: context.window.InhasuQuoteBookingWorkspace, clicks, buttons };
};

test('run은 기존 버튼만 누르고 잠긴·없는·모르는 버튼은 false를 돌려준다', () => {
    const { api, clicks } = editorApi();
    assert.equal(api.run('itineraryNotice'), true);
    assert.equal(api.run('guideSheet'), true);
    assert.equal(api.run('copyLink'), false, '비활성 버튼');
    assert.equal(api.run('save'), false, '목록에 없는 동작');
    assert.equal(api.run(''), false);
    assert.deepEqual(clicks, ['itineraryNoticeBtn', 'guideSheetBtn']);
    const locked = editorApi({ busy: true });
    assert.equal(locked.api.run('revert'), false); assert.deepEqual(locked.clicks, []);
    assert.equal(locked.api.links().locked, true);
});

test('links는 고객 링크·라벨·되돌리기 가능 여부만 주고 개인정보를 담지 않는다', () => {
    const { api } = editorApi({ saved: '{"days":[]}' });
    const links = api.links();
    assert.equal(links.confirm, 'https://local.invalid/확정일정표.html?t=LOCAL-TOKEN');
    assert.equal(links.contract, 'https://local.invalid/계약서.html?t=LOCAL-TOKEN&adminId=local');
    assert.equal(links.travelNoticeLabel, '주의사항 재발송'); assert.equal(links.travelNoticeDisabled, false);
    assert.equal(links.undoDisabled, false); assert.equal(links.hasQuote, true); assert.equal(links.locked, false);
    assert.ok(!JSON.stringify(links).includes('PRIVATE'));
    const unsaved = editorApi({ token: false }).api.links();
    assert.equal(unsaved.confirm, null); assert.equal(unsaved.contract, null); assert.equal(unsaved.undoDisabled, true);
});

test('send 바로가기는 숨겨진 알림 버튼 대신 일정표 카드로 간다', () => {
    const calls = [];
    const doc = { getElementById(id) { return { scrollIntoView() { calls.push(id); }, focus() { calls.push('focus:' + id); } }; } };
    assert.equal(workspace.navigate('send', doc), true);
    assert.deepEqual(calls, ['documentsSection', 'focus:documentsSection']);
});

test('임베드 편집기는 옛 머리·아래 바의 옮긴 버튼을 숨기고 본문을 전체 폭으로 쓴다', () => {
    const css = fs.readFileSync(new URL('../src/styles/quote-booking-workspace.css', import.meta.url), 'utf8');
    assert.ok(css.includes('.customer-booking-editor body>header{display:none}'));
    assert.ok(css.includes('.customer-booking-editor main,.customer-booking-editor #admin-booking-history{max-width:none'));
    assert.ok(css.includes('.customer-booking-editor #travelNoticeBtn,.customer-booking-editor .bar-more{display:none!important}'));
    assert.ok(css.includes('--cbe-head:0px'));
    // 단독 예약관리 화면의 버튼은 그대로 있어야 한다(숨기기만, 삭제 금지).
    for (const id of ['itineraryNoticeBtn', 'copyLinkBtn', 'guideSheetBtn', 'guidePdfBtn', 'travelNoticeBtn', 'undoBtn', 'saveBtn']) assert.ok(bookingHtml.includes(`id="${id}"`), id);
});
