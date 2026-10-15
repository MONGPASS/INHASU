import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { resolveMailFrom, DEFAULT_MAIL_FROM } from '../functions/lib/mailConfig.ts';

async function bundle(file) {
  const result = await build({ entryPoints: [file], bundle: true, platform: 'node', format: 'esm', write: false });
  return import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].contents).toString('base64'));
}
const [{ sendEmail }, { default: guides }] = await Promise.all([bundle('functions/lib/mailer.ts'), bundle('functions/api/tour-guides.ts')]);

test('MAIL_FROM 미설정·공백은 기존 발신 이름과 주소를 유지한다', () => {
  for (const env of [undefined, {}, { MAIL_FROM: undefined }, { MAIL_FROM: null }, { MAIL_FROM: '' }, { MAIL_FROM: '   ' }]) {
    assert.equal(resolveMailFrom(env), '몽골리아 은하수 <noreply@mongolryokou.com>');
  }
  assert.equal(DEFAULT_MAIL_FROM, '몽골리아 은하수 <noreply@mongolryokou.com>');
});

test('검증된 설정용 단일 주소와 표시 이름을 사용할 수 있다', () => {
  for (const sender of ['booking@example.invalid', '몽골리아 은하수 <booking@example.invalid>', '"Milky Way, Mongolia" <hello+tour@letters.example.invalid>']) {
    assert.equal(resolveMailFrom({ MAIL_FROM: '  ' + sender + '  ' }), sender);
  }
});

test('CRLF·제어 문자·복수 주소·잘못된 발신 형식을 설정 값 노출 없이 거부한다', () => {
  for (const sender of [42, {}, 'wrong-address', 'a..b@example.invalid', '.a@example.invalid', 'a.@example.invalid', 'a@-bad.invalid', 'a@bad-.invalid', 'a@localhost',
    'a@example.invalid,b@example.invalid', 'a@example.invalid\r\nBcc: hidden@example.invalid', '\n', 'Name\t<booking@example.invalid>', 'Name <booking@example.invalid> <extra@example.invalid>',
    'Bad, Name <booking@example.invalid>', 'Bad" Name <booking@example.invalid>', 'Name <booking@example.invalid>\u0000']) {
    assert.throws(() => resolveMailFrom({ MAIL_FROM: sender }), error => {
      assert.match(error.message, /MAIL_FROM/);
      if (typeof sender === 'string' && sender.length > 1) assert.ok(!error.message.includes(sender));
      return true;
    });
  }
});

test('공통 메일러는 기본·설정 발신 주소와 기존 reply-to·수신자·서식을 함께 유지한다', async t => {
  const original = globalThis.fetch; const sent = [];
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), 'https://api.resend.com/emails');
    sent.push(JSON.parse(init.body));
    return Response.json({ id: 'synthetic-receipt' });
  };
  t.after(() => { globalThis.fetch = original; });
  await sendEmail('synthetic-test-key', 'recipient@example.invalid', '원래 제목', '<p>원래 HTML</p>');
  await sendEmail('synthetic-test-key', ['recipient@example.invalid'], '원래 제목', '<p>원래 HTML</p>', {
    replyTo: 'reply@example.invalid', env: { MAIL_FROM: '몽골리아 은하수 <booking@example.invalid>' },
  });
  assert.deepEqual(sent[0], { from: DEFAULT_MAIL_FROM, to: ['recipient@example.invalid'], subject: '원래 제목', html: '<p>원래 HTML</p>' });
  assert.deepEqual(sent[1], { ...sent[0], from: '몽골리아 은하수 <booking@example.invalid>', reply_to: 'reply@example.invalid' });
});

test('잘못된 발신 환경 변수는 provider 요청 전에 차단한다', async t => {
  const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('No provider should be called'); };
  t.after(() => { globalThis.fetch = original; });
  await assert.rejects(sendEmail('synthetic-test-key', 'recipient@example.invalid', '제목', '<p>내용</p>', {
    env: { MAIL_FROM: 'booking@example.invalid\r\nBcc: hidden@example.invalid' },
  }), /MAIL_FROM/);
  assert.equal(calls, 0);
});

test('가이드 지원 관리자 메일도 같은 MAIL_FROM을 사용하고 지원서와 원래 메일 내용을 보존한다', async t => {
  const original = globalThis.fetch; const sent = [], saved = [];
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), 'https://api.resend.com/emails'); sent.push(JSON.parse(init.body)); return Response.json({ id: 'synthetic-guide-receipt' });
  };
  t.after(() => { globalThis.fetch = original; });
  const DB = { prepare(sql) { return { bind(...values) { return { async run() { saved.push({ sql, values }); return { meta: { changes: 1 } }; } }; } }; } };
  const response = await guides.request('/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: '합성 지원자', phone: '00000000000', languages: ['한국어'], specialties: ['초원'] }) }, {
    DB, RESEND_API_KEY: 'synthetic-test-key', ADMIN_EMAIL: 'admin@example.invalid', MAIL_FROM: '몽골리아 은하수 <booking@example.invalid>',
  });
  assert.equal(response.status, 200); assert.equal((await response.json()).success, true);
  assert.equal(saved.length, 1); assert.equal(saved[0].values[1], '합성 지원자');
  assert.equal(sent.length, 1); assert.equal(sent[0].from, '몽골리아 은하수 <booking@example.invalid>');
  assert.deepEqual(sent[0].to, ['admin@example.invalid']); assert.equal(sent[0].subject, '[가이드 지원] 합성 지원자 님');
  assert.match(sent[0].html, /새 가이드 지원서가 접수되었습니다/);
  assert.match(sent[0].html, /한국어/);
});
