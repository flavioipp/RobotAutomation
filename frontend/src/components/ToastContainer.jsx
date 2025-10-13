import React from 'react';
import './ToastContainer.css';

export default function ToastContainer({ toasts, onClose }) {
  return (
    <div className="toast-root">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <div className="toast-msg">{t.message}</div>
          <button className="toast-close" onClick={() => onClose(t.id)}>&times;</button>
        </div>
      ))}
    </div>
  );
}
