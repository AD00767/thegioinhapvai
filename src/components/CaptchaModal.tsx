import React, { useState, useEffect, useRef } from 'react';
import { Shield, RefreshCw, X, ArrowRight, ShieldCheck } from 'lucide-react';

interface CaptchaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  actionLabel?: string;
}

export default function CaptchaModal({ isOpen, onClose, onSuccess, actionLabel = 'thực hiện hành động' }: CaptchaModalProps) {
  const [captchaText, setCaptchaText] = useState('');
  const [userInput, setUserInput] = useState('');
  const [sliderPosition, setSliderPosition] = useState(0);
  const [isSliderVerified, setIsSliderVerified] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sliderTrackRef = useRef<HTMLDivElement>(null);

  // Generate random string
  const generateRandomText = () => {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Avoid confusing chars like 1, 0, I, O
    let result = '';
    for (let i = 0; i < 5; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const drawCaptcha = (text: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Reset canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background
    const isDark = document.documentElement.classList.contains('dark');
    ctx.fillStyle = isDark ? '#1f1f1f' : '#f5f5f5';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw noise lines
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) {
      ctx.strokeStyle = isDark 
        ? `rgba(245, 158, 11, ${0.1 + Math.random() * 0.2})` 
        : `rgba(217, 119, 6, ${0.1 + Math.random() * 0.2})`;
      ctx.beginPath();
      ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
      ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
      ctx.stroke();
    }

    // Draw noise dots
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)';
      ctx.beginPath();
      ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, 1 + Math.random() * 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw text with random distortion, rotation, and colors
    ctx.font = 'bold 32px monospace';
    ctx.textBaseline = 'middle';
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const x = 30 + i * 36;
      const y = canvas.height / 2 + (Math.random() * 10 - 5);
      const angle = (Math.random() * 30 - 15) * Math.PI / 180; // rotation between -15deg and 15deg

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);

      // Color variation
      ctx.fillStyle = isDark 
        ? `hsl(${35 + Math.random() * 15}, 90%, ${70 + Math.random() * 15}%)` 
        : `hsl(${35 + Math.random() * 15}, 90%, ${30 + Math.random() * 15}%)`;

      ctx.fillText(char, -10, 0);
      ctx.restore();
    }
  };

  const initCaptcha = () => {
    const text = generateRandomText();
    setCaptchaText(text);
    setUserInput('');
    setSliderPosition(0);
    setIsSliderVerified(false);
    setError(null);
    setTimeout(() => drawCaptcha(text), 50);
  };

  useEffect(() => {
    if (isOpen) {
      initCaptcha();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle slider events
  const handleStartDrag = () => {
    if (isSliderVerified) return;
    setIsDragging(true);
  };

  const handleDrag = (clientX: number) => {
    if (!isDragging || isSliderVerified || !sliderTrackRef.current) return;
    const trackRect = sliderTrackRef.current.getBoundingClientRect();
    const trackWidth = trackRect.width - 50; // slider handle width
    let pos = clientX - trackRect.left - 25;
    
    if (pos < 0) pos = 0;
    if (pos > trackWidth) pos = trackWidth;
    
    const percentage = (pos / trackWidth) * 100;
    setSliderPosition(percentage);

    if (percentage > 98) {
      setIsSliderVerified(true);
      setIsDragging(false);
      setSliderPosition(100);
    }
  };

  const handleEndDrag = () => {
    setIsDragging(false);
    if (!isSliderVerified) {
      // snap back
      setSliderPosition(0);
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      handleDrag(e.touches[0].clientX);
    }
  };

  const onMouseMove = (e: React.MouseEvent) => {
    handleDrag(e.clientX);
  };

  // Submit CAPTCHA validation
  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (userInput.toUpperCase() !== captchaText) {
      setError('Mã xác thực không chính xác. Vui lòng nhập lại.');
      initCaptcha();
      return;
    }

    if (!isSliderVerified) {
      setError('Vui lòng kéo thanh trượt để xác minh bạn là con người.');
      return;
    }

    // Success!
    onSuccess();
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onMouseMove={isDragging ? onMouseMove : undefined}
      onMouseUp={isDragging ? handleEndDrag : undefined}
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      {/* Container */}
      <div className="relative bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl z-10 p-6 space-y-6 animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-500">
            <Shield className="w-5 h-5" />
            <h3 className="font-extrabold text-base tracking-tight text-neutral-900 dark:text-neutral-100">
              Xác Minh Bảo Mật
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>

        <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
          Để bảo vệ hệ thống khỏi spam và lạm dụng, vui lòng hoàn thành thử thách bảo mật dưới đây để {actionLabel}.
        </p>

        {/* Canvas & Refresh */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="relative border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-inner flex-1">
              <canvas 
                ref={canvasRef} 
                width={220} 
                height={70} 
                className="w-full h-[70px] block"
              />
            </div>
            <button 
              type="button" 
              onClick={initCaptcha}
              className="p-3 rounded-2xl border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 text-neutral-500 transition-all shadow-sm"
              title="Đổi mã bảo mật"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form and slider */}
        <form onSubmit={handleVerify} className="space-y-4">
          {/* Text Input */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
              Nhập mã hiển thị phía trên <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Nhập 5 ký tự bảo mật..."
              maxLength={5}
              className="w-full px-4 py-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-sm font-mono tracking-widest text-center uppercase focus:outline-none focus:ring-2 focus:ring-amber-500"
              required
            />
          </div>

          {/* Sliding Track Puzzle */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
              Kéo thanh trượt để xác minh <span className="text-red-500">*</span>
            </label>
            <div 
              ref={sliderTrackRef}
              className="relative h-12 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-full overflow-hidden select-none"
              onTouchMove={isDragging ? onTouchMove : undefined}
              onTouchEnd={isDragging ? handleEndDrag : undefined}
            >
              {/* Fill background */}
              <div 
                className="absolute left-0 top-0 bottom-0 bg-amber-500/10 dark:bg-amber-500/20 transition-all duration-75"
                style={{ width: `${sliderPosition}%` }}
              />

              {/* Verified Text placeholder */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                {isSliderVerified ? (
                  <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <ShieldCheck className="w-4 h-4" /> Đã xác thực con người
                  </span>
                ) : (
                  <span>Kéo sang phải để trượt</span>
                )}
              </div>

              {/* Slider Handle */}
              <div 
                onMouseDown={handleStartDrag}
                onTouchStart={handleStartDrag}
                className={`absolute top-1 bottom-1 w-10 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing shadow-md border transition-colors ${
                  isSliderVerified 
                    ? 'bg-amber-500 border-amber-500 text-black left-[calc(100%-44px)]' 
                    : 'bg-white dark:bg-neutral-950 border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300'
                }`}
                style={isSliderVerified ? {} : { left: `${sliderPosition}%`, transform: `translateX(${-sliderPosition * 0.4}px)` }}
              >
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <p className="text-xs text-red-500 dark:text-red-400 font-semibold text-center animate-shake">
              {error}
            </p>
          )}

          {/* Verify Button */}
          <button
            type="submit"
            disabled={!isSliderVerified || userInput.length < 5}
            className="w-full py-3.5 rounded-2xl bg-black dark:bg-white hover:opacity-90 text-white dark:text-black font-extrabold text-xs md:text-sm shadow-lg transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Xác Minh & Tiếp Tục</span>
          </button>
        </form>
      </div>
    </div>
  );
}
