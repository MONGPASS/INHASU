/**
 * 일차 라벨에서 후리가나 괄호를 뗀다: 「1日目（いちにちめ）」 → 「1日目」.
 * 예전 골격 생성기가 읽는 법을 괄호로 붙여 저장했는데 운영 페이지·디자인·관리자 목록
 * 어디서도 필요 없는 중복 표기라 표시할 때 항상 걷어낸다. 전각·반각 괄호 모두 처리.
 */
export function stripDayLabelReading(label: string | undefined | null): string {
    if (!label) return '';
    // 괄호 안이 가나(읽는 법)뿐일 때만 뗀다 — 「オプション A（別料金）」 같은 관리자 메모는 남긴다
    return label.replace(/\s*[（(][぀-ヿ]+[）)]\s*$/, '').trim();
}

/** 「1日目」「DAY 1」「1일차」처럼 자동으로 매긴 라벨인지 (관리자가 직접 쓴 특수 라벨과 구분) */
export function isAutoDayLabel(label: string | undefined | null): boolean {
    const s = stripDayLabelReading(label);
    return !s || /^\s*(DAY\s*)?\d+\s*(日目|일차|일째|日)?\s*$/i.test(s);
}
