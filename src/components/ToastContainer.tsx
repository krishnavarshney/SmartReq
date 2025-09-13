import React from 'react';
import { useToast } from '../context/ToastContext';
import { CheckCircle2, XCircle, Info, X } from './icons';


const ToastIcon: React.FC<{ type: 'success' | 'error' | 'info' }> = ({ type }) => {
    switch (type) {
        case 'success': return <CheckCircle2 className="w-5 h-5 text-success" />;
        case 'error': return <XCircle className="w-5 h-5 text-destructive" />;
        case 'info': return <Info className="w-5 h-5 text-primary" />;
    }
};


export const ToastContainer: React.FC = () => {
    const { toasts, dismissToast } = useToast();

    const typeClasses = {
        success: 'bg-success/80 border-success/90 text-success-foreground',
        error: 'bg-destructive/80 border-destructive/90 text-destructive-foreground',
        info: 'bg-primary/80 border-primary/90 text-primary-foreground',
    }

    return (
        <div className="fixed bottom-4 right-4 z-[9999] w-full max-w-xs">
            {toasts.map((toast, index) => (
                <div 
                    key={toast.id} 
                    className={`
                        bg-popover border border-border p-3 rounded-lg shadow-lg flex items-center space-x-3 
                        ${typeClasses[toast.type]}
                        ${toast.closing ? 'animate-toast-out' : 'animate-toast-in'}
                        relative overflow-hidden mb-[-10px]
                    `}
                    style={{ zIndex: toasts.length - index }}
                    role="alert"
                >
                    <div className="flex-shrink-0">
                        <ToastIcon type={toast.type} />
                    </div>
                    <div className="text-sm font-semibold text-foreground flex-grow">{toast.message}</div>
                    {toast.dismissible && (
                        <button 
                            onClick={() => dismissToast(toast.id)}
                            className="ml-auto p-1 rounded-md hover:bg-background/50 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                    {toast.duration && toast.duration > 0 && (
                        <div 
                            className="absolute bottom-0 left-0 h-1 bg-current opacity-50"
                            style={{ animation: `progress ${toast.duration}ms linear forwards` }}
                        />
                    )}
                </div>
            ))}
        </div>
    );
};

