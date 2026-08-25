import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Lock, Mail, CornerDownRight, Send, Trash2, Shield, Heart, ArrowRight, MessageSquare 
} from 'lucide-react';
import { doc, updateDoc, deleteDoc, collection, addDoc, getDocs, query, where, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/useAuthStore';
import UserBadge from '../UserBadge';
import { FeedbackItem } from './PublicFeedbackCard';
import { getValidAvatar, DEFAULT_AVATAR } from '../../lib/avatar';
import { enforceActivityCheck } from '../../lib/restrictions';
import DeleteConfirmModal from '../DeleteConfirmModal';
import toast from 'react-hot-toast';

interface PrivateReply {
  id: string;
  feedbackId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  content: string;
  createdAt?: any;
}

const REACTION_ICONS: Record<string, { label: string; emoji: string }> = {
  like: { label: 'Thích', emoji: '👍' },
  love: { label: 'Yêu thích', emoji: '❤️' },
  haha: { label: 'Haha', emoji: '😆' },
  wow: { label: 'Wow', emoji: '😮' },
  sad: { label: 'Buồn', emoji: '😢' },
  angry: { label: 'Phẫn nộ', emoji: '😡' }
};

interface PrivateFeedbackCardProps {
  key?: React.Key;
  feedback: FeedbackItem;
  onUpdate?: () => void;
  onDelete?: (id: string) => void;
}

export default function PrivateFeedbackCard({
  feedback,
  onUpdate,
  onDelete
}: PrivateFeedbackCardProps) {
  const navigate = useNavigate();
  const { user, firebaseUser } = useAuthStore();

  const currentUserId = user?.id || user?.uid || firebaseUser?.uid;
  const isSender = Boolean(currentUserId && currentUserId === feedback.senderId);
  const isRecipient = Boolean(currentUserId && currentUserId === feedback.recipientId);
  const isAdmin = user?.role === 'ADMIN';

  const [isDeleted, setIsDeleted] = useState(false);

  // Security Rule check: Only sender and recipient (or Admin) can view content!
  if (!currentUserId || (!isSender && !isRecipient && !isAdmin) || isDeleted) {
    return null; // Do not render if neither sender nor recipient
  }

  // Reactions State
  const reactionsMap = feedback.reactions || {};
  const myReaction = reactionsMap[user.id];
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  // Reply Thread State
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState<PrivateReply[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  // Fetch private replies
  const fetchReplies = async () => {
    setLoadingReplies(true);
    try {
      const q = query(
        collection(db, `feedbacks/${feedback.id}/private_replies`),
        orderBy('createdAt', 'asc')
      );
      const snap = await getDocs(q);
      const list: PrivateReply[] = [];
      snap.docs.forEach(d => {
        list.push({ id: d.id, ...d.data() } as PrivateReply);
      });
      setReplies(list);
    } catch (err) {
      console.error("Lỗi khi tải phản hồi riêng tư:", err);
    } finally {
      setLoadingReplies(false);
    }
  };

  useEffect(() => {
    if (showReplies) {
      fetchReplies();
    }
  }, [showReplies, feedback.id]);

  // Handle Reaction
  const handleReaction = async (reactionType: string) => {
    setShowReactionPicker(false);
    try {
      const updatedReactions = { ...reactionsMap };
      if (updatedReactions[user.id] === reactionType) {
        delete updatedReactions[user.id];
      } else {
        updatedReactions[user.id] = reactionType;
      }

      const fbRef = doc(db, 'feedbacks', feedback.id);
      await updateDoc(fbRef, {
        reactions: updatedReactions,
        reactionsCount: Object.keys(updatedReactions).length
      });

      // Notify the other party
      const notifyTargetId = isRecipient ? feedback.senderId : feedback.recipientId;
      await addDoc(collection(db, 'notifications'), {
        userId: notifyTargetId,
        senderId: user.id,
        type: 'FEEDBACK',
        title: 'Cảm xúc mới trên Thư riêng tư',
        message: `${user.displayName} đã thả cảm xúc vào thư riêng tư của bạn.`,
        link: '/feedbacks',
        read: false,
        createdAt: serverTimestamp()
      });

      if (onUpdate) onUpdate();
    } catch (err) {
      toast.error("Thao tác thất bại.");
    }
  };

  // Recipient or Admin deletes letter (per Module 11 rules)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDelete = async (reason?: string, details?: string) => {
    try {
      const now = new Date().toISOString();
      const isModerationAction = Boolean(isAdmin && user?.id !== feedback.senderId);

      if (isModerationAction) {
        if (!reason || !reason.trim()) {
          toast.error("Lý do xử lý là bắt buộc.");
          return;
        }

        const removalReasonText = reason.trim();
        const removalDetailsText = details?.trim() || removalReasonText;

        const fbRef = doc(db, 'feedbacks', feedback.id);
        await updateDoc(fbRef, { 
          isHidden: true,
          deletedAt: now,
          deletedBy: user?.id || 'admin',
          removalReason: removalReasonText,
          removalDetails: removalDetailsText,
          removalTime: now,
          appealStatus: 'NONE'
        });

        // Notify sender if deleted by admin
        if (feedback.senderId && feedback.senderId !== user?.id) {
          const targetName = feedback.title || feedback.content?.slice(0, 40) || 'Thư riêng tư';
          await addDoc(collection(db, 'notifications'), {
            userId: feedback.senderId,
            recipientId: feedback.senderId,
            senderId: user?.id,
            senderName: user?.displayName || "Hệ thống Quản trị",
            senderAvatar: user?.avatar ? getValidAvatar(user.avatar) : DEFAULT_AVATAR,
            type: 'CONTENT_REMOVED',
            title: `Thư riêng tư "${targetName}" đã bị gỡ bỏ`,
            message: `Thư riêng tư của bạn đã bị gỡ bỏ bởi Quản trị viên. Lý do: ${removalReasonText}. Nhấp vào để xem chi tiết và gửi đơn kháng nghị.`,
            targetId: feedback.id,
            targetType: 'FEEDBACK',
            targetName,
            removalReason: removalReasonText,
            removalDetails: removalDetailsText,
            removalTime: now,
            read: false,
            createdAt: now
          });
        }

        // Add audit log
        await addDoc(collection(db, 'audit_logs'), {
          executorId: user?.id,
          executorName: user?.displayName || 'Admin',
          executorRole: user?.role || 'ADMIN',
          action: 'DELETE_FEEDBACK',
          targetId: feedback.id,
          targetType: 'FEEDBACK',
          details: `Đã gỡ bỏ thư riêng tư của "${feedback.senderName}". Lý do: ${removalReasonText}`,
          reason: removalReasonText,
          createdAt: now
        });

        toast.success("Đã gỡ bỏ thư riêng tư và gửi thông báo cho tác giả.");
      } else {
        // Recipient deletes received private feedback
        const fbRef = doc(db, 'feedbacks', feedback.id);
        await updateDoc(fbRef, { 
          deletedAt: now,
          deletedBy: user?.id
        });
        toast.success("Đã xóa thư riêng tư thành công.");
      }

      setIsDeleted(true);
      if (onDelete) onDelete(feedback.id);
    } catch (err) {
      console.error("Lỗi khi xóa doc riêng tư:", err);
      toast.error("Không thể xóa thư.");
    } finally {
      setShowDeleteConfirm(false);
    }
  };

  // Send Reply (Recipient or Sender)
  const handleSendReply = async () => {
    if (!replyText.trim()) return;

    if (!enforceActivityCheck(user, 'POST_FEEDBACK')) {
      return;
    }

    setSubmittingReply(true);
    try {
      await addDoc(collection(db, `feedbacks/${feedback.id}/private_replies`), {
        feedbackId: feedback.id,
        senderId: user.id,
        senderName: user.displayName,
        senderAvatar: getValidAvatar(user.avatar),
        content: replyText.trim(),
        createdAt: serverTimestamp()
      });

      // Notify recipient or sender
      const targetUserId = isRecipient ? feedback.senderId : feedback.recipientId;
      await addDoc(collection(db, 'notifications'), {
        userId: targetUserId,
        senderId: user.id,
        type: 'FEEDBACK',
        title: 'Phản hồi mới cho Feedback riêng tư',
        message: `${user.displayName} đã trả lời thư riêng tư của bạn.`,
        link: '/feedbacks',
        read: false,
        createdAt: serverTimestamp()
      });

      setReplyText('');
      fetchReplies();
      toast.success("Đã gửi phản hồi riêng tư!");
    } catch (err) {
      toast.error("Lỗi khi gửi phản hồi.");
    } finally {
      setSubmittingReply(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-amber-500/5 via-neutral-900/90 to-neutral-950 border border-amber-500/30 rounded-3xl p-6 shadow-xl space-y-4 relative overflow-hidden text-white">
      {/* Confidential Watermark */}
      <div className="absolute right-4 top-4 opacity-10 pointer-events-none">
        <Mail className="w-32 h-32 text-amber-500" />
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 relative z-10">
        <div className="flex items-center gap-3 flex-wrap">
          <div 
            onClick={() => navigate(`/creator/${feedback.senderId}`)}
            className="flex items-center gap-2 cursor-pointer group"
          >
            <img
              src={getValidAvatar(feedback.senderAvatar)}
              alt={feedback.senderName}
              className="w-9 h-9 rounded-full border border-amber-500/40 object-cover group-hover:scale-105 transition-transform"
            />
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-extrabold text-sm text-neutral-100 group-hover:text-amber-400 group-hover:underline">
                  {feedback.senderName}
                </span>
                <UserBadge subject={{ commentCount: 1 }} size="xs" />
                {isSender && (
                  <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 text-[10px] font-bold rounded">
                    Người gửi (Bạn)
                  </span>
                )}
              </div>
            </div>
          </div>

          <ArrowRight className="w-4 h-4 text-amber-500/60 shrink-0" />

          <div 
            onClick={() => navigate(`/creator/${feedback.recipientId}`)}
            className="flex items-center gap-2 cursor-pointer group"
          >
            <img
              src={getValidAvatar(feedback.recipientAvatar)}
              alt={feedback.recipientName}
              className="w-8 h-8 rounded-full border border-neutral-700 object-cover group-hover:scale-105 transition-transform"
            />
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-xs text-neutral-300 group-hover:text-amber-400 group-hover:underline">
                  @{feedback.recipientName}
                </span>
                <UserBadge subject={{ creatorStatus: true }} size="xs" />
                {isRecipient && (
                  <span className="px-1.5 py-0.5 bg-indigo-500/20 text-indigo-300 text-[10px] font-bold rounded">
                    Người nhận (Bạn)
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Private Badge & Delete */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full text-[10px] font-extrabold">
            <Lock className="w-3 h-3" />
            <span>Thư Riêng Tư</span>
          </span>

          {(isRecipient || isAdmin) && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
              title="Xóa thư riêng tư"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Letter Body */}
      <div className="bg-black/40 border border-amber-500/20 rounded-2xl p-4 space-y-2 relative z-10">
        {feedback.title && (
          <h4 className="font-extrabold text-sm text-amber-300 flex items-center gap-1.5">
            <Mail className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{feedback.title}</span>
          </h4>
        )}
        <p className="text-xs text-neutral-200 leading-relaxed whitespace-pre-wrap font-sans">
          {feedback.content}
        </p>
        {feedback.images && feedback.images.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-2">
            {feedback.images.map((imgUrl, idx) => (
              <a key={idx} href={imgUrl} target="_blank" rel="noopener noreferrer" className="aspect-video rounded-xl overflow-hidden border border-amber-500/30 bg-neutral-900 group">
                <img src={imgUrl} alt={`Ảnh đính kèm ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Date */}
      <div className="text-[10px] text-neutral-400 font-medium">
        Gửi lúc: {feedback.createdAt?.toDate ? feedback.createdAt.toDate().toLocaleString('vi-VN') : 'Mới đây'}
      </div>

      {/* Actions Bar: Reaction & Reply */}
      <div className="pt-2 border-t border-neutral-800 flex items-center justify-between text-xs relative z-10">
        <div className="flex items-center gap-2">
          {/* Reaction Button */}
          <div className="relative">
            <button
              onClick={() => setShowReactionPicker(!showReactionPicker)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                myReaction
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
              }`}
            >
              <span>{myReaction ? REACTION_ICONS[myReaction]?.emoji : '❤️'}</span>
              <span>{myReaction ? REACTION_ICONS[myReaction]?.label : 'Thả cảm xúc'}</span>
            </button>

            {/* Reaction Picker Popup */}
            {showReactionPicker && (
              <div className="absolute left-0 bottom-full mb-2 bg-neutral-900 border border-neutral-700 rounded-2xl p-2 shadow-xl flex items-center gap-2 z-20">
                {Object.entries(REACTION_ICONS).map(([key, item]) => (
                  <button
                    key={key}
                    onClick={() => handleReaction(key)}
                    className="p-2 hover:bg-neutral-800 rounded-xl text-lg transition-transform hover:scale-125"
                    title={item.label}
                  >
                    {item.emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Reply Button */}
          <button
            onClick={() => setShowReplies(!showReplies)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-neutral-300 transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Trả lời ({replies.length})</span>
          </button>
        </div>

        <div className="text-[10px] text-neutral-400 italic flex items-center gap-1">
          <Shield className="w-3 h-3 text-amber-400" />
          <span>Bảo mật 100%</span>
        </div>
      </div>

      {/* Private Reply Thread */}
      {showReplies && (
        <div className="pt-4 border-t border-neutral-800 space-y-4 animate-fade-in relative z-10">
          {/* Reply Input */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Viết phản hồi riêng tư..."
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSendReply();
                }
              }}
              className="flex-1 px-3.5 py-2 text-xs rounded-xl bg-neutral-900 border border-neutral-700 focus:outline-none focus:border-amber-500 text-white"
            />
            <button
              onClick={handleSendReply}
              disabled={!replyText.trim() || submittingReply}
              className="px-4 py-2 rounded-xl bg-amber-500 text-black font-extrabold text-xs disabled:opacity-40 hover:bg-amber-400"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* List of Private Replies */}
          {loadingReplies ? (
            <div className="text-center text-xs text-neutral-400 py-2">Đang tải phản hồi...</div>
          ) : replies.length === 0 ? (
            <div className="text-center text-xs text-neutral-500 py-2">Chưa có phản hồi nào.</div>
          ) : (
            <div className="space-y-2">
              {replies.map(rep => (
                <div key={rep.id} className="flex items-start gap-2.5 bg-neutral-900/80 p-3 rounded-2xl border border-neutral-800">
                  <img
                    src={getValidAvatar(rep.senderAvatar)}
                    alt={rep.senderName}
                    className="w-6 h-6 rounded-full object-cover border border-neutral-700 shrink-0"
                  />
                  <div className="space-y-0.5">
                    <div className="font-bold text-xs text-amber-400 flex items-center gap-1.5">
                      <span>{rep.senderName}</span>
                      {rep.senderId === user.id && (
                        <span className="text-[9px] bg-neutral-800 px-1.5 py-0.2 rounded text-neutral-400">Bạn</span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-200">{rep.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <DeleteConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirmWithReason={(reason, details) => handleDelete(reason, details)}
        onConfirm={() => handleDelete()}
        requireReason={Boolean(isAdmin && user?.id !== feedback.senderId)}
        targetName={feedback.title || feedback.content?.slice(0, 40) || 'Thư riêng tư'}
        title={isAdmin && user?.id !== feedback.senderId ? "Gỡ bỏ thư riêng tư vi phạm" : "Xóa thư riêng tư"}
        description={
          isAdmin && user?.id !== feedback.senderId
            ? "Thư riêng tư sẽ bị gỡ bỏ khỏi hệ thống. Tác giả sẽ nhận được thông báo kèm lý do cụ thể và có quyền gửi đơn kháng nghị."
            : "Bạn có chắc chắn muốn xóa thư riêng tư này không? Hành động này sẽ gỡ thư khỏi hòm thư của bạn."
        }
        confirmText="Xác nhận xóa"
        cancelText="Hủy bỏ"
      />
    </div>
  );
}
