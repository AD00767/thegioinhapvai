import React from 'react';
import { X, ShieldAlert } from 'lucide-react';

interface DeletedContentModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'COMMENT' | 'FEEDBACK' | string;
}

export default function DeletedContentModal({ isOpen, onClose, type }: DeletedContentModalProps) {
  if (!isOpen) return null;

  const isComment = type === 'COMMENT';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-neutral-900 rounded-3xl w-full max-w-sm p-8 shadow-2xl border border-neutral-200 dark:border-neutral-800 text-center space-y-6 relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto text-red-500">
          <ShieldAlert className="w-10 h-10" />
        </div>

        <div className="space-y-2">
          <h3 className="text-xl font-black text-neutral-900 dark:text-neutral-100">
            {isComment ? 'Nội dung đã bị xóa' : 'Nội dung không còn tồn tại'}
          </h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {isComment 
              ? 'Bình luận này đã bị gỡ bỏ khỏi hệ thống.' 
              : 'Feedback này hiện không còn khả dụng hoặc đã bị xóa.'}
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3.5 bg-black dark:bg-white text-white dark:text-black font-black text-xs rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-lg"
        >
          Đóng
        </button>
      </div>
    </div>
  );
}
