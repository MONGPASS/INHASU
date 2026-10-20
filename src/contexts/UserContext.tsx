import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { clearCustomerSessionCache } from '../lib/customerSessionCache';

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

    const checkUser = async () => {
        try {
            const data = await api.auth.me();
            if (data) {
                setUserState({
                    id: data.id,
                    name: data.name || 'User',
                    email: data.email,
                    image: data.avatarUrl,
                    role: data.role
                });
            } else {
                setUserState(null);
            }
        } catch (e) {
            console.error(e);
            setUserState(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkUser();
    }, []);

    const logout = async () => {
        try { await api.auth.logout(); }
        finally {
            await clearCustomerSessionCache(queryClient);
            setUserState(null);
            window.location.href = '/';
        }
    };

    const setUser = useCallback((newUser: User | null) => {
        setUserState(newUser);
    }, []);

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
