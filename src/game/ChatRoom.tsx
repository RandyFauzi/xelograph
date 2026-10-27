import { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, Minimize2, ChevronDown, UserCheck } from 'lucide-react';
import type { ChatMessage, Profile } from '../types';

export default function ChatRoom({
  profile,
  messages,
  unreadCount,
  isOpen,
  sending,
  onToggleOpen,
  onSendMessage,
  onJoin,
}: {
  profile: Profile | null;
  messages: ChatMessage[];
  unreadCount: number;
  isOpen: boolean;
  sending: boolean;
  onToggleOpen: () => void;
  onSendMessage: (text: string) => Promise<void>;
  onJoin: () => void;
}) {
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom whenever messages update
  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || sending) return;
    setInputText('');
    await onSendMessage(text);
  };

  const formatTime = (ms: number) => {
    if (!ms) return '';
    const date = new Date(ms);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        className="chat-toggle-pill"
        onClick={onToggleOpen}
        aria-label="Buka obrolan kampus"
        title="Buka obrolan kampus"
      >
        <MessageSquare size={16} />
        <span>Obrolan</span>
        {unreadCount > 0 && <span className="chat-unread-badge">{unreadCount}</span>}
      </button>
    );
  }

  return (
    <div className="game-chat-box" role="region" aria-label="Roomchat Obrolan Kampus">
      <header className="chat-box-header">
        <div className="chat-box-title">
          <MessageSquare size={14} />
          <strong>Obrolan Kampus</strong>
        </div>
        <button
          type="button"
          className="chat-box-hide"
          onClick={onToggleOpen}
          aria-label="Sembunyikan obrolan"
          title="Sembunyikan obrolan"
        >
          <ChevronDown size={17} />
        </button>
      </header>

      <div className="chat-box-messages" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="chat-empty">Belum ada obrolan. Sapa teman-temanmu di sini!</div>
        ) : (
          messages.map((m) => {
            const isMe = profile && m.senderId === profile.id;
            if (m.isSystem) {
              return (
                <div key={m.id} className="chat-item is-system">
                  <span className="chat-system-tag">📢 PENGUMUMAN</span>
                  <p>{m.text}</p>
                </div>
              );
            }
            return (
              <div key={m.id} className={'chat-item' + (isMe ? ' is-me' : '')}>
                <span className="chat-time">{formatTime(m.createdMs)}</span>
                <b className="chat-author">{m.nickname}:</b>
                <span className="chat-text">{m.text}</span>
              </div>
            );
          })
        )}
      </div>

      <div className="chat-box-footer">
        {profile ? (
          <form className="chat-input-form" onSubmit={handleSubmit}>
            <input
              type="text"
              placeholder="Ketik pesan santai..."
              maxLength={100}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={sending}
            />
            <button
              type="submit"
              disabled={!inputText.trim() || sending}
              aria-label="Kirim pesan"
              title="Kirim pesan"
            >
              <Send size={14} />
            </button>
          </form>
        ) : (
          <button type="button" className="chat-join-prompt" onClick={onJoin}>
            <UserCheck size={14} />
            <span>Buat karakter untuk ikut ngobrol</span>
          </button>
        )}
      </div>
    </div>
  );
}
