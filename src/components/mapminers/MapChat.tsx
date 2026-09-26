import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, MessageSquare, Sparkles, RotateCcw, Trash2 } from 'lucide-react';
import { apiFetch } from '../../services/api';

const GLOBAL_CHAT_TRAIL_ID = 'global_trail_chat';

interface MapChatProps {
  currentUserEmail?: string;
  onSelectTrail?: (trailName: string) => void;
}

interface ChatMessage {
  id: string;
  text: string;
  senderEmail: string;
  senderName: string;
  guestSessionId?: string | null;
  timestamp: number;
}

const INITIAL_TRAIL_POSTS: ChatMessage[] = [
  {
    id: 'seed-1',
    text: 'Welcome to MapMiners Trail Chat! Share real-time conditions, trail blockages, or questions with fellow hikers.',
    senderEmail: 'walknepalwalk@gmail.com',
    senderName: 'Coordinator (WNW)',
    timestamp: 1700000000000,
  },
  {
    id: 'seed-2',
    text: 'Sundarijal to Chisapani route is clear today. Spring water point near the army checkpost is flowing well.',
    senderEmail: 'biraj@seekscape.com',
    senderName: 'Trail Scout',
    timestamp: 1700000060000,
  }
];

function mergeChatMessages(existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const map = new Map<string, ChatMessage>();
  INITIAL_TRAIL_POSTS.forEach((m) => map.set(m.id, m));
  existing.forEach((m) => map.set(m.id, m));
  incoming.forEach((m) => map.set(m.id, m));
  return Array.from(map.values()).sort((a, b) => a.timestamp - b.timestamp);
}

export default function MapChat({ currentUserEmail }: MapChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('wnw_mapchat_messages');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_TRAIL_POSTS;
  });
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'offline'>('online');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [guestName, setGuestName] = useState(() => {
    return localStorage.getItem('chat_guest_name') || '';
  });
  const [showNameModal, setShowNameModal] = useState(false);
  
  // Persist a unique session ID for the guest browser to correctly identify personal chats
  const [currentSessionId] = useState(() => {
    let id = localStorage.getItem('chat_guest_session_id');
    if (!id) {
      id = 'gs_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
      localStorage.setItem('chat_guest_session_id', id);
    }
    return id;
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchGlobalChat = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await apiFetch(
        `mapminers/comments?trailId=${encodeURIComponent(GLOBAL_CHAT_TRAIL_ID)}`,
        { forceFresh: true }
      );
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json().catch(() => ({}));
      if (data?.success && Array.isArray(data.comments)) {
        const remoteMsgs: ChatMessage[] = data.comments.map((c: any) => ({
          id: String(c.id),
          text: String(c.text || ''),
          senderName: String(c.authorName || c.author_name || 'Hiker'),
          senderEmail: String(c.authorEmail || c.author_email || ''),
          guestSessionId: c.guestSessionId || c.guest_session_id || null,
          timestamp: Number(c.timestamp) || Date.now(),
        }));

        setMessages((prev) => {
          const merged = mergeChatMessages(prev, remoteMsgs);
          try {
            localStorage.setItem('wnw_mapchat_messages', JSON.stringify(merged));
          } catch {}
          return merged;
        });
        setConnectionStatus('online');
        setErrorMessage('');
      }
    } catch (err: any) {
      setConnectionStatus('offline');
      setErrorMessage(err?.message || 'Unable to sync with Cloudflare D1');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial fetch + periodic live sync while MapChat is open
  useEffect(() => {
    fetchGlobalChat(false);
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchGlobalChat(true);
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchGlobalChat]);

  // Auto scroll to bottom when message count changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    let senderName = 'Guest Hiker';
    if (currentUserEmail) {
      senderName = currentUserEmail.split('@')[0];
    } else if (guestName.trim()) {
      senderName = guestName.trim();
    } else {
      setShowNameModal(true);
      return;
    }

    const payload = {
      text: inputText.trim(),
      senderEmail: currentUserEmail || 'guest@walknepal.com',
      senderName: senderName,
      guestSessionId: currentUserEmail ? null : currentSessionId,
      timestamp: Date.now()
    };

    const textToSubmit = inputText;
    setInputText('');

    const commentId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newMsg: ChatMessage = { id: commentId, ...payload };

    // 1. Optimistically update UI & localStorage
    setMessages((prev) => {
      const updated = mergeChatMessages(prev, [newMsg]);
      try {
        localStorage.setItem('wnw_mapchat_messages', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    // 2. Persist to Cloudflare D1 via existing mapminers/comments endpoint
    try {
      const res = await apiFetch('mapminers/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: commentId,
          trailId: GLOBAL_CHAT_TRAIL_ID,
          text: payload.text,
          authorName: payload.senderName,
          authorEmail: payload.senderEmail,
          guestSessionId: payload.guestSessionId,
          timestamp: payload.timestamp,
        }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      setConnectionStatus('online');
      setErrorMessage('');
    } catch (err: any) {
      console.error('Failed to post live chat to D1:', err);
      setConnectionStatus('offline');
      setErrorMessage(err?.message || 'Saved locally; could not reach server');
      setInputText(textToSubmit);
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    setMessages((prev) => {
      const updated = prev.filter((m) => m.id !== msgId);
      try {
        localStorage.setItem('wnw_mapchat_messages', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    try {
      await apiFetch(`mapminers/comments/${encodeURIComponent(msgId)}`, {
        method: 'DELETE',
      });
    } catch (_) {}
  };

  const saveGuestName = (e: React.FormEvent) => {
    e.preventDefault();
    if (guestName.trim()) {
      localStorage.setItem('chat_guest_name', guestName.trim());
      setShowNameModal(false);
      // Automatically send the message that triggered the nickname prompt
      setTimeout(() => {
        handleSendMessage();
      }, 50);
    }
  };

  return (
    <div className="flex flex-col h-full bg-neutral-50/50">
      {/* Active Header */}
      <div className="p-3 bg-white border-b border-neutral-100 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${connectionStatus === 'online' ? 'bg-[#7ABA42]' : 'bg-amber-500'}`} />
          <span className="text-xs font-black text-neutral-800 tracking-tight">
            {connectionStatus === 'online' ? 'Live Trail chat' : 'Radio Signal Weak'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-neutral-400 font-bold">
            {connectionStatus === 'online' ? `${messages.length} active logs` : 'offline cache'}
          </span>
          <button
            type="button"
            onClick={() => fetchGlobalChat(false)}
            disabled={refreshing}
            title="Refresh live trail chat"
            className="p-1 rounded-lg hover:bg-neutral-100 text-neutral-500 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className={`w-3 h-3 ${refreshing ? 'animate-spin text-[#7ABA42]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Offline Status Diagnostic Banner */}
      {connectionStatus === 'offline' && (
        <div className="bg-amber-50 border-b border-amber-200 p-2 text-center text-[10px] text-amber-800 font-bold leading-normal">
          <div>Trouble connecting to trail frequency:</div>
          <div className="font-mono mt-0.5 text-[9px] bg-amber-100/40 p-1 rounded break-all select-all">{errorMessage}</div>
        </div>
      )}

      {/* Messages viewport */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3 scrollbar-thin">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-center h-full">
            <div className="w-5 h-5 border-2 border-[#7ABA42] border-t-transparent rounded-full animate-spin" />
            <span className="text-[10px] text-neutral-400 font-bold">Connecting to radio frequency...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-center h-full text-neutral-400">
            <MessageSquare className="w-8 h-8 text-neutral-300 animate-pulse" />
            <span className="text-xs font-bold text-neutral-500">Silence on the Trails</span>
            <span className="text-[10px] max-w-[200px]">Be the first to share live trail updates, conditions, or greet fellow hikers!</span>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = (currentUserEmail && msg.senderEmail === currentUserEmail) || 
                         (!currentUserEmail && (msg.guestSessionId === currentSessionId || (msg.senderName === guestName && guestName.trim() !== '')));
            const isAdminUser = currentUserEmail?.toLowerCase() === 'walknepalwalk@gmail.com';
            const canDelete = !msg.id.startsWith('seed-') && (isMe || isAdminUser);
            return (
              <div
                key={msg.id}
                className={`flex flex-col max-w-[85%] ${isMe ? 'ml-auto items-end' : 'mr-auto items-start'}`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px] font-black text-neutral-600 truncate max-w-[120px]">
                    {msg.senderName}
                  </span>
                  <span className="text-[8px] text-neutral-400">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => handleDeleteMessage(msg.id)}
                      title="Delete message"
                      className="text-neutral-300 hover:text-rose-500 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
                <div
                  className={`p-3 rounded-2xl text-xs leading-relaxed shadow-3xs break-words w-full ${
                    isMe
                      ? 'bg-[#7ABA42] text-white rounded-tr-none'
                      : 'bg-white text-neutral-800 border border-neutral-200/50 rounded-tl-none'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Inputs panel */}
      <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-neutral-100 shrink-0 flex items-center gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={currentUserEmail ? "Say something..." : "Identify nickname to chat..."}
          className="flex-1 p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white text-xs font-semibold focus:outline-none focus:border-[#7ABA42] text-neutral-800"
          maxLength={400}
        />
        <button
          type="submit"
          className="p-2.5 bg-[#7ABA42] hover:bg-[#6CA838] text-white rounded-xl transition-all cursor-pointer shadow-xs shrink-0 flex items-center justify-center"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>

      {/* Guest Name Modal Popup */}
      {showNameModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[2500] flex items-center justify-center p-4">
          <form onSubmit={saveGuestName} className="bg-white rounded-2xl max-w-xs w-full p-5 shadow-2xl space-y-3.5">
            <div className="text-center">
              <Sparkles className="w-6 h-6 text-[#7ABA42] mx-auto mb-1 animate-bounce" />
              <h3 className="text-sm font-bold text-neutral-800">Choose a Chat Nickname</h3>
              <p className="text-[10px] text-neutral-400 mt-1">
                Enter your nickname to post your first message on the trail radar!
              </p>
            </div>
            <input
              type="text"
              placeholder="e.g. MountainLover"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className="w-full p-2.5 border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#7ABA42] text-xs text-center font-bold bg-neutral-50"
              required
              maxLength={20}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowNameModal(false)}
                className="flex-1 py-2 text-[11px] border border-neutral-200 hover:bg-neutral-100 text-neutral-700 font-bold rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2 bg-[#7ABA42] hover:bg-[#6CA838] text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
              >
                Let's Chat!
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
