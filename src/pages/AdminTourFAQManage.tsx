import React from 'react';
import { AdminLayout } from '../components/admin/AdminLayout';
import { TourFAQEditor } from '../components/admin/TourFAQEditor';

/**
 * Standalone page that hosts only the Tour Common FAQ editor. Kept so old
 * bookmarks of /admin/tour-faqs continue to work — the primary entry point
 * now lives as a tab inside /admin/faq.
 */
export const AdminTourFAQManage: React.FC = () => {
    return (
        <AdminLayout
            activePage="faq"
            title="투어 공통 FAQ"
            description="모든 상품 상세 페이지 하단에 공통으로 표시됩니다. 「FAQ 관리」→「투어 공통 FAQ」 탭에서도 동일하게 편집 가능합니다."
        >
            <div className="card route-anim">
                <div className="card-pad">
                    <TourFAQEditor />
                </div>
            </div>
        </AdminLayout>
    );
};

export default AdminTourFAQManage;
