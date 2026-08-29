import React, { useState } from 'react';
import { Share2, Copy, Check, X, QrCode, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

import { buildCharacterUrl, buildPromptUrl, buildCreatorUrl, buildUserUrl } from '../lib/urls';
import { cn } from '../lib/utils';
import { getValidAvatar } from '../lib/avatar';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  type: 'CHARACTER' | 'PROMPT' | 'CREATOR' | 'USER';
  targetId: string;
  avatar?: string;
  description?: string;
}

export default function ShareModal({
  isOpen,
  onClose,
  title,
  type,
  targetId,
  avatar,
  description
}: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  if (!isOpen) return null;

  // Build the accurate canonical URL
  let shareUrl = "";
  let urlError: string | null = null;
  
  try {
    shareUrl = 
      type === 'CHARACTER' ? buildCharacterUrl(targetId) :
      type === 'PROMPT' ? buildPromptUrl(targetId) :
      type === 'CREATOR' ? buildCreatorUrl(targetId) :
      buildUserUrl(targetId);
  } catch (error: any) {
    urlError = error?.message || "Lỗi cấu hình liên kết.";
    shareUrl = "";
  }

  // Generate standardized share content according to specification
  const targetName = (title || '').trim() || (
    type === 'CHARACTER' ? 'Character' :
    type === 'PROMPT' ? 'Prompt' :
    type === 'CREATOR' ? 'Creator' : 'Người dùng'
  );

  let introSentence = '';
  switch (type) {
    case 'CHARACTER':
      introSentence = `Khám phá Character ${targetName} trên Thế Giới Nhập Vai AD.`;
      break;
    case 'CREATOR':
      introSentence = `Khám phá trang Creator ${targetName} trên Thế Giới Nhập Vai AD.`;
      break;
    case 'PROMPT':
      introSentence = `Khám phá Prompt ${targetName} trên Thế Giới Nhập Vai AD.`;
      break;
    case 'USER':
      introSentence = `Khám phá trang cá nhân của ${targetName} trên Thế Giới Nhập Vai AD.`;
      break;
    default:
      introSentence = `Khám phá ${targetName} trên Thế Giới Nhập Vai AD.`;
  }

  // 3-part structured clipboard payload
  const fullShareText = `${targetName}\n${introSentence}\n${shareUrl}`;

  const typeLabel = 
    type === 'CHARACTER' ? 'Character Roleplay' :
    type === 'PROMPT' ? 'Prompt AI Studio' :
    type === 'CREATOR' ? 'Trang Creator' :
    'Trang Cá Nhân';

  const handleCopyLink = async () => {
    if (urlError || !shareUrl) {
      toast.error("Không thể sao chép: " + (urlError || "Liên kết không hợp lệ."));
      return;
    }
    
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(fullShareText);
      } else {
        // Fallback for older browsers or restricted iframe environments
        const textArea = document.createElement("textarea");
        textArea.value = fullShareText;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }

      setCopied(true);
      toast.success("Đã sao chép nội dung chia sẻ.");
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error("Clipboard copy failed:", err);
      toast.error("Không thể sao chép nội dung chia sẻ.");
    }
  };

  const handleNativeShare = async () => {
    if (urlError || !shareUrl) {
      toast.error("Không thể chia sẻ: " + (urlError || "Liên kết không hợp lệ."));
      return;
    }
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: targetName,
          text: introSentence,
          url: shareUrl,
        });
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          console.error("Native share error:", err);
          handleCopyLink();
        }
      }
    } else {
      handleCopyLink();
    }
  };

  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedIntro = encodeURIComponent(introSentence);
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodedUrl}`;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl max-w-sm w-full p-5 sm:p-6 shadow-2xl relative space-y-4 text-neutral-900 dark:text-neutral-100"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Share2 className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h3 id="share-modal-title" className="font-extrabold text-sm sm:text-base text-neutral-900 dark:text-neutral-100">
                Chia sẻ
              </h3>
              <p className="text-[11px] text-neutral-500">
                {typeLabel}
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            title="Đóng"
            aria-label="Đóng cửa sổ chia sẻ"
            className="p-1.5 sm:p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Content Card Preview */}
        <div className="flex items-center gap-3 p-3 bg-neutral-50 dark:bg-neutral-800/60 rounded-2xl border border-neutral-200/80 dark:border-neutral-800">
          {avatar ? (
            <img 
              src={getValidAvatar(avatar)} 
              alt={targetName} 
              className="w-11 h-11 rounded-xl object-cover shrink-0 border border-neutral-200 dark:border-neutral-700" 
            />
          ) : (
            <div className="w-11 h-11 rounded-xl bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-neutral-600 dark:text-neutral-300 shrink-0 font-bold text-base">
              {targetName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h4 className="font-bold text-xs sm:text-sm text-neutral-900 dark:text-neutral-100 truncate">
              {targetName}
            </h4>
            <p className="text-[11px] text-neutral-500 truncate mt-0.5">
              {description || introSentence}
            </p>
          </div>
        </div>

        {/* Icon-driven Share Action Menu - STRICTLY ICON ONLY */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
            <span>Tùy chọn chia sẻ</span>
            <button
              type="button"
              onClick={() => setShowQR(!showQR)}
              title={showQR ? "Ẩn mã QR" : "Hiển thị mã QR"}
              aria-label={showQR ? "Ẩn mã QR" : "Hiển thị mã QR"}
              className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 hover:underline capitalize font-medium text-[11px] transition-colors"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>{showQR ? "Ẩn QR" : "Mã QR"}</span>
            </button>
          </div>

          {showQR ? (
            <div className="p-4 bg-white rounded-2xl border border-neutral-200 dark:border-neutral-800 text-center space-y-2 flex flex-col items-center animate-fade-in">
              <img src={qrApiUrl} alt="QR Code" className="w-36 h-36 rounded-xl" />
              <p className="text-[11px] text-neutral-500 font-medium">Quét mã QR bằng camera điện thoại để mở</p>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5">
              {/* 1. Copy Link & Text Button */}
              <button
                type="button"
                onClick={handleCopyLink}
                title="Sao chép nội dung và liên kết"
                aria-label="Sao chép liên kết"
                className={cn(
                  "w-11 h-11 rounded-2xl border flex items-center justify-center transition-all active:scale-95",
                  copied
                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 shadow-sm"
                    : "bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 hover:text-black dark:hover:text-white"
                )}
              >
                {copied ? (
                  <Check className="w-5 h-5 text-emerald-500" />
                ) : (
                  <Copy className="w-5 h-5" />
                )}
              </button>

              {/* 2. Facebook Share Button */}
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Chia sẻ lên Facebook"
                aria-label="Chia sẻ lên Facebook"
                className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 flex items-center justify-center transition-all active:scale-95"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </a>

              {/* 3. Messenger Share Button */}
              <a
                href={`https://www.facebook.com/dialog/send?link=${encodedUrl}&app_id=291494419107518&redirect_uri=${encodedUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Chia sẻ qua Messenger"
                aria-label="Chia sẻ qua Messenger"
                className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-900/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 flex items-center justify-center transition-all active:scale-95"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 0C5.373 0 0 4.974 0 11.111c0 3.498 1.744 6.614 4.469 8.654V24l4.088-2.242c1.096.304 2.254.464 3.443.464 6.627 0 12-4.975 12-11.111S18.627 0 12 0zm1.191 14.963l-3.056-3.259-5.963 3.259 6.559-6.963 3.13 3.259 5.89-3.259-6.56 6.963z"/>
                </svg>
              </a>

              {/* 4. X (Twitter) Share Button */}
              <a
                href={`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedIntro}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Chia sẻ lên X (Twitter)"
                aria-label="Chia sẻ lên X (Twitter)"
                className="w-11 h-11 rounded-2xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 hover:text-black dark:hover:text-white flex items-center justify-center transition-all active:scale-95"
              >
                <svg className="w-4.5 h-4.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>

              {/* 5. Telegram Share Button */}
              <a
                href={`https://t.me/share/url?url=${encodedUrl}&text=${encodedIntro}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Chia sẻ lên Telegram"
                aria-label="Chia sẻ lên Telegram"
                className="w-11 h-11 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200/60 dark:border-sky-900/60 text-sky-600 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900/60 flex items-center justify-center transition-all active:scale-95"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.842 8.232c-.187 1.968-.98 6.643-1.383 8.8-.17.915-.506 1.22-.832 1.25-.71.066-1.25-.468-1.938-.92-.1-.067-1.57-1.002-2.115-1.468-.15-.128-.323-.377-.008-.7.733-.75 1.608-1.6 2.146-2.146.248-.25.493-.822-.534-.122-1.455.992-2.87 1.933-3.03 2.04-.25.17-.48.252-.69.245-.233-.007-.68-.134-1.012-.242-.408-.133-.732-.204-.704-.43.014-.118.175-.24.482-.365 3.01-1.31 5.02-2.173 6.03-2.59 2.87-1.187 3.468-1.393 3.858-1.4 0 0 .5-.008.31.258"/>
                </svg>
              </a>

              {/* 6. Native / More Share Button */}
              <button
                type="button"
                onClick={handleNativeShare}
                title="Chia sẻ qua ứng dụng khác"
                aria-label="Chia sẻ qua ứng dụng khác"
                className="w-11 h-11 rounded-2xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 hover:text-black dark:hover:text-white flex items-center justify-center transition-all active:scale-95"
              >
                <Share2 className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Content & Link Preview Box */}
        <div className="space-y-1.5 pt-1">
          <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">
            Nội dung chia sẻ
          </label>
          <div className="p-2.5 bg-neutral-100/80 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700/80 rounded-xl text-xs space-y-1 font-mono text-neutral-700 dark:text-neutral-300 select-all">
            <div className="font-bold text-neutral-900 dark:text-neutral-100 truncate font-sans">
              {targetName}
            </div>
            <div className="text-[11px] text-neutral-600 dark:text-neutral-400 font-sans line-clamp-2">
              {introSentence}
            </div>
            <div className="text-[10px] text-amber-600 dark:text-amber-400 truncate break-all pt-0.5">
              {urlError ? "Lỗi: " + urlError : shareUrl}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
