import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  Send,
  MessageSquare,
  Shield,
  Clock,
  Sparkles,
  Search,
  Filter,
  CheckCircle2,
  RefreshCw,
  Hash,
  AlertCircle,
  Users,
  Copy,
  Check,
  X,
  Mail,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import {
  isFullAdminEmail,
  isCoordinatorEmail,
  getFullAdminEmails,
  getCoordinatorEmails,
} from '../../adminUtils';
import { triggerHaptic } from '../../utils/haptics';
import { Trek } from '../../types';

export interface CoordinatorChatMessage {
  id: string;
  text: string;
  senderEmail: string;
  senderName: string;
  senderRole?: 'Admin' | 'Coordinator' | 'Team Member';
  hikeTag?: string;
  timestamp: number;
  createdAt?: string;
}

interface InternalCoordinatorChatProps {
  currentUserEmail: string;
  treks?: Trek[];
}

export function InternalCoordinatorChat({
  currentUserEmail,
  treks = [],
}: InternalCoordinatorChatProps) {
  const [messages, setMessages] = useState<CoordinatorChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [inputText, setInputText] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [selectedHikeForComposer, setSelectedHikeForComposer] = useState<string>('General');
  const [searchQuery, setSearchQuery] = useState('');
  const [connectionState, setConnectionState] = useState<'connected' | 'connecting' | 'error'>('connecting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Team Directory State
  const [adminEmails, setAdminEmails] = useState<string[]>(() => getFullAdminEmails());
  const [coordinatorEmails, setCoordinatorEmails] = useState<string[]>(() => getCoordinatorEmails());
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [teamSearchQuery, setTeamSearchQuery] = useState('');
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  useEffect(() => {
    const handleRolesUpdate = () => {
      setAdminEmails(getFullAdminEmails());
      setCoordinatorEmails(getCoordinatorEmails());
    };
    window.addEventListener('wnw-admin-roles-updated', handleRolesUpdate);
    return () => window.removeEventListener('wnw-admin-roles-updated', handleRolesUpdate);
  }, []);

  const handleCopyEmail = (email: string) => {
    try {
      navigator.clipboard.writeText(email);
      setCopiedEmail(email);
      triggerHaptic(10);
      setTimeout(() => setCopiedEmail(null), 2000);
    } catch (_) {}
  };

  const handleCopyAllEmails = () => {
    try {
      const all = Array.from(new Set([...adminEmails, ...coordinatorEmails])).join(', ');
      navigator.clipboard.writeText(all);
      setCopiedAll(true);
      triggerHaptic(15);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch (_) {}
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatScrollContainerRef = useRef<HTMLDivElement>(null);

  const isFullAdmin = isFullAdminEmail(currentUserEmail);
  const isCoordinator = isCoordinatorEmail(currentUserEmail);
  const myRole: 'Admin' | 'Coordinator' | 'Team Member' = isFullAdmin
    ? 'Admin'
    : isCoordinator
    ? 'Coordinator'
    : 'Team Member';

  // Extract upcoming / active hike numbers for the tag selector
  const availableHikeTags = useMemo(() => {
    const tags = new Set<string>();
    treks.forEach((t) => {
      const raw = t.hike_number || (t as any).hikeNumber;
      if (raw && raw !== 'TBD' && raw !== 'PRIVATE') {
        const match = String(raw).match(/\d+/);
        if (match) tags.add(`Hike #${match[0]}`);
      }
    });
    return Array.from(tags).slice(0, 10);
  }, [treks]);

  // Real-time Firestore onSnapshot listener
  useEffect(() => {
    setLoading(true);
    setConnectionState('connecting');
    setErrorMessage(null);

    const chatCol = collection(db, 'coordinator_chats');
    const q = query(chatCol, orderBy('timestamp', 'asc'), limit(150));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: CoordinatorChatMessage[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id,
            text: data.text || '',
            senderEmail: data.senderEmail || '',
            senderName: data.senderName || data.senderEmail?.split('@')[0] || 'Member',
            senderRole: data.senderRole || 'Coordinator',
            hikeTag: data.hikeTag || 'General',
            timestamp: typeof data.timestamp === 'number' ? data.timestamp : Date.now(),
            createdAt: data.createdAt || new Date().toISOString(),
          });
        });

        setMessages(list);
        setLoading(false);
        setConnectionState('connected');
        setErrorMessage(null);
      },
      (error) => {
        console.error('CoordinatorChat onSnapshot error:', error);
        setConnectionState('error');
        setErrorMessage(error?.message || 'Unable to connect to live coordinator chat.');
        setLoading(false);
        try {
          handleFirestoreError(error, OperationType.LIST, 'coordinator_chats');
        } catch (_) {}
      }
    );

    return () => unsubscribe();
  }, []);

  // Auto scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Periodic tick (every 30 seconds) to update relative time indicators (e.g. 'Just now' -> '1m ago')
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const getRelativeTimeString = (ts: number): string => {
    if (!ts) return '';
    const now = Date.now();
    const diff = Math.max(0, now - ts);
    const seconds = Math.floor(diff / 1000);
    if (seconds < 30) return 'Just now';
    if (seconds < 60) return '<1m ago';

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    if (days === 1) return '1d ago';
    if (days < 7) return `${days}d ago`;

    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks}w ago`;

    return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const formatFullDateTime = (ts: number): string => {
    if (!ts) return '';
    const date = new Date(ts);
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatTimeOnly = (ts: number): string => {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || sending) return;

    setSending(true);
    triggerHaptic(10);

    const emailPrefix = currentUserEmail ? currentUserEmail.split('@')[0] : 'Team';
    const formattedName = emailPrefix
      .replace(/[._-]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

    const newMsg = {
      text: trimmed,
      senderEmail: currentUserEmail || 'coordinator@walknepalwalk.com',
      senderName: formattedName,
      senderRole: myRole,
      hikeTag: selectedHikeForComposer,
      timestamp: Date.now(),
      createdAt: new Date().toISOString(),
      serverCreated: serverTimestamp(),
    };

    try {
      await addDoc(collection(db, 'coordinator_chats'), newMsg);
      setInputText('');
      triggerHaptic(15);
    } catch (err) {
      console.error('Failed to send coordinator chat message:', err);
      setErrorMessage('Could not send message. Please check permissions.');
      try {
        handleFirestoreError(err, OperationType.CREATE, 'coordinator_chats');
      } catch (_) {}
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Filter messages by tag and search query
  const filteredMessages = useMemo(() => {
    return messages.filter((m) => {
      const matchesTag =
        selectedTag === 'all'
          ? true
          : selectedTag === 'General'
          ? !m.hikeTag || m.hikeTag === 'General'
          : m.hikeTag === selectedTag;

      if (!matchesTag) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        m.text.toLowerCase().includes(q) ||
        m.senderName.toLowerCase().includes(q) ||
        m.senderEmail.toLowerCase().includes(q) ||
        (m.hikeTag && m.hikeTag.toLowerCase().includes(q))
      );
    });
  }, [messages, selectedTag, searchQuery]);

  // Detected tags in active messages
  const messageTags = useMemo(() => {
    const set = new Set<string>(['all', 'General']);
    messages.forEach((m) => {
      if (m.hikeTag) set.add(m.hikeTag);
    });
    availableHikeTags.forEach((t) => set.add(t));
    return Array.from(set);
  }, [messages, availableHikeTags]);

  const filteredAdmins = useMemo(() => {
    if (!teamSearchQuery.trim()) return adminEmails;
    const q = teamSearchQuery.toLowerCase();
    return adminEmails.filter((e) => e.toLowerCase().includes(q));
  }, [adminEmails, teamSearchQuery]);

  const filteredCoordinators = useMemo(() => {
    if (!teamSearchQuery.trim()) return coordinatorEmails;
    const q = teamSearchQuery.toLowerCase();
    return coordinatorEmails.filter((e) => e.toLowerCase().includes(q));
  }, [coordinatorEmails, teamSearchQuery]);

  return (
    <div className="w-full bg-white rounded-2xl border border-[#E5E1DB] shadow-sm overflow-hidden flex flex-col h-[750px] max-h-[85vh]">
      {/* Top Header Bar */}
      <div className="bg-[#FAF8F5] border-b border-[#E5E1DB] px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-black text-[#2D2A26] tracking-tight">
                Coordinator & Admin Team Chat
              </h2>
              <span
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  connectionState === 'connected'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : connectionState === 'connecting'
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    connectionState === 'connected'
                      ? 'bg-emerald-500 animate-pulse'
                      : connectionState === 'connecting'
                      ? 'bg-amber-500 animate-spin'
                      : 'bg-rose-500'
                  }`}
                />
                {connectionState === 'connected'
                  ? 'Live Sync'
                  : connectionState === 'connecting'
                  ? 'Connecting...'
                  : 'Offline'}
              </span>
            </div>
            <p className="text-[11px] text-[#78716C] font-medium">
              Private channel for trail operations, hiker rosters, and coordinator handoffs
            </p>
          </div>
        </div>

        {/* Top Actions: Team Directory & Role Pill */}
        <div className="flex items-center gap-2">
          {/* Team Directory Button */}
          <button
            type="button"
            onClick={() => setShowTeamModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-[#FAF8F5] active:scale-95 rounded-xl border border-[#E5E1DB] text-[11px] font-bold text-[#5A5551] hover:text-indigo-600 transition-all cursor-pointer shadow-2xs group"
            title="View list of authorized admin and coordinator emails"
          >
            <Users className="w-3.5 h-3.5 text-indigo-600 group-hover:scale-110 transition-transform" />
            <span>Team Members</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-50 text-indigo-700 font-black">
              {adminEmails.length + coordinatorEmails.length}
            </span>
          </button>

          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-xl border border-[#E5E1DB] text-[11px] text-[#5A5551]">
            <Shield
              className={`w-3.5 h-3.5 ${
                myRole === 'Admin' ? 'text-amber-600' : 'text-indigo-600'
              }`}
            />
            <span className="font-bold text-[#2D2A26]">{currentUserEmail}</span>
            <span
              className={`ml-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                myRole === 'Admin'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-indigo-100 text-indigo-800'
              }`}
            >
              {myRole}
            </span>
          </div>
        </div>
      </div>

      {/* Filter & Search Sub-Header */}
      <div className="bg-white border-b border-[#EFEAE4] px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2.5 text-xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-3.5 h-3.5 text-[#A8A29E] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search messages, coordinators, or topics..."
            className="w-full pl-8 pr-3 py-1.5 bg-[#FAF8F5] border border-[#E5E1DB] rounded-lg text-xs text-[#2D2A26] focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white placeholder:text-[#A8A29E]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-stone-400 hover:text-stone-700 font-bold"
            >
              ✕
            </button>
          )}
        </div>

        {/* Tag Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5 max-w-full">
          <span className="text-[11px] text-[#A8A29E] font-semibold flex items-center gap-1 mr-1">
            <Filter className="w-3 h-3" />
            Topic:
          </span>
          {messageTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setSelectedTag(tag)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedTag === tag
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-[#FAF8F5] text-[#5A5551] hover:bg-[#EFEAE4]'
              }`}
            >
              {tag === 'all' ? 'All Chats' : tag}
            </button>
          ))}
        </div>
      </div>

      {/* Error Notice */}
      {errorMessage && (
        <div className="bg-rose-50 border-b border-rose-200 px-4 py-2 text-xs text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div
        ref={chatScrollContainerRef}
        className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-[#FBF9F6]"
      >
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-12">
            <RefreshCw className="w-6 h-6 text-indigo-500 animate-spin mb-2" />
            <p className="text-xs font-semibold text-[#78716C]">Loading team messages...</p>
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-16 px-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-500 mb-3 shadow-xs">
              <MessageSquare className="w-7 h-7" />
            </div>
            <h3 className="text-sm font-bold text-[#2D2A26] mb-1">
              {searchQuery ? 'No matching messages found' : 'No messages in this channel yet'}
            </h3>
            <p className="text-xs text-[#78716C] max-w-sm mb-4">
              {searchQuery
                ? 'Try a different keyword or clear your search query.'
                : 'Start the conversation! Post an update regarding upcoming treks, bus logistics, hiker confirmations, or trail handoffs.'}
            </p>
            {!searchQuery && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setInputText('Hiker registration count check for this weekend?')}
                  className="px-3 py-1.5 bg-white border border-[#E5E1DB] rounded-xl text-xs text-[#5A5551] hover:border-indigo-400 hover:text-indigo-600 font-medium transition-all"
                >
                  "Registration count check?"
                </button>
                <button
                  type="button"
                  onClick={() => setInputText('Bus meeting point and timing is confirmed.')}
                  className="px-3 py-1.5 bg-white border border-[#E5E1DB] rounded-xl text-xs text-[#5A5551] hover:border-indigo-400 hover:text-indigo-600 font-medium transition-all"
                >
                  "Bus point confirmed"
                </button>
              </div>
            )}
          </div>
        ) : (
          filteredMessages.map((msg, index) => {
            const isMe =
              msg.senderEmail.toLowerCase().trim() ===
              (currentUserEmail || '').toLowerCase().trim();

            const role = msg.senderRole || 'Coordinator';

            return (
              <div
                key={msg.id || index}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-full`}
              >
                {/* Sender Header */}
                <div
                  className={`flex items-center gap-1.5 mb-1 px-1 text-[11px] ${
                    isMe ? 'flex-row-reverse' : 'flex-row'
                  }`}
                >
                  <span className="font-bold text-[#2D2A26]">{isMe ? 'You' : msg.senderName}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider ${
                      role === 'Admin'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-indigo-100 text-indigo-800'
                    }`}
                  >
                    {role}
                  </span>
                  {msg.hikeTag && msg.hikeTag !== 'General' && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-stone-200 text-stone-700 rounded text-[9px] font-bold">
                      <Hash className="w-2.5 h-2.5" />
                      {msg.hikeTag.replace('Hike #', '#')}
                    </span>
                  )}
                  <span
                    className="text-[10px] text-[#A8A29E] flex items-center gap-1"
                    title={formatFullDateTime(msg.timestamp)}
                  >
                    <Clock className="w-2.5 h-2.5" />
                    <span className="font-semibold text-[#78716C]">{getRelativeTimeString(msg.timestamp)}</span>
                  </span>
                </div>

                {/* Message Bubble */}
                <div
                  className={`relative max-w-[85%] sm:max-w-[70%] px-4 py-2.5 rounded-2xl text-xs leading-relaxed break-words shadow-2xs ${
                    isMe
                      ? 'bg-indigo-600 text-white rounded-tr-xs'
                      : 'bg-white text-[#2D2A26] border border-[#E5E1DB] rounded-tl-xs'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                  <div
                    className={`flex items-center justify-end gap-1 mt-1.5 pt-0.5 text-[10px] select-none ${
                      isMe ? 'text-indigo-200' : 'text-[#8C827A]'
                    }`}
                    title={formatFullDateTime(msg.timestamp)}
                  >
                    <span className="font-semibold">{getRelativeTimeString(msg.timestamp)}</span>
                    <span className="opacity-70 text-[9px]">({formatTimeOnly(msg.timestamp)})</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Composer Footer */}
      <div className="bg-white border-t border-[#E5E1DB] p-3 sm:p-4">
        {/* Quick Tag Selector Bar */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[11px] font-bold text-[#78716C] flex items-center gap-1">
            <Hash className="w-3 h-3 text-indigo-600" />
            Tag to:
          </span>
          <select
            value={selectedHikeForComposer}
            onChange={(e) => setSelectedHikeForComposer(e.target.value)}
            className="text-[11px] font-bold bg-[#FAF8F5] border border-[#E5E1DB] rounded-lg px-2.5 py-1 text-[#2D2A26] focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="General">General Team Chat</option>
            {availableHikeTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>

          <span className="text-[10px] text-[#A8A29E] hidden sm:inline ml-auto">
            Press <kbd className="px-1 py-0.5 bg-[#FAF8F5] border border-[#E5E1DB] rounded text-[9px] font-mono">Enter</kbd> to send, <kbd className="px-1 py-0.5 bg-[#FAF8F5] border border-[#E5E1DB] rounded text-[9px] font-mono">Shift+Enter</kbd> for new line
          </span>
        </div>

        {/* Input & Send Form */}
        <form onSubmit={handleSendMessage} className="flex items-end gap-2">
          <div className="relative flex-1">
            <textarea
              rows={2}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Write a message to coordinators & admins...`}
              disabled={sending}
              className="w-full resize-none bg-[#FAF8F5] border border-[#E5E1DB] rounded-xl px-3.5 py-2.5 text-xs text-[#2D2A26] placeholder:text-[#A8A29E] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all disabled:opacity-50"
            />
          </div>
          <button
            type="submit"
            disabled={!inputText.trim() || sending}
            className={`flex items-center justify-center gap-1.5 px-4 sm:px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs shrink-0 ${
              !inputText.trim() || sending
                ? 'bg-[#E5E1DB] text-[#A8A29E] cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white active:scale-95'
            }`}
          >
            {sending ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Send</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Team Directory Modal */}
      {showTeamModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setShowTeamModal(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl border border-[#E5E1DB] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-[#FAF8F5] border-b border-[#E5E1DB] px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#2D2A26] tracking-tight">
                    Team Chat Directory
                  </h3>
                  <p className="text-xs text-[#78716C]">
                    {adminEmails.length + coordinatorEmails.length} authorized emails in this channel
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTeamModal(false)}
                className="w-8 h-8 rounded-full bg-white border border-[#E5E1DB] flex items-center justify-center text-stone-500 hover:text-stone-900 hover:bg-stone-50 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Search & Copy All Bar */}
            <div className="px-6 py-3 border-b border-[#EFEAE4] bg-white flex items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={teamSearchQuery}
                  onChange={(e) => setTeamSearchQuery(e.target.value)}
                  placeholder="Filter team emails..."
                  className="w-full pl-8 pr-3 py-1.5 bg-[#FAF8F5] border border-[#E5E1DB] rounded-xl text-xs text-[#2D2A26] focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-stone-400"
                />
              </div>
              <button
                type="button"
                onClick={handleCopyAllEmails}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0"
              >
                {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedAll ? 'Copied All!' : 'Copy All Emails'}</span>
              </button>
            </div>

            {/* Email Lists */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1 bg-[#FBF9F6]">
              {/* Admins Group */}
              <div>
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-xs font-black uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-amber-600" />
                    Full Administrators ({filteredAdmins.length})
                  </span>
                </div>
                <div className="space-y-1.5">
                  {filteredAdmins.map((email) => {
                    const isCurrent = email.toLowerCase() === (currentUserEmail || '').toLowerCase();
                    return (
                      <div
                        key={email}
                        className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-[#E5E1DB] shadow-2xs hover:border-amber-300 transition-all"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center text-xs font-black shrink-0">
                            {email.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-[#2D2A26] truncate">{email}</span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.2 bg-stone-100 text-stone-600 text-[9px] font-bold rounded">
                                  You
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-amber-700 font-semibold">Admin Access</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleCopyEmail(email)}
                            className="p-1.5 hover:bg-stone-100 rounded-lg text-stone-500 hover:text-stone-800 transition-all cursor-pointer"
                            title="Copy email address"
                          >
                            {copiedEmail === email ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <a
                            href={`mailto:${email}`}
                            className="p-1.5 hover:bg-stone-100 rounded-lg text-stone-500 hover:text-indigo-600 transition-all"
                            title="Send email"
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                    );
                  })}
                  {filteredAdmins.length === 0 && (
                    <p className="text-xs text-stone-400 italic px-2">No matching administrator emails.</p>
                  )}
                </div>
              </div>

              {/* Coordinators Group */}
              <div>
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-xs font-black uppercase tracking-wider text-indigo-800 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-indigo-600" />
                    Team Coordinators ({filteredCoordinators.length})
                  </span>
                </div>
                <div className="space-y-1.5">
                  {filteredCoordinators.map((email) => {
                    const isCurrent = email.toLowerCase() === (currentUserEmail || '').toLowerCase();
                    return (
                      <div
                        key={email}
                        className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-[#E5E1DB] shadow-2xs hover:border-indigo-300 transition-all"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center text-xs font-black shrink-0">
                            {email.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-[#2D2A26] truncate">{email}</span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.2 bg-stone-100 text-stone-600 text-[9px] font-bold rounded">
                                  You
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-indigo-600 font-semibold">Coordinator Access</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleCopyEmail(email)}
                            className="p-1.5 hover:bg-stone-100 rounded-lg text-stone-500 hover:text-stone-800 transition-all cursor-pointer"
                            title="Copy email address"
                          >
                            {copiedEmail === email ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <a
                            href={`mailto:${email}`}
                            className="p-1.5 hover:bg-stone-100 rounded-lg text-stone-500 hover:text-indigo-600 transition-all"
                            title="Send email"
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                    );
                  })}
                  {filteredCoordinators.length === 0 && (
                    <div className="bg-white p-3 rounded-xl border border-dashed border-[#E5E1DB] text-center">
                      <p className="text-xs text-stone-500">
                        {teamSearchQuery
                          ? 'No matching coordinator emails.'
                          : 'No custom coordinator emails added yet. Administrators can add coordinator emails in the System Zone > Access Roles tab.'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-white border-t border-[#E5E1DB] px-6 py-3.5 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowTeamModal(false)}
                className="px-5 py-2 bg-stone-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Close Directory
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
