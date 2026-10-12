import React from 'react';

export const HeroSkeleton: React.FC = () => {
    return (
        <section className="mt-4 mb-6 px-5 w-full">
            <div className="relative w-full aspect-[16/10] rounded-3xl overflow-hidden bg-white dark:bg-white/5 border border-gray-100 dark:border-white/5 animate-pulse">
                {/* Content Placeholder */}
                <div className="absolute bottom-0 left-0 p-6 w-full space-y-3">
                    <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
                    <div className="space-y-2">
                        <div className="h-8 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
                        <div className="h-8 w-1/2 bg-gray-200 dark:bg-gray-700 rounded" />
                    </div>
                    <div className="h-4 w-1/3 bg-gray-200 dark:bg-gray-700 rounded" />
                </div>
            </div>
        </section>
    );
};
