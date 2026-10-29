import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  BookOpen,
  PenLine,
  Heart,
  Eye,
   Clock,
  Search,
  ArrowLeft,
  Share2,
  Check,
  Send,
  AlertCircle,
  Tag,
  ChevronRight,
  User,
  Image as ImageIcon,
  Edit3,
  Trash2,
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Link2,
  Minus,
  Code,
  UploadCloud,
  Loader2,
  X,
  Columns
} from 'lucide-react';
import { fetchBlogs, fetchBlogByIdOrSlug, createBlog, updateBlog, deleteBlog, likeBlog, uploadBlogImage } from '../services/api';
import { useAuth } from '../context/AuthContext';

export interface BlogItem {
  id: number;
  slug: string;
  title: string;
  summary?: string;
  content?: string;
  cover_image_url?: string;
  author_name: string;
  author_email?: string;
  category: string;
  tags?: string;
  reading_time_mins: number;
  likes_count: number;
  views_count: number;
  created_at: string;
  is_sample?: boolean;
}

const SAMPLE_FALLBACK_BLOGS: BlogItem[] = [
  {
    id: -1,
    is_sample: true,
    slug: 'first-time-trekking-nepal-essential-tips',
    title: 'Beginner’s Guide to Himalayan Trails: What I Learned on My First Trek',
    summary: 'From packing layered clothing to acclimatizing gently above 3,000 meters, here are 7 practical lessons from the Langtang Valley trail.',
    content: `Trekking in Nepal is transformative, but your first trail can feel daunting if you've never climbed at high altitudes.

### 1. Pace Beats Speed Every Single Time
In the mountains, locals call it "Bistari, bistari" (slowly, slowly). Setting a rhythmic walking tempo where you never feel out of breath keeps your heart rate stable and burns oxygen efficiently.

### 2. Hydration is Non-Negotiable
Above 2,500m, your respiration increases and dry Himalayan winds sap your body moisture without you realizing it. Carry an insulated water bottle and aim for 3-4 liters daily.

### 3. Pack Light, Layer Smart
Invest in a good merino base layer, lightweight fleece, and windproof outer shell. You don't need five heavy cotton shirts—cotton holds sweat and freezes when you stop.

### 4. Respect Trail Etiquette
Always yield to uphill hikers and loaded yaks/mules by stepping to the mountain (cliff-wall) side, never the drop-off side.

Trek safe, keep our trails pristine, and remember to pack out every piece of plastic!`,
    cover_image_url: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?q=80&w=1000&auto=format&fit=crop',
    author_name: 'Anupama Shrestha',
    category: 'Trail Stories',
    tags: 'Langtang, Beginners, Gear',
    reading_time_mins: 4,
    likes_count: 24,
    views_count: 142,
    created_at: new Date(Date.now() - 3 * 86400000).toISOString()
  },
  {
    id: -2,
    is_sample: true,
    slug: 'essential-gear-monsoon-himalayan-hikes',
    title: 'Surviving Monsoon Treks: Gear Checklist & Leech Protection',
    summary: 'How to keep your sleeping bag bone-dry, choose waterproof trail runners, and navigate slippery stone steps in the Kathmandu rim.',
    content: `Monsoon turns Nepal’s hills into lush emerald wonders filled with gushing waterfalls, but it also brings slippery wet rocks and notorious trail leeches.

### Top Essentials:
- **Dry Sacks inside your backpack:** Don't rely solely on an external rain cover. Water seeps through back harnesses. Pack clothes into sealed dry bags.
- **Salt & Tobacco pouches:** The most humane and quickest way to peel off trail leeches without pulling skin.
- **Trekking Poles with Rubber Tips:** Essential for balancing on wet river boulders and slick muddy slopes.
- **Quick-Dry Socks:** Bring at least 3 pairs of wool-synthetic blends; dry feet prevent blistering.

Embrace the mist, listen to the cicadas, and enjoy having the tranquil trails all to yourself!`,
    cover_image_url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=1000&auto=format&fit=crop',
    author_name: 'Dawa Sherpa',
    category: 'Gear & Prep',
    tags: 'Monsoon, Kathmandu Rim, Gear',
    reading_time_mins: 3,
    likes_count: 18,
    views_count: 98,
    created_at: new Date(Date.now() - 7 * 86400000).toISOString()
  }
];

const CATEGORIES = ['All', 'Trail Stories', 'Gear & Prep', 'Culture & Flora', 'Guides'];

const safeUrl = (u: string): string => {
  const t = (u || '').trim();
  return /^(https?:\/\/|mailto:)/i.test(t) ? t : '#';
};

const safeImageUrl = (u: string): string => {
  const t = (u || '').trim();
  return /^https?:\/\//i.test(t) ? t : '';
};

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const validateImageFile = (file: File): string | null => {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return 'Please choose a JPG, PNG, WebP or GIF image.';
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return 'Image is too large. Maximum size is 8 MB.';
  }
  return null;
};

const renderInlineMarkdown = (text: string): React.ReactNode => {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*.*?\*\*|\*.*?\*|\[.*?\]\(.*?\)|\`.*?\`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(<strong key={match.index} className="font-bold text-[#1F1F1F]">{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('*') && token.endsWith('*')) {
      parts.push(<em key={match.index} className="italic text-[#332F2B]">{token.slice(1, -1)}</em>);
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code key={match.index} className="px-1.5 py-0.5 rounded-md bg-[#F3F0EC] text-[11px] font-mono text-[#E08828]">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('[') && token.includes('](') && token.endsWith(')')) {
      const label = token.substring(1, token.indexOf(']('));
      const url = token.substring(token.indexOf('](') + 2, token.length - 1);
      parts.push(
        <a
          key={match.index}
          href={safeUrl(url)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#7ABA42] hover:text-[#5d942e] font-semibold underline underline-offset-2 decoration-[#7ABA42]/50 hover:decoration-[#5d942e]"
        >
          {label}
        </a>
      );
    } else {
      parts.push(token);
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  return parts.length > 0 ? parts : text;
};

const MarkdownRendererBase: React.FC<{ content: string }> = ({ content }) => {
  if (!content) return null;
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: { type: 'ul' | 'ol'; items: string[] } | null = null;

  const flushList = (key: string | number) => {
    if (!currentList) return;
    if (currentList.type === 'ul') {
      elements.push(
        <ul key={`ul-${key}`} className="my-2 space-y-1.5 list-none pl-1">
          {currentList.items.map((it, i) => (
            <li key={i} className="flex items-start gap-2 text-xs sm:text-sm text-[#332F2B]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#7ABA42] mt-1.5 shrink-0" />
              <span>{renderInlineMarkdown(it)}</span>
            </li>
          ))}
        </ul>
      );
    } else {
      elements.push(
        <ol key={`ol-${key}`} className="my-2 space-y-1.5 list-decimal list-inside pl-1 text-xs sm:text-sm text-[#332F2B]">
          {currentList.items.map((it, i) => (
            <li key={i} className="leading-relaxed">
              <span>{renderInlineMarkdown(it)}</span>
            </li>
          ))}
        </ol>
      );
    }
    currentList = null;
  };

  for (let idx = 0; idx < lines.length; idx++) {
    const rawLine = lines[idx];
    const line = rawLine.trim();

    const bulletMatch = line.match(/^[-*•]\s+(.*)$/);
    const numMatch = line.match(/^(\d+)\.\s+(.*)$/);

    if (bulletMatch) {
      if (!currentList || currentList.type !== 'ul') {
        flushList(idx);
        currentList = { type: 'ul', items: [] };
      }
      currentList.items.push(bulletMatch[1]);
      continue;
    } else if (numMatch) {
      if (!currentList || currentList.type !== 'ol') {
        flushList(idx);
        currentList = { type: 'ol', items: [] };
      }
      currentList.items.push(numMatch[2]);
      continue;
    } else {
      flushList(idx);
    }

    if (!line) continue;

    // Markdown Image: ![alt](url)
    const imgMatch = line.match(/^!\[(.*?)\]\((.*?)\)$/);
    if (imgMatch) {
      const alt = imgMatch[1];
      const url = imgMatch[2];
      elements.push(
        <figure key={idx} className="my-4 rounded-2xl overflow-hidden border border-[#E5E1DB] bg-[#FAF8F5]">
          <img
            src={safeImageUrl(url)}
            alt={alt || 'Trek Story Photo'}
            className="w-full h-auto max-h-[500px] object-cover"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          {alt && (
            <figcaption className="text-center text-[11px] text-[#8B8680] py-2 px-3 italic bg-white/70 border-t border-[#F0EBE5]">
              {alt}
            </figcaption>
          )}
        </figure>
      );
      continue;
    }

    // Horizontal Rule
    if (/^---+$|^\*\*\*+$/.test(line)) {
      elements.push(<hr key={idx} className="my-5 border-[#E5E1DB]" />);
      continue;
    }

    // Headings
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={idx} className="text-base sm:text-lg font-bold text-[#E08828] mt-4 mb-1.5 leading-snug">
          {renderInlineMarkdown(line.slice(4))}
        </h3>
      );
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={idx} className="text-lg sm:text-xl font-black text-[#1F1F1F] mt-5 mb-2 leading-tight">
          {renderInlineMarkdown(line.slice(3))}
        </h2>
      );
      continue;
    }
    if (line.startsWith('# ')) {
      elements.push(
        <h2 key={idx} className="text-xl sm:text-2xl font-black text-[#1F1F1F] mt-6 mb-2.5 leading-tight">
          {renderInlineMarkdown(line.slice(2))}
        </h2>
      );
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      elements.push(
        <blockquote key={idx} className="my-3 pl-3.5 py-2 border-l-4 border-[#7ABA42] bg-[#FAF8F5] rounded-r-xl text-xs sm:text-sm italic text-[#4A4540]">
          {renderInlineMarkdown(line.slice(2))}
        </blockquote>
      );
      continue;
    }

    // Standard paragraph
    elements.push(
      <p key={idx} className="text-xs sm:text-sm text-[#332F2B] leading-relaxed my-2">
        {renderInlineMarkdown(line)}
      </p>
    );
  }
  flushList('final');

  return <div className="space-y-1">{elements}</div>;
};

export const MarkdownRenderer = React.memo(MarkdownRendererBase);

export const CommunityBlogsSection: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [blogs, setBlogs] = useState<BlogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Reading mode
  const [activeBlog, setActiveBlog] = useState<BlogItem | null>(null);
  const [readingLoading, setReadingLoading] = useState(false);
  const activeBlogIdRef = useRef<number | null>(null);
  const latestCategoryReqRef = useRef<string>('All');
  const [likedBlogIds, setLikedBlogIds] = useState<Set<number>>(() => {
    try {
      const saved = localStorage.getItem('wnw_liked_blogs');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [copiedShare, setCopiedShare] = useState(false);

  // Writing & Editing mode
  const [isComposing, setIsComposing] = useState(false);
  const [editingBlogId, setEditingBlogId] = useState<number | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [blogToDelete, setBlogToDelete] = useState<BlogItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [editorTab, setEditorTab] = useState<'write' | 'preview' | 'split'>('write');
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingInlineImage, setUploadingInlineImage] = useState(false);
  const contentInputRef = useRef<HTMLTextAreaElement>(null);
  const lastSelectionRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });
  const coverFileInputRef = useRef<HTMLInputElement>(null);
  const inlineFileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    title: '',
    author_name: '',
    author_email: '',
    category: 'Trail Stories',
    tags: '',
    summary: '',
    cover_image_url: '',
    content: ''
  });

  const initialFormDataRef = useRef(formData);

  const wordCount = formData.content.trim()
    ? formData.content.trim().split(/\s+/).filter(Boolean).length
    : 0;
  const estReadingTime = Math.max(1, Math.ceil(wordCount / 180));

  const isFormDirty = () => {
    const initial = initialFormDataRef.current;
    const keys = ['title', 'content', 'category', 'tags', 'summary', 'cover_image_url', 'author_name'] as const;
    return keys.some((k) => {
      // For new posts, author is auto-prefilled from the logged-in user, so ignore it
      if (!editingBlogId && k === 'author_name') return false;
      return (formData[k] || '').trim() !== (initial[k] || '').trim();
    });
  };

  const handleExitRequest = () => {
    if (submitting) return;
    if (isFormDirty()) {
      setShowExitConfirm(true);
    } else {
      setIsComposing(false);
      resetForm();
    }
  };

  // Lock body scroll and listen for Escape key when full-page editor is open
  useEffect(() => {
    if (!isComposing) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // 1. Never exit while submitting
        if (submitting) return;

        // 2. If discard dialog is open, Escape closes the discard dialog (Keep Writing)
        if (showExitConfirm) {
          setShowExitConfirm(false);
          return;
        }

        // 3. Otherwise check if form is dirty
        if (isFormDirty()) {
          setShowExitConfirm(true);
        } else {
          setIsComposing(false);
          resetForm();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isComposing, showExitConfirm, submitting, formData, editingBlogId]);

  // Pre-populate author details when user logs in if not currently editing
  useEffect(() => {
    if (user && !editingBlogId) {
      setFormData((prev) => ({
        ...prev,
        author_name: prev.author_name || user.displayName || user.email?.split('@')[0] || '',
        author_email: prev.author_email || user.email || ''
      }));
    }
  }, [user, editingBlogId]);

  const getBlogEditToken = (blogId: number): string | undefined => {
    try {
      return localStorage.getItem(`wnw_blog_token_${blogId}`) || undefined;
    } catch {
      return undefined;
    }
  };

  const canManageBlog = (blog: BlogItem | null): boolean => {
    if (!blog) return false;
    // Sample fallback posts are read-only templates and never have CRUD permissions
    if (blog.id < 0 || blog.is_sample) return false;
    if (isAdmin) return true;
    if (user?.email && blog.author_email && user.email.toLowerCase() === blog.author_email.toLowerCase()) {
      return true;
    }
    const token = getBlogEditToken(blog.id);
    if (token) return true;
    return false;
  };

  const [loadingEdit, setLoadingEdit] = useState(false);
  const [editLoadFailed, setEditLoadFailed] = useState(false);

  const resetForm = () => {
    const initial = {
      title: '',
      author_name: user ? (user.displayName || user.email?.split('@')[0] || '') : '',
      author_email: user?.email || '',
      category: 'Trail Stories',
      tags: '',
      summary: '',
      cover_image_url: '',
      content: ''
    };
    setFormData(initial);
    initialFormDataRef.current = initial;
    setEditingBlogId(null);
    setLoadingEdit(false);
    setEditLoadFailed(false);
    setEditorTab('write');
    setSubmitError(null);
    setShowExitConfirm(false);
  };

  const insertFormat = (formatType: string) => {
    if (loadingEdit || editLoadFailed) return;
    const textarea = contentInputRef.current;
    if (!textarea) return;

    let start = textarea.selectionStart;
    let end = textarea.selectionEnd;
    const currentText = formData.content;

    // If textarea was not focused or collapsed at 0 in non-empty text, recover saved selection
    if (start === 0 && end === 0 && lastSelectionRef.current.end > 0) {
      start = lastSelectionRef.current.start;
      end = lastSelectionRef.current.end;
    }

    const selected = currentText.substring(start, end);
    let insertion = '';
    let selectStart = start;
    let selectEnd = start;

    const needLeadingNewline = start > 0 && currentText[start - 1] !== '\n';
    const prefix = needLeadingNewline ? '\n' : '';

    switch (formatType) {
      case 'bold':
        if (selected) {
          insertion = `**${selected}**`;
          selectStart = start;
          selectEnd = start + insertion.length;
        } else {
          insertion = `**bold text**`;
          selectStart = start + 2;
          selectEnd = start + 11;
        }
        break;
      case 'italic':
        if (selected) {
          insertion = `*${selected}*`;
          selectStart = start;
          selectEnd = start + insertion.length;
        } else {
          insertion = `*italic text*`;
          selectStart = start + 1;
          selectEnd = start + 12;
        }
        break;
      case 'h1': {
        const text = selected || 'Main Heading';
        insertion = `${prefix}# ${text}\n`;
        selectStart = start + prefix.length + 2;
        selectEnd = selectStart + text.length;
        break;
      }
      case 'h2': {
        const text = selected || 'Section Title';
        insertion = `${prefix}## ${text}\n`;
        selectStart = start + prefix.length + 3;
        selectEnd = selectStart + text.length;
        break;
      }
      case 'h3': {
        const text = selected || 'Sub-heading';
        insertion = `${prefix}### ${text}\n`;
        selectStart = start + prefix.length + 4;
        selectEnd = selectStart + text.length;
        break;
      }
      case 'quote': {
        const text = selected || 'Himalayan mountain wisdom or trail note...';
        insertion = `${prefix}> ${text}\n`;
        selectStart = start + prefix.length + 2;
        selectEnd = selectStart + text.length;
        break;
      }
      case 'bullet': {
        const text = selected || 'Gear or checklist item';
        insertion = `${prefix}- ${text}\n`;
        selectStart = start + prefix.length + 2;
        selectEnd = selectStart + text.length;
        break;
      }
      case 'number': {
        const text = selected || 'First trail milestone';
        insertion = `${prefix}1. ${text}\n`;
        selectStart = start + prefix.length + 3;
        selectEnd = selectStart + text.length;
        break;
      }
      case 'divider':
        insertion = `${prefix}\n---\n\n`;
        selectStart = start + insertion.length;
        selectEnd = selectStart;
        break;
      case 'code':
        if (selected) {
          insertion = `\`${selected}\``;
          selectStart = start;
          selectEnd = start + insertion.length;
        } else {
          insertion = `\`gear spec\``;
          selectStart = start + 1;
          selectEnd = start + 10;
        }
        break;
      case 'link':
        if (selected) {
          insertion = `[${selected}](https://)`;
          selectStart = start + selected.length + 3;
          selectEnd = selectStart + 8;
        } else {
          insertion = `[Trail Guide](https://)`;
          selectStart = start + 14;
          selectEnd = start + 22;
        }
        break;
      default:
        return;
    }

    const nextContent = currentText.substring(0, start) + insertion + currentText.substring(end);
    setFormData((prev) => ({ ...prev, content: nextContent }));
    lastSelectionRef.current = { start: selectStart, end: selectEnd };

    setTimeout(() => {
      if (contentInputRef.current) {
        contentInputRef.current.focus();
        contentInputRef.current.setSelectionRange(selectStart, selectEnd);
      }
    }, 10);
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileError = validateImageFile(file);
    if (fileError) {
      setSubmitError(fileError);
      e.target.value = '';
      return;
    }
    setUploadingCover(true);
    setSubmitError(null);
    try {
      const url = await uploadBlogImage(file);
      setFormData((prev) => ({ ...prev, cover_image_url: url }));
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to upload cover photo to Cloudflare R2');
    } finally {
      setUploadingCover(false);
      if (coverFileInputRef.current) coverFileInputRef.current.value = '';
    }
  };

  const handleInlineImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileError = validateImageFile(file);
    if (fileError) {
      setSubmitError(fileError);
      e.target.value = '';
      return;
    }
    setUploadingInlineImage(true);
    setSubmitError(null);
    try {
      const url = await uploadBlogImage(file);
      const cleanName = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
      const imageMarkdown = `\n\n![${cleanName || 'Trail Photo'}](${url})\n\n`;

      const textarea = contentInputRef.current;
      let start = textarea ? textarea.selectionStart : lastSelectionRef.current.start;
      let end = textarea ? textarea.selectionEnd : lastSelectionRef.current.end;
      if (start === 0 && end === 0 && lastSelectionRef.current.end > 0) {
        start = lastSelectionRef.current.start;
        end = lastSelectionRef.current.end;
      }

      setFormData((prev) => {
        const currentText = prev.content;
        const validStart = Math.min(start, currentText.length);
        const validEnd = Math.min(end, currentText.length);
        const nextContent = currentText.substring(0, validStart) + imageMarkdown + currentText.substring(validEnd);
        return {
          ...prev,
          content: nextContent,
          cover_image_url: prev.cover_image_url || url
        };
      });

      const nextPos = start + imageMarkdown.length;
      lastSelectionRef.current = { start: nextPos, end: nextPos };
      setTimeout(() => {
        if (contentInputRef.current) {
          contentInputRef.current.focus();
          contentInputRef.current.setSelectionRange(nextPos, nextPos);
        }
      }, 10);
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to upload photo to Cloudflare R2');
    } finally {
      setUploadingInlineImage(false);
      if (inlineFileInputRef.current) inlineFileInputRef.current.value = '';
    }
  };

  const handleStartEdit = async (blog: BlogItem) => {
    if (blog.id < 0 || blog.is_sample) {
      setSubmitError('Sample posts are demo templates and cannot be edited. Create a new story to publish to the community.');
      return;
    }

    setEditingBlogId(blog.id);
    setSubmitError(null);
    setEditLoadFailed(false);

    // Initial pre-fill with available fields (do NOT use summary as content fallback)
    const initial = {
      title: blog.title || '',
      author_name: blog.author_name || '',
      author_email: blog.author_email || '',
      category: blog.category || 'Trail Stories',
      tags: blog.tags || '',
      summary: blog.summary || '',
      cover_image_url: blog.cover_image_url || '',
      content: blog.content || ''
    };
    setFormData(initial);
    initialFormDataRef.current = initial;

    setIsComposing(true);

    // If full content is not loaded yet (e.g. clicked Edit from the feed card snippet), fetch the full blog
    if (!blog.content) {
      setLoadingEdit(true);
      try {
        const full = await fetchBlogByIdOrSlug(blog.slug || blog.id);
        if (full) {
          const loaded = {
            title: full.title || blog.title || '',
            author_name: full.author_name || blog.author_name || '',
            author_email: full.author_email || blog.author_email || '',
            category: full.category || blog.category || 'Trail Stories',
            tags: full.tags || blog.tags || '',
            summary: full.summary || blog.summary || '',
            cover_image_url: full.cover_image_url || blog.cover_image_url || '',
            content: full.content || ''
          };
          setFormData(loaded);
          initialFormDataRef.current = loaded;
          if (activeBlog && activeBlog.id === blog.id) {
            setActiveBlog(full);
          }
        } else {
          setEditLoadFailed(true);
          setSubmitError('Unable to load the original story. Saving is disabled to prevent data loss. Close the editor and try again.');
        }
      } catch (err: any) {
        console.warn('Failed to load full blog for editing:', err);
        setEditLoadFailed(true);
        setSubmitError(err?.message || 'Failed to load the original story. Saving is disabled to prevent overwriting. Close the editor and try again.');
      } finally {
        setLoadingEdit(false);
      }
    }
  };

  const handleConfirmDelete = async () => {
    if (!blogToDelete) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const editToken = getBlogEditToken(blogToDelete.id);
      await deleteBlog(blogToDelete.id, {
        email: user?.email || undefined,
        editToken,
        isAdmin
      });

      // Remove from list
      setBlogs((prev) => prev.filter((b) => b.id !== blogToDelete.id));
      if (activeBlog && activeBlog.id === blogToDelete.id) {
        setActiveBlog(null);
      }
      try {
        localStorage.removeItem(`wnw_blog_token_${blogToDelete.id}`);
      } catch {}

      setBlogToDelete(null);
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete blog post.');
    } finally {
      setIsDeleting(false);
    }
  };

  const renderDeleteModal = () => {
    if (!blogToDelete) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
        <div className="w-full max-w-sm rounded-2xl bg-white p-5 border border-[#E5E1DB] shadow-xl space-y-4 animate-in zoom-in-95 duration-150">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-[#1F1F1F]">Delete Story</h4>
              <p className="text-xs text-[#8B8680]">Are you sure you want to permanently remove this blog post?</p>
            </div>
          </div>

          <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E5E1DB] text-xs font-bold text-[#1F1F1F] line-clamp-2">
            "{blogToDelete.title}"
          </div>

          {deleteError && (
            <div className="p-2.5 rounded-xl bg-rose-50 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{deleteError}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => {
                setBlogToDelete(null);
                setDeleteError(null);
              }}
              className="px-3.5 py-2 text-xs font-bold text-[#5A5551] hover:text-[#1F1F1F] rounded-xl hover:bg-[#F3F0EC] transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={handleConfirmDelete}
              className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              {isDeleting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Story</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const loadBlogs = async (cat?: string) => {
    const targetCat = cat || 'All';
    latestCategoryReqRef.current = targetCat;
    setLoading(true);
    try {
      const fetched = await fetchBlogs(targetCat === 'All' ? undefined : targetCat);
      // Discard stale responses if user switched category while request was in-flight
      if (latestCategoryReqRef.current !== targetCat) return;

      if (Array.isArray(fetched)) {
        // Correctly sets real blogs from D1 database (including 0 entries for clean empty state)
        setBlogs(fetched);
      } else {
        setBlogs([]);
      }
    } catch {
      if (latestCategoryReqRef.current !== targetCat) return;
      // In offline / network disconnect mode, show sample template posts filtered by active category
      const samples = targetCat === 'All'
        ? SAMPLE_FALLBACK_BLOGS
        : SAMPLE_FALLBACK_BLOGS.filter((s) => s.category.toLowerCase() === targetCat.toLowerCase());
      setBlogs(samples);
    } finally {
      if (latestCategoryReqRef.current === targetCat) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadBlogs(activeCategory);
  }, [activeCategory]);

  const handleOpenBlog = async (item: BlogItem) => {
    activeBlogIdRef.current = item.id;
    setActiveBlog(item);
    if (!item.content && item.id > 0) {
      setReadingLoading(true);
      try {
        const full = await fetchBlogByIdOrSlug(item.slug || item.id);
        // Guard against race condition: only apply if user is still on this exact post
        if (full && activeBlogIdRef.current === item.id) {
          setActiveBlog(full);
        }
      } catch (err) {
        console.warn('Failed to load full blog', err);
      } finally {
        if (activeBlogIdRef.current === item.id) {
          setReadingLoading(false);
        }
      }
    }
  };

  const handleCloseBlog = () => {
    activeBlogIdRef.current = null;
    setActiveBlog(null);
    setReadingLoading(false);
  };

  const handleLike = async (blogId: number) => {
    if (likedBlogIds.has(blogId)) return;
    const prevLikedSet = new Set(likedBlogIds);
    const nextSet = new Set(likedBlogIds);
    nextSet.add(blogId);
    setLikedBlogIds(nextSet);

    // Optimistic UI update
    if (activeBlog && activeBlog.id === blogId) {
      setActiveBlog({ ...activeBlog, likes_count: (activeBlog.likes_count || 0) + 1 });
    }
    setBlogs((prev) =>
      prev.map((b) => (b.id === blogId ? { ...b, likes_count: (b.likes_count || 0) + 1 } : b))
    );

    // Only invoke backend API for real stored blogs, not offline sample templates
    if (blogId > 0) {
      try {
        await likeBlog(blogId);
        // Persist to localStorage only after the server acknowledges the like
        try {
          localStorage.setItem('wnw_liked_blogs', JSON.stringify(Array.from(nextSet)));
        } catch {}
      } catch (err) {
        console.warn('Failed to register like on server, rolling back:', err);
        // Rollback optimistic state on failure
        setLikedBlogIds(prevLikedSet);
        if (activeBlog && activeBlog.id === blogId) {
          setActiveBlog((prev) =>
            prev ? { ...prev, likes_count: Math.max(0, (prev.likes_count || 0) - 1) } : null
          );
        }
        setBlogs((prev) =>
          prev.map((b) => (b.id === blogId ? { ...b, likes_count: Math.max(0, (b.likes_count || 0) - 1) } : b))
        );
      }
    } else {
      // Offline sample posts: persist locally
      try {
        localStorage.setItem('wnw_liked_blogs', JSON.stringify(Array.from(nextSet)));
      } catch {}
    }
  };

  const handleShare = (blog: BlogItem) => {
    if (blog.id < 0 || blog.is_sample) return;
    const shareUrl = `${window.location.origin}/?blog=${blog.slug || blog.id}`;
    if (navigator.share) {
      navigator.share({
        title: blog.title,
        text: blog.summary || 'Read this Himalayan trekking story on Walk Nepal Walk',
        url: shareUrl
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareUrl).then(() => {
        setCopiedShare(true);
        setTimeout(() => setCopiedShare(false), 2000);
      });
    }
  };

  const handleSaveBlogSubmit = async (e?: React.FormEvent) => {
    if (e && e.preventDefault) e.preventDefault();
    if (loadingEdit) {
      setSubmitError('Please wait for the story content to finish loading before saving.');
      return;
    }
    if (editLoadFailed) {
      setSubmitError('The original story could not be loaded, so saving is disabled. Close the editor and try again.');
      return;
    }
    if (!formData.title.trim()) {
      setSubmitError('Please enter a title for your story.');
      if (editorTab === 'preview') setEditorTab('write');
      return;
    }
    if (!formData.author_name.trim()) {
      setSubmitError('Please enter your name as the story author.');
      if (editorTab === 'preview') setEditorTab('write');
      return;
    }
    if (!formData.content.trim()) {
      setSubmitError('Please write your story content before publishing.');
      if (editorTab === 'preview') setEditorTab('write');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (editingBlogId) {
        const editToken = getBlogEditToken(editingBlogId);
        const updated = await updateBlog(
          editingBlogId,
          {
            title: formData.title.trim(),
            content: formData.content.trim(),
            author_name: formData.author_name.trim(),
            category: formData.category,
            tags: formData.tags.trim(),
            summary: formData.summary.trim() || undefined,
            cover_image_url: formData.cover_image_url.trim() || undefined
          },
          {
            email: user?.email || formData.author_email || undefined,
            editToken,
            isAdmin
          }
        );

        setBlogs((prev) =>
          prev.map((b) => (b.id === editingBlogId ? { ...b, ...updated } : b))
        );
        if (activeBlog && activeBlog.id === editingBlogId) {
          setActiveBlog((prev) => (prev ? { ...prev, ...updated } : null));
        }

        setIsComposing(false);
        resetForm();
      } else {
        const clientEditToken = Array.from(crypto.getRandomValues(new Uint8Array(16)))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
        const created = await createBlog({
          title: formData.title.trim(),
          content: formData.content.trim(),
          author_name: formData.author_name.trim(),
          author_email: user?.email || formData.author_email.trim() || undefined,
          category: formData.category,
          tags: formData.tags.trim(),
          summary: formData.summary.trim() || undefined,
          cover_image_url: formData.cover_image_url.trim() || undefined,
          edit_token: clientEditToken
        });

        if (created?.id) {
          try {
            localStorage.setItem(`wnw_blog_token_${created.id}`, clientEditToken);
          } catch {}
        }

        setIsComposing(false);
        resetForm();

        // Refresh list and open new post
        await loadBlogs(activeCategory);
        if (created?.id) {
          const full = await fetchBlogByIdOrSlug(created.id);
          if (full) setActiveBlog(full);
        }
      }
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to save blog. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredBlogs = blogs.filter((b) => {
    // 1. Ensure category matches activeCategory (for fallback sample posts and client-side harmony)
    if (activeCategory !== 'All') {
      const bCat = (b.category || '').toLowerCase();
      const aCat = activeCategory.toLowerCase();
      if (bCat !== aCat) return false;
    }

    // 2. Search query filter
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      b.title.toLowerCase().includes(q) ||
      (b.summary && b.summary.toLowerCase().includes(q)) ||
      (b.author_name && b.author_name.toLowerCase().includes(q)) ||
      (b.tags && b.tags.toLowerCase().includes(q))
    );
  });

  // 1. Editor form and full-page overlay components (declared before early returns)
  function renderEditorForm(isSplit: boolean = false) {
    return (
      <form onSubmit={handleSaveBlogSubmit} className="space-y-6">
        {/* Cover Photo Header */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-[#1F1F1F]">
              Cover Photo <span className="text-[#8B8680] font-normal">(optional)</span>
            </label>
            <input
              type="file"
              ref={coverFileInputRef}
              accept="image/*"
              onChange={handleCoverUpload}
              className="hidden"
            />
            <button
              type="button"
              disabled={uploadingCover}
              onClick={() => coverFileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#7ABA42] hover:text-[#5d942e] transition-colors cursor-pointer disabled:opacity-50"
            >
              {uploadingCover ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Uploading to R2...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Upload from Device</span>
                </>
              )}
            </button>
          </div>

          {formData.cover_image_url ? (
            <div className="relative group w-full h-64 sm:h-80 rounded-2xl overflow-hidden border border-[#E5E1DB] shadow-2xs bg-neutral-900">
              <img
                src={formData.cover_image_url}
                alt="Cover photo preview"
                className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 flex items-end justify-between p-3.5">
                <span className="text-[11px] font-bold text-white/90 drop-shadow-xs">Cover Photo Set</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => coverFileInputRef.current?.click()}
                    className="px-2.5 py-1 text-xs font-bold bg-white/90 hover:bg-white text-[#1F1F1F] rounded-lg shadow-xs transition-all cursor-pointer"
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, cover_image_url: '' }))}
                    className="p-1 text-white/90 hover:text-rose-400 bg-black/40 hover:bg-black/60 rounded-lg transition-all cursor-pointer"
                    title="Remove cover photo"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative">
              <input
                type="url"
                value={formData.cover_image_url}
                onChange={(e) => setFormData((prev) => ({ ...prev, cover_image_url: e.target.value }))}
                placeholder="https://... image link or click 'Upload from Device' above"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E1DB] bg-white focus:border-[#7ABA42] focus:outline-none transition-all text-xs text-[#1F1F1F]"
              />
            </div>
          )}
        </div>

        {/* Story Title */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-[#1F1F1F]">
            Story Title <span className="text-[#E08828]">*</span>
          </label>
          <input
            type="text"
            required
            value={formData.title}
            onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="e.g. 5 Lessons from My Winter Hike to Shivapuri Peak"
            className="w-full text-lg sm:text-2xl font-black text-[#1F1F1F] placeholder:text-[#A8A29E] bg-white px-4 py-3 rounded-2xl border border-[#E5E1DB] focus:border-[#7ABA42] focus:ring-2 focus:ring-[#7ABA42]/10 focus:outline-none transition-all tracking-tight"
          />
        </div>

        {/* Author, Category, Tags Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-bold text-[#1F1F1F] mb-1 flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-[#8B8680]" />
              <span>Your Name <span className="text-[#E08828]">*</span></span>
            </label>
            <input
              type="text"
              required
              value={formData.author_name}
              onChange={(e) => setFormData((prev) => ({ ...prev, author_name: e.target.value }))}
              placeholder="e.g. Ramesh Gurung"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E1DB] bg-white focus:border-[#7ABA42] focus:outline-none transition-all text-xs text-[#1F1F1F]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#1F1F1F] mb-1 flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-[#8B8680]" />
              <span>Category</span>
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E1DB] bg-white focus:border-[#7ABA42] focus:outline-none transition-all text-xs text-[#1F1F1F]"
            >
              <option value="Trail Stories">Trail Stories</option>
              <option value="Gear & Prep">Gear & Prep</option>
              <option value="Culture & Flora">Culture & Flora</option>
              <option value="Guides">Guides</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#1F1F1F] mb-1 flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-[#8B8680]" />
              <span>Tags (comma-separated)</span>
            </label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData((prev) => ({ ...prev, tags: e.target.value }))}
              placeholder="e.g. Shivapuri, Winter, DayHike"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E1DB] bg-white focus:border-[#7ABA42] focus:outline-none transition-all text-xs text-[#1F1F1F]"
            />
          </div>
        </div>

        {/* Short Summary */}
        <div>
          <label className="block text-xs font-bold text-[#1F1F1F] mb-1">
            Short Summary / Teaser <span className="text-[#8B8680] font-normal">(optional, shown on cards)</span>
          </label>
          <input
            type="text"
            value={formData.summary}
            onChange={(e) => setFormData((prev) => ({ ...prev, summary: e.target.value }))}
            placeholder="A brief 1-2 sentence teaser to hook fellow hikers..."
            className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E1DB] bg-white focus:border-[#7ABA42] focus:outline-none transition-all text-xs text-[#1F1F1F]"
          />
        </div>

        {/* Content & Markdown Editor */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-[#1F1F1F]">
              Story / Blog Content <span className="text-[#E08828]">*</span>
            </label>
            <span className="text-[11px] text-[#8B8680]">
              Markdown formatting supported
            </span>
          </div>

          {/* Sticky Formatting Toolbar */}
          <div className="sticky top-2 z-10 p-1.5 bg-white/95 backdrop-blur-md rounded-2xl border border-[#E5E1DB] shadow-xs flex flex-wrap items-center gap-1">
            <button
              type="button"
              disabled={loadingEdit || editLoadFailed}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertFormat('bold')}
              className="p-1.5 rounded-lg hover:bg-[#F3F0EC] text-[#5A5551] hover:text-[#1F1F1F] font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title="Bold (**text**)"
            >
              <Bold className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={loadingEdit || editLoadFailed}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertFormat('italic')}
              className="p-1.5 rounded-lg hover:bg-[#F3F0EC] text-[#5A5551] hover:text-[#1F1F1F] italic transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title="Italic (*text*)"
            >
              <Italic className="w-4 h-4" />
            </button>

            <div className="w-px h-4 bg-[#E5E1DB] mx-0.5" />

            <button
              type="button"
              disabled={loadingEdit || editLoadFailed}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertFormat('h1')}
              className="px-2 py-1 rounded-lg hover:bg-[#F3F0EC] text-[#5A5551] hover:text-[#1F1F1F] font-extrabold text-xs transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title="Heading 1 (# Heading)"
            >
              H1
            </button>
            <button
              type="button"
              disabled={loadingEdit || editLoadFailed}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertFormat('h2')}
              className="px-2 py-1 rounded-lg hover:bg-[#F3F0EC] text-[#5A5551] hover:text-[#1F1F1F] font-extrabold text-xs transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title="Heading 2 (## Heading)"
            >
              H2
            </button>
            <button
              type="button"
              disabled={loadingEdit || editLoadFailed}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertFormat('h3')}
              className="px-2 py-1 rounded-lg hover:bg-[#F3F0EC] text-[#5A5551] hover:text-[#1F1F1F] font-extrabold text-xs transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title="Heading 3 (### Heading)"
            >
              H3
            </button>

            <div className="w-px h-4 bg-[#E5E1DB] mx-0.5" />

            <button
              type="button"
              disabled={loadingEdit || editLoadFailed}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertFormat('quote')}
              className="p-1.5 rounded-lg hover:bg-[#F3F0EC] text-[#5A5551] hover:text-[#1F1F1F] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title="Blockquote (> Quote)"
            >
              <Quote className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={loadingEdit || editLoadFailed}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertFormat('bullet')}
              className="p-1.5 rounded-lg hover:bg-[#F3F0EC] text-[#5A5551] hover:text-[#1F1F1F] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title="Bullet List (- Item)"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={loadingEdit || editLoadFailed}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertFormat('number')}
              className="p-1.5 rounded-lg hover:bg-[#F3F0EC] text-[#5A5551] hover:text-[#1F1F1F] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title="Numbered List (1. Item)"
            >
              <ListOrdered className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={loadingEdit || editLoadFailed}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertFormat('divider')}
              className="p-1.5 rounded-lg hover:bg-[#F3F0EC] text-[#5A5551] hover:text-[#1F1F1F] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title="Divider (---)"
            >
              <Minus className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={loadingEdit || editLoadFailed}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertFormat('code')}
              className="p-1.5 rounded-lg hover:bg-[#F3F0EC] text-[#5A5551] hover:text-[#1F1F1F] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title="Inline Code (`text`)"
            >
              <Code className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={loadingEdit || editLoadFailed}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertFormat('link')}
              className="p-1.5 rounded-lg hover:bg-[#F3F0EC] text-[#5A5551] hover:text-[#1F1F1F] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title="Insert Link ([Text](url))"
            >
              <Link2 className="w-4 h-4" />
            </button>

            <div className="w-px h-4 bg-[#E5E1DB] mx-0.5" />

            {/* Direct Photo Upload to Cloudflare R2 */}
            <input
              type="file"
              ref={inlineFileInputRef}
              accept="image/*"
              onChange={handleInlineImageUpload}
              className="hidden"
            />
            <button
              type="button"
              disabled={uploadingInlineImage || loadingEdit || editLoadFailed}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (contentInputRef.current) {
                  lastSelectionRef.current = {
                    start: contentInputRef.current.selectionStart,
                    end: contentInputRef.current.selectionEnd
                  };
                }
                inlineFileInputRef.current?.click();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 text-xs font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title="Upload photo directly to Cloudflare R2"
            >
              {uploadingInlineImage ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                  <span>Uploading to R2...</span>
                </>
              ) : (
                <>
                  <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Upload Photo</span>
                </>
              )}
            </button>
          </div>

          {/* Story Textarea */}
          <div className="relative">
            <textarea
              ref={contentInputRef}
              required
              disabled={loadingEdit || editLoadFailed}
              rows={isSplit ? 18 : 22}
              value={formData.content}
              onSelect={(e) => {
                lastSelectionRef.current = {
                  start: e.currentTarget.selectionStart,
                  end: e.currentTarget.selectionEnd
                };
              }}
              onKeyUp={(e) => {
                lastSelectionRef.current = {
                  start: e.currentTarget.selectionStart,
                  end: e.currentTarget.selectionEnd
                };
              }}
              onClick={(e) => {
                lastSelectionRef.current = {
                  start: e.currentTarget.selectionStart,
                  end: e.currentTarget.selectionEnd
                };
              }}
              onChange={(e) => setFormData((prev) => ({ ...prev, content: e.target.value }))}
              placeholder={
                loadingEdit
                  ? "Loading full story from Cloudflare..."
                  : "Write your story here... Use the toolbar above to style headings, insert trail wisdom quotes, gear lists, and upload trail photos directly from your device."
              }
              className="w-full px-5 py-4 rounded-2xl border border-[#E5E1DB] bg-white focus:border-[#7ABA42] focus:ring-2 focus:ring-[#7ABA42]/10 focus:outline-none transition-all text-sm leading-relaxed text-[#1F1F1F] font-mono resize-y shadow-2xs disabled:bg-neutral-50 disabled:opacity-75"
            />
            {loadingEdit && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-2xs flex flex-col items-center justify-center gap-2 rounded-2xl z-10">
                <Loader2 className="w-6 h-6 animate-spin text-[#7ABA42]" />
                <span className="text-xs font-bold text-[#5A5551]">Fetching full original story from Cloudflare...</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#8B8680] pt-1">
            <span>💡 Tip: Click "Upload Photo" above to upload high-res trail pictures into your story.</span>
            <span>{wordCount} words • ~{estReadingTime} min read</span>
          </div>
        </div>

        {/* Action Buttons in Form Bottom */}
        <div className="flex items-center justify-between pt-4 border-t border-[#E5E1DB]">
          <button
            type="button"
            onClick={handleExitRequest}
            className="px-5 py-2.5 rounded-xl border border-[#E5E1DB] bg-white text-[#5A5551] hover:bg-[#F3F0EC] hover:text-[#1F1F1F] font-bold text-xs cursor-pointer transition-all"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={submitting || loadingEdit || !formData.title.trim() || !formData.author_name.trim() || !formData.content.trim()}
            className="px-6 py-2.5 bg-[#7ABA42] hover:bg-[#689f38] text-white font-extrabold text-xs rounded-xl shadow-xs flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{editingBlogId ? 'Saving Changes...' : 'Publishing to Cloudflare...'}</span>
              </>
            ) : (
              <>
                {editingBlogId ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                <span>{editingBlogId ? 'Save Changes' : 'Publish Story'}</span>
              </>
            )}
          </button>
        </div>
      </form>
    );
  }

  function renderFullPageEditor() {
    if (typeof document === 'undefined') return null;

    return createPortal(
      <div
        role="dialog"
        aria-modal="true"
        aria-label={editingBlogId ? 'Edit Himalayan Story' : 'Write a Himalayan Story'}
        className="fixed inset-0 z-[9999] bg-[#FAF8F5] flex flex-col h-screen w-screen overflow-hidden animate-in fade-in duration-200"
      >
        {/* Full-Page Top Navigation Bar */}
        <header className="bg-white/95 backdrop-blur-md border-b border-[#E5E1DB] px-4 sm:px-6 py-3 flex items-center justify-between shrink-0 shadow-2xs z-20">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={handleExitRequest}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#5A5551] hover:text-[#1F1F1F] px-3 py-2 rounded-xl hover:bg-[#F3F0EC] transition-all cursor-pointer shrink-0 border border-[#E5E1DB]"
              title="Exit editor (Esc)"
            >
              <ArrowLeft className="w-4 h-4 text-[#7ABA42]" />
              <span className="hidden sm:inline">Exit Editor</span>
              <span className="sm:hidden">Exit</span>
            </button>

            <div className="h-5 w-px bg-[#E5E1DB] hidden sm:block" />

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                  {editingBlogId ? <Edit3 className="w-3 h-3 text-[#E08828]" /> : <PenLine className="w-3 h-3 text-[#E08828]" />}
                  <span>{editingBlogId ? 'Editing Story' : 'New Story'}</span>
                </span>
                <h2 className="text-xs sm:text-sm font-extrabold text-[#1F1F1F] truncate hidden md:block max-w-xs lg:max-w-md">
                  {formData.title.trim() || 'Untitled Himalayan Story'}
                </h2>
              </div>
              <div className="text-[11px] text-[#8B8680] flex items-center gap-2 mt-0.5">
                <span>📖 {wordCount} words</span>
                <span>•</span>
                <span>~{estReadingTime} min read</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* View Mode Switcher */}
            <div className="inline-flex items-center p-0.5 bg-[#F4F1ED] border border-[#E5E1DB] rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setEditorTab('write')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  editorTab === 'write'
                    ? 'bg-white text-[#1F1F1F] shadow-2xs font-black'
                    : 'text-[#7A7570] hover:text-[#1F1F1F]'
                }`}
                title="Focus on writing"
              >
                <PenLine className="w-3.5 h-3.5 text-[#E08828]" />
                <span className="hidden sm:inline">Write</span>
              </button>
              <button
                type="button"
                onClick={() => setEditorTab('split')}
                className={`hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  editorTab === 'split'
                    ? 'bg-white text-[#1F1F1F] shadow-2xs font-black'
                    : 'text-[#7A7570] hover:text-[#1F1F1F]'
                }`}
                title="Side-by-side Markdown editor and real-time live preview"
              >
                <Columns className="w-3.5 h-3.5 text-[#7ABA42]" />
                <span>Split View</span>
              </button>
              <button
                type="button"
                onClick={() => setEditorTab('preview')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  editorTab === 'preview'
                    ? 'bg-white text-[#7ABA42] shadow-2xs font-black'
                    : 'text-[#7A7570] hover:text-[#1F1F1F]'
                }`}
                title="Preview article as readers will see it"
              >
                <Eye className="w-3.5 h-3.5 text-[#7ABA42]" />
                <span className="hidden sm:inline">Live Preview</span>
              </button>
            </div>

            {/* Quick Header Publish / Save button */}
            <button
              type="button"
              disabled={submitting || loadingEdit || !formData.title.trim() || !formData.author_name.trim() || !formData.content.trim()}
              onClick={(e) => handleSaveBlogSubmit(e as any)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#7ABA42] hover:bg-[#689f38] text-white text-xs font-black rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span className="hidden sm:inline">{editingBlogId ? 'Saving...' : 'Publishing...'}</span>
                </>
              ) : (
                <>
                  {editingBlogId ? <Check className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                  <span>{editingBlogId ? 'Save Changes' : 'Publish Story'}</span>
                </>
              )}
            </button>
          </div>
        </header>

        {/* Global Alerts Inside Editor */}
        {submitError && (
          <div className="bg-rose-50 border-b border-rose-200 px-4 py-2.5 text-xs text-rose-800 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="font-medium">{submitError}</span>
            </div>
            <button
              type="button"
              onClick={() => setSubmitError(null)}
              className="p-1 hover:bg-rose-100 rounded-lg text-rose-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {loadingEdit && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-800 flex items-center gap-2 shrink-0">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600 shrink-0" />
            <span>Loading full original story content...</span>
          </div>
        )}

        {/* Editor Main Content Area */}
        <div className="flex-1 overflow-hidden">
          {editorTab === 'preview' ? (
            /* 1. Full Live Preview Mode */
            <div className="h-full overflow-y-auto px-4 sm:px-8 py-8 bg-[#FAF8F5]">
              <div className="max-w-6xl mx-auto space-y-6 bg-white p-6 sm:p-10 rounded-3xl border border-[#E5E1DB] shadow-xs">
                {formData.cover_image_url && (
                  <div className="w-full h-96 sm:h-[480px] rounded-2xl overflow-hidden border border-[#E5E1DB] shadow-2xs">
                    <img
                      src={formData.cover_image_url}
                      alt={formData.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-[#8B8680]">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#FAF2EB] text-[#E08828] font-bold border border-[#F3DFC9]">
                      {formData.category || 'Trail Stories'}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#7ABA42]" />
                      ~{estReadingTime} min read
                    </span>
                    <span>•</span>
                    <span>{new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                  </div>

                  <h1 className="text-2xl sm:text-3xl font-black text-[#1F1F1F] leading-tight tracking-tight">
                    {formData.title || 'Untitled Himalayan Story'}
                  </h1>

                  {formData.summary && (
                    <p className="text-sm text-[#5A5551] font-medium leading-relaxed italic border-l-[3px] border-[#7ABA42] pl-3 py-1">
                      {formData.summary}
                    </p>
                  )}

                  <div className="flex items-center gap-2 pt-2 border-t border-[#F0EBE5]">
                    <div className="w-8 h-8 rounded-full bg-[#7ABA42]/15 text-[#7ABA42] font-bold flex items-center justify-center text-xs shrink-0">
                      {(formData.author_name || 'H').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#1F1F1F]">{formData.author_name || 'Himalayan Explorer'}</div>
                      <div className="text-[10px] text-[#8B8680]">Author</div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-[#F0EBE5] pt-5">
                  {formData.content.trim() ? (
                    <MarkdownRenderer content={formData.content} />
                  ) : (
                    <div className="py-16 text-center text-xs text-[#8B8680] italic">
                      Nothing written yet. Switch back to Write mode to compose your trail story.
                    </div>
                  )}
                </div>

                {formData.tags && (
                  <div className="pt-4 border-t border-[#F0EBE5] flex flex-wrap items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-[#8B8680]" />
                    {formData.tags.split(',').map((tag, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-[#FAF8F5] text-[#5A5551] border border-[#E5E1DB]"
                      >
                        #{tag.trim()}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : editorTab === 'split' ? (
            /* 2. Split Screen View (Write on Left, Live Preview on Right) */
            <div className="h-full grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#E5E1DB] overflow-hidden">
              {/* Left Column: Form & Editor */}
              <div className="h-full overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[#FAF8F5]">
                {renderEditorForm(true)}
              </div>

              {/* Right Column: Live Markdown Preview */}
              <div className="h-full overflow-y-auto p-4 sm:p-6 lg:p-8 bg-white">
                <div className="max-w-5xl mx-auto space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-[#F0EBE5]">
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4 text-[#7ABA42]" />
                      <span className="text-xs font-extrabold uppercase tracking-wider text-[#1F1F1F]">
                        Live Article Preview
                      </span>
                    </div>
                    <span className="text-[11px] text-[#8B8680]">Updates as you type</span>
                  </div>

                  {formData.cover_image_url && (
                    <div className="w-full h-72 sm:h-96 rounded-2xl overflow-hidden border border-[#E5E1DB] shadow-2xs">
                      <img
                        src={formData.cover_image_url}
                        alt="Cover preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[11px] font-semibold text-[#8B8680]">
                      <span className="px-2 py-0.5 rounded-full bg-[#FAF2EB] text-[#E08828] font-bold border border-[#F3DFC9]">
                        {formData.category}
                      </span>
                      <span>•</span>
                      <span>~{estReadingTime} min read</span>
                    </div>
                    <h1 className="text-xl sm:text-2xl font-black text-[#1F1F1F] leading-snug">
                      {formData.title || 'Untitled Himalayan Story'}
                    </h1>
                  </div>

                  <div className="border-t border-[#F0EBE5] pt-4">
                    {formData.content.trim() ? (
                      <MarkdownRenderer content={formData.content} />
                    ) : (
                      <div className="py-12 text-center text-xs text-[#8B8680] italic">
                        Type story content in the left editor to preview it here live.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* 3. Full Write View (Focused, Centered, Clean) */
            <div className="h-full overflow-y-auto p-4 sm:p-8 bg-[#FAF8F5]">
              <div className="max-w-screen-xl mx-auto">
                {renderEditorForm(false)}
              </div>
            </div>
          )}
        </div>

        {/* Exit Confirmation Dialog */}
        {showExitConfirm && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="w-full max-w-sm rounded-2xl bg-white p-5 border border-[#E5E1DB] shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-[#1F1F1F]">Discard Unsaved Changes?</h4>
                  <p className="text-xs text-[#8B8680]">You have unsaved edits in this story. If you exit now, your changes will not be saved.</p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowExitConfirm(false)}
                  className="px-3.5 py-2 text-xs font-bold text-[#5A5551] hover:text-[#1F1F1F] rounded-xl hover:bg-[#F3F0EC] transition-all cursor-pointer"
                >
                  Keep Writing
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowExitConfirm(false);
                    setIsComposing(false);
                    resetForm();
                  }}
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all shadow-xs cursor-pointer"
                >
                  Discard & Exit
                </button>
              </div>
            </div>
          </div>
        )}
      </div>,
      document.body
    );
  }

  // 2. Reading view
  if (activeBlog) {
    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        <div className="flex items-center justify-between pb-3 border-b border-[#F0EBE5]">
          <button
            type="button"
            onClick={handleCloseBlog}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#5A5551] hover:text-[#1F1F1F] px-2.5 py-1.5 rounded-xl hover:bg-[#F3F0EC] transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-[#7ABA42]" />
            <span>Back to All Stories</span>
          </button>

          <div className="flex items-center gap-2">
            {canManageBlog(activeBlog) && (
              <>
                <button
                  type="button"
                  onClick={() => handleStartEdit(activeBlog)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-white text-[#5A5551] border border-[#E5E1DB] hover:text-[#E08828] hover:border-[#E08828]/50 transition-all cursor-pointer shadow-2xs"
                  title="Edit story"
                >
                  <Edit3 className="w-3.5 h-3.5 text-[#E08828]" />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBlogToDelete(activeBlog)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-white text-[#5A5551] border border-[#E5E1DB] hover:text-rose-600 hover:border-rose-200 transition-all cursor-pointer shadow-2xs"
                  title="Delete story"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                  <span>Delete</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => handleLike(activeBlog.id)}
              className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                likedBlogIds.has(activeBlog.id)
                  ? 'bg-rose-50 text-rose-600 border-rose-200'
                  : 'bg-white text-[#5A5551] border-[#E5E1DB] hover:text-rose-600 hover:border-rose-200'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${likedBlogIds.has(activeBlog.id) ? 'fill-rose-500 text-rose-500' : ''}`} />
              <span>{activeBlog.likes_count || 0}</span>
            </button>

            <button
              type="button"
              onClick={() => handleShare(activeBlog)}
              className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-white text-[#5A5551] border border-[#E5E1DB] hover:text-[#1F1F1F] transition-all cursor-pointer"
            >
              {copiedShare ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Copied!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5 text-[#8B8680]" />
                  <span>Share</span>
                </>
              )}
            </button>
          </div>
        </div>

        {activeBlog.cover_image_url && (
          <div className="w-full h-80 sm:h-[432px] rounded-2xl overflow-hidden border border-[#E5E1DB] shadow-xs">
            <img
              src={activeBlog.cover_image_url}
              alt={activeBlog.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
        )}

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-[#8B8680]">
            <span className="px-2.5 py-0.5 rounded-full bg-[#FAF2EB] text-[#E08828] font-bold border border-[#F3DFC9]">
              {activeBlog.category}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-[#7ABA42]" />
              {activeBlog.reading_time_mins || 3} min read
            </span>
            <span>•</span>
            <span>{new Date(activeBlog.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-[#1F1F1F] leading-tight tracking-tight">
            {activeBlog.title}
          </h1>

          <div className="flex items-center gap-2 pt-1">
            <div className="w-8 h-8 rounded-full bg-[#7ABA42]/15 text-[#7ABA42] font-bold flex items-center justify-center text-xs shrink-0">
              {(activeBlog.author_name || '?').charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-xs font-bold text-[#1F1F1F]">{activeBlog.author_name}</div>
              <div className="text-[10px] text-[#8B8680]">Community Trail Writer</div>
            </div>
          </div>
        </div>

        {readingLoading ? (
          <div className="py-12 flex flex-col items-center justify-center text-xs text-[#8B8680] gap-2">
            <div className="w-5 h-5 border-2 border-[#7ABA42]/30 border-t-[#7ABA42] rounded-full animate-spin" />
            <span>Loading full story...</span>
          </div>
        ) : (
          <div className="border-t border-[#F0EBE5] pt-4">
            <MarkdownRenderer content={activeBlog.content || activeBlog.summary || ''} />
          </div>
        )}

        {activeBlog.tags && (
          <div className="pt-4 border-t border-[#F0EBE5] flex flex-wrap items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-[#8B8680]" />
            {activeBlog.tags.split(',').map((tag, idx) => (
              <span
                key={idx}
                className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-[#FAF8F5] text-[#5A5551] border border-[#E5E1DB]"
              >
                #{tag.trim()}
              </span>
            ))}
          </div>
        )}

        {renderDeleteModal()}
        {isComposing && renderFullPageEditor()}
      </div>
    );
  }

  // 3. Main Blog Feed View
  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#F0EBE5] pb-3">
        <div>
          <h3 className="text-lg font-extrabold text-[#1F1F1F] flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#7ABA42]" />
            Himalayan Blogs & Stories
          </h3>
          <p className="text-xs text-[#8B8680] mt-0.5">Community trail experiences, mountain wisdom & practical expedition advice.</p>
        </div>

        <button
          type="button"
          onClick={() => {
            resetForm();
            setIsComposing(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#E08828] hover:bg-[#cc781f] text-white font-extrabold text-xs rounded-xl shadow-xs transition-all cursor-pointer active:scale-95 shrink-0"
        >
          <PenLine className="w-3.5 h-3.5" />
          <span>Write a Story</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar-x">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeCategory === cat
                  ? 'bg-[#1F1F1F] text-white shadow-2xs'
                  : 'bg-[#F9F7F5] text-[#5A5551] hover:bg-[#EFEAE4] border border-[#E5E1DB]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-[#8B8680] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search blogs or tags..."
            className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-[#E5E1DB] bg-[#FAF8F5] focus:bg-white focus:border-[#7ABA42] focus:outline-none text-xs text-[#1F1F1F] transition-all"
          />
        </div>
      </div>

      {/* Blogs List */}
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center text-xs text-[#8B8680] gap-2">
          <div className="w-5 h-5 border-2 border-[#7ABA42]/30 border-t-[#7ABA42] rounded-full animate-spin" />
          <span>Fetching stories from Cloudflare...</span>
        </div>
      ) : filteredBlogs.length === 0 ? (
        <div className="p-8 text-center bg-[#FAF8F5] rounded-2xl border border-[#E5E1DB] space-y-2">
          <p className="text-xs font-bold text-[#1F1F1F]">No blogs found</p>
          <p className="text-[11px] text-[#8B8680]">Be the first to share an adventure on this trail!</p>
          <button
            type="button"
            onClick={() => {
              resetForm();
              setIsComposing(true);
            }}
            className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-[#7ABA42] text-white text-xs font-bold rounded-xl cursor-pointer"
          >
            <PenLine className="w-3.5 h-3.5" />
            <span>Write the First Post</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredBlogs.map((item) => (
            <div
              key={item.id}
              role="button"
              tabIndex={0}
              onClick={() => handleOpenBlog(item)}
              onKeyDown={(e) => {
                if (e.target !== e.currentTarget) return;
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleOpenBlog(item);
                }
              }}
              className="p-4 rounded-2xl bg-[#FAF8F5] hover:bg-white border border-[#E5E1DB] hover:border-[#7ABA42]/50 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group space-y-3"
            >
              {item.cover_image_url && (
                <div className="w-full h-36 rounded-xl overflow-hidden bg-neutral-100">
                  <img
                    src={item.cover_image_url}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
              )}

              <div className="space-y-1.5 flex-1">
                <div className="flex items-center justify-between gap-2 text-[10px] font-bold">
                  <span className="px-2 py-0.5 rounded-md bg-[#FAF2EB] text-[#E08828] border border-[#F3DFC9]">
                    {item.category}
                  </span>
                  <span className="text-[#8B8680] flex items-center gap-1">
                    <Clock className="w-3 h-3 text-[#7ABA42]" />
                    {item.reading_time_mins || 3} min
                  </span>
                </div>

                <h4 className="text-sm font-extrabold text-[#1F1F1F] group-hover:text-[#E08828] transition-colors line-clamp-2 leading-snug">
                  {item.title}
                </h4>

                <p className="text-[11px] text-[#5A5551] line-clamp-2 leading-relaxed">
                  {item.summary || (item.content ? item.content.slice(0, 120) : '')}
                </p>
              </div>

              <div className="pt-2 border-t border-[#F0EBE5] flex items-center justify-between text-[11px] text-[#8B8680]">
                <div className="flex items-center gap-1.5 font-semibold text-[#1F1F1F]">
                  <div className="w-5 h-5 rounded-full bg-[#7ABA42]/20 text-[#7ABA42] flex items-center justify-center text-[10px] font-extrabold">
                    {(item.author_name || '?').charAt(0).toUpperCase()}
                  </div>
                  <span className="truncate max-w-[120px]">{item.author_name}</span>
                </div>

                <div className="flex items-center gap-2">
                  {canManageBlog(item) && (
                    <div className="flex items-center gap-0.5 mr-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleStartEdit(item)}
                        className="p-1 rounded-md text-[#8B8680] hover:text-[#E08828] hover:bg-[#FAF2EB] transition-colors cursor-pointer"
                        title="Edit story"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setBlogToDelete(item)}
                        className="p-1 rounded-md text-[#8B8680] hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Delete story"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <span className="flex items-center gap-1 hover:text-rose-600 transition-colors">
                    <Heart className="w-3 h-3 text-rose-500" />
                    <span>{item.likes_count || 0}</span>
                  </span>
                  <span className="text-[#E08828] font-bold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                    Read
                    <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {renderDeleteModal()}
      {isComposing && renderFullPageEditor()}
    </div>
  );
};
