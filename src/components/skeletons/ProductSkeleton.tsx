import React from 'react';

export const ProductSkeleton: React.FC = () => {
    return (
        <div className="flex flex-col bg-white dark:bg-white/5 rounded-xl overflow-hidden shadow-sm border border-gray-100 dark:border-white/5 animate-pulse h-full">
            {/* Image Placeholder */}
            <div className="w-full aspect-square bg-gray-200 dark:bg-gray-700" />

            {/* Content Placeholder */}
            <div className="p-3 space-y-2">
                {/* Category | Duration */}
                <div className="flex items-center gap-2">
                    <div className="h-3 w-12 bg-gray-200 dark:bg-gray-700 rounded" />
                    <div className="h-3 w-1 bg-gray-200 dark:bg-gray-700 rounded" />
                    <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
                </div>

                {/* Title */}
                <div className="space-y-1">
                    <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded" />
                    <div className="h-4 w-2/3 bg-gray-200 dark:bg-gray-700 rounded" />
                </div>

                {/* Price */}
                <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded mt-2" />
            </div>
        </div>
    );
};
