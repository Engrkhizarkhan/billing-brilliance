import { useEffect, useState } from 'react';
import { API_BASE_URL, getAccessToken } from '@/lib/apiClient';
import { notifyPaymentUpdate } from '@/store/paymentStore';

export const usePaymentEvents = (enabled: boolean) => {
  const [connected, setConnected] = useState(false);
  const [lastEventAt, setLastEventAt] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let retryTimer: number | undefined;
    let stopped = false;

    const connect = async () => {
      try {
        const token = getAccessToken();
        if (!token) return;
        const response = await fetch(`${API_BASE_URL}/payments/events`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
          credentials: 'include',
          signal: controller.signal,
        });
        if (!response.ok || !response.body) throw new Error(`Payment stream failed (${response.status})`);
        setConnected(true);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (!stopped) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const messages = buffer.split('\n\n');
          buffer = messages.pop() || '';
          for (const message of messages) {
            const event = message.split('\n').find((line) => line.startsWith('event:'))?.slice(6).trim();
            if (event === 'payment') {
              setLastEventAt(new Date().toISOString());
              notifyPaymentUpdate();
            }
          }
        }
        if (!stopped) throw new Error('Payment stream closed');
      } catch (error) {
        if (stopped || (error instanceof DOMException && error.name === 'AbortError')) return;
        setConnected(false);
        retryTimer = window.setTimeout(() => void connect(), 3000);
      }
    };

    void connect();
    return () => {
      stopped = true;
      controller.abort();
      if (retryTimer) window.clearTimeout(retryTimer);
      setConnected(false);
    };
  }, [enabled]);

  return { connected, lastEventAt };
};
