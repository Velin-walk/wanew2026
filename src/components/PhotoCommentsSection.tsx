import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Trash2, MessageSquare, Loader2, User, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { fetchPhotoComments, postPhotoComment, deletePhotoComment } from '../services/api';
import { PhotoComment } from '../types';

interface PhotoCommentsSectionProps {
  photoId: string;
  isDarkTheme?: boolean;
}

export const PhotoCommentsSection: React.FC<PhotoCommentsSectionProps> = ({
  photoId,
  isDarkTheme = true,
}) => {
  const { user, isAdmin, openAuthModal } = useAuth();
  const [comments, setComments] = useState<PhotoComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [charError, setCharError] = useState<string | null>(null);

  const commentsEndRef = useRef<HTMLDivElement>(null);

  // Fetch comments on mount/photoId change
  useEffect(() => {
    let active = true;
    const loadComments = async () => {
      setLoading(true);
      try {
        const data = await fetchPhotoComments(photoId);
        if (active) {
          setComments(data);
        }
      } catch (err) {
        console.error('Error fetching comments:', err);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    loadComments();
    return () => {
      active = false;
    };
  }, [photoId]);

  // Scroll comments into view when new comment arrives
  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || submitting) return;

    const trimmed = commentText.trim();
    if (!trimmed) return;

    if (trimmed.length > 300) {
      setCharError('Comments are limited to 300 characters.');
      return;
    }
    setCharError(null);

    setSubmitting(true);
    try {
      const authorName = user.displayName || user.email?.split('@')[0] || 'Nepal Hiker';
      const authorAvatar = user.photoURL || '';
      
      const newComment = await postPhotoComment(
        photoId,
        user.uid,
        authorName,
        authorAvatar,
        trimmed
      );

      if (newComment) {
        setComments((prev) => [...prev, newComment]);
        setCommentText('');
      }
    } catch (err) {
      console.error('Failed to post comment:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const success = await deletePhotoComment(id);
      if (success) {
        setComments((prev) => prev.filter((c) => c.id !== id));
        if (deleteId === id) setDeleteId(null);
      }
    } catch (err) {
      console.error('Failed to delete comment:', err);
    }
  };

  const formatRelativeTime = (isoString: string): string => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffSecs = Math.floor(diffMs / 1000);
      const diffMins = Math.floor(diffSecs / 60);
      const diffHrs = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHrs / 24);

      if (diffSecs < 60) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHrs < 24) return `${diffHrs}h ago`;
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;

      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return 'Some time ago';
    }
  };

  // Theme styling helpers
  const textPrimary = isDarkTheme ? 'text-stone-100' : 'text-stone-800';
  const textSecondary = isDarkTheme ? 'text-stone-400' : 'text-stone-500';
  const bgCard = isDarkTheme ? 'bg-[#18181B] border-stone-800' : 'bg-white border-stone-100';
  const bgInput = isDarkTheme ? 'bg-[#27272A] text-stone-100 border-stone-700' : 'bg-stone-50 text-stone-900 border-stone-200';
  const bgHover = isDarkTheme ? 'hover:bg-stone-800' : 'hover:bg-stone-100';

  return (
    <div className={`flex flex-col h-full max-h-[450px] md:max-h-none ${isDarkTheme ? 'dark' : ''}`} id={`photo-comments-${photoId}`}>
      {/* Comments Header */}
      <div className={`flex items-center justify-between pb-3 mb-3 border-b ${isDarkTheme ? 'border-stone-800' : 'border-stone-100'}`}>
        <div className="flex items-center gap-2">
          <MessageSquare className={`w-4 h-4 ${isDarkTheme ? 'text-[#7ABA42]' : 'text-[#629b35]'}`} />
          <h3 className={`text-xs font-black tracking-wider uppercase ${textPrimary}`}>
            Discussion ({comments.length})
          </h3>
        </div>
      </div>

      {/* Comments List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-stone-800 pr-1 space-y-3 min-h-[180px] max-h-[300px] md:max-h-[350px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <Loader2 className={`w-6 h-6 animate-spin ${isDarkTheme ? 'text-[#7ABA42]' : 'text-[#629b35]'}`} />
            <span className={`text-[10px] font-medium ${textSecondary}`}>Retrieving messages...</span>
          </div>
        ) : comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center px-4">
            <MessageSquare className={`w-8 h-8 mb-2 opacity-20 ${textSecondary}`} />
            <p className={`text-xs font-bold ${textPrimary}`}>No comments yet</p>
            <p className={`text-[10px] mt-0.5 ${textSecondary}`}>Be the first to share your thoughts on this memory!</p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {comments.map((comment) => {
                const canDelete = isAdmin || (user && user.uid === comment.userUid);
                return (
                  <motion.div
                    key={comment.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className={`flex gap-2.5 p-2.5 rounded-xl border ${bgCard} shadow-sm group`}
                  >
                    {/* Avatar */}
                    <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden bg-stone-700/50 flex items-center justify-center border border-white/10">
                      {comment.userAvatar ? (
                        <img
                          src={comment.userAvatar}
                          alt={comment.userName}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // Clear src so avatar icon falls back
                            (e.currentTarget as HTMLImageElement).src = '';
                          }}
                        />
                      ) : (
                        <User className="w-4 h-4 text-stone-400" />
                      )}
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className={`text-xs font-black truncate ${isDarkTheme ? 'text-[#7ABA42]' : 'text-[#629b35]'}`}>
                          {comment.userName}
                        </span>
                        <span className={`text-[9px] font-medium flex-shrink-0 ${textSecondary}`}>
                          {formatRelativeTime(comment.createdAt)}
                        </span>
                      </div>
                      <p className={`text-xs mt-1 break-words leading-relaxed ${textPrimary}`}>
                        {comment.commentText}
                      </p>
                    </div>

                    {/* Delete Action */}
                    {canDelete && (
                      <div className="flex-shrink-0 flex items-start justify-end">
                        {deleteId === comment.id ? (
                          <div className="flex items-center gap-1 bg-red-600/10 border border-red-500/20 rounded-lg p-0.5">
                            <button
                              onClick={() => handleDelete(comment.id)}
                              className="px-1.5 py-0.5 text-[8px] font-black text-red-400 hover:text-red-300 transition-colors uppercase cursor-pointer"
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => setDeleteId(null)}
                              className="px-1.5 py-0.5 text-[8px] font-black text-stone-400 hover:text-stone-300 transition-colors uppercase cursor-pointer"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteId(comment.id)}
                            className={`p-1 rounded-lg text-stone-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 ${bgHover} cursor-pointer`}
                            title="Delete comment"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
            <div ref={commentsEndRef} />
          </div>
        )}
      </div>

      {/* Input / Auth Prompt Section */}
      <div className={`mt-3 pt-3 border-t ${isDarkTheme ? 'border-stone-800' : 'border-stone-100'}`}>
        {charError && (
          <div className="mb-2 px-2.5 py-1 text-[11px] font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-lg">
            {charError}
          </div>
        )}
        {user ? (
          <form onSubmit={handleSubmit} className="flex gap-2 items-end">
            <div className="flex-1 relative">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Share your thoughts..."
                maxLength={300}
                rows={1}
                className={`w-full max-h-24 resize-none rounded-xl py-2 pl-3 pr-10 text-xs focus:ring-1 focus:ring-[#7ABA42] focus:outline-none border transition-all scrollbar-none ${bgInput}`}
                style={{ height: '36px' }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
              />
              <span className={`absolute right-2 bottom-1 text-[8px] font-medium ${textSecondary}`}>
                {commentText.length}/300
              </span>
            </div>
            <button
              type="submit"
              disabled={submitting || !commentText.trim()}
              className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-white bg-[#7ABA42] hover:bg-[#629b35] disabled:bg-stone-800 disabled:text-stone-600 transition-all cursor-pointer shadow-md`}
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </form>
        ) : (
          <div
            onClick={() => openAuthModal('join the photo discussion')}
            className={`flex items-center gap-3 p-3 rounded-2xl border border-dashed text-left cursor-pointer transition-all ${
              isDarkTheme
                ? 'bg-stone-900/50 border-stone-800 hover:border-[#7ABA42]/50 hover:bg-[#7ABA42]/5'
                : 'bg-stone-50 border-stone-200 hover:border-[#7ABA42]/50 hover:bg-[#7ABA42]/5'
            }`}
          >
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isDarkTheme ? 'bg-[#7ABA42]/10 text-[#7ABA42]' : 'bg-[#7ABA42]/10 text-[#629b35]'
            }`}>
              <Lock className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-black ${textPrimary}`}>Sign In to Comment</p>
              <p className={`text-[10px] ${textSecondary}`}>Connect your account to share memories with other trekkers.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
