import React, { useState, useEffect } from 'react';
import { HelpCircle, Mail, Clock, CheckCircle2, X, MessageSquare, ShieldCheck, Paperclip } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { NotificationItem } from '../../pages/Notifications';

interface SupportReplyModalProps {
  isOpen: boolean;
  onClose: () => void;
  notification: NotificationItem | null;
  ticketId?: string;
}

export default function SupportReplyModal({
  isOpen,
  onClose,
  notification,
  ticketId: propTicketId
}: SupportReplyModalProps) {
  const [loading, setLoading] = useState(false);
  const [ticketData, setTicketData] = useState<any>(null);

  const effectiveTicketId = propTicketId || notification?.targetId;

  useEffect(() => {
    if (!isOpen || !effectiveTicketId) return;

    const fetchTicket = async () => {
      setLoading(true);
      try {
        const docRef = doc(db, 'contact_forms', effectiveTicketId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setTicketData({ id: snap.id, ...snap.data() });
        } else {
          setTicketData(null);
        }
      } catch (err) {
        console.error("Error fetching support ticket details:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTicket();
  }, [isOpen, effectiveTicketId]);

  if (!isOpen) return null;

  // Fallback data if document fetch is still loading or unavailable
  const subject = ticketData?.subject || ticketData?.fullSubject || (notification as any)?.ticketSubject || notification?.title || 'Yêu cầu hỗ trợ';
  const category = ticketData?.category || 'Hỗ trợ';
  const userContent = ticketData?.content || ticketData?.message || (notification as any)?.ticketContent || '';
  const adminReply = ticketData?.moderatorReply || (notification as any)?.moderatorReply || notification?.message || '';
  const attachmentName = ticketData?.attachmentName;
  const attachmentData = ticketData?.attachmentData;
  const createdAtFormatted = ticketData?.createdAt
    ? (ticketData.createdAt.toDate ? ticketData.createdAt.toDate().toLocaleString('vi-VN') : new Date(ticketData.createdAt).toLocaleString('vi-VN'))
    : (notification?.createdAt?.toDate ? notification.createdAt.toDate().toLocaleString('vi-VN') : new Date(notification?.createdAt || 0).toLocaleString('vi-VN'));
  const resolvedAtFormatted = ticketData?.resolvedAt
    ? (ticketData.resolvedAt.toDate ? ticketData.resolvedAt.toDate().toLocaleString('vi-VN') : new Date(ticketData.resolvedAt).toLocaleString('vi-VN'))
    : null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 rounded-[2.5rem] w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-6 shadow-2xl relative border border-neutral-200 dark:border-neutral-800 animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black tracking-tight uppercase">Chi Tiết Yêu Cầu & Phản Hồi</h2>
              <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest font-mono">
                {effectiveTicketId ? `Mã Ticket: #${effectiveTicketId.substring(0, 12)}` : 'Hỗ trợ thành viên'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="py-12 space-y-4">
            <div className="h-20 bg-neutral-100 dark:bg-neutral-800 animate-pulse rounded-2xl" />
            <div className="h-32 bg-neutral-100 dark:bg-neutral-800 animate-pulse rounded-2xl" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* User Request Section */}
            <div className="p-5 bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl border border-neutral-200/80 dark:border-neutral-700/80 space-y-3">
              <div className="flex items-center justify-between gap-2 border-b border-neutral-200 dark:border-neutral-700/60 pb-2.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-lg">
                  {category}
                </span>
                <span className="text-[11px] text-neutral-400 flex items-center gap-1 font-medium">
                  <Clock className="w-3.5 h-3.5" />
                  {createdAtFormatted}
                </span>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-black text-neutral-500 uppercase tracking-widest">Chủ đề yêu cầu</p>
                <h3 className="text-sm font-extrabold text-neutral-900 dark:text-neutral-100">{subject}</h3>
              </div>

              {userContent && (
                <div className="space-y-1 pt-1">
                  <p className="text-xs font-black text-neutral-500 uppercase tracking-widest">Nội dung đã gửi</p>
                  <p className="text-xs md:text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed whitespace-pre-wrap italic">
                    "{userContent}"
                  </p>
                </div>
              )}

              {attachmentName && (
                <div className="pt-2 flex items-center gap-2 text-xs text-neutral-500 font-medium">
                  <Paperclip className="w-3.5 h-3.5 text-amber-500" />
                  <span>Tệp đính kèm: <strong>{attachmentName}</strong></span>
                </div>
              )}
            </div>

            {/* Admin Response Section */}
            <div className="p-5 bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/30 rounded-2xl space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-extrabold text-xs uppercase tracking-wider">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Phản Hồi Từ Ban Quản Trị</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-black">
                  Đã giải quyết
                </span>
              </div>

              <p className="text-sm md:text-base font-semibold text-neutral-900 dark:text-neutral-100 leading-relaxed whitespace-pre-wrap pt-1">
                {adminReply || 'Yêu cầu của bạn đã được Ban Quản Trị tiếp nhận và xử lý.'}
              </p>

              {resolvedAtFormatted && (
                <p className="text-[10px] text-neutral-400 pt-1 font-medium">
                  Thời gian giải quyết: {resolvedAtFormatted}
                </p>
              )}
            </div>

            {/* Close Action */}
            <div className="pt-2 text-right">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-100 rounded-2xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer shadow-md"
              >
                Đóng
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
