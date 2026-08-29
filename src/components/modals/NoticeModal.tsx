import React from 'react';
import { X, BookOpen } from 'lucide-react';

export type NoticeType = 'character' | 'prompt' | 'feedback';

interface NoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: NoticeType;
}

const NOTICE_DATA: Record<NoticeType, { title: string; items: string[] }> = {
  character: {
    title: "Lưu ý",
    items: [
      "Chỉ đăng Character do bạn tự tạo hoặc nội dung mà bạn có quyền sử dụng và chia sẻ.",
      "Không sử dụng nội dung của người khác khi chưa được cho phép.",
      "Nếu sử dụng nội dung của người khác, hãy ghi rõ nguồn.",
      "Không đăng thông tin cá nhân hoặc thông tin riêng tư của người khác.",
      "Hãy kiểm tra kỹ nội dung trước khi đăng. Người đăng chịu trách nhiệm về nội dung Character của mình.",
      "Nội dung vi phạm quyền sở hữu trí tuệ, quyền của người khác hoặc không phù hợp có thể bị ẩn hoặc gỡ bỏ."
    ]
  },
  prompt: {
    title: "Lưu ý",
    items: [
      "Chỉ đăng Prompt do bạn tự tạo hoặc nội dung mà bạn có quyền sử dụng và chia sẻ.",
      "Không sử dụng nội dung của người khác khi chưa được cho phép.",
      "Nếu sử dụng nội dung của người khác, hãy ghi rõ nguồn.",
      "Không đưa thông tin cá nhân hoặc thông tin riêng tư của người khác vào Prompt.",
      "Hãy kiểm tra kỹ Prompt trước khi đăng. Người đăng chịu trách nhiệm về nội dung mình chia sẻ.",
      "Nội dung vi phạm quyền sở hữu trí tuệ, quyền của người khác hoặc không phù hợp có thể bị ẩn hoặc gỡ bỏ."
    ]
  },
  feedback: {
    title: "Lưu ý",
    items: [
      "Feedback nên tập trung vào vấn đề cần góp ý và hướng đến việc cải thiện website, tính năng hoặc trải nghiệm của cộng đồng.",
      "Trình bày ý kiến rõ ràng, cụ thể và mang tính xây dựng để góp ý có thể được tiếp nhận và cải thiện.",
      "Không sử dụng Feedback để công kích, xúc phạm người khác hoặc cố tình gây tranh cãi trong cộng đồng.",
      "Không đăng thông tin cá nhân hoặc thông tin riêng tư của người khác.",
      "Hãy kiểm tra lại nội dung trước khi gửi để đảm bảo Feedback thực sự phù hợp và hữu ích."
    ]
  }
};

export default function NoticeModal({ isOpen, onClose, type }: NoticeModalProps) {
  if (!isOpen) return null;

  const currentNotice = NOTICE_DATA[type] || NOTICE_DATA.character;

  return (
    <div 
      className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="notice-modal-title"
    >
      <div 
        className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 w-full max-w-lg rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-neutral-900 dark:text-neutral-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
              <BookOpen className="w-5 h-5" />
            </div>
            <h3 id="notice-modal-title" className="text-base font-bold text-neutral-900 dark:text-neutral-100">
              {currentNotice.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            title="Đóng"
            aria-label="Đóng modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-3.5 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          {currentNotice.items.map((item, index) => (
            <div key={index} className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 dark:bg-neutral-500 mt-2 shrink-0" />
              <p className="flex-1">{item}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/30 dark:bg-neutral-900/30 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-xl text-xs font-semibold hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors shadow-sm"
          >
            Đã hiểu
          </button>
        </div>
      </div>
    </div>
  );
}
