import React, { createContext, useCallback, useContext, useState } from 'react';
import ToastContainer from './ToastContainer';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, opts = {}) => {
    const id = Date.now() + Math.random();
    const t = { id, message, type: opts.type || 'info', timeout: opts.timeout ?? 4000 };
    setToasts((s) => [...s, t]);
    if (t.timeout > 0) setTimeout(() => setToasts((s) => s.filter(x => x.id !== id)), t.timeout + 100);
    return id;
  }, []);

  const removeToast = useCallback((id) => setToasts((s) => s.filter(x => x.id !== id)), []);

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export default ToastContext;
