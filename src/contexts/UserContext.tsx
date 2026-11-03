import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { clearCustomerSessionCache } from '../lib/customerSessionCache';
import { clearAdminReads, setAdminReadAccount } from '../lib/adminReadCache';

interface User {
    id: string;
    name: string;
    email?: string;
    image?: string | null;
    role?: string;
}

interface UserContextType {
    user: User | null;
    setUser: (user: User | null) => void;
    logout: () => void;
    loading: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const queryClient = useQueryClient();
    const [user, setUserState] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const authRevision = useRef(0);
    const applyUser = useCallback((next: User | null) => {
        // Scope changes before children can render or start another request.
        setAdminReadAccount(next?.role === 'admin' ? next.id : '');
        setUserState(next);
    }, []);

    useEffect(() => {
        const current = ++authRevision.current;
        let active = true;
        const checkUser = async () => {
            try {
                const data = await api.auth.me();
                if (!active || current !== authRevision.current) return;
                if (data) {
                    applyUser({
                        id: data.id,
                        name: data.name || 'User',
                        email: data.email,
                        image: data.avatarUrl,
                        role: data.role
                    });
                } else {
                    applyUser(null);
                }
            } catch (e) {
                console.error(e);
                if (active && current === authRevision.current) applyUser(null);
            } finally {
                if (active && current === authRevision.current) setLoading(false);
            }
        };
        void checkUser();
        return () => { active = false; clearAdminReads(); };
    }, [applyUser]);

    const logout = async () => {
        authRevision.current++;
        clearAdminReads();
        try { await api.auth.logout(); }
        finally {
            await clearCustomerSessionCache(queryClient);
            applyUser(null);
            window.location.href = '/';
        }
    };

    const setUser = useCallback((newUser: User | null) => {
        authRevision.current++;
        applyUser(newUser);
        setLoading(false);
    }, [applyUser]);

    return (
        <UserContext.Provider value={{ user, setUser, logout, loading }}>
            {children}
        </UserContext.Provider>
    );
};

export const useUser = () => {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
};
