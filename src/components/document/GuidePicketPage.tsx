import React, { useState } from 'react';
import { saveGuidePicket, useGuidePicketImage, type GuidePicketInput } from '../../utils/guidePicket';

/**
 * 가이드용 일정표의 마지막 페이지 — 공항 미팅용 가이드 피켓(A4 가로).
 * 인쇄하면 이 페이지만 A4 가로 한 장으로 나오고, ‘PNG 저장’은 A4 300dpi 이미지로 내려받는다.
 * 그림이 준비될 때까지 data-picket-pending을 달아 자동 인쇄가 기다릴 수 있게 한다.
 */
export const GuidePicketPage: React.FC<{ input: GuidePicketInput }> = ({ input }) => {
    const image = useGuidePicketImage(input);
    const [notice, setNotice] = useState('');
    const save = () => { setNotice(''); saveGuidePicket(input).catch(error => setNotice(error?.message || 'PNG를 만들지 못했습니다.')); };
    return (
        <section className="guide-picket-page" data-picket-pending={image.pending ? '' : undefined} aria-label="가이드 피켓">
            <style>{`
                .guide-picket-page { margin-top: 24px; }
                .guide-picket-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
                .guide-picket-bar b { font-size: 14px; font-weight: 800; color: #0b4050; }
                .guide-picket-bar small { margin-left: 6px; color: #8c98a3; font-size: 11px; font-weight: 600; }
                .guide-picket-bar button { height: 34px; padding: 0 14px; border: 0; border-radius: 8px; background: #06C4A0; color: #fff; font: inherit; font-size: 13px; font-weight: 800; cursor: pointer; }
                .guide-picket-bar button:disabled { opacity: .45; cursor: default; }
                .guide-picket-sheet { aspect-ratio: 297 / 210; display: flex; align-items: center; justify-content: center; overflow: hidden; border-radius: 6px; background: #fff; box-shadow: 0 0 0 1px #e2e8e6; color: #8c98a3; font-size: 13px; font-weight: 600; }
                .guide-picket-sheet img { display: block; width: 100%; height: 100%; }
                .guide-picket-notice { margin-top: 6px; color: #e5484d; font-size: 12px; font-weight: 600; }
                @page guide-picket { size: A4 landscape; margin: 0; }
                @media print {
                    .guide-picket-page { page: guide-picket; break-before: page; page-break-before: always; margin: 0; }
                    .guide-picket-bar, .guide-picket-notice { display: none !important; }
                    .guide-picket-sheet { width: 297mm; height: 209.5mm; aspect-ratio: auto; border-radius: 0; box-shadow: none; }
                }
            `}</style>
            <div className="guide-picket-bar">
                <b>가이드 피켓<small>A4 가로 · 공항 미팅용</small></b>
                <button type="button" disabled={!image.url} onClick={save}>PNG 저장</button>
            </div>
            <div className="guide-picket-sheet">
                {image.url ? <img src={image.url} alt={`${input.customerName} 님 가이드 피켓`} /> : (image.error || '피켓을 만드는 중…')}
            </div>
            {(notice || image.error) && <p className="guide-picket-notice">{notice || image.error}</p>}
        </section>
    );
};
