import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Copy, Check, Bookmark, BookmarkCheck, Pin, Edit3, Trash2, User as UserIcon, Sparkles, MessageSquare, Flag
} from 'lucide-react';
import { 
  doc, updateDoc, increment, collection, addDoc, query, where, getDocs, deleteDoc, serverTimestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { PromptItem } from '../types';
import CommentSection from './comments/CommentSection';
import ReportModal from './ReportModal';
import UserBadge from './UserBadge';
import DisplayId from './DisplayId';
import { getValidAvatar } from '../lib/avatar';
import toast from 'react-hot-toast';

interface PromptCardProps {
  key?: React.Key;
  prompt: PromptItem;
  onEdit?: (prompt: PromptItem) => void;
  onDelete?: (promptId: string) => void;
  onPin?: (prompt: PromptItem) => void;
  isOwner?: boolean;
}

export default function PromptCard({ prompt, onEdit, onDelete, onPin, isOwner }: PromptCardProps) {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [copied, setCopied] = useState(false);
  const [copyCount, setCopyCount] = useState(prompt.copyCount || 0);
  
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [savesCount, setSavesCount] = useState(prompt.savesCount || 0);
  const [bookmarking, setBookmarking] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);

  const isPinned = prompt.pinned || false;

  // Check initial bookmark status for current user
  useEffect(() => {
    if (!user?.id || !prompt.id) return;
    const checkBookmark = async () => {
      try {
        const q = query(
          collection(db, 'bookmarks'),
          where('userId', '==', user.id),
          where('targetId', '==', prompt.id),
          where('targetType', '==', 'PROMPT')
        );
        const snap = await getDocs(q);
        setIsBookmarked(!snap.empty);
      } catch (e) {
        console.error("Check bookmark error:", e);
      }
    };
    checkBookmark();
  }, [user?.id, prompt.id]);

  // Quick Copy Handler ("Sao chép nhanh")
  const handleQuickCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt.content);
      setCopied(true);
      toast.success("Đã sao chép Prompt vào khay nhớ tạm!");

      // Update Firestore copy count
      const promptRef = doc(db, 'prompts', prompt.id);
      await updateDoc(promptRef, {
        copyCount: increment(1)
      });
      setCopyCount(prev => prev + 1);

      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
      toast.error("Không thể sao chép nội dung.");
    }
  };

  // Save / Bookmark Handler ("Nút lưu" & "Bộ đếm số lượt lưu")
  const handleToggleSave = async () => {
    if (!user) {
      toast.error("Vui lòng đăng nhập để lưu Prompt này!");
      return;
    }

    setBookmarking(true);
    try {
      const q = query(
        collection(db, 'bookmarks'),
        where('userId', '==', user.id),
        where('targetId', '==', prompt.id),
        where('targetType', '==', 'PROMPT')
      );
      const snap = await getDocs(q);

      const promptRef = doc(db, 'prompts', prompt.id);

      if (!snap.empty) {
        // Remove bookmark
        for (const bDoc of snap.docs) {
          await deleteDoc(doc(db, 'bookmarks', bDoc.id));
        }
        await updateDoc(promptRef, {
          savesCount: increment(-1)
        });
        setIsBookmarked(false);
        setSavesCount(prev => Math.max(0, prev - 1));
        toast.success("Đã bỏ lưu Prompt.");
      } else {
        // Add bookmark
        await addDoc(collection(db, 'bookmarks'), {
          userId: user.id,
          targetId: prompt.id,
          targetType: 'PROMPT',
          createdAt: serverTimestamp()
        });
        await updateDoc(promptRef, {
          savesCount: increment(1)
        });
        setIsBookmarked(true);
        setSavesCount(prev => prev + 1);
        toast.success("Đã lưu Prompt vào bộ sưu tập!");

        // Gửi thông báo đến Tác giả Prompt
        if (prompt.authorId && prompt.authorId !== user.id) {
          await addDoc(collection(db, 'notifications'), {
            recipientId: prompt.authorId,
            senderId: user.id,
            senderName: user.displayName || 'Người dùng',
            senderAvatar: user.avatar || '',
            type: 'PROMPT_SAVE',
            title: 'Prompt được lưu vào bộ sưu tập',
            message: `${user.displayName || 'Một người dùng'} đã lưu Prompt "${prompt.name}" của bạn vào bộ sưu tập.`,
            targetId: prompt.id,
            targetType: 'PROMPT',
            read: false,
            createdAt: new Date().toISOString()
          });
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Thao tác lưu thất bại.");
    } finally {
      setBookmarking(false);
    }
  };

  const handleNavigateDetail = () => {
    navigate(`/prompt/${prompt.id}`);
  };

  return (
    <div 
      onClick={handleNavigateDetail}
      className={`bg-white dark:bg-neutral-900 border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-4 cursor-pointer ${
      isPinned 
        ? 'border-indigo-500/50 dark:border-indigo-500/40 ring-1 ring-indigo-500/20' 
        : 'border-neutral-200 dark:border-neutral-800'
    }`}>
      <div className="space-y-3">
        {/* Header line: Title, Pinned badge, Author */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-neutral-900 dark:text-neutral-100 line-clamp-1 group-hover:text-amber-600 transition-colors">
                {prompt.name}
              </h3>
              {isPinned && (
                <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 rounded-md text-[10px] font-extrabold shrink-0 flex items-center gap-1">
                  <Pin className="w-2.5 h-2.5 fill-indigo-500" /> Ghim
                </span>
              )}
            </div>

            <div className="mt-1 mb-1">
              <DisplayId type="prompt" numericId={prompt.numericId} />
            </div>
            {/* Author Name */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
              {prompt.authorId ? (
                <div 
                  onClick={() => navigate(`/creator/${prompt.authorId}`)}
                  className="flex items-center gap-1.5 cursor-pointer hover:text-amber-600 dark:hover:text-amber-400 hover:underline"
                >
                  <img 
                    src={getValidAvatar(prompt.authorAvatar)} 
                    alt={prompt.authorName || "Author"} 
                    className="w-5 h-5 rounded-full object-cover border border-neutral-200 dark:border-neutral-700 hover:scale-105 transition-transform"
                  />
                  <span>Tác giả: <strong className="font-semibold">{prompt.authorName || 'Ẩn danh'}</strong></span>
                </div>
              ) : (
                <>
                  <img 
                    src={getValidAvatar(prompt.authorAvatar)} 
                    alt={prompt.authorName || "Author"} 
                    className="w-5 h-5 rounded-full object-cover border border-neutral-200 dark:border-neutral-700"
                  />
                  <span>Tác giả: <strong className="text-neutral-700 dark:text-neutral-300 font-semibold">{prompt.authorName || 'Ẩn danh'}</strong></span>
                </>
              )}
              <UserBadge subject={{ promptCount: 1 }} size="xs" />
            </div>
          </div>

          {/* Owner/Admin actions if applicable */}
          {isOwner && (
            <div className="flex items-center gap-1 shrink-0">
              {onPin && (
                <button
                  onClick={(e) => { e.stopPropagation(); onPin(prompt); }}
                  title={isPinned ? "Bỏ ghim" : "Ghim lên đầu"}
                  className={`p-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                    isPinned 
                      ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400' 
                      : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:text-black dark:hover:text-white'
                  }`}
                >
                  <Pin className="w-3.5 h-3.5" />
                </button>
              )}
              {onEdit && (
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit(prompt); }}
                  title="Chỉnh sửa Prompt"
                  className="p-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:text-black dark:hover:text-white transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(prompt.id); }}
                  title="Xoá Prompt"
                  className="p-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Purpose */}
        {prompt.purpose && (
          <p className="text-xs text-neutral-600 dark:text-neutral-300">
            <span className="font-bold text-neutral-800 dark:text-neutral-200">Mục đích:</span> {prompt.purpose}
          </p>
        )}

        {/* Content Box */}
        <div className="relative group/code">
          <div className="p-3.5 bg-neutral-50 dark:bg-neutral-800/60 rounded-xl border border-neutral-200/80 dark:border-neutral-800 font-mono text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto scrollbar-thin">
            {prompt.content}
          </div>
        </div>

        {/* Tags */}
        {prompt.tags && prompt.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {prompt.tags.map(t => (
              <span key={t} className="px-2.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-[10px] font-medium rounded-md text-neutral-500 dark:text-neutral-400">
                #{t}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Footer Interactive Actions: Quick Copy, Copy Counter, Save Button, Save Counter */}
      <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between gap-2">
        {/* Left: Counters */}
        <div className="flex items-center gap-4 text-xs font-medium text-neutral-500 dark:text-neutral-400">
          {/* Bộ đếm số lần sao chép */}
          <span className="flex items-center gap-1.5" title="Số lần sao chép">
            <Copy className="w-3.5 h-3.5 text-blue-500" />
            <span><strong className="text-neutral-900 dark:text-neutral-100">{copyCount}</strong> lượt sao chép</span>
          </span>

          {/* Bộ đếm số lượt lưu */}
          <span className="flex items-center gap-1.5" title="Số lượt lưu">
            <Bookmark className="w-3.5 h-3.5 text-amber-500" />
            <span><strong className="text-neutral-900 dark:text-neutral-100">{savesCount}</strong> lượt lưu</span>
          </span>
        </div>

        {/* Right: Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Nút Bình luận */}
          <button
            onClick={(e) => { e.stopPropagation(); setShowComments(!showComments); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
              showComments
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-700'
            }`}
            title="Xem & Viết bình luận"
          >
            <MessageSquare className="w-3.5 h-3.5 text-neutral-500" />
            <span>Bình luận</span>
          </button>

          {/* Nút lưu */}
          <button
            onClick={(e) => { e.stopPropagation(); handleToggleSave(); }}
            disabled={bookmarking}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
              isBookmarked
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-700'
            }`}
            title={isBookmarked ? "Bỏ lưu Prompt" : "Lưu Prompt vào bộ sưu tập"}
          >
            {isBookmarked ? (
              <>
                <BookmarkCheck className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                <span>Đã lưu</span>
              </>
            ) : (
              <>
                <Bookmark className="w-3.5 h-3.5 text-neutral-500" />
                <span>Lưu Prompt</span>
              </>
            )}
          </button>

          {/* Báo cáo vi phạm */}
          <button
            onClick={(e) => { e.stopPropagation(); setIsReportOpen(true); }}
            className="flex items-center justify-center p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-red-500 border border-neutral-200 dark:border-neutral-700 transition-all"
            title="Báo cáo vi phạm"
          >
            <Flag className="w-3.5 h-3.5" />
          </button>

          {/* Sao chép nhanh */}
          <button
            onClick={(e) => { e.stopPropagation(); handleQuickCopy(); }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-black dark:bg-white text-white dark:text-black hover:opacity-90 transition-all rounded-xl text-xs font-bold shadow-sm"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-600" />
                <span>Đã sao chép</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Sao chép nhanh</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Shared Comment System for Prompt */}
      {showComments && (
        <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800/80 animate-fade-in">
          <CommentSection
            targetId={prompt.id}
            targetType="PROMPT"
            targetTitle={prompt.name}
            targetOwnerId={prompt.authorId}
          />
        </div>
      )}

      <ReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        targetType="PROMPT"
        targetId={prompt.id}
        targetName={prompt.name}
      />
    </div>
  );
}
