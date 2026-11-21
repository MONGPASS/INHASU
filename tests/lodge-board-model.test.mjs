import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

// 숙소 배정 계산(표로 보기·배정 보드 공용)을 묶어서 불러온다.
const bundled = await build({
    entryPoints: ['src/components/admin/accommodation/lodgeBoardModel.ts'], bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent',
});
const m = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));

const lodge = (extra = {}) => ({ name: '테를지 캠프', ...extra });

test('숙박일 상태: 숙소 없음 → 미배정, 메일 전 → 배정(요청 전), 메일 보냄 → 진행 중, 예약완료 → 배정 완료', () => {
    assert.equal(m.nightStateOf({}), 'none');
    assert.equal(m.nightStateOf(lodge({ mailStatus: '발송전' })), 'sel');
    assert.equal(m.nightStateOf(lodge({ mailStatus: '1메일완료' })), 'req');
    assert.equal(m.nightStateOf(lodge({ mailStatus: '2메일완료', bookingStatus: '예약완료' })), 'ok');
});

test('배정 보드의 예약 상태는 가장 덜 된 숙박을 따른다(숙박일이 없으면 미배정)', () => {
    const s = (...states) => m.tourStateOf(states.map(state => ({ state })));
    assert.equal(s(), 'none', '숙박일 확인 필요');
    assert.equal(s('ok', 'none'), 'none');
    assert.equal(s('ok', 'sel', 'req'), 'sel');
    assert.equal(s('ok', 'req'), 'req');
    assert.equal(s('ok', 'ok'), 'ok');
});

test('숙소 연락 단계와 다음 메일 회차', () => {
    assert.equal(m.contactStepsDone({}), 0);
    assert.equal(m.contactStepsDone(lodge({ mailStatus: '발송전' })), 1);
    assert.equal(m.contactStepsDone(lodge({ mailStatus: '2메일완료' })), 3);
    assert.equal(m.nextMailStage(lodge({ mailStatus: '발송전' })), '1메일완료');
    assert.equal(m.nextMailStage(lodge({ mailStatus: '2메일완료' })), '3메일완료');
    assert.equal(m.nextMailStage(lodge({ mailStatus: '3메일완료' })), null, '3메일 뒤에는 더 없음');
    assert.equal(m.nextMailStage(lodge({ mailStatus: '배정X' })), null);
});

test('계약 일정 지역 불러오기: 저장된 지역이 없으면 그날 일정 지역을 쓰고(fill), 관리자가 비운 칸은 다시 채우지 않는다', () => {
    const tour = { id: 't1', bookingId: 'b1', source: 'product', startDate: '2026-12-01', endDate: '2026-12-03',
        schedule: { source: 'product', days: [{ day: 1, title: 'Terelj', summary: '' }, { day: 2, title: 'UB', summary: '' }] } };
    const rows = [{ day: 1, date: '2026-12-01', accommodation: {} }, { day: 2, date: '2026-12-02', accommodation: { region: 'Huvsgul' } }];
    const model = m.buildLodgeModel(tour, { rows, planned: 2, clearedAreas: new Set(), lodgeRegions: [] });
    assert.equal(model.nights[1].area, 'Huvsgul', '저장된 지역이 먼저');
    assert.equal(model.nights[1].fromPlan, false);
    assert.equal(model.nights[0].fromPlan, !!model.nights[0].area, '비어 있으면 일정 지역(있을 때만)');
    const cleared = m.buildLodgeModel(tour, { rows, planned: 2, clearedAreas: new Set(['t1:0']), lodgeRegions: [] });
    assert.equal(cleared.nights[0].area, '');
    assert.deepEqual(cleared.fill, {});
});

test('숙소 배정 화면: 배정 보드가 기본이고, 표로 보기·카드 보기와 같은 저장 함수를 쓴다', () => {
    const page = readFileSync('src/pages/AdminAccommodationOps.tsx', 'utf8');
    assert.match(page, /: 'board-view'; \} catch \{ return 'board-view'; \}/, '저장된 보기가 없으면 배정 보드');
    assert.match(page, /<LodgeAssignQueue[\s\S]*onPatch=\{patchDay\}[\s\S]*onSave=/);
    const board = readFileSync('src/components/admin/accommodation/LodgeAssignBoard.tsx', 'utf8');
    assert.match(board, /buildLodgeModel/, '표로 보기도 같은 계산을 쓴다');
    const queue = readFileSync('src/components/admin/accommodation/LodgeAssignQueue.tsx', 'utf8');
    assert.doesNotMatch(queue, /@montage-ui\/core/, '화면은 Montage를 직접 부르지 않는다');
    assert.doesNotMatch(queue, /window\.prompt|window\.confirm|alert\(/, '기본 확인창을 쓰지 않는다');
});
