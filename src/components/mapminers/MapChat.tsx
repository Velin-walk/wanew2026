import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../lib/firebase';
import { collection, addDoc, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { Send, MessageSquare, Compass, Calendar, Sparkles } from 'lucide-react';

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

export default function MapChat({ currentUserEmail, onSelectTrail }: MapChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const startStream = (useOrderBy: boolean) => {
      try {
        const q = useOrderBy
          ? query(
              collection(db, 'map_chats'),
              orderBy('timestamp', 'desc'),
              limit(100)
            )
          : query(
              collection(db, 'map_chats'),
              limit(100)
            );

        unsubscribe = onSnapshot(q, (snapshot) => {
          setConnectionStatus('online');
          const msgs: ChatMessage[] = [];
          
          // If server-sorted in desc order, reverse once to show oldest-to-newest chronologically
          const docs = useOrderBy ? [...snapshot.docs].reverse() : snapshot.docs;
          
          docs.forEach((doc) => {
            const data = doc.data();
            msgs.push({
              id: doc.id,
              text: data.text || '',
              senderEmail: data.senderEmail || '',
              senderName: data.senderName || 'Hiker',
              guestSessionId: data.guestSessionId || null,
              timestamp: data.timestamp || Date.now()
            });
          });

          // Fallback manual sort if database returned unordered list
          if (!useOrderBy) {
            msgs.sort((a, b) => a.timestamp - b.timestamp);
          }

          setMessages(msgs);
          setLoading(false);
        }, (error) => {
          console.warn(`Firestore chat stream warning (useOrderBy=${useOrderBy}):`, error);
          if (useOrderBy) {
            // Fall back to no-index query to guarantee instant operation
            console.log("Attempting fallback chat query without orderBy...");
            if (unsubscribe) unsubscribe();
            startStream(false);
          } else {
            setConnectionStatus('offline');
            setErrorMessage(error.message || String(error));
            setLoading(false);
          }
        });
      } catch (err) {
        console.error("Failed to construct query:", err);
        setConnectionStatus('offline');
        setErrorMessage(err instanceof Error ? err.message : String(err));
        setLoading(false);
      }
    };

    startStream(true);

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

    try {
      await addDoc(collection(db, 'map_chats'), payload);
    } catch (err) {
      console.error('Failed to post live chat:', err);
      setInputText(textToSubmit); // Restore text on failure so message isn't lost
    }
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
        <span className="text-[10px] text-neutral-400 font-bold">
          {connectionStatus === 'online' ? `${messages.length} active logs` : 'reconnecting...'}
        </span>
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
