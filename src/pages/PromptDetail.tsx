import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  Copy, Check, Bookmark, BookmarkCheck, ArrowLeft, Flag, AlertCircle, Eye, MessageSquare, Sparkles, Trash2, Edit3, Link as LinkIcon, Image as ImageIcon, FileText, ExternalLink 
} from 'lucide-react';
import { doc, getDoc, updateDoc, increment, collection, addDoc, query, where, getDocs, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { PromptItem } from '../types';
import { useSeo } from '../hooks/useSeo';
import CommentSection from '../components/comments/CommentSection';
import ReportModal from '../components/ReportModal';
import CreatePromptModal from '../components/profile/CreatePromptModal';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import DisplayId from '../components/DisplayId';
import { getValidAvatar } from '../lib/avatar';
import toast from 'react-hot-toast';

export default function PromptDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [prompt, setPrompt] = useState<PromptItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [copied, setCopied] = useState(false);
  const [copyCount, setCopyCount] = useState(0);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [savesCount, setSavesCount] = useState(0);
  const [viewsCount, setViewsCount] = useState(0);

  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  useSeo({
    title: prompt?.name || prompt?.title,
    description: prompt?.purpose,
    image: prompt?.authorAvatar,
    type: 'article'
  });

  const fetchPrompt = async () => {
    if (!id) return;
    setLoading(true);
    setError(false);

    try {
      const docRef = doc(db, 'prompts', id);
      const snap = await getDoc(docRef);

      if (!snap.exists()) {
        setError(true);
        return;
      }

      const data = snap.data();
      if (data.deletedAt) {
        setError(true);
        return;
      }

      const item = { id: snap.id, ...data } as PromptItem;
      setPrompt(item);
      setCopyCount(item.copyCount || 0);
      setSavesCount(item.savesCount || 0);

      // Requirement 18 & 19: View count with throttle
      const storageKey = `vviewed_prompt_${id}`;
      const lastViewed = localStorage.getItem(storageKey);
      const now = Date.now();
      const throttleTime = 5 * 60 * 1000; // 5 minutes

      if (!lastViewed || (now - parseInt(lastViewed, 10)) > throttleTime) {
        setViewsCount((item.viewsCount || 0) + 1);
        localStorage.setItem(storageKey, now.toString());
        try {
          await updateDoc(docRef, { viewsCount: increment(1) });
        } catch (e) {
          console.error("View count update error:", e);
        }
      } else {
        setViewsCount(item.viewsCount || 0);
      }

      // Set page title
      document.title = `${item.name || item.title || 'Prompt'} - Prompt AI Studio | Thế giới nhập vai_AD`;
    } catch (err) {
      console.error("Fetch prompt detail error:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.id || !id) return;

    const checkBookmark = async () => {
      try {
        const q = query(
          collection(db, 'bookmarks'),
          where('userId', '==', user.id),
          where('targetId', '==', id),
          where('targetType', '==', 'PROMPT')
        );
        const snap = await getDocs(q);
        setIsBookmarked(!snap.empty);
      } catch (e) {
        console.error("Check bookmark error:", e);
      }
    };

    checkBookmark();
  }, [user?.id, id]);

  useEffect(() => {
    fetchPrompt();
  }, [id]);

  const handleQuickCopy = async () => {
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt.content);
      setCopied(true);
      toast.success("Đã sao chép Prompt vào khay nhớ tạm!");

      const promptRef = doc(db, 'prompts', prompt.id);
      await updateDoc(promptRef, { copyCount: increment(1) });
      setCopyCount(prev => prev + 1);

      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
      toast.error("Không thể sao chép nội dung.");
    }
  };

  const handleToggleSave = async () => {
    if (!user) {
      toast.error("Vui lòng đăng nhập để lưu Prompt!");
      return;
    }
    if (!prompt) return;

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
        for (const bDoc of snap.docs) {
          await deleteDoc(doc(db, 'bookmarks', bDoc.id));
        }
        await updateDoc(promptRef, { savesCount: increment(-1) });
        setIsBookmarked(false);
        setSavesCount(prev => Math.max(0, prev - 1));
        toast.success("Đã bỏ lưu Prompt.");
      } else {
        await addDoc(collection(db, 'bookmarks'), {
          userId: user.id,
          targetId: prompt.id,
          targetType: 'PROMPT',
          createdAt: serverTimestamp()
        });
        await updateDoc(promptRef, { savesCount: increment(1) });
        setIsBookmarked(true);
        setSavesCount(prev => prev + 1);
        toast.success("Đã lưu Prompt vào bộ sưu tập!");
      }
    } catch (err) {
      console.error(err);
      toast.error("Thao tác lưu thất bại.");
    }
  };

  const isOwnerOrAdmin = Boolean(
    user && (
      user.id === prompt?.authorId || 
      user.role === 'ADMIN' || 
      user.role === 'MODERATOR' || 
      user.role === 'MOD'
    )
  );

  const handleDeletePrompt = async () => {
    if (!prompt) return;
    setIsDeleteConfirmOpen(true);
  };

  const executeDeletePrompt = async () => {
    if (!prompt) return;

    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'prompts', prompt.id));
      toast.success("Đã xóa hoàn toàn Prompt khỏi hệ thống!");
      navigate('/prompts');
    } catch (err) {
      console.error("Delete prompt error:", err);
      toast.error("Không thể xóa Prompt. Vui lòng thử lại.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-6">
        <div className="h-8 w-32 bg-neutral-200 dark:bg-neutral-800 rounded-xl animate-pulse" />
        <div className="h-80 bg-neutral-100 dark:bg-neutral-800 rounded-3xl animate-pulse" />
      </div>
    );
  }

  if (error || !prompt) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-16 h-16 bg-red-50 dark:bg-red-950/40 text-red-500 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
          Nội dung này không còn khả dụng
        </h2>
        <p className="text-neutral-500 text-sm max-w-md mx-auto">
          Prompt này có thể đã bị tác giả xoá hoặc không tồn tại.
        </p>
        <button
          onClick={() => navigate('/prompts')}
          className="mt-4 px-6 py-2.5 rounded-2xl bg-black dark:bg-white text-white dark:text-black font-bold text-sm hover:opacity-90 transition-opacity"
        >
          Khám phá Prompt khác
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 animate-fade-in">
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-xs font-bold text-neutral-500 hover:text-black dark:hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Quay lại</span>
      </button>

      {/* Main Prompt Card */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-neutral-100 dark:border-neutral-800">
          <div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-extrabold text-neutral-900 dark:text-neutral-100">
              {prompt.name || prompt.title}
            </h1>
            <div className="mt-2">
              <DisplayId type="prompt" numericId={prompt.numericId} />
            </div>

            <div className="flex items-center gap-3 text-xs text-neutral-500">
              <img 
                src={getValidAvatar(prompt.authorAvatar)} 
                alt={prompt.authorName} 
                className="w-6 h-6 rounded-full object-cover border border-neutral-200 dark:border-neutral-700"
              />
              <span>Tác giả: <Link to={`/creator/${prompt.authorId}`} className="font-bold text-neutral-800 dark:text-neutral-200 hover:underline">{prompt.authorName || 'Ẩn danh'}</Link></span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isOwnerOrAdmin && (
              <>
                <button
                  onClick={() => setIsEditModalOpen(true)}
                  className="px-3.5 py-3 md:py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                  title="Chỉnh sửa Prompt"
                >
                  <Edit3 className="w-4 h-4 text-indigo-500" />
                  <span>Sửa</span>
                </button>

                <button
                  onClick={handleDeletePrompt}
                  disabled={isDeleting}
                  className="px-3.5 py-3 md:py-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/60 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                  title="Xóa Prompt"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Xóa</span>
                </button>
              </>
            )}

            <button
              onClick={() => setIsReportOpen(true)}
              className="p-3 md:p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:text-red-500 transition-colors"
              title="Báo cáo vi phạm"
            >
              <Flag className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Purpose */}
        <div>
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-neutral-400 mb-2">
            Mục đích
          </h3>
          <p className="text-sm text-neutral-800 dark:text-neutral-200 font-medium">
            {prompt.purpose}
          </p>
        </div>

        {/* Reference Links */}
        {prompt.referenceLinks && prompt.referenceLinks.length > 0 && (
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-neutral-400 mb-2 flex items-center gap-1.5">
              <LinkIcon className="w-3.5 h-3.5 text-amber-500" /> Link tham khảo
            </h3>
            <div className="flex flex-col gap-2">
              {prompt.referenceLinks.map((link, idx) => (
                <a
                  key={idx}
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-800 p-2.5 rounded-xl w-fit max-w-full truncate"
                >
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{link}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Illustration Images */}
        {prompt.images && prompt.images.length > 0 && (
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-neutral-400 mb-2 flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-amber-500" /> Hình ảnh minh họa & Giao diện
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {prompt.images.map((imgUrl, idx) => (
                <div key={idx} className="rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-800 group aspect-video">
                  <a href={imgUrl} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
                    <img
                      src={imgUrl}
                      alt={`Minh họa ${idx + 1}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Content Code Box */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-neutral-400">
              Nội dung Prompt (System Instructions)
            </h3>
            <button
              onClick={handleQuickCopy}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copied ? "Đã sao chép!" : "Sao chép nhanh"}</span>
            </button>
          </div>
          <div className="p-5 bg-neutral-50 dark:bg-neutral-800/60 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 font-mono text-xs md:text-sm text-neutral-800 dark:text-neutral-200 leading-relaxed whitespace-pre-wrap selection:bg-amber-500 selection:text-white">
            {prompt.content}
          </div>
        </div>

        {/* Notes */}
        {prompt.notes && (
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-neutral-400 mb-2 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-amber-500" /> Ghi chú thêm
            </h3>
            <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl text-xs md:text-sm text-neutral-800 dark:text-neutral-200 leading-relaxed whitespace-pre-wrap font-medium">
              {prompt.notes}
            </div>
          </div>
        )}

        {/* Tags */}
        {prompt.tags && prompt.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {prompt.tags.map(t => (
              <span key={t} className="px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-xs font-medium text-neutral-600 dark:text-neutral-400">
                #{t}
              </span>
            ))}
          </div>
        )}

        {/* Bottom Interactive Bar */}
        <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-xs font-medium text-neutral-500">
            <span className="flex items-center gap-1.5"><Eye className="w-4 h-4 text-neutral-400" /> <strong className="text-neutral-900 dark:text-neutral-100">{viewsCount}</strong> lượt xem</span>
            <span className="flex items-center gap-1.5"><Copy className="w-4 h-4 text-blue-500" /> <strong className="text-neutral-900 dark:text-neutral-100">{copyCount}</strong> lượt sao chép</span>
            <span className="flex items-center gap-1.5"><Bookmark className="w-4 h-4 text-amber-500" /> <strong className="text-neutral-900 dark:text-neutral-100">{savesCount}</strong> lượt lưu</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleSave}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                isBookmarked
                  ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-600 dark:text-amber-400'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-200'
              }`}
            >
              {isBookmarked ? <BookmarkCheck className="w-4 h-4 text-amber-500 fill-amber-500" /> : <Bookmark className="w-4 h-4" />}
              <span>{isBookmarked ? 'Đã lưu' : 'Lưu Prompt'}</span>
            </button>

            <button
              onClick={handleQuickCopy}
              className="px-5 py-2.5 bg-black dark:bg-white text-white dark:text-black hover:opacity-90 transition-all rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? "Đã sao chép!" : "Sao chép Prompt"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Comment Section */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 md:p-8 shadow-sm">
        <h2 className="text-lg font-bold mb-6 text-neutral-900 dark:text-neutral-100">
          Thảo luận về Prompt
        </h2>
        <CommentSection
          targetId={prompt.id}
          targetType="PROMPT"
          targetTitle={prompt.name || prompt.title || 'Prompt'}
          targetOwnerId={prompt.authorId}
        />
      </div>

      {/* Report Modal */}
      <ReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        targetType="PROMPT"
        targetId={prompt.id}
        targetName={prompt.name || prompt.title || 'Prompt'}
      />

      {/* Edit Prompt Modal */}
      <CreatePromptModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={fetchPrompt}
        promptToEdit={prompt}
      />

      {/* Delete Prompt Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        title="Xóa hoàn toàn Prompt?"
        description="Bạn có chắc chắn muốn xóa hoàn toàn Prompt này không? Hành động này không thể hoàn tác và Prompt sẽ biến mất ngay lập tức khỏi hệ thống."
        onConfirm={async () => {
          setIsDeleteConfirmOpen(false);
          await executeDeletePrompt();
        }}
      />
    </div>
  );
}
