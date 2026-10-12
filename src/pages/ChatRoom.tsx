import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api'; 
import { useUser } from '../contexts/UserContext';

interface Message {
    id: string;
    content: string;
    user_id: string;
    created_at: string;
}

export const ChatRoom: React.FC = () => {
    const { id: roomId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useUser();
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [partnerName, setPartnerName] = useState('Chat');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Initial Fetch & Partner Info
    useEffect(() => {
        if (!roomId || !user) return;

        // Fetch Partner Info
        const fetchPartner = async () => {
            try {
                // Assuming api.chats.get(id) returns room info including participants
                const room = await api.chats.get(roomId);
                if (room && room.chat_participants) {
                    const partner = room.chat_participants.find((p: any) => p.user_id !== user.id);
                    if (partner && partner.profiles) {
                        setPartnerName(partner.profiles.full_name || 'Partner');
                    }
                }
            } catch (e) {
                console.error("Error fetching partner:", e);
            }
        };

        // Fetch Messages
        const fetchMessages = async () => {
            try {
                const data = await api.messages.list(roomId);
                if (data) {
                    setMessages(data);
                }
            } catch (e) {
                console.error("Error fetching messages:", e);
            }
        };

        fetchPartner();
        fetchMessages();
    }, [roomId, user]);

    // Auto Scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!newMessage.trim() || !user || !roomId) return;

        const content = newMessage.trim();
        setNewMessage(''); // Optimistic clear

        try {
            const result = await api.messages.create({
                room_id: roomId,
                user_id: user.id,
                content: content
            });

            // If backend returns the created message, add it (since realtime is off)
            if (result) {
                setMessages(prev => [...prev, result]);
            }
        } catch (error) {
            console.error('Send error:', error);
            alert('메시지 전송 실패');
        }
    };

    return (
        <div className="flex flex-col h-screen bg-white dark:bg-[#12201d]">
            {/* Header */}
            <header className="flex items-center gap-3 p-4 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-[#12201d] sticky top-0 z-10">
                <button
                    onClick={() => navigate('/chats')}
                    className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                    <span className="material-symbols-outlined text-gray-600 dark:text-gray-300">arrow_back</span>
                </button>
                <div className="flex flex-col">
                    <h1 className="font-bold text-lg dark:text-white leading-tight">{partnerName}</h1>
                    <span className="text-xs text-green-500 font-medium">온라인</span>
                </div>
            </header>

            {/* Messages Area */}
            <main className="flex-1 overflow-y-auto p-4 bg-slate-50 dark:bg-black/20">
                <div className="flex flex-col gap-3">
                    {messages.map((msg) => {
                        const isMe = msg.user_id === user?.id;
                        return (
                            <div
                                key={msg.id}
                                className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${isMe
                                        ? 'bg-primary text-white rounded-tr-none shadow-md shadow-primary/20'
                                        : 'bg-white dark:bg-surface-dark border border-gray-100 dark:border-gray-700 rounded-tl-none shadow-sm dark:text-gray-200'
                                        }`}
                                >
                                    {msg.content}
                                </div>
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>
            </main>

            {/* Input Area */}
            <footer className="p-4 bg-white dark:bg-[#12201d] border-t border-gray-100 dark:border-gray-800">
                <form
                    onSubmit={handleSendMessage}
                    className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-full px-4 py-2"
                >
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="메시지를 입력하세요..."
                        className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2 dark:text-white"
                    />
                    <button
                        type="submit"
                        disabled={!newMessage.trim()}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-primary text-white disabled:opacity-50 disabled:bg-gray-300 transition-colors"
                    >
                        <span className="material-symbols-outlined text-[18px]">send</span>
                    </button>
                </form>
            </footer>
        </div>
    );
};
