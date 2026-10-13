import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

// Toast Types
interface Toast {
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    duration?: number;
}

// Confirm Dialog Types
interface ConfirmOptions {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info';
}

interface ToastContextType {
    showToast: (type: Toast['type'], message: string, duration?: number) => void;
    showConfirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) throw new Error('useToast must be used within ToastProvider');
    return context;
};

// Toast Component
const ToastItem: React.FC<{ toast: Toast; onClose: () => void }> = ({ toast, onClose }) => {
    const icons = {
        success: 'check_circle',
        error: 'error',
        warning: 'warning',
        info: 'info'
    };

    const colors = {
        success: 'bg-emerald-500',
        error: 'bg-red-500',
        warning: 'bg-amber-500',
        info: 'bg-blue-500'
    };

    React.useEffect(() => {
        const timer = setTimeout(onClose, toast.duration || 3000);
        return () => clearTimeout(timer);
    }, [toast.duration, onClose]);

    return (
        <div className={`flex items-center gap-3 px-4 py-3 ${colors[toast.type]} text-white rounded-xl shadow-lg animate-in slide-in-from-top-2 fade-in duration-300`}>
            <span className="material-symbols-outlined">{icons[toast.type]}</span>
            <p className="text-sm font-medium">{toast.message}</p>
            <button onClick={onClose} className="ml-auto p-1 hover:bg-white/20 rounded-lg transition-colors">
                <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
        </div>
    );
};

// Confirm Modal Component
const ConfirmModal: React.FC<{
    options: ConfirmOptions;
    onConfirm: () => void;
    onCancel: () => void;
}> = ({ options, onConfirm, onCancel }) => {
    const typeStyles = {
        danger: {
            icon: 'warning',
            iconBg: 'bg-red-100 text-red-600',
            confirmBtn: 'bg-red-500 hover:bg-red-600 text-white'
        },
        warning: {
            icon: 'help',
            iconBg: 'bg-amber-100 text-amber-600',
            confirmBtn: 'bg-amber-500 hover:bg-amber-600 text-white'
        },
        info: {
            icon: 'info',
            iconBg: 'bg-teal-100 text-teal-600',
            confirmBtn: 'bg-teal-500 hover:bg-teal-600 text-white'
        }
    };

    const style = typeStyles[options.type || 'info'];

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 text-center">
                    <div className={`w-16 h-16 mx-auto mb-4 rounded-full ${style.iconBg} flex items-center justify-center`}>
                        <span className="material-symbols-outlined text-3xl">{style.icon}</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">{options.title}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 whitespace-pre-line">{options.message}</p>
                </div>
                <div className="flex border-t border-slate-100 dark:border-slate-700">
                    <button
                        onClick={onCancel}
                        className="flex-1 py-4 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                        {options.cancelText || '취소'}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`flex-1 py-4 font-bold transition-colors ${style.confirmBtn}`}
                    >
                        {options.confirmText || '확인'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Provider Component
export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [confirmState, setConfirmState] = useState<{
        options: ConfirmOptions;
        resolve: (value: boolean) => void;
    } | null>(null);

    const showToast = useCallback((type: Toast['type'], message: string, duration = 3000) => {
        const id = Math.random().toString(36).substr(2, 9);
        setToasts(prev => [...prev, { id, type, message, duration }]);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const showConfirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
        return new Promise(resolve => {
            setConfirmState({ options, resolve });
        });
    }, []);

    const handleConfirm = () => {
        confirmState?.resolve(true);
        setConfirmState(null);
    };

    const handleCancel = () => {
        confirmState?.resolve(false);
        setConfirmState(null);
    };

    return (
        <ToastContext.Provider value={{ showToast, showConfirm }}>
            {children}

            {/* Toast Container */}
            <div className="fixed top-4 right-4 z-[300] flex flex-col gap-2 pointer-events-none">
                {toasts.map(toast => (
                    <div key={toast.id} className="pointer-events-auto">
                        <ToastItem toast={toast} onClose={() => removeToast(toast.id)} />
                    </div>
                ))}
            </div>

            {/* Confirm Modal */}
            {confirmState && (
                <ConfirmModal
                    options={confirmState.options}
                    onConfirm={handleConfirm}
                    onCancel={handleCancel}
                />
            )}
        </ToastContext.Provider>
    );
};
