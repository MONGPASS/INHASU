import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../../lib/api';

interface AuthGuardProps {
    children: React.ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const user = await api.auth.me();

                if (!user) {
                    navigate('/login', {
                        state: { from: `${location.pathname}${location.search}${location.hash}` },
                    });
                    return;
                }

                setIsAuthenticated(true);
            } catch (error) {
                console.error('Auth check error:', error);
                navigate('/login');
            } finally {
                setIsLoading(false);
            }
        };

        checkAuth();
    }, [navigate, location.pathname, location.search, location.hash]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                </div>
            </div>
        );
    }

    return isAuthenticated ? <>{children}</> : null;
};
