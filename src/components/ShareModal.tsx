import React, { useState } from 'react';
import { Share2, Copy, Check, X, ExternalLink, QrCode } from 'lucide-react';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import toast from 'react-hot-toast';

import { buildCharacterUrl, buildPromptUrl, buildCreatorUrl, getCanonicalBaseUrl } from '../lib/urls.ts';
import { cn } from '../lib/utils';
import { getValidAvatar } from '../lib/avatar';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  type: 'CHARACTER' | 'PROMPT' | 'CREATOR';
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

  const isDev = import.meta.env.DEV;

  let shareUrl = "";
  let urlError: string | null = null;
  
  try {
    shareUrl = 
      type === 'CHARACTER' ? buildCharacterUrl(targetId) :
      type === 'PROMPT' ? buildPromptUrl(targetId) :
      buildCreatorUrl(targetId);
  } catch (error: any) {
    urlError = error.message;
    shareUrl = "Lỗi cấu hình URL: " + error.message;
  }

  const generatedPath = 
    type === 'CHARACTER' ? `/character/${targetId}` :
    type === 'PROMPT' ? `/prompt/${targetId}` :
    `/creator/${targetId}`;

  const typeLabel = 
    type === 'CHARACTER' ? 'Character Roleplay' :
    type === 'PROMPT' ? 'Prompt AI Studio' :
    'Hồ sơ Creator';

  const handleCopyLink = async (e?: React.MouseEvent) => {
    if (urlError) {
      if (e) e.preventDefault();
      toast.error("Không thể chia sẻ: " + urlError);
      return;
    }
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Đã sao chép liên kết.");

      if (isDev) {
        console.log("DEBUG SHARE INFO:", {
          environment: import.meta.env.MODE,
          currentOrigin: window.location.origin,
          configuredBaseUrl: import.meta.env.VITE_PUBLIC_APP_URL || 'Not Set',
          resourceType: type.toLowerCase(),
          resourceId: targetId,
          generatedPath,
          generatedShareUrl: shareUrl,
          finalClipboardValue: shareUrl
        });
      }

      // Record share in Firestore with throttle check
      const storageKey = `shared_${type}_${targetId}`;
      const lastShared = localStorage.getItem(storageKey);
      const now = Date.now();

      if (!lastShared || now - parseInt(lastShared, 10) > 60000) { // 1 min throttle
        localStorage.setItem(storageKey, now.toString());
        try {
          const collectionName = 
            type === 'CHARACTER' ? 'characters' :
            type === 'PROMPT' ? 'prompts' : 'users';
          const docRef = doc(db, collectionName, targetId);
          await updateDoc(docRef, { sharesCount: increment(1) });
        } catch (e) {
          console.error("Failed to update share count", e);
        }
      }

      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error(err);
      toast.error("Không thể sao chép liên kết.");
    }
  };

  const handleNativeShare = async () => {
    if (urlError) {
      toast.error("Không thể chia sẻ: " + urlError);
      return;
    }
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${title} - Thế Giới Nhập vai AD`,
          text: description || `Xem ${typeLabel.toLowerCase()} "${title}" trên Thế Giới Nhập vai AD!`,
          url: shareUrl,
        });
        toast.success("Đã chia sẻ thành công!");
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error("Native share error:", err);
        }
      }
    } else {
      handleCopyLink();
    }
  };

  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(`${title} - Thế Giới Nhập vai AD`);

  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodedUrl}`;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative space-y-5"
      >
        {/* Header & Close Button */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-neutral-900 dark:text-neutral-100">
                Chia sẻ liên kết
              </h3>
              <p className="text-xs text-neutral-500">
                {typeLabel}
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Card Preview */}
        <div className="flex items-center gap-3.5 p-3.5 bg-neutral-50 dark:bg-neutral-800/60 rounded-2xl border border-neutral-200/80 dark:border-neutral-800">
          {avatar ? (
            <img 
              src={getValidAvatar(avatar)} 
              alt={title} 
              className="w-12 h-12 rounded-xl object-cover shrink-0 border border-neutral-200 dark:border-neutral-700" 
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-neutral-500 shrink-0 font-bold text-lg">
              {title.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h4 className="font-bold text-sm text-neutral-900 dark:text-neutral-100 truncate">
              {title}
            </h4>
            {description && (
              <p className="text-xs text-neutral-500 truncate mt-0.5">
                {description}
              </p>
            )}
          </div>
        </div>

        {/* URL Box & Copy Button */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
            Liên kết trực tiếp (Permanent Link)
          </label>
          <div className="flex items-center gap-2">
            <input 
              type="text" 
              readOnly 
              value={urlError ? "Lỗi: " + urlError : shareUrl}
              className={cn(
                "flex-1 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 text-xs rounded-xl px-3.5 py-2.5 focus:outline-none font-mono selection:bg-amber-500 selection:text-white",
                urlError && "text-red-500 border-red-500 dark:border-red-900"
              )}
            />
            <button
              onClick={handleCopyLink}
              disabled={!!urlError}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shrink-0 transition-all ${
                copied
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : urlError 
                  ? 'bg-neutral-300 dark:bg-neutral-700 text-neutral-500 cursor-not-allowed'
                  : 'bg-black dark:bg-white text-white dark:text-black hover:opacity-90 active:scale-95'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Đã chép</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Sao chép</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Debug Info (Development Only) */}
        {isDev && (
          <div className="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-xl text-[10px] font-mono text-neutral-500 overflow-auto max-h-48 border border-neutral-200 dark:border-neutral-700">
            <div className="font-bold border-b border-neutral-200 dark:border-neutral-700 pb-1 mb-1 text-neutral-700 dark:text-neutral-300">
              DEBUG INFO (Dev Mode Only)
            </div>
            <div className="grid grid-cols-2 gap-1">
              <span className="font-bold">Environment:</span> <span>{import.meta.env.MODE}</span>
              <span className="font-bold">Current Origin:</span> <span className="truncate">{window.location.origin}</span>
              <span className="font-bold">Configured Canonical URL:</span> 
              <span className={cn(
                "truncate font-bold",
                !getCanonicalBaseUrl() ? "text-amber-500" : "text-green-600"
              )}>
                {getCanonicalBaseUrl() || 'NOT CONFIGURED'}
              </span>
              <span className="font-bold">Canonical URL Valid:</span> 
              <span className={cn("font-bold", getCanonicalBaseUrl() ? "text-green-600" : "text-red-500")}>
                {getCanonicalBaseUrl() ? 'YES' : 'NO'}
              </span>
              <span className="font-bold">URL Source:</span> 
              <span className="font-bold text-blue-500">
                {getCanonicalBaseUrl() ? 'CANONICAL_PUBLIC_URL' : 'ERROR_NO_FALLBACK'}
              </span>
              <span className="font-bold">Share Link Status:</span>
              <span className={cn("font-bold", getCanonicalBaseUrl() ? "text-green-600" : "text-amber-600")}>
                {getCanonicalBaseUrl() ? 'STABLE' : 'DISABLED (ERROR)'}
              </span>
              <span className="font-bold">Resource:</span> <span>{type.toLowerCase()} / {targetId.substring(0, 8)}...</span>
              <span className="font-bold">Generated Path:</span> <span className="truncate">{generatedPath}</span>
              <span className="font-bold">Generated Share URL:</span> <span className="truncate text-amber-600 select-all font-bold">{shareUrl}</span>
            </div>
          </div>
        )}

        {/* Social Share Buttons */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-xs font-bold text-neutral-400 uppercase tracking-wider">
            <span>Chia sẻ qua mạng xã hội</span>
            <button
              onClick={() => setShowQR(!showQR)}
              className="flex items-center gap-1 text-amber-600 dark:text-amber-400 hover:underline capitalize font-medium text-xs"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>{showQR ? "Ẩn Mã QR" : "Tạo Mã QR"}</span>
            </button>
          </div>

          {showQR ? (
            <div className="p-4 bg-white rounded-2xl border border-neutral-200 dark:border-neutral-800 text-center space-y-2 flex flex-col items-center">
              <img src={qrApiUrl} alt="QR Code" className="w-40 h-40 rounded-xl" />
              <p className="text-[11px] text-neutral-500 font-medium">Quét mã QR bằng ứng dụng camera di động để mở nhanh</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleCopyLink}
                className="flex flex-col items-center justify-center p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors gap-1 text-xs font-semibold"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                <span>Facebook</span>
              </a>

              <a
                href={`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleCopyLink}
                className="flex flex-col items-center justify-center p-3 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors gap-1 text-xs font-semibold"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                <span>Twitter / X</span>
              </a>

              <a
                href={`https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleCopyLink}
                className="flex flex-col items-center justify-center p-3 rounded-2xl bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900/60 transition-colors gap-1 text-xs font-semibold"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.842 8.232c-.187 1.968-.98 6.643-1.383 8.8-.17.915-.506 1.22-.832 1.25-.71.066-1.25-.468-1.938-.92-.1-.067-1.57-1.002-2.115-1.468-.15-.128-.323-.377-.008-.7.733-.75 1.608-1.6 2.146-2.146.248-.25.493-.822-.534-.122-1.455.992-2.87 1.933-3.03 2.04-.25.17-.48.252-.69.245-.233-.007-.68-.134-1.012-.242-.408-.133-.732-.204-.704-.43.014-.118.175-.24.482-.365 3.01-1.31 5.02-2.173 6.03-2.59 2.87-1.187 3.468-1.393 3.858-1.4 0 0 .5-.008.31.258 font-bold"/>
                </svg>
                <span>Telegram</span>
              </a>

              <button
                onClick={handleNativeShare}
                className="flex flex-col items-center justify-center p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors gap-1 text-xs font-semibold"
              >
                <Share2 className="w-5 h-5" />
                <span>Khác</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
