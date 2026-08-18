import React from 'react';
import { X, Trash2, AlertTriangle } from 'lucide-react';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
}

export default function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Xóa hoàn toàn Prompt",
  description = "Bạn có chắc chắn muốn xóa hoàn toàn Prompt này không? Hành động này không thể hoàn tác và Prompt sẽ biến mất ngay lập tức khỏi hệ thống.",
  confirmText = "Xóa hoàn toàn",
  cancelText = "Hủy bỏ"
}: DeleteConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" 
        onClick={onClose} 
      />
      
      {/* Modal Container */}
      <div className="relative bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl z-10 p-6 space-y-6 animate-fade-in">
        {/* Close button */}
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
          aria-label="Đóng"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header / Icon */}
        <div className="flex flex-col items-center text-center space-y-3 pt-2">
          <div className="p-4 rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
            <Trash2 className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="font-extrabold text-lg text-neutral-900 dark:text-neutral-100">
              {title}
            </h3>
            <p className="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center justify-center gap-1.5 px-4">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>Hành động không thể hoàn tác</span>
            </p>
          </div>
        </div>

        {/* Content Description */}
        <div className="text-sm text-neutral-600 dark:text-neutral-400 text-center leading-relaxed px-2">
          {description}
        </div>

        {/* Buttons / Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-2xl border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 font-bold text-xs hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all text-center"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex-1 py-3 px-4 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-all shadow-md hover:shadow-lg hover:shadow-red-500/10 active:scale-95 text-center"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
