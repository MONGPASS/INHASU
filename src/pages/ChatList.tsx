import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api'; 
import { useUser } from '../contexts/UserContext';
import { BottomNav } from '../components/layout/BottomNav';

interface ChatRoom {
    id: string;
    updated_at: string;
    chat_participants: {
        user_id: string;
        profiles: {
            full_name: string;
            avatar_url: string | null;
            email: string;
        }
    }[];
    last_message?: {
        content: string;
        created_at: string;
    };
}

export const ChatList: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useUser();
    const [rooms, setRooms] = useState<ChatRoom[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;

        const fetchRooms = async () => {
            setLoading(true);
            try {
                const data = await api.chats.list();
                if (data) {
                    setRooms(data);
                }
            } catch (error) {
                console.error('Error fetching rooms:', error);
            }
            setLoading(false);
        };

        fetchRooms();
    }, [user]);

    // Helper to get partner info
    const getPartner = (participants: ChatRoom['chat_participants']) => {
        const partner = participants.find(p => p.user_id !== user?.id);
        return partner ? partner.profiles : { full_name: '알 수 없음', avatar_url: null, email: '' };
    };

    return (
        <div className="bg-background-light dark:bg-background-dark font-display text-text-main-light dark:text-text-main-dark min-h-screen pb-24">
            <header className="sticky top-0 z-50 bg-white/90 dark:bg-[#12201d]/90 backdrop-blur-md px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                <h1 className="text-xl font-bold">메시지</h1>
            </header>

            <main className="p-4">
                {loading ? (
                    <div className="flex justify-center p-10">
                        <span className="material-symbols-outlined animate-spin text-primary">sync</span>
                    </div>
                ) : rooms.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                        <span className="material-symbols-outlined text-6xl mb-4 opacity-20">chat_bubble_outline</span>
                        <p>대화방이 없습니다.</p>
                        <p className="text-sm mt-1">동행 찾기에서 새로운 친구를 만들어보세요!</p>
                        <button
                            onClick={() => navigate('/travel-mates')}
                            className="mt-6 px-6 py-2 bg-primary text-white rounded-full font-bold text-sm"
                        >
                            동행 찾으러 가기
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        {rooms.map(room => {
                            const partner = getPartner(room.chat_participants);
                            return (
                                <div
                                    key={room.id}
                                    onClick={() => navigate(`/chats/${room.id}`)}
                                    className="flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-surface-dark shadow-sm active:scale-[0.98] transition-transform cursor-pointer"
                                >
                                    <div className="relative">
                                        <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden">
                                            {partner.avatar_url ? (
                                                <img src={partner.avatar_url} alt={partner.full_name} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary">
                                                    <span className="material-symbols-outlined text-2xl">person</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-baseline mb-1">
                                            <h3 className="font-bold truncate text-base">{partner.full_name || partner.email?.split('@')[0]}</h3>
                                            <span className="text-[10px] text-gray-400">
                                                {new Date(room.updated_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-500 truncate">
                                            대화 내역을 확인해보세요.
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>

            <BottomNav />
        </div>
    );
};
