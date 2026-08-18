import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Globe, MessageSquare, Heart, ThumbsUp, Smile, Frown, Angry, Sparkles, 
  Trash2, Edit3, CornerDownRight, Send, ShieldAlert, ArrowRight, Check, X, MoreVertical, Flag
} from 'lucide-react';
import { 
  doc, updateDoc, deleteDoc, collection, addDoc, getDocs, query, where, orderBy, serverTimestamp 
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/useAuthStore';
import CommentSection from '../comments/CommentSection';
import ReportModal from '../ReportModal';
import UserBadge from '../UserBadge';
import toast from 'react-hot-toast';

export interface FeedbackItem {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  recipientId: string;
  recipientName: string;
  recipientAvatar: string;
  mode: 'PUBLIC' | 'PRIVATE';
  title?: string;
  content: string;
  images?: string[];
  reactions?: Record<string, string>; // userId -> reactionType ('like'|'love'|'haha'|'wow'|'sad'|'angry')
  reactionsCount?: number;
  commentsCount?: number;
  createdAt?: any;
  updatedAt?: any;
  deletedAt?: string | null;
}

interface CommentItem {
  id: string;
  targetId: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  parentId?: string | null;
  content: string;
  createdAt?: any;
  deletedAt?: string | null;
}

const REACTION_ICONS: Record<string, { label: string; emoji: string }> = {
  like: { label: 'Thích', emoji: '👍' },
  love: { label: 'Yêu thích', emoji: '❤️' },
  haha: { label: 'Haha', emoji: '😆' },
  wow: { label: 'Wow', emoji: '😮' },
  sad: { label: 'Buồn', emoji: '😢' },
  angry: { label: 'Phẫn nộ', emoji: '😡' }
};

interface PublicFeedbackCardProps {
  key?: React.Key;
  feedback: FeedbackItem;
  onUpdate?: () => void;
  onDelete?: (id: string) => void;
}

export default function PublicFeedbackCard({
  feedback,
  onUpdate,
  onDelete
}: PublicFeedbackCardProps) {
  const navigate = useNavigate();
  const { user, firebaseUser } = useAuthStore();

  const currentUserId = user?.id || user?.uid || firebaseUser?.uid;
  const isSender = Boolean(currentUserId && currentUserId === feedback.senderId);
  const isRecipient = Boolean(currentUserId && currentUserId === feedback.recipientId);
  const isAdmin = user?.role === 'ADMIN';
  const isStaff = user?.role === 'ADMIN' || user?.role === 'MODERATOR' || user?.role === 'MOD';

  const [isDeleted, setIsDeleted] = useState(false);

  // Edit State for Post
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(feedback.title || '');
  const [editContent, setEditContent] = useState(feedback.content || '');
  const [savingEdit, setSavingEdit] = useState(false);

  // Reaction State
  const reactionsMap = feedback.reactions || {};
  const myReaction = currentUserId ? reactionsMap[currentUserId] : null;
  const reactionsList = Object.values(reactionsMap);
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  // Comments State
  const [showComments, setShowComments] = useState(false);

  // Report State
  const [isReportOpen, setIsReportOpen] = useState(false);

  if (isDeleted) {
    return null;
  }

  // Handle Reaction Selection
  const handleReaction = async (reactionType: string) => {
    if (!user) {
      toast.error("Vui lòng đăng nhập để thả cảm xúc!");
      return;
    }

    setShowReactionPicker(false);

    try {
      const updatedReactions = { ...reactionsMap };

      if (updatedReactions[user.id] === reactionType) {
        // Toggle off if clicking the same reaction
        delete updatedReactions[user.id];
      } else {
        updatedReactions[user.id] = reactionType;
      }

      const totalCount = Object.keys(updatedReactions).length;

      const fbRef = doc(db, 'feedbacks', feedback.id);
      await updateDoc(fbRef, {
        reactions: updatedReactions,
        reactionsCount: totalCount
      });

      // Send notification to sender if it's someone else reacting
      if (feedback.senderId !== user.id) {
        await addDoc(collection(db, 'notifications'), {
          userId: feedback.senderId,
          senderId: user.id,
          type: 'FEEDBACK',
          title: 'Cảm xúc mới trên Feedback',
          message: `${user.displayName} đã thả cảm xúc ${REACTION_ICONS[reactionType]?.emoji || ''} vào Feedback của bạn.`,
          link: '/feedbacks',
          read: false,
          createdAt: serverTimestamp()
        });
      }

      if (onUpdate) onUpdate();
    } catch (err) {
      console.error("Lỗi khi thả cảm xúc:", err);
      toast.error("Thao tác thất bại.");
    }
  };

  // Save edited feedback post
  const handleSavePostEdit = async () => {
    if (!editContent.trim()) {
      toast.error("Nội dung không được để trống!");
      return;
    }

    setSavingEdit(true);
    try {
      const fbRef = doc(db, 'feedbacks', feedback.id);
      await updateDoc(fbRef, {
        title: editTitle.trim(),
        content: editContent.trim(),
        updatedAt: serverTimestamp()
      });

      toast.success("Đã cập nhật bài đăng Feedback.");
      setIsEditing(false);
      if (onUpdate) onUpdate();
    } catch (err) {
      toast.error("Lỗi khi cập nhật bài đăng.");
    } finally {
      setSavingEdit(false);
    }
  };

  // Delete post (sender or admin)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDeletePost = async () => {
    try {
      const fbRef = doc(db, 'feedbacks', feedback.id);
      await updateDoc(fbRef, { 
        deletedAt: new Date().toISOString(),
        deletedBy: user?.id,
        deleteReason: isStaff && user?.id !== feedback.senderId ? "Nội dung vi phạm quy chuẩn cộng đồng" : null
      });

      // Send notification to author if deleted by staff
      if (isStaff && feedback.senderId !== user?.id) {
        await addDoc(collection(db, 'notifications'), {
          userId: feedback.senderId,
          recipientId: feedback.senderId,
          senderId: user?.id,
          senderName: "Hệ thống Quản trị",
          senderAvatar: "https://api.dicebear.com/7.x/bottts/svg?seed=admin",
          type: 'SYSTEM',
          title: 'Nội dung không còn tồn tại',
          message: `Feedback của bạn đã bị xóa bởi Quản trị viên. Lý do: Nội dung vi phạm quy chuẩn cộng đồng.`,
          targetId: feedback.id,
          targetType: 'FEEDBACK',
          read: false,
          createdAt: new Date().toISOString()
        });
      }

      setIsDeleted(true);
      toast.success("Đã xóa Feedback thành công.");
      if (onDelete) onDelete(feedback.id);
    } catch (err) {
      console.error("Lỗi khi xóa document Feedback:", err);
      toast.error("Lỗi khi xóa Feedback.");
    } finally {
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow space-y-4">
      {/* Header: Sender -> Recipient */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Sender */}
          <div 
            onClick={() => navigate(`/creator/${feedback.senderId}`)}
            className="flex items-center gap-2 cursor-pointer group"
          >
            <img
              src={feedback.senderAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${feedback.senderId}`}
              alt={feedback.senderName}
              className="w-10 h-10 rounded-full border border-neutral-200 dark:border-neutral-800 object-cover group-hover:scale-105 transition-transform"
            />
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-extrabold text-sm text-neutral-900 dark:text-neutral-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 group-hover:underline">
                  {feedback.senderName}
                </span>
                <UserBadge subject={{ commentCount: 1 }} size="xs" />
                {isSender && (
                  <span className="px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-[10px] font-bold text-neutral-500 rounded">
                    Bạn
                  </span>
                )}
              </div>
            </div>
          </div>

          <ArrowRight className="w-4 h-4 text-neutral-400 shrink-0" />

          {/* Recipient */}
          <div 
            onClick={() => navigate(`/creator/${feedback.recipientId}`)}
            className="flex items-center gap-2 cursor-pointer group"
          >
            <img
              src={feedback.recipientAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${feedback.recipientId}`}
              alt={feedback.recipientName}
              className="w-8 h-8 rounded-full border border-neutral-200 dark:border-neutral-800 object-cover group-hover:scale-105 transition-transform"
            />
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-xs text-neutral-700 dark:text-neutral-300 group-hover:text-amber-600 dark:group-hover:text-amber-400 group-hover:underline">
                  @{feedback.recipientName}
                </span>
                <UserBadge subject={{ creatorStatus: true }} size="xs" />
                {isRecipient && (
                  <span className="px-1.5 py-0.5 bg-indigo-500/10 text-[10px] font-bold text-indigo-500 rounded">
                    Người nhận
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Badge & Actions Menu */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 rounded-full text-[10px] font-bold">
            <Globe className="w-3 h-3" />
            <span>Công Khai</span>
          </span>

          {(isSender || isStaff) && (
            <div className="flex items-center gap-1">
              {isSender && !isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 hover:text-black dark:hover:text-white"
                  title="Chỉnh sửa bài đăng"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-red-500 hover:text-red-600 transition-colors"
                title="Xóa bài đăng"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Report Button */}
          {user && !isSender && (
            <button
              onClick={() => setIsReportOpen(true)}
              className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-neutral-500 hover:text-red-500 transition-colors"
              title="Báo cáo bài đăng"
            >
              <Flag className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {isEditing ? (
        <div className="space-y-3 bg-neutral-50 dark:bg-neutral-800/50 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-700">
          <input
            type="text"
            placeholder="Tiêu đề..."
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            className="w-full px-3 py-1.5 text-xs font-bold rounded-lg bg-white dark:bg-neutral-900 border focus:outline-none"
          />
          <textarea
            rows={4}
            value={editContent}
            onChange={e => setEditContent(e.target.value)}
            className="w-full p-3 text-xs rounded-lg bg-white dark:bg-neutral-900 border focus:outline-none resize-none"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setIsEditing(false)}
              className="px-3 py-1.5 text-xs font-bold rounded-lg border hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              Hủy
            </button>
            <button
              onClick={handleSavePostEdit}
              disabled={savingEdit}
              className="px-4 py-1.5 text-xs font-bold rounded-lg bg-black dark:bg-white text-white dark:text-black"
            >
              {savingEdit ? 'Đang lưu...' : 'Lưu bài đăng'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {feedback.title && (
            <h4 className="font-extrabold text-base text-neutral-900 dark:text-neutral-100">
              {feedback.title}
            </h4>
          )}
          <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed whitespace-pre-wrap">
            {feedback.content}
          </p>
          {feedback.images && feedback.images.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-2">
              {feedback.images.map((imgUrl, idx) => (
                <a key={idx} href={imgUrl} target="_blank" rel="noopener noreferrer" className="aspect-video rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-800 group">
                  <img src={imgUrl} alt={`Ảnh đính kèm ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Timestamp */}
      <div className="text-[10px] text-neutral-400 font-medium">
        {feedback.createdAt?.toDate ? feedback.createdAt.toDate().toLocaleString('vi-VN') : 'Mới đăng'}
      </div>

      {/* Reactions Display Bar & Counts */}
      <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-xs text-neutral-500">
        <div className="flex items-center gap-1.5">
          {reactionsList.length > 0 && (
            <div className="flex items-center -space-x-1">
              {Array.from(new Set(reactionsList)).map(rType => (
                <span key={rType} className="text-sm bg-neutral-100 dark:bg-neutral-800 rounded-full p-0.5 shadow-sm">
                  {REACTION_ICONS[rType]?.emoji || '👍'}
                </span>
              ))}
            </div>
          )}
          <span className="font-bold text-neutral-800 dark:text-neutral-200">
            {feedback.reactionsCount || reactionsList.length || 0}
          </span>
          <span className="text-[11px]">lượt cảm xúc</span>
        </div>

        <button
          onClick={() => setShowComments(!showComments)}
          className="hover:text-black dark:hover:text-white font-semibold transition-colors flex items-center gap-1 text-[11px]"
        >
          <span>{feedback.commentsCount || 0} bình luận</span>
        </button>
      </div>

      {/* Actions Bar: Reaction Button & Comment Toggle Button */}
      <div className="pt-1 flex items-center gap-2 border-t border-neutral-100 dark:border-neutral-800 relative">
        {/* Reaction Trigger Button with Hover Picker */}
        <div className="relative">
          <button
            onClick={() => setShowReactionPicker(!showReactionPicker)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${
              myReaction
                ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30'
                : 'bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300'
            }`}
          >
            <span>{myReaction ? REACTION_ICONS[myReaction]?.emoji : '👍'}</span>
            <span>{myReaction ? REACTION_ICONS[myReaction]?.label : 'Thả cảm xúc'}</span>
          </button>

          {/* Emoji Selector Popup */}
          {showReactionPicker && (
            <div className="absolute left-0 bottom-full mb-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-2 shadow-xl flex items-center gap-2 z-20 animate-scale-up">
              {Object.entries(REACTION_ICONS).map(([key, item]) => (
                <button
                  key={key}
                  onClick={() => handleReaction(key)}
                  className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-xl text-lg transition-transform hover:scale-125"
                  title={item.label}
                >
                  {item.emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Toggle Comments Button */}
        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-xs font-bold text-neutral-600 dark:text-neutral-300 transition-colors"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Bình luận</span>
        </button>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800 animate-fade-in">
          <CommentSection
            targetId={feedback.id}
            targetType="FEEDBACK"
            targetTitle={feedback.title || "Feedback"}
            targetOwnerId={feedback.senderId}
          />
        </div>
      )}

      {isReportOpen && (
        <ReportModal
          isOpen={isReportOpen}
          onClose={() => setIsReportOpen(false)}
          targetType="FEEDBACK"
          targetId={feedback.id}
          targetName={feedback.title || `Feedback của ${feedback.senderName}`}
        />
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-neutral-200 dark:border-neutral-800">
            <h3 className="text-xl font-extrabold text-neutral-900 dark:text-neutral-100 mb-2">
              Xóa Feedback?
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
              Bạn có chắc chắn muốn xóa Feedback này không? Hành động này không thể hoàn tác và Feedback sẽ lập tức biến mất khỏi hệ thống.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleDeletePost}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-red-500 hover:bg-red-600 text-white transition-colors"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
