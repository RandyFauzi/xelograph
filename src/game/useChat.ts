import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '../api';
import type { ChatMessage, Profile } from '../types';

const POLL_INTERVAL = 3500;
const BUBBLE_DURATION_MS = 6000;

export function useChat({
  profile,
  guestNickname,
  enabled = true,
}: {
  profile: Profile | null;
  guestNickname?: string;
  enabled?: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeBubbles, setActiveBubbles] = useState<Record<string, string>>({});
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(true);
  const [sending, setSending] = useState(false);
  const lastFetchedMs = useRef<number>(0);
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;

  const triggerBubble = useCallback((senderKey: string, text: string) => {
    if (!senderKey || !text) return;
    const cleanKey = senderKey.toLowerCase().trim();
    setActiveBubbles((prev) => ({ ...prev, [cleanKey]: text }));
    setTimeout(() => {
      setActiveBubbles((prev) => {
        if (prev[cleanKey] === text) {
          const next = { ...prev };
          delete next[cleanKey];
          return next;
        }
        return prev;
      });
    }, BUBBLE_DURATION_MS);
  }, []);

  const fetchMessages = useCallback(async () => {
    if (!enabled) return;
    try {
      const sinceParam = lastFetchedMs.current > 0 ? `?since=${lastFetchedMs.current}` : '';
      const data = await api<{ messages: ChatMessage[] }>(`/chat${sinceParam}`);
      if (!data?.messages || !Array.isArray(data.messages)) return;

      if (data.messages.length > 0) {
        const latestMs = Math.max(...data.messages.map((m) => m.createdMs || 0));
        if (latestMs > lastFetchedMs.current) {
          lastFetchedMs.current = latestMs;
        }

        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const fresh = data.messages.filter((m) => !existingIds.has(m.id));
          if (!fresh.length) return prev;

          // Trigger bubbles for recent non-system messages
          const now = Date.now();
          for (const msg of fresh) {
            if (!msg.isSystem && now - msg.createdMs < BUBBLE_DURATION_MS) {
              if (msg.nickname) triggerBubble(msg.nickname, msg.text);
              if (msg.senderId) triggerBubble(msg.senderId, msg.text);
            }
          }

          if (!isOpenRef.current) {
            setUnreadCount((count) => count + fresh.length);
          }

          // Keep rolling buffer of 80 messages on frontend
          const combined = [...prev, ...fresh];
          return combined.length > 80 ? combined.slice(combined.length - 80) : combined;
        });
      }
    } catch {
      // Background poll silently fails on network blip
    }
  }, [enabled, triggerBubble]);

  useEffect(() => {
    if (!enabled) return;
    void fetchMessages();
    const interval = setInterval(fetchMessages, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [enabled, fetchMessages]);

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      if (next) setUnreadCount(0);
      return next;
    });
  }, []);

  const markRead = useCallback(() => {
    setUnreadCount(0);
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;
      setSending(true);
      try {
        const res = await api<{ message: ChatMessage }>('/chat', {
          method: 'POST',
          body: JSON.stringify({ text: trimmed }),
        });
        if (res?.message) {
          const msg = res.message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            const updated = [...prev, msg];
            return updated.length > 80 ? updated.slice(updated.length - 80) : updated;
          });
          if (msg.nickname) triggerBubble(msg.nickname, msg.text);
          if (msg.senderId) triggerBubble(msg.senderId, msg.text);
          const currentNick = profile?.nickname || guestNickname;
          if (currentNick) triggerBubble(currentNick, msg.text);
          if (msg.createdMs > lastFetchedMs.current) {
            lastFetchedMs.current = msg.createdMs;
          }
        }
      } finally {
        setSending(false);
      }
    },
    [sending, profile, guestNickname, triggerBubble],
  );

  return {
    messages,
    activeBubbles,
    unreadCount,
    isOpen,
    sending,
    toggleOpen,
    markRead,
    sendMessage,
  };
}
