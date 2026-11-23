// Start the same Vite app and local synthetic API used by npm run dev.
import { setTimeout as delay } from 'node:timers/promises';
import { createServer } from 'vite';

const server = await createServer({ server: { host: '127.0.0.1', port: 5173, open: false } });
try {
    await server.listen();
    const url = new URL('/__local-admin?view=inbox', server.resolvedUrls.local[0]);
    const deadline = Date.now() + 90_000;
    for (;;) {
        const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(3000) }).catch(() => null);
        if (response?.status === 302 && response.headers.get('location') === '/admin/quote-desk/inbox') break;
        if (Date.now() >= deadline) throw new Error('합성 관리자 API가 준비되지 않았습니다. 위의 API 오류와 8804 포트를 확인하세요.');
        await delay(500);
    }
    console.log(`\n은하수 로컬 관리자가 준비되었습니다. ${url.href}\n종료하려면 Ctrl+C를 누르세요.\n`);
    server.config.server.open = url.pathname + url.search;
    server.openBrowser();
} catch (error) {
    await server.close();
    console.error(error);
    process.exit(1);
}
