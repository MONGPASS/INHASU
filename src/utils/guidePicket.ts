import { useEffect, useState } from 'react';

/** 가이드 피켓에 들어가는 투어 정보(날짜는 YYYY-MM-DD) */
export interface GuidePicketInput {
    customerName: string;
    startDate: string;
    endDate: string;
    guideName?: string;
    guidePhone?: string;
}
export interface GuidePicketApi {
    toDataUrl(input: GuidePicketInput): Promise<string>;
    download(input: GuidePicketInput): Promise<void>;
    print(input: GuidePicketInput): Promise<void>;
    fileName(input: GuidePicketInput): string;
}

/**
 * 피켓 그리기는 public/guide-picket.js 한 곳에 있다(견적 가이드 시트의 정적 페이지도 같은 파일을 쓴다).
 * React 화면은 처음 필요할 때 한 번만 불러온다.
 */
let loading: Promise<GuidePicketApi> | null = null;
export function loadGuidePicket(): Promise<GuidePicketApi> {
    const ready = (window as any).GuidePicket as GuidePicketApi | undefined;
    if (ready) return Promise.resolve(ready);
    if (loading) return loading;
    loading = new Promise<GuidePicketApi>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = '/guide-picket.js';
        script.async = true;
        script.onload = () => { const api = (window as any).GuidePicket; api ? resolve(api) : reject(new Error('피켓 도구를 불러오지 못했습니다.')); };
        script.onerror = () => { loading = null; script.remove(); reject(new Error('피켓 도구를 불러오지 못했습니다.')); };
        document.head.appendChild(script);
    });
    return loading;
}

/** 피켓 PNG(A4 가로 300dpi)를 만들어 미리보기 주소로 돌려준다. input이 바뀌면 다시 만든다. */
export function useGuidePicketImage(input: GuidePicketInput | null) {
    const key = input ? JSON.stringify(input) : '';
    const [state, setState] = useState<{ key: string; url: string; error: string }>({ key: '', url: '', error: '' });
    useEffect(() => {
        if (!input) return;
        let alive = true;
        loadGuidePicket().then(api => api.toDataUrl(input)).then(
            url => { if (alive) setState({ key, url, error: '' }); },
            error => { if (alive) setState({ key, url: '', error: error?.message || '피켓을 만들지 못했습니다.' }); });
        return () => { alive = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);
    const current = state.key === key;
    return { url: current ? state.url : '', error: current ? state.error : '', pending: !!input && !current };
}

export const saveGuidePicket = (input: GuidePicketInput) => loadGuidePicket().then(api => api.download(input));
export const printGuidePicket = (input: GuidePicketInput) => loadGuidePicket().then(api => api.print(input));
