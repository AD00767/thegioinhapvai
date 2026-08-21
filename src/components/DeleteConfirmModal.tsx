import React, { useState, useEffect } from 'react';
import { X, Trash2, AlertTriangle, ShieldAlert } from 'lucide-react';

export const DEFAULT_DELETION_REASONS = [
  "Vi phạm tiêu chuẩn cộng đồng",
  "Nội dung/hình ảnh nhạy cảm hoặc không phù hợp",
  "Spam, quảng cáo hoặc nội dung rác",
  "Xúc phạm, thù địch hoặc quấy rối thành viên khác",
  "Đạo nhái hoặc vi phạm bản quyền",
  "Khác (Nhập lý do chi tiết bên dưới)"
];

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void | Promise<void>;
  onConfirmWithReason?: (reason: string, details: string) => void | Promise<void>;
  requireReason?: boolean;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  targetName?: string;
}

export default function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  onConfirmWithReason,
  requireReason = false,
  title = "Xóa nội dung",
  description = "Bạn có chắc chắn muốn xóa nội dung này không? Thao tác này sẽ gỡ nội dung khỏi danh sách hiển thị công khai.",
  confirmText = "Xác nhận xóa",
  cancelText = "Hủy bỏ",
  targetName
}: DeleteConfirmModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>(DEFAULT_DELETION_REASONS[0]);
  const [detailedReason, setDetailedReason] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedReason(DEFAULT_DELETION_REASONS[0]);
      setDetailedReason('');
      setErrorMsg('');
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (requireReason) {
      const finalReason = selectedReason === "Khác (Nhập lý do chi tiết bên dưới)" 
        ? detailedReason.trim() 
        : selectedReason;
      
      if (!finalReason) {
        setErrorMsg("Vui lòng chọn hoặc nhập lý do xóa nội dung.");
        return;
      }

      if (selectedReason === "Khác (Nhập lý do chi tiết bên dưới)" && detailedReason.trim().length < 5) {
        setErrorMsg("Vui lòng nhập lý do cụ thể tối thiểu 5 ký tự.");
        return;
      }

      setIsSubmitting(true);
      try {
        if (onConfirmWithReason) {
          await onConfirmWithReason(finalReason, detailedReason.trim() || finalReason);
        } else if (onConfirm) {
          await onConfirm();
        }
        onClose();
      } catch (err) {
        console.error("Delete confirmation error:", err);
      } finally {
        setIsSubmitting(false);
      }
    } else {
      setIsSubmitting(true);
      try {
        if (onConfirm) {
          await onConfirm();
        } else if (onConfirmWithReason) {
          await onConfirmWithReason("Tác giả tự xóa", "Nội dung được xóa bởi chính chủ.");
        }
        onClose();
      } catch (err) {
        console.error("Delete confirmation error:", err);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div 
      id="delete-confirm-modal-overlay"
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div 
        id="delete-confirm-modal-card"
        className="relative bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] max-w-lg w-full overflow-hidden shadow-2xl z-10 p-6 md:p-8 space-y-6 max-h-[90vh] flex flex-col"
      >
        {/* Close button */}
        <button 
          id="close-delete-modal-btn"
          onClick={onClose} 
          disabled={isSubmitting}
          className="absolute top-5 right-5 p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
          aria-label="Đóng"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header / Icon */}
        <div className="flex items-start gap-4">
          <div className="p-3.5 rounded-2xl bg-red-500/10 text-red-600 dark:text-red-400 shrink-0">
            {requireReason ? <ShieldAlert className="w-7 h-7" /> : <Trash2 className="w-7 h-7" />}
          </div>
          <div className="space-y-1 pr-6">
            <h3 className="font-black text-lg md:text-xl text-neutral-900 dark:text-neutral-100 tracking-tight">
              {title}
            </h3>
            {targetName && (
              <p className="text-xs font-bold text-neutral-700 dark:text-neutral-300 line-clamp-1">
                Đối tượng: <span className="text-red-500">"{targetName}"</span>
              </p>
            )}
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {description}
            </p>
          </div>
        </div>

        {/* Reason Form (if requireReason is true) */}
        {requireReason && (
          <div className="space-y-4 py-1 overflow-y-auto scrollbar-thin">
            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                <span>Lý do xử lý / gỡ bỏ</span>
                <span className="text-red-500">*</span>
              </label>
              <select
                id="delete-reason-select"
                value={selectedReason}
                onChange={(e) => {
                  setSelectedReason(e.target.value);
                  setErrorMsg('');
                }}
                className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl text-xs font-bold text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all cursor-pointer"
              >
                {DEFAULT_DELETION_REASONS.map((r, idx) => (
                  <option key={idx} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center justify-between">
                <span>Chi tiết vi phạm & Hướng dẫn (Gửi đến tác giả)</span>
                <span className="text-[10px] text-neutral-400 lowercase">tùy chọn / bổ sung</span>
              </label>
              <textarea
                id="delete-detailed-reason-textarea"
                rows={3}
                value={detailedReason}
                onChange={(e) => {
                  setDetailedReason(e.target.value);
                  setErrorMsg('');
                }}
                placeholder="Mô tả cụ thể điều khoản vi phạm, bằng chứng hoặc lưu ý để tác giả hiểu và có thể kháng nghị..."
                className="w-full p-3.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl text-xs text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none transition-all placeholder:text-neutral-400"
              />
            </div>

            {errorMsg && (
              <p className="text-xs font-bold text-red-500 bg-red-500/10 p-2.5 rounded-xl border border-red-500/20">
                {errorMsg}
              </p>
            )}

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed font-medium">
                Hệ thống sẽ gửi thông báo đến tác giả nội dung kèm lý do này. Tác giả sẽ có quyền xem chi tiết và gửi đơn Kháng nghị.
              </p>
            </div>
          </div>
        )}

        {/* Buttons / Actions */}
        <div className="flex flex-col-reverse sm:flex-row items-center gap-3 pt-2">
          <button
            id="cancel-delete-btn"
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="w-full sm:w-1/3 py-3.5 px-4 rounded-2xl border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 font-extrabold text-xs uppercase tracking-wider hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all text-center cursor-pointer disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            id="confirm-delete-btn"
            type="button"
            disabled={isSubmitting}
            onClick={handleConfirm}
            className="w-full sm:w-2/3 py-3.5 px-4 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs uppercase tracking-wider transition-all shadow-lg shadow-red-600/20 active:scale-95 text-center flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
