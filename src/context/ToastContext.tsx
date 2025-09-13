import React, { createContext, useState, useContext, useCallback } from 'react';
import { ToastMessage } from '../types';

interface ToastContextType {
  toasts: ToastMessage[];
  addToast: (message: string, type: ToastMessage['type'], duration?: number, dismissible?: boolean) => void;
  dismissToast: (id: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: number) => {
    // Trigger the exit animation
    setToasts(currentToasts => 
      currentToasts.map(toast => toast.id === id ? { ...toast, closing: true } : toast)
    );
    
    // Remove the toast from state after the animation completes
    setTimeout(() => {
      setToasts(currentToasts => currentToasts.filter(toast => toast.id !== id));
    }, 300); // This duration should match the toast-out animation
  }, []);

  const addToast = useCallback((message: string, type: ToastMessage['type'], duration: number = 4000, dismissible: boolean = true) => {
    const id = Date.now() + Math.random(); // Add random to prevent key collision on rapid calls
    const newToast: ToastMessage = { id, message, type, duration, dismissible };
    setToasts(currentToasts => [newToast, ...currentToasts]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const dismissToast = useCallback((id: number) => {
    removeToast(id);
  }, [removeToast]);
  
  return (
    <ToastContext.Provider value={{ toasts, addToast, dismissToast }}>
      {children}
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
