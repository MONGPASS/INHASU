import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
const require = createRequire(import.meta.url), React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

// 템플릿·팝오버를 서버 렌더로 그린다. 반응형 이미지는 <img>로, 팝오버 껍데기(body 포털)는 그냥 <div>로 바꾼다.
async function load(entry) {
    const bundle = await build({
        entryPoints: [fileURLToPath(new URL(entry, import.meta.url))],
        bundle: true, format: 'cjs', platform: 'node', packages: 'external', jsx: 'automatic', write: false, loader: { '.css': 'empty' },
        plugins: [{ name: 'design-test-stubs', setup(builder) {
            builder.onResolve({ filter: /\/ResponsiveProductImage$/ }, () => ({ path: 'image', namespace: 'design-test' }));
            builder.onResolve({ filter: /\/PopoverShell$/ }, () => ({ path: 'shell', namespace: 'design-test' }));
            builder.onLoad({ filter: /.*/, namespace: 'design-test' }, args => ({ loader: 'tsx', resolveDir: fileURLToPath(new URL('..', import.meta.url)),
                contents: args.path === 'image'
                    ? 'export const ResponsiveProductImage = (props) => <img {...props} />;'
                    : 'export const PopoverShell = ({ label, children }) => <div className="popover-stub" data-label={label}>{children}</div>;' }));
        } }],
    });
    const mod = { exports: {} };
    new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(require, mod, mod.exports);
    return mod.exports;
}
const noop = () => {};

for (const [name, entry] of [['PC', '../src/components/product/designTemplates/HorseTrekTemplate.tsx'], ['모바일', '../src/components/product/designTemplates/HorseTrekMobileTemplate.tsx']]) {
    test(`${name} 템플릿의 섹션 래퍼는 data-df-section(인스턴스 id)과 data-df-scope(복제 접미사)를 가진다`, async () => {
        const { default: Template } = await load(entry);
        const html = renderToStaticMarkup(React.createElement(Template, {
            v: k => (k === 'ger_title1@2' ? '복제본 제목' : k === 'ger_title1' ? '원본 제목' : ''), editing: true,
            instances: [{ id: '06 숙소', def: '06 숙소' }, { id: '06 숙소#2', def: '06 숙소' }],
        }));
        assert.ok(html.includes('data-df-scope="" data-df-section="06 숙소"'), '원본 섹션');
        assert.ok(html.includes('data-df-scope="@2" data-df-section="06 숙소#2"'), '복제 섹션');
        assert.ok(html.includes('원본 제목') && html.includes('복제본 제목'), '복제본은 접미사 붙은 키를 읽는다');
        assert.equal(html.includes('01 오프닝'), false, '인스턴스 목록에 없는 섹션은 그리지 않는다');
    });
}

test('FieldPopover: 한 줄 칸은 Shift+Enter로 줄을 나누고(프리셋 칸은 input), 여러 줄은 textarea, 자동 반영 칸은 안내만 보여 준다', async () => {
    const { FieldPopover } = await load('../src/components/admin/designEditor/FieldPopover.tsx');
    const text = renderToStaticMarkup(React.createElement(FieldPopover, { field: { key: 'a', label: '큰 제목', type: 'text', section: 's', default: '원본 문구' }, value: '', anchor: null, onChange: noop, onClear: noop, onClose: noop }));
    assert.ok(text.includes('<textarea') && text.includes('rows="1"') && !text.includes('<input'), '한 줄 칸은 한 줄 높이의 textarea');
    assert.ok(text.includes('placeholder="원본 문구"') && text.includes('원본 문구</span>'), '비어 있으면 원본 문구 표시');
    assert.ok(text.includes('Enter 적용 · Shift+Enter 줄바꿈 · Esc 취소') && text.includes('원본으로') && text.includes('적용'));
    assert.ok(!text.includes('글자 크기'), '크기 조절은 onSizeChange가 있을 때만');
    const preset = renderToStaticMarkup(React.createElement(FieldPopover, { field: { key: 'd', label: '일수', type: 'text', section: 's', presets: ['3박 4일'] }, value: '', anchor: null, onChange: noop, onClear: noop, onClose: noop }));
    assert.ok(preset.includes('<input') && preset.includes('Enter 적용 · Esc 취소') && !preset.includes('Shift+Enter'), '프리셋 칸은 줄을 나누지 않는다');
    const sized = renderToStaticMarkup(React.createElement(FieldPopover, { field: { key: 'a', label: '큰 제목', type: 'text', section: 's', default: '원본 문구' }, value: '', size: 120, onSizeChange: noop, anchor: null, onChange: noop, onClear: noop, onClose: noop }));
    assert.ok(sized.includes('글자 크기') && sized.includes('120%') && sized.includes('기본 크기(100%)') && sized.includes('수정됨'), '크기를 바꾸면 수정됨');
    const multi = renderToStaticMarkup(React.createElement(FieldPopover, { field: { key: 'b', label: '본문', type: 'textarea', section: 's', default: '1\n2\n3' }, value: '고친 글', anchor: null, disabled: true, onChange: noop, onClear: noop, onClose: noop }));
    assert.ok(multi.includes('<textarea') && multi.includes('rows="4"') && multi.includes('disabled=""'), '여러 줄 칸은 업로드 중 잠긴다');
    assert.ok(multi.includes('수정됨') && multi.includes('Ctrl+Enter 적용'));
    const locked = renderToStaticMarkup(React.createElement(FieldPopover, { field: { key: 'c', label: '가격', type: 'text', section: 's' }, value: '1,000,000원', anchor: null, readOnlyNote: '가격/옵션 탭에서 고칩니다', onChange: noop, onClear: noop, onClose: noop }));
    assert.ok(locked.includes('가격/옵션 탭에서 고칩니다') && !locked.includes('<input'), '자동 반영 칸은 입력칸 없이 안내만');
});

test('ImagePopover: 공통 사진 배지·바꾸기/지우기 버튼·업로드 중 잠금', async () => {
    const { ImagePopover } = await load('../src/components/admin/designEditor/ImagePopover.tsx');
    const base = { label: '배경 사진', anchor: null, onUpload: noop, onUseShared: noop, onClear: noop, onClose: noop, uploading: false };
    const empty = renderToStaticMarkup(React.createElement(ImagePopover, { ...base, value: '' }));
    assert.ok(empty.includes('사진 올리기') && empty.includes('사진 없음') && !empty.includes('지우기'));
    const shared = renderToStaticMarkup(React.createElement(ImagePopover, { ...base, value: '', sharedUrl: '/api/images/shared.webp' }));
    assert.ok(shared.includes('공통 사진 사용 중') && shared.includes('>공통<') && shared.includes('/api/images/shared.webp'));
    assert.equal(shared.includes('공통 사진 쓰기'), false, '이미 공통 사진이면 버튼 없음');
    const own = renderToStaticMarkup(React.createElement(ImagePopover, { ...base, value: '/api/images/own.webp', sharedUrl: '/api/images/shared.webp' }));
    assert.ok(own.includes('사진 바꾸기') && own.includes('공통 사진 쓰기') && own.includes('지우기') && own.includes('이 상품에 올린 사진'));
    const busy = renderToStaticMarkup(React.createElement(ImagePopover, { ...base, value: '/api/images/own.webp', uploading: true }));
    assert.ok(busy.includes('업로드 중…') && busy.includes('type="file" accept="image/*" disabled=""'));
});

test('문구 글자 크기·줄바꿈: 범위 제한, 기본 크기는 지워 저장, 블록 안 선택자로만 zoom·pre-line 적용', async () => {
    const { clampTextSize, commitTextSize, textStyleCss, TEXT_SIZE } = await load('../src/components/product/designTemplates/textStyles.ts');
    assert.equal(clampTextSize(10), TEXT_SIZE.min);
    assert.equal(clampTextSize(999), TEXT_SIZE.max);
    assert.equal(clampTextSize('abc'), 100);
    assert.deepEqual(commitTextSize(undefined, 'hero_title', 130), { hero_title: { size: 130 } });
    assert.equal(commitTextSize({ hero_title: { size: 130 } }, 'hero_title', 100), undefined, '기본 크기면 키를 지운다');
    const css = textStyleCss('[data-dtpl="b1"]', { hero_title: { size: 130 }, 'intro_body@2': { size: 80 }, 'bad"key': { size: 150 }, plain: { size: 100 } },
        { hero_title: ['첫 줄', '둘째 줄'].join(String.fromCharCode(10)), photo: 'https://x/a.webp', one: '한 줄' });
    assert.ok(css.includes('[data-dtpl="b1"] [data-df-scope=""] [data-df="hero_title"]{zoom:1.3}'));
    assert.ok(css.includes('[data-dtpl="b1"] [data-df-scope="@2"] [data-df="intro_body"]{zoom:0.8}'), '복제 섹션은 그 섹션 안만');
    assert.ok(css.includes('[data-df="hero_title"]{white-space:pre-line}'), '줄을 나눈 문구는 줄바꿈 표시');
    assert.ok(!css.includes('bad') && !css.includes('"plain"') && !css.includes('"one"') && !css.includes('photo'), '이상한 키·기본 크기·한 줄·사진 주소는 규칙 없음');
});
