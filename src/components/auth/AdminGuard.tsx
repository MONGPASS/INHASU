import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';

interface AdminGuardProps {
    children: React.ReactNode;
}

export const AdminGuard: React.FC<AdminGuardProps> = ({ children }) => {
    const { user, loading } = useUser();
    const navigate = useNavigate();

    useEffect(() => {
        if (!loading) {
            if (!user || user.role !== 'admin') {
                // Optional: Show alert or just redirect
                // alert('현재 로그인된 계정은 관리자가 아닙니다.\n관리자 계정으로 다시 로그인해주세요.');
                navigate('/admin/login');
            }
        }
    }, [user, loading, navigate]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                    <p className="text-slate-500 font-medium text-sm">권한 확인 중...</p>
                </div>
            </div>
        );
    }

    if (!user || user.role !== 'admin') {
        return null; // Will redirect via useEffect
    }

    return <>{children}</>;
};
