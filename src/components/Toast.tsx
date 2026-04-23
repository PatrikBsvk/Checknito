'use client';

import { useEffect, useState } from 'react';

interface ToastProps {
  type: 'success' | 'error' | 'info';
  message: string;
  duration?: number;
}

export default function Toast({ type, message, duration = 3000 }: ToastProps) {
  const [visible, setVisible] = useState(true);

  // Reset visibility whenever the message changes (same Toast instance, new message).
  useEffect(() => {
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), duration);
    return () => clearTimeout(timer);
  }, [message, duration]);

  if (!visible) return null;

  return <div className={`toast ${type}`}>{message}</div>;
}
