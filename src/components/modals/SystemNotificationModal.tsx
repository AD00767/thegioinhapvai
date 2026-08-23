import React from 'react';
import { X, ShieldCheck, Megaphone, Bell, Calendar, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { getValidAvatar } from '../../lib/avatar';

interface SystemNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  notification: any;
}

export default function SystemNotificationModal({
  isOpen,
  onClose,
  notification
}: SystemNotificationModalProps) {
  if (!isOpen || !notification) return null;

  const timeFormatted = notification.createdAt?.toDate 
    ? notification.createdAt.toDate().toLocaleString('vi-VN') 
    : new Date(notification.createdAt || 0).toLocaleString('vi-VN');

  const senderName = notification.senderName || 'Ban Quản Trị';
  const senderAvatar = getValidAvatar(notification.senderAvatar);
  const title = notification.title || notification.subject || 'Thông Báo Hệ Thống';
  const markdownText = notification.markdownContent || notification.message || notification.content || notification.body || '';

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 rounded-[2.5rem] w-full max-w-xl max-h-[85vh] overflow-y-auto p-6 sm:p-8 space-y-6 shadow-2xl relative border border-neutral-200 dark:border-neutral-800 animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-md">
                  Thông Báo Hệ Thống
                </span>
              </div>
              <h2 className="text-base font-black tracking-tight text-neutral-900 dark:text-white pt-0.5">
                {title}
              </h2>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sender & Timestamp Header Card */}
        <div className="p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl border border-neutral-200 dark:border-neutral-700/60 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={senderAvatar}
              alt={senderName}
              className="w-10 h-10 rounded-full object-cover shrink-0 border border-neutral-200 dark:border-neutral-700"
            />
            <div className="min-w-0">
              <p className="text-xs font-black text-neutral-900 dark:text-white truncate">
                {senderName}
              </p>
              <p className="text-[10px] text-neutral-400 font-semibold">
                Đại diện Ban Quản Trị
              </p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <div className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
              <Calendar className="w-3 h-3 text-neutral-400" />
              <span>{timeFormatted}</span>
            </div>
          </div>
        </div>

        {/* Rendered Markdown Content */}
        <div className="p-5 bg-neutral-50/50 dark:bg-neutral-800/30 rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Nội dung thông báo</p>
          <div className="prose dark:prose-invert max-w-none text-xs md:text-sm text-neutral-800 dark:text-neutral-200 leading-relaxed font-medium">
            <ReactMarkdown
              components={{
                p: ({node, ...props}) => <p className="mb-3 leading-relaxed" {...props} />,
                h1: ({node, ...props}) => <h1 className="text-base font-black text-amber-600 dark:text-amber-400 my-3 uppercase tracking-wide border-b border-amber-500/20 pb-1.5" {...props} />,
                h2: ({node, ...props}) => <h2 className="text-sm font-extrabold my-2 text-neutral-900 dark:text-white" {...props} />,
                h3: ({node, ...props}) => <h3 className="text-xs font-bold my-1.5 text-neutral-900 dark:text-white" {...props} />,
                strong: ({node, ...props}) => <strong className="font-extrabold text-neutral-900 dark:text-white" {...props} />,
                em: ({node, ...props}) => <em className="italic text-amber-600 dark:text-amber-400" {...props} />,
                ul: ({node, ...props}) => <ul className="list-disc pl-5 my-2 space-y-1" {...props} />,
                ol: ({node, ...props}) => <ol className="list-decimal pl-5 my-2 space-y-1" {...props} />,
                li: ({node, ...props}) => <li className="my-0.5" {...props} />,
                a: ({node, ...props}) => <a className="text-amber-600 dark:text-amber-400 font-bold underline hover:opacity-80" target="_blank" rel="noopener noreferrer" {...props} />,
                code: ({node, ...props}) => <code className="bg-neutral-200 dark:bg-neutral-800 px-1.5 py-0.5 rounded text-[11px] font-mono text-amber-600 dark:text-amber-300" {...props} />,
                blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-amber-500/50 pl-3 italic text-neutral-600 dark:text-neutral-400 my-2" {...props} />
              }}
            >
              {markdownText}
            </ReactMarkdown>
          </div>
        </div>

        {/* Action / Close */}
        <div className="pt-2 text-right">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-100 rounded-2xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer shadow-md"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
