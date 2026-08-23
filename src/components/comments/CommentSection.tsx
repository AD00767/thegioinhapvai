import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  MessageSquare, Send, Trash2, Edit3, CornerDownRight, Smile, Heart, ThumbsUp, Frown, Angry, Sparkles, Check, X, ShieldAlert 
} from 'lucide-react';
import { 
  collection, query, where, orderBy, getDocs, addDoc, doc, updateDoc, serverTimestamp, increment 
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/useAuthStore';
import ReportModal from '../ReportModal';
import UserBadge from '../UserBadge';
import DeleteConfirmModal from '../DeleteConfirmModal';
import { getValidAvatar, DEFAULT_AVATAR } from '../../lib/avatar';
import { enforceActivityCheck } from '../../lib/restrictions';
import toast from 'react-hot-toast';

export interface CommentItem {
  id: string;
  targetId: string;
  targetType?: 'CHARACTER' | 'PROMPT' | 'FEEDBACK' | string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  parentId?: string | null;
  content: string;
  reactions?: Record<string, string>; // userId -> reactionType
  createdAt?: any;
  updatedAt?: any;
  deletedAt?: string | null;
  deletedBy?: string | null;
}

const REACTION_ICONS: Record<string, { label: string; emoji: string }> = {
  like: { label: 'Thích', emoji: '👍' },
  love: { label: 'Yêu thích', emoji: '❤️' },
  haha: { label: 'Haha', emoji: '😆' },
  wow: { label: 'Wow', emoji: '😮' },
  sad: { label: 'Buồn', emoji: '😢' },
  angry: { label: 'Phẫn nộ', emoji: '😡' }
};

interface CommentSectionProps {
  targetId: string;
  targetType: 'CHARACTER' | 'PROMPT' | 'FEEDBACK' | string;
  targetTitle?: string;
  targetOwnerId?: string;
  className?: string;
}

interface CommentNodeProps {
  comment: CommentItem;
  allComments: CommentItem[];
  depth: number;
  user: any;
  isStaff: boolean;
  targetOwnerId?: string;
  replyingToId: string | null;
  setReplyingToId: (id: string | null) => void;
  newCommentText: string;
  setNewCommentText: (text: string) => void;
  handleAddComment: (parentId?: string | null, parentAuthorName?: string) => void;
  editingCommentId: string | null;
  setEditingCommentId: (id: string | null) => void;
  editingCommentText: string;
  setEditingCommentText: (text: string) => void;
  handleSaveCommentEdit: (id: string) => void;
  activeReactionPickerId: string | null;
  setActiveReactionPickerId: (id: string | null) => void;
  handleCommentReaction: (comment: CommentItem, reactionKey: string) => void;
  handleDeleteComment: (id: string) => void;
  setSelectedCommentForReport: (comment: CommentItem) => void;
  setIsReportOpen: (open: boolean) => void;
  navigate: any;
}

function CommentNode({
  comment,
  allComments,
  depth,
  user,
  isStaff,
  targetOwnerId,
  replyingToId,
  setReplyingToId,
  newCommentText,
  setNewCommentText,
  handleAddComment,
  editingCommentId,
  setEditingCommentId,
  editingCommentText,
  setEditingCommentText,
  handleSaveCommentEdit,
  activeReactionPickerId,
  setActiveReactionPickerId,
  handleCommentReaction,
  handleDeleteComment,
  setSelectedCommentForReport,
  setIsReportOpen,
  navigate
}: CommentNodeProps) {
  const isDeleted = !!comment.deletedAt;
  const childReplies = allComments.filter(c => c.parentId === comment.id);

  // If this comment is deleted and has no replies, do not render it
  if (isDeleted && childReplies.length === 0) {
    return null;
  }

  const isModeratorRemoval = isDeleted && comment.deletedBy && comment.deletedBy !== comment.authorId;
  const isCommentAuthor = user?.id === comment.authorId;
  const reactionsObj = comment.reactions || {};
  const reactionsList = Object.values(reactionsObj) as string[];
  const myReaction = user ? reactionsObj[user.id] : null;

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2.5 text-xs">
        <img
          onClick={() => {
            if (!isDeleted) navigate(`/creator/${comment.authorId}`);
          }}
          src={isDeleted ? DEFAULT_AVATAR : getValidAvatar(comment.authorAvatar)}
          alt={isDeleted ? "Ẩn danh" : comment.authorName}
          className={`w-7 h-7 rounded-full border border-neutral-200 dark:border-neutral-700 shrink-0 object-cover mt-0.5 ${!isDeleted ? 'cursor-pointer hover:scale-105 transition-transform' : ''}`}
        />
        <div className="flex-1 space-y-1">
          <div className="bg-neutral-100 dark:bg-neutral-800/90 p-3 rounded-2xl inline-block max-w-full relative group">
            <div className="flex flex-wrap items-center gap-1.5">
              <span 
                onClick={() => {
                  if (!isDeleted) navigate(`/creator/${comment.authorId}`);
                }}
                className={`font-extrabold text-neutral-900 dark:text-neutral-100 text-xs ${!isDeleted ? 'cursor-pointer hover:text-amber-600 dark:hover:text-amber-400 hover:underline' : 'opacity-60'}`}
              >
                {isDeleted ? (isModeratorRemoval ? '[Đã ẩn]' : 'Ẩn danh') : comment.authorName}
              </span>
              {!isDeleted && <UserBadge subject={{ commentCount: 1 }} size="xs" />}
              {!isDeleted && targetOwnerId === comment.authorId && (
                <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded text-[9px] font-extrabold">
                  Tác giả
                </span>
              )}
            </div>

            {isDeleted ? (
              <p className="text-neutral-400 dark:text-neutral-500 mt-1 italic leading-relaxed text-xs">
                {isModeratorRemoval ? '[Bình luận bị ẩn do vi phạm]' : '[Bình luận đã bị xóa]'}
              </p>
            ) : editingCommentId === comment.id ? (
              <div className="mt-2 space-y-2 min-w-[240px]">
                <input
                  type="text"
                  value={editingCommentText}
                  onChange={e => setEditingCommentText(e.target.value)}
                  className="w-full p-2 text-xs rounded-xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 focus:outline-none"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setEditingCommentId(null)}
                    className="px-2.5 py-1 text-[11px] font-semibold text-neutral-500 hover:text-black dark:hover:text-white"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={() => handleSaveCommentEdit(comment.id)}
                    className="px-3 py-1 text-[11px] font-bold bg-black dark:bg-white text-white dark:text-black rounded-lg"
                  >
                    Lưu
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-neutral-700 dark:text-neutral-300 mt-1 leading-relaxed whitespace-pre-wrap">
                {comment.content}
              </p>
            )}

            {!isDeleted && reactionsList.length > 0 && (
              <div className="absolute -bottom-2 right-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-full px-1.5 py-0.5 shadow-sm flex items-center gap-1 text-[10px]">
                {Array.from(new Set(reactionsList)).map(rKey => (
                  <span key={rKey}>{REACTION_ICONS[rKey]?.emoji || '👍'}</span>
                ))}
                <span className="font-bold text-neutral-700 dark:text-neutral-300 ml-0.5">
                  {reactionsList.length}
                </span>
              </div>
            )}
          </div>

          {isDeleted ? (
            <div className="flex items-center gap-3 text-[10px] text-neutral-400 px-1 font-semibold pt-0.5">
              <span className="text-[10px] text-neutral-400 font-normal">
                {comment.createdAt?.toDate ? comment.createdAt.toDate().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : ''}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-[10px] text-neutral-400 px-1 font-semibold pt-0.5">
              <div className="relative">
                <button
                  onClick={() => {
                    if (myReaction) {
                      handleCommentReaction(comment, myReaction);
                    } else {
                      setActiveReactionPickerId(activeReactionPickerId === comment.id ? null : comment.id);
                    }
                  }}
                  className={`hover:text-amber-500 transition-colors flex items-center gap-1 ${
                    myReaction ? 'text-amber-500 font-bold' : ''
                  }`}
                >
                  <span>{myReaction ? REACTION_ICONS[myReaction]?.emoji : 'Thích'}</span>
                </button>

                {activeReactionPickerId === comment.id && (
                  <div className="absolute left-0 bottom-full mb-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-1.5 shadow-xl flex items-center gap-1 z-30">
                    {Object.entries(REACTION_ICONS).map(([rKey, rItem]) => (
                      <button
                        key={rKey}
                        onClick={() => handleCommentReaction(comment, rKey)}
                        className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-xl text-base transition-transform hover:scale-125"
                        title={rItem.label}
                      >
                        {rItem.emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {user ? (
                <button
                  onClick={() => {
                    setReplyingToId(replyingToId === comment.id ? null : comment.id);
                    setNewCommentText('');
                  }}
                  className="hover:text-black dark:hover:text-white transition-colors"
                >
                  Trả lời
                </button>
              ) : (
                <button
                  onClick={() => toast.error("Vui lòng đăng nhập bằng Google để trả lời!")}
                  className="hover:text-black dark:hover:text-white transition-colors opacity-70"
                >
                  Trả lời
                </button>
              )}

              {isCommentAuthor && (
                <button
                  onClick={() => {
                    setEditingCommentId(comment.id);
                    setEditingCommentText(comment.content);
                  }}
                  className="hover:text-black dark:hover:text-white transition-colors"
                >
                  Sửa
                </button>
              )}

              {(isCommentAuthor || isStaff) && (
                <button
                  onClick={() => handleDeleteComment(comment.id)}
                  className="hover:text-red-500 transition-colors"
                >
                  Xóa
                </button>
              )}

              {!isCommentAuthor && (
                <button
                  onClick={() => {
                    setSelectedCommentForReport(comment);
                    setIsReportOpen(true);
                  }}
                  className="hover:text-red-500 transition-colors"
                >
                  Báo cáo
                </button>
              )}

              <span className="text-[10px] text-neutral-400 font-normal">
                {comment.createdAt?.toDate ? comment.createdAt.toDate().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : ''}
              </span>
            </div>
          )}
        </div>
      </div>

      {replyingToId === comment.id && (
        <div className="ml-6 sm:ml-8 pl-3 border-l-2 border-neutral-200 dark:border-neutral-700 flex items-center gap-2 pt-1 animate-fade-in">
          <CornerDownRight className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
          <input
            type="text"
            placeholder={`Trả lời @${comment.authorName}...`}
            value={newCommentText}
            onChange={e => setNewCommentText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddComment(comment.id, comment.authorName);
              }
            }}
            className="flex-1 px-3.5 py-1.5 text-xs rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none"
          />
          <button
            onClick={() => handleAddComment(comment.id, comment.authorName)}
            className="px-3 py-1.5 rounded-xl bg-black dark:bg-white text-white dark:text-black text-xs font-bold shrink-0"
          >
            Gửi
          </button>
        </div>
      )}

      {childReplies.length > 0 && (
        <div className="space-y-3 pt-1 ml-4 sm:ml-6 pl-2.5 border-l border-neutral-200 dark:border-neutral-800/80">
          {childReplies.map(reply => (
            <CommentNode
              key={reply.id}
              comment={reply}
              allComments={allComments}
              depth={depth + 1}
              user={user}
              isStaff={isStaff}
              targetOwnerId={targetOwnerId}
              replyingToId={replyingToId}
              setReplyingToId={setReplyingToId}
              newCommentText={newCommentText}
              setNewCommentText={setNewCommentText}
              handleAddComment={handleAddComment}
              editingCommentId={editingCommentId}
              setEditingCommentId={setEditingCommentId}
              editingCommentText={editingCommentText}
              setEditingCommentText={setEditingCommentText}
              handleSaveCommentEdit={handleSaveCommentEdit}
              activeReactionPickerId={activeReactionPickerId}
              setActiveReactionPickerId={setActiveReactionPickerId}
              handleCommentReaction={handleCommentReaction}
              handleDeleteComment={handleDeleteComment}
              setSelectedCommentForReport={setSelectedCommentForReport}
              setIsReportOpen={setIsReportOpen}
              navigate={navigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CommentSection({
  targetId,
  targetType,
  targetTitle,
  targetOwnerId,
  className = ''
}: CommentSectionProps) {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';
  const isStaff = user?.role === 'ADMIN' || user?.role === 'MODERATOR' || user?.role === 'MOD';

  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);

  // New comment input state
  const [newCommentText, setNewCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reply state
  const [replyingToId, setReplyingToId] = useState<string | null>(null);

  // Edit comment state
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');

  // Reaction picker state
  const [activeReactionPickerId, setActiveReactionPickerId] = useState<string | null>(null);

  // Report states
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [selectedCommentForReport, setSelectedCommentForReport] = useState<CommentItem | null>(null);

  // Delete state
  const [commentToDelete, setCommentToDelete] = useState<string | null>(null);

  // Fetch comments for target
  const fetchComments = async () => {
    if (!targetId) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'comments'),
        where('targetId', '==', targetId),
        orderBy('createdAt', 'asc')
      );
      const snap = await getDocs(q);
      const list: CommentItem[] = [];
      snap.docs.forEach(dSnap => {
        const data = dSnap.data();
        list.push({ id: dSnap.id, ...data } as CommentItem);
      });
      setComments(list);
    } catch (err) {
      console.error("Lỗi khi tải bình luận:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [targetId]);

  // Submit comment or reply
  const handleAddComment = async (parentId?: string | null, parentAuthorName?: string) => {
    if (!user) {
      toast.error("Vui lòng đăng nhập để bình luận!");
      return;
    }

    if (!enforceActivityCheck(user, 'POST_COMMENT')) {
      return;
    }

    const trimmed = newCommentText.trim();
    if (!trimmed) {
      toast.error("Bình luận không được để trống!");
      return;
    }

    setSubmitting(true);
    try {
      const commentData = {
        targetId,
        targetType,
        authorId: user.id,
        authorName: user.displayName || 'Người dùng',
        authorAvatar: getValidAvatar(user.avatar),
        parentId: parentId || null,
        content: trimmed,
        reactions: {},
        createdAt: serverTimestamp(),
        deletedAt: null
      };

      const commentRef = await addDoc(collection(db, 'comments'), commentData);

      // Increment comments count on target collection if applicable
      try {
        const collectionName = targetType === 'CHARACTER' ? 'characters' : targetType === 'PROMPT' ? 'prompts' : 'feedbacks';
        const docRef = doc(db, collectionName, targetId);
        await updateDoc(docRef, {
          commentsCount: increment(1)
        });
      } catch (e) {
        // Ignored if field doesn't exist
      }

      // Send notification
      // Case 1: Reply to another comment author
      if (parentId) {
        const parentComment = comments.find(c => c.id === parentId);
        if (parentComment && parentComment.authorId !== user.id) {
          await addDoc(collection(db, 'notifications'), {
            recipientId: parentComment.authorId,
            userId: parentComment.authorId,
            senderId: user.id,
            senderName: user.displayName || 'Người dùng',
            senderAvatar: getValidAvatar(user.avatar),
            type: 'COMMENT',
            title: 'Phản hồi bình luận mới',
            message: `${user.displayName || 'Một người dùng'} đã trả lời bình luận của bạn: "${trimmed.slice(0, 40)}..."`,
            targetId: commentRef.id,
            targetType: 'COMMENT',
            link: `/${targetType === 'CHARACTER' ? 'character' : targetType === 'PROMPT' ? 'prompt' : 'feedbacks'}/${targetId}`,
            read: false,
            createdAt: new Date().toISOString()
          });
        }
      } 
      // Case 2: Top level comment -> Notify Target Owner/Creator
      else if (targetOwnerId && targetOwnerId !== user.id) {
        await addDoc(collection(db, 'notifications'), {
          recipientId: targetOwnerId,
          userId: targetOwnerId,
          senderId: user.id,
          senderName: user.displayName || 'Người dùng',
          senderAvatar: getValidAvatar(user.avatar),
          type: 'COMMENT',
          title: 'Bình luận mới',
          message: `${user.displayName || 'Một người dùng'} đã bình luận bài viết của bạn: "${trimmed.slice(0, 40)}..."`,
          targetId: commentRef.id,
          targetType: 'COMMENT',
          link: `/${targetType === 'CHARACTER' ? 'character' : targetType === 'PROMPT' ? 'prompt' : 'feedbacks'}/${targetId}`,
          read: false,
          createdAt: new Date().toISOString()
        });
      }

      setNewCommentText('');
      setReplyingToId(null);
      await fetchComments();
      toast.success("Đã gửi bình luận!");
    } catch (err) {
      console.error("Lỗi khi thêm bình luận:", err);
      toast.error("Không thể gửi bình luận. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  // Edit existing comment
  const handleSaveCommentEdit = async (commentId: string) => {
    const trimmed = editingCommentText.trim();
    if (!trimmed) {
      toast.error("Bình luận không được để trống!");
      return;
    }

    try {
      const cRef = doc(db, 'comments', commentId);
      await updateDoc(cRef, {
        content: trimmed,
        updatedAt: serverTimestamp()
      });
      toast.success("Đã cập nhật bình luận.");
      setEditingCommentId(null);
      fetchComments();
    } catch (err) {
      console.error("Lỗi khi sửa bình luận:", err);
      toast.error("Lỗi khi sửa bình luận.");
    }
  };

  // Delete comment
  const handleDeleteComment = async (commentId: string) => {
    setCommentToDelete(commentId);
  };

  const executeDeleteComment = async (commentId: string, reason?: string, details?: string) => {
    try {
      const comment = comments.find(c => c.id === commentId);
      const cRef = doc(db, 'comments', commentId);
      const isModeratorRemoval = Boolean(isStaff && comment && comment.authorId !== user?.id);
      const removalReason = reason || (isModeratorRemoval ? "Nội dung vi phạm quy chuẩn cộng đồng" : null);

      await updateDoc(cRef, { 
        deletedAt: new Date().toISOString(),
        deletedBy: user?.id,
        removalReason: isModeratorRemoval ? removalReason : null,
        removalDetails: isModeratorRemoval ? (details || '') : null,
        removalTime: isModeratorRemoval ? new Date().toISOString() : null,
        appealStatus: isModeratorRemoval ? 'NONE' : null,
        deleteReason: removalReason
      });

      // Send notification to author if deleted by staff
      if (isModeratorRemoval && comment && comment.authorId !== user?.id) {
        await addDoc(collection(db, 'notifications'), {
          recipientId: comment.authorId,
          userId: comment.authorId,
          senderId: user?.id,
          senderName: "Hệ thống Quản trị",
          senderAvatar: DEFAULT_AVATAR,
          type: 'CONTENT_REMOVED',
          title: 'Bình luận của bạn đã bị gỡ bỏ',
          content: `Bình luận "${comment.content.slice(0, 50)}..." đã bị gỡ bỏ do: ${removalReason}.`,
          targetType: 'COMMENT',
          targetId: commentId,
          targetName: `Bình luận: "${comment.content.slice(0, 30)}..."`,
          removalReason,
          removalDetails: details || '',
          isRead: false,
          read: false,
          createdAt: serverTimestamp()
        });

        // Add audit log
        await addDoc(collection(db, 'activity_logs'), {
          userId: user?.id,
          userName: user?.displayName || 'Admin/Mod',
          action: 'REMOVE_COMMENT',
          details: `Gỡ bỏ bình luận của "${comment.authorName}" (ID: ${commentId}) - Lý do: ${removalReason}`,
          timestamp: serverTimestamp()
        });
      }

      // Decrement counter
      try {
        const collectionName = targetType === 'CHARACTER' ? 'characters' : targetType === 'PROMPT' ? 'prompts' : 'feedbacks';
        const docRef = doc(db, collectionName, targetId);
        await updateDoc(docRef, {
          commentsCount: increment(-1)
        });
      } catch (e) {
        // Ignored
      }

      toast.success("Đã gỡ bỏ bình luận.");
      fetchComments();
    } catch (err) {
      console.error("Lỗi khi xóa bình luận:", err);
      toast.error("Không thể xóa bình luận.");
    }
  };

  // Handle Comment Reaction
  const handleCommentReaction = async (comment: CommentItem, reactionType: string) => {
    if (!user) {
      toast.error("Vui lòng đăng nhập để thả cảm xúc!");
      return;
    }

    setActiveReactionPickerId(null);

    try {
      const updatedReactions = { ...(comment.reactions || {}) };

      if (updatedReactions[user.id] === reactionType) {
        delete updatedReactions[user.id];
      } else {
        updatedReactions[user.id] = reactionType;
      }

      const cRef = doc(db, 'comments', comment.id);
      await updateDoc(cRef, {
        reactions: updatedReactions
      });

      // Send notification if added/changed and not self
      if (updatedReactions[user.id] && comment.authorId !== user.id) {
        await addDoc(collection(db, 'notifications'), {
          recipientId: comment.authorId,
          userId: comment.authorId,
          senderId: user.id,
          senderName: user.displayName || 'Người dùng',
          senderAvatar: user.avatar || '',
          type: 'COMMENT',
          title: 'Cảm xúc mới về bình luận',
          message: `${user.displayName || 'Một người dùng'} đã thả cảm xúc ${REACTION_ICONS[reactionType]?.emoji || ''} vào bình luận của bạn.`,
          targetId: comment.id,
          targetType: 'COMMENT',
          link: `/${targetType === 'CHARACTER' ? 'character' : targetType === 'PROMPT' ? 'prompt' : 'feedbacks'}/${targetId}`,
          read: false,
          createdAt: new Date().toISOString()
        });
      }

      fetchComments();
    } catch (err) {
      console.error("Lỗi khi thả cảm xúc:", err);
      toast.error("Thao tác thất bại.");
    }
  };

  // Group comments into top-level and replies
  const topLevelComments = comments.filter(c => !c.parentId);
  const getRepliesFor = (commentId: string) => comments.filter(c => c.parentId === commentId);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header Title */}
      <div className="flex items-center justify-between">
        <h4 className="font-extrabold text-sm text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-amber-500" />
          <span>Bình luận ({comments.length})</span>
        </h4>
      </div>

      {/* Main Comment Box */}
      <div className="flex items-start gap-2.5">
        <img
          src={getValidAvatar(user?.avatar)}
          alt="Avatar"
          className="w-8 h-8 rounded-full border border-neutral-200 dark:border-neutral-700 shrink-0 object-cover"
        />
        <div className="flex-1 flex gap-2">
          <input
            type="text"
            placeholder={user ? "Viết bình luận của bạn..." : "Đăng nhập bằng Google để bình luận"}
            disabled={!user}
            value={newCommentText}
            onChange={e => setNewCommentText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAddComment();
              }
            }}
            className="flex-1 px-4 py-2.5 text-xs rounded-2xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700 focus:border-black dark:focus:border-white focus:outline-none transition-colors"
          />
          <button
            onClick={() => handleAddComment()}
            disabled={!user || !newCommentText.trim() || submitting}
            className="px-4 py-2.5 rounded-2xl bg-black dark:bg-white text-white dark:text-black font-extrabold text-xs disabled:opacity-40 hover:opacity-90 transition-opacity flex items-center gap-1.5 shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Gửi</span>
          </button>
        </div>
      </div>

      {/* Comments List */}
      {loading ? (
        <div className="space-y-2 py-2">
          {[1, 2].map(i => (
            <div key={i} className="h-14 bg-neutral-100 dark:bg-neutral-800/60 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : topLevelComments.length === 0 ? (
        <div className="py-8 text-center bg-neutral-50 dark:bg-neutral-800/40 rounded-2xl border border-dashed border-neutral-200 dark:border-neutral-800 p-4">
          <MessageSquare className="w-8 h-8 text-neutral-400 mx-auto mb-2 opacity-40" />
          <p className="text-xs text-neutral-500 font-medium">Chưa có bình luận nào. Hãy là người đầu tiên trao đổi!</p>
        </div>
      ) : (
        <div className="space-y-3 pt-2">
          {topLevelComments.map(comment => (
            <CommentNode
              key={comment.id}
              comment={comment}
              allComments={comments}
              depth={0}
              user={user}
              isStaff={isStaff}
              targetOwnerId={targetOwnerId}
              replyingToId={replyingToId}
              setReplyingToId={setReplyingToId}
              newCommentText={newCommentText}
              setNewCommentText={setNewCommentText}
              handleAddComment={handleAddComment}
              editingCommentId={editingCommentId}
              setEditingCommentId={setEditingCommentId}
              editingCommentText={editingCommentText}
              setEditingCommentText={setEditingCommentText}
              handleSaveCommentEdit={handleSaveCommentEdit}
              activeReactionPickerId={activeReactionPickerId}
              setActiveReactionPickerId={setActiveReactionPickerId}
              handleCommentReaction={handleCommentReaction}
              handleDeleteComment={handleDeleteComment}
              setSelectedCommentForReport={setSelectedCommentForReport}
              setIsReportOpen={setIsReportOpen}
              navigate={navigate}
            />
          ))}
        </div>
      )}

      {isReportOpen && selectedCommentForReport && (
        <ReportModal
          isOpen={isReportOpen}
          onClose={() => {
            setIsReportOpen(false);
            setSelectedCommentForReport(null);
          }}
          targetType="COMMENT"
          targetId={selectedCommentForReport.id}
          targetName={`bình luận của ${selectedCommentForReport.authorName}`}
        />
      )}

      {/* Delete Comment Confirmation Modal */}
      {(() => {
        const commentObj = comments.find(c => c.id === commentToDelete);
        const isModAction = Boolean(isStaff && commentObj && commentObj.authorId !== user?.id);

        return (
          <DeleteConfirmModal
            isOpen={commentToDelete !== null}
            onClose={() => setCommentToDelete(null)}
            title={isModAction ? "Gỡ bỏ bình luận (Kiểm duyệt)" : "Xóa bình luận?"}
            description={
              isModAction
                ? `Bạn đang thực hiện gỡ bỏ bình luận của thành viên "${commentObj?.authorName}". Vui lòng cung cấp lý do và chi tiết để hệ thống thông báo minh bạch tới thành viên.`
                : "Bạn có chắc chắn muốn xóa bình luận này? Hành động này không thể hoàn tác."
            }
            requireReason={isModAction}
            onConfirm={async () => {
              if (!commentToDelete) return;
              const targetId = commentToDelete;
              setCommentToDelete(null);
              await executeDeleteComment(targetId);
            }}
            onConfirmWithReason={async (reason, details) => {
              if (!commentToDelete) return;
              const targetId = commentToDelete;
              setCommentToDelete(null);
              await executeDeleteComment(targetId, reason, details);
            }}
          />
        );
      })()}
    </div>
  );
}
