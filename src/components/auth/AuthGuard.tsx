import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../../lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { synchronizeCustomerSessionCache } from '../../lib/customerSessionCache';
import { useUser } from '../../contexts/UserContext';

interface AuthGuardProps {
    children: React.ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const queryClient = useQueryClient();
    const { setUser } = useUser();
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [validatedPath, setValidatedPath] = useState('');
    const currentPath = `${location.pathname}${location.search}${location.hash}`;

    useEffect(() => {
        let active = true;
        setIsLoading(true);
        setIsAuthenticated(false);
        const checkAuth = async () => {
            try {
                const user = await api.auth.me();
                if (!active) return;
                await synchronizeCustomerSessionCache(queryClient, user);
                if (!active) return;
                setUser(user ? { id: user.id, name: user.name || '고객', email: user.email, image: user.avatarUrl || user.image, role: user.role } : null);

                if (!user) {
                    navigate('/login', {
                        replace: true,
                        state: { from: `${location.pathname}${location.search}${location.hash}` },
                    });
                    return;
                }

                setIsAuthenticated(true);
                setValidatedPath(currentPath);
            } catch (error) {
                console.error('Auth check error:', error);
                if (active) navigate('/login', { replace: true, state: { from: `${location.pathname}${location.search}${location.hash}` } });
            } finally {
                if (active) setIsLoading(false);
            }
        };

        checkAuth();
        return () => { active = false; };
    }, [navigate, queryClient, setUser, currentPath, location.pathname, location.search, location.hash]);

    if (isLoading || validatedPath !== currentPath) {
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
