import React, { createContext, useCallback, useContext, useState } from 'react';
import { Toast, type ToastType } from '@/components/ui/Toast';

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  hideToast: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Standalone callback so non-React services (e.g. httpClient) can dispatch toasts directly if needed
let globalToastHandler: ((message: string, type?: ToastType, duration?: number) => void) | null = null;

export function showGlobalToast(message: string, type: ToastType = 'error', duration = 4000) {
  if (globalToastHandler) {
    globalToastHandler(message, type, duration);
  }
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toastState, setToastState] = useState<{
    visible: boolean;
    message: string;
    type: ToastType;
    duration: number;
  }>({
    visible: false,
    message: '',
    type: 'error',
    duration: 4000,
  });

  const showToast = useCallback((message: string, type: ToastType = 'error', duration = 4000) => {
    setToastState({
      visible: true,
      message,
      type,
      duration,
    });
  }, []);

  const hideToast = useCallback(() => {
    setToastState((prev) => ({ ...prev, visible: false }));
  }, []);

  globalToastHandler = showToast;

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      <Toast
        visible={toastState.visible}
        message={toastState.message}
        type={toastState.type}
        duration={toastState.duration}
        onDismiss={hideToast}
      />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

