import React, { useState, useEffect } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import { WifiOff, RefreshCw, ArrowLeft, Mail, Lock, UserPlus, AlertCircle } from "lucide-react";
import { motion } from "motion/react";
import { useSeo } from "../hooks/useSeo";
import ThemeToggle from "../components/ThemeToggle";
import { loginWithGoogle, loginWithEmail, registerWithEmail } from "../lib/firebase";
import toast from "react-hot-toast";

interface WelcomeProps {
  onStart?: () => void;
}

export default function Welcome({ onStart }: WelcomeProps) {
  const { user } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'welcome' | 'auth'>('welcome');
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  const from = location.state?.from?.pathname || "/";

  useSeo({
    title: 'THẾ GIỚI NHẬP VAI AD - KHỞI ĐẦU CHO MỌI HÀNH TRÌNH ROLEPLAY',
    description: 'Nơi khám phá, chia sẻ và kết nối cùng thế giới Roleplay trên Google AI Studio.'
  });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (user) {
    return <Navigate to={from} replace />;
  }

  const handleStart = () => {
    sessionStorage.setItem('has_entered_app', 'true');
    window.dispatchEvent(new Event('app-entered-changed'));
    if (onStart) {
      onStart();
    } else {
      navigate('/');
    }
  };

  const handleRetryConnection = () => {
    setIsOnline(navigator.onLine);
    if (navigator.onLine) {
      window.location.reload();
    }
  };

  const resetAuthForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setAuthError(null);
  };

  const switchAuthTab = (tab: 'login' | 'register') => {
    setAuthTab(tab);
    resetAuthForm();
  };

  const handleGoogleAuth = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      await loginWithGoogle();
      toast.success("Đăng nhập bằng Google thành công!");
      sessionStorage.setItem('has_entered_app', 'true');
      window.dispatchEvent(new Event('app-entered-changed'));
      if (onStart) onStart();
      else navigate('/');
    } catch (err: any) {
      console.error(err);
      setAuthError(err.message || "Không thể đăng nhập bằng Google. Vui lòng thử lại.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (!email.trim() || !password) {
      setAuthError("Vui lòng điền đầy đủ Email và Mật khẩu.");
      return;
    }

    setAuthLoading(true);
    try {
      await loginWithEmail(email.trim(), password);
      toast.success("Đăng nhập thành công!");
      sessionStorage.setItem('has_entered_app', 'true');
      window.dispatchEvent(new Event('app-entered-changed'));
      if (onStart) onStart();
      else navigate('/');
    } catch (err: any) {
      setAuthError(err.message || "Đăng nhập thất bại.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !password || !confirmPassword) {
      setAuthError("Vui lòng điền đầy đủ các thông tin đăng ký.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setAuthError("Địa chỉ Email không đúng định dạng.");
      return;
    }

    if (password.length < 6) {
      setAuthError("Mật khẩu phải chứa ít nhất 6 ký tự.");
      return;
    }

    if (password !== confirmPassword) {
      setAuthError("Mật khẩu xác nhận không trùng khớp.");
      return;
    }

    setAuthLoading(true);
    try {
      await registerWithEmail(cleanEmail, password);
      toast.success("Đăng ký tài khoản thành công!");
      sessionStorage.setItem('has_entered_app', 'true');
      window.dispatchEvent(new Event('app-entered-changed'));
      if (onStart) onStart();
      else navigate('/');
    } catch (err: any) {
      setAuthError(err.message || "Đăng ký thất bại.");
    } finally {
      setAuthLoading(false);
    }
  };

  // Offline State (Module 03 Section XI)
  if (!isOnline) {
    return (
      <div className="min-h-screen bg-[#F7F6F3] dark:bg-[#050505] text-neutral-950 dark:text-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-16 h-16 rounded-2xl bg-neutral-200/60 dark:bg-neutral-900 border border-black/5 dark:border-white/10 text-neutral-600 dark:text-neutral-400 flex items-center justify-center mb-6">
          <WifiOff className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-serif font-bold mb-3 tracking-tight">Mất kết nối mạng</h2>
        <p className="text-neutral-600 dark:text-neutral-400 max-w-md mb-8 leading-relaxed text-sm">
          Không thể kết nối. Vui lòng kiểm tra kết nối mạng và thử lại.
        </p>
        <button
          onClick={handleRetryConnection}
          className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-neutral-950 dark:bg-white text-white dark:text-black font-semibold text-sm hover:opacity-90 transition-opacity cursor-pointer uppercase tracking-wider"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Thử lại</span>
        </button>
      </div>
    );
  }

  // Full-Screen Authentication View in Matching Dark Luxury Editorial Style
  if (viewMode === 'auth') {
    return (
      <div className="min-h-screen bg-[#F7F6F3] dark:bg-[#050505] text-neutral-950 dark:text-white flex flex-col justify-between font-sans selection:bg-neutral-300 dark:selection:bg-neutral-800 animate-in fade-in duration-300">
        {/* Top bar with back button & theme toggle */}
        <header className="p-6 sm:px-12 max-w-7xl mx-auto w-full flex items-center justify-between">
          <button
            onClick={() => {
              setViewMode('welcome');
              resetAuthForm();
            }}
            className="inline-flex items-center gap-2 text-xs font-bold tracking-widest text-neutral-600 hover:text-black dark:text-neutral-400 dark:hover:text-white transition-colors cursor-pointer uppercase"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>QUAY LẠI</span>
          </button>

          <div className="flex items-center gap-3">
            <ThemeToggle />
          </div>
        </header>

        {/* Auth Content */}
        <main className="flex-1 flex items-center justify-center p-6 my-auto">
          <div className="max-w-md w-full mx-auto space-y-6">
            
            <div className="text-center space-y-3">
              <div className="inline-flex items-center justify-center px-3.5 py-1 rounded-full bg-neutral-950 text-white dark:bg-white dark:text-black text-[10px] font-semibold tracking-[0.2em] uppercase">
                GOOGLE AI STUDIO COMMUNITY
              </div>
              <h1 className="text-3xl sm:text-4xl font-serif font-bold tracking-tight text-neutral-950 dark:text-white uppercase">
                {authTab === 'login' ? 'ĐĂNG NHẬP' : 'TẠO TÀI KHOẢN'}
              </h1>
              <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 font-sans">
                Nơi khám phá, chia sẻ và kết nối cùng thế giới Roleplay trên Google AI Studio.
              </p>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="grid grid-cols-2 p-1 bg-black/5 dark:bg-white/5 rounded-xl text-xs font-semibold border border-black/10 dark:border-white/10">
              <button
                type="button"
                onClick={() => switchAuthTab('login')}
                className={`py-3 rounded-lg transition-all cursor-pointer uppercase tracking-wider ${
                  authTab === 'login'
                    ? 'bg-white dark:bg-neutral-900 text-neutral-950 dark:text-white shadow-sm font-bold'
                    : 'text-neutral-500 hover:text-black dark:hover:text-white'
                }`}
              >
                Đăng Nhập
              </button>
              <button
                type="button"
                onClick={() => switchAuthTab('register')}
                className={`py-3 rounded-lg transition-all cursor-pointer uppercase tracking-wider ${
                  authTab === 'register'
                    ? 'bg-white dark:bg-neutral-900 text-neutral-950 dark:text-white shadow-sm font-bold'
                    : 'text-neutral-500 hover:text-black dark:hover:text-white'
                }`}
              >
                Đăng Ký
              </button>
            </div>

            {/* Error Alert Box */}
            {authError && (
              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-start gap-3 text-xs text-red-600 dark:text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="leading-relaxed font-medium">{authError}</div>
              </div>
            )}

            {/* Google Sign In */}
            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={authLoading}
              className="w-full py-3.5 px-4 rounded-xl border border-neutral-950/20 dark:border-white/20 bg-white dark:bg-transparent hover:bg-neutral-100 dark:hover:bg-white/5 text-neutral-950 dark:text-white font-semibold text-sm transition-all flex items-center justify-center gap-3 shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{authTab === 'login' ? 'Đăng nhập bằng Google' : 'Đăng ký nhanh bằng Google'}</span>
            </button>

            {/* Divider */}
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-black/10 dark:border-white/10" />
              </div>
              <span className="relative px-3 bg-[#F7F6F3] dark:bg-[#050505] text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                hoặc sử dụng Email
              </span>
            </div>

            {/* Email Form */}
            {authTab === 'login' ? (
              <form onSubmit={handleEmailLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      required
                      className="w-full pl-11 pr-4 py-3 rounded-xl bg-white dark:bg-neutral-900 border border-black/10 dark:border-white/10 text-sm focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white transition-all text-neutral-950 dark:text-white"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                    Mật khẩu
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full pl-11 pr-4 py-3 rounded-xl bg-white dark:bg-neutral-900 border border-black/10 dark:border-white/10 text-sm focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white transition-all text-neutral-950 dark:text-white"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-3.5 rounded-xl bg-neutral-950 dark:bg-white hover:opacity-90 text-white dark:text-black font-bold text-xs sm:text-sm tracking-wider uppercase transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  <span>{authLoading ? 'Đang xử lý...' : 'ĐĂNG NHẬP'}</span>
                </button>

                <div className="text-center pt-1">
                  <p className="text-xs text-neutral-500">
                    Bạn chưa có tài khoản?{' '}
                    <button
                      type="button"
                      onClick={() => switchAuthTab('register')}
                      className="font-bold text-neutral-950 dark:text-white hover:underline cursor-pointer ml-1"
                    >
                      Đăng ký ngay
                    </button>
                  </p>
                </div>
              </form>
            ) : (
              <form onSubmit={handleEmailRegister} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      required
                      className="w-full pl-11 pr-4 py-3 rounded-xl bg-white dark:bg-neutral-900 border border-black/10 dark:border-white/10 text-sm focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white transition-all text-neutral-950 dark:text-white"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                    Mật khẩu
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Ít nhất 6 ký tự"
                      minLength={6}
                      required
                      className="w-full pl-11 pr-4 py-3 rounded-xl bg-white dark:bg-neutral-900 border border-black/10 dark:border-white/10 text-sm focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white transition-all text-neutral-950 dark:text-white"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                    Xác nhận Mật khẩu
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Nhập lại mật khẩu..."
                      minLength={6}
                      required
                      className="w-full pl-11 pr-4 py-3 rounded-xl bg-white dark:bg-neutral-900 border border-black/10 dark:border-white/10 text-sm focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white transition-all text-neutral-950 dark:text-white"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-3.5 rounded-xl bg-neutral-950 dark:bg-white hover:opacity-90 text-white dark:text-black font-bold text-xs sm:text-sm tracking-wider uppercase transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{authLoading ? 'Đang tạo tài khoản...' : 'ĐĂNG KÝ TÀI KHOẢN'}</span>
                </button>

                <div className="text-center pt-1">
                  <p className="text-xs text-neutral-500">
                    Đã có tài khoản?{' '}
                    <button
                      type="button"
                      onClick={() => switchAuthTab('login')}
                      className="font-bold text-neutral-950 dark:text-white hover:underline cursor-pointer ml-1"
                    >
                      Đăng nhập
                    </button>
                  </p>
                </div>
              </form>
            )}

          </div>
        </main>

        {/* Footer */}
        <footer className="p-6 text-xs text-neutral-500 text-center max-w-7xl mx-auto w-full border-t border-black/10 dark:border-white/10">
          &copy; 2026 THẾ GIỚI NHẬP VAI AD
        </footer>
      </div>
    );
  }

  // Pure Dark Luxury / Editorial / Cinematic / Minimal Welcome Page
  return (
    <div className="min-h-screen bg-[#F7F6F3] dark:bg-[#050505] text-neutral-950 dark:text-white flex flex-col justify-between selection:bg-neutral-300 dark:selection:bg-neutral-800 transition-colors duration-300">
      
      {/* Discreet Top Navigation Bar for Theme Switching */}
      <header className="w-full p-6 sm:px-12 flex items-center justify-end">
        <div className="flex items-center gap-3">
          <ThemeToggle />
        </div>
      </header>

      {/* Main Hero Section: Pure Typography & Whitespace */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 sm:px-10 py-10 md:py-16 my-auto">
        <div className="max-w-4xl w-full mx-auto text-center flex flex-col items-center">
          
          {/* 1. BRAND LABEL */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="mb-4 sm:mb-6"
          >
            <span className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-neutral-950 text-white dark:bg-white dark:text-black text-[10px] sm:text-xs font-semibold tracking-[0.2em] sm:tracking-[0.25em] uppercase">
              GOOGLE AI STUDIO COMMUNITY
            </span>
          </motion.div>

          {/* 2. TÊN WEBSITE (MAIN HEADING) */}
          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
            className="font-serif font-bold text-3xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl tracking-tight uppercase text-neutral-950 dark:text-white leading-[1.1] sm:leading-[1.08] mb-3 sm:mb-4 text-center max-w-5xl"
          >
            THẾ GIỚI NHẬP VAI AD
          </motion.h1>

          {/* 3. TAGLINE */}
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
            className="font-serif font-semibold text-sm sm:text-lg md:text-xl lg:text-2xl uppercase tracking-[0.14em] sm:tracking-[0.18em] text-neutral-700 dark:text-neutral-300 mb-4 sm:mb-6 text-center"
          >
            KHỞI ĐẦU CHO MỌI HÀNH TRÌNH ROLEPLAY
          </motion.p>

          {/* 4. MÔ TẢ (DESCRIPTION) */}
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
            className="font-sans font-normal text-sm sm:text-base md:text-lg text-neutral-600 dark:text-neutral-400 max-w-xl mx-auto leading-relaxed mb-8 sm:mb-12 px-2 text-center"
          >
            Nơi khám phá, chia sẻ và kết nối cùng thế giới Roleplay trên Google AI Studio.
          </motion.p>

          {/* 5. CTA BUTTONS */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3.5 sm:gap-5 w-full max-w-md mx-auto"
          >
            {/* Primary CTA: BẮT ĐẦU */}
            <button
              onClick={handleStart}
              aria-label="Bắt đầu"
              className="w-full sm:flex-1 py-4 px-8 rounded-xl bg-neutral-950 text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 font-semibold text-sm sm:text-base uppercase tracking-wider transition-colors duration-200 shadow-sm cursor-pointer min-h-[50px] flex items-center justify-center active:scale-[0.99]"
            >
              <span>BẮT ĐẦU</span>
            </button>

            {/* Secondary CTA: ĐĂNG NHẬP */}
            <button
              onClick={() => setViewMode('auth')}
              aria-label="Đăng nhập"
              className="w-full sm:flex-1 py-4 px-8 rounded-xl bg-transparent border border-neutral-950/30 text-neutral-950 hover:border-neutral-950 hover:bg-black/5 dark:border-white/30 dark:text-white dark:hover:border-white dark:hover:bg-white/5 font-semibold text-sm sm:text-base uppercase tracking-wider transition-colors duration-200 cursor-pointer min-h-[50px] flex items-center justify-center active:scale-[0.99]"
            >
              <span>ĐĂNG NHẬP</span>
            </button>
          </motion.div>

        </div>
      </main>

      {/* 6. FOOTER: Divider, Left Copyright, Right Links */}
      <footer className="w-full border-t border-black/10 dark:border-white/10 py-6 px-6 sm:px-12 transition-colors duration-300">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-sans tracking-wider uppercase text-neutral-600 dark:text-neutral-400">
          
          {/* Left: Copyright */}
          <div className="text-center sm:text-left">
            &copy; 2026 THẾ GIỚI NHẬP VAI AD
          </div>

          {/* Right: Quick Links */}
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap justify-center">
            <Link
              to="/contact"
              aria-label="Liên hệ"
              className="hover:text-black dark:hover:text-white transition-colors duration-150"
            >
              LIÊN HỆ
            </Link>
            <span className="opacity-40 select-none">·</span>
            <Link
              to="/terms"
              aria-label="Điều khoản"
              className="hover:text-black dark:hover:text-white transition-colors duration-150"
            >
              ĐIỀU KHOẢN
            </Link>
            <span className="opacity-40 select-none">·</span>
            <Link
              to="/privacy"
              aria-label="Bảo mật"
              className="hover:text-black dark:hover:text-white transition-colors duration-150"
            >
              BẢO MẬT
            </Link>
          </div>

        </div>
      </footer>

    </div>
  );
}
