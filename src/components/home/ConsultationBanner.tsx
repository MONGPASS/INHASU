import React from 'react';

export const ConsultationBanner: React.FC = () => {
    return (
        <section className="px-5 py-10">
            <div className="bg-primary/5 dark:bg-primary/10 rounded-3xl p-6 border border-primary/10">
                <h4 className="text-[17px] font-bold text-slate-900 dark:text-white mb-1">아직 일정을 정하지 못하셨나요?</h4>
                <p className="text-[13px] text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">여행 전문가가 고객님의 취향에 맞춘 1:1 맞춤 일정을 무료로 설계해 드립니다.</p>
                <button className="w-full py-3.5 bg-primary text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-primary/20">
                    <span className="material-symbols-outlined text-[20px]">chat_bubble</span>
                    무료 상담 시작하기
                </button>
            </div>
        </section>
    );
};
