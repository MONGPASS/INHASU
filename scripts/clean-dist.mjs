// dist/ 를 비운다 (빌드 전 단계).
// Vite의 emptyOutDir 대신 쓰는 이유: Windows + Node 24 에서 fs.rmSync(recursive) 가 한글이 들어간 경로
// (dist/견적서.html 같은 견적 정적 페이지, 또는 한글 폴더 안의 프로젝트)를 만나면 네이티브 충돌(0xC0000409)로
// 빌드가 메시지 없이 죽는다. 파일을 하나씩 지우는 방식은 영향을 받지 않는다.
import { existsSync, lstatSync, readdirSync, rmdirSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';

const remove = (target) => {
    const stat = lstatSync(target);
    if (stat.isDirectory() && !stat.isSymbolicLink()) {
        for (const name of readdirSync(target)) remove(join(target, name));
        rmdirSync(target);
    } else {
        unlinkSync(target);
    }
};

const dist = resolve('dist');
if (existsSync(dist)) {
    for (const name of readdirSync(dist)) remove(join(dist, name));
}
