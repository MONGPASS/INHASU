import test from 'node:test';
import assert from 'node:assert/strict';
import { quoteFrameNeedsRemount, scheduleQuoteFrameDelay } from '../src/utils/quoteFrameRecovery.ts';

const origin = 'http://localhost:8803';
test('빈 초기 frame·실패 문서는 알려진 src로 재생성하고 정상 같은 출처 문서는 현재 주소를 유지한다', () => {
    for (const href of [undefined, '', 'about:blank', 'about:srcdoc', 'chrome-error://chromewebdata/', 'https://other.example.invalid/']) assert.equal(quoteFrameNeedsRemount(href, origin), true);
    assert.equal(quoteFrameNeedsRemount(origin + '/예약관리?id=local-booking', origin), false);
    assert.equal(quoteFrameNeedsRemount(origin + '/견적만들기?id=local-quote', origin), false);
});
test('12초 후 수동 재시도 안내만 표시하며 자동 navigation/반복 timer를 만들지 않는다', () => {
    const scheduled = [], cleared = []; let notices = 0;
    const clock = { setTimeout(callback, delay) { scheduled.push({ callback, delay }); return 1; }, clearTimeout(id) { cleared.push(id); } };
    const cancel = scheduleQuoteFrameDelay(() => { notices++; }, clock);
    assert.equal(notices, 0); assert.equal(scheduled.length, 1); assert.equal(scheduled[0].delay, 12000);
    scheduled[0].callback(); assert.equal(notices, 1); assert.equal(scheduled.length, 1);
    cancel(); assert.deepEqual(cleared, [1]);
});
test('로딩 성공·화면 종료 뒤 대기 중이던 안내 callback을 무효화한다', () => {
    let callback, notices = 0;
    const cancel = scheduleQuoteFrameDelay(() => { notices++; }, { setTimeout(fn) { callback = fn; return 1; }, clearTimeout() {} });
    cancel(); callback(); assert.equal(notices, 0);
});
