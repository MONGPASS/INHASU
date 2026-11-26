/**
 * 화면 위에 뜨는 창(사진 크게 보기 · 전체 사진 등)이 열린 동안 뒤 페이지 스크롤을 막는다.
 * 창이 겹쳐 열려도(전체 사진 → 사진 크게 보기) 몇 개가 열렸는지 세어, 마지막 창이 닫힐 때만 원래 값으로 되돌린다.
 * (창마다 따로 이전 값을 기억했다 되돌리면 닫히는 순서에 따라 'hidden'이 남아 페이지가 스크롤되지 않았다.)
 */
let count = 0;
let saved = '';

export function lockBodyScroll(): () => void {
    if (count === 0) {
        saved = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
    }
    count += 1;
    let released = false;
    return () => {
        if (released) return;
        released = true;
        count = Math.max(0, count - 1);
        if (count === 0) document.body.style.overflow = saved;
    };
}
