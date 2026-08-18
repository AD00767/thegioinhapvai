import React, { useState, useEffect } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import { Compass, LogIn, WifiOff, RefreshCw, ArrowLeft, Mail, Lock, UserPlus, AlertCircle } from "lucide-react";
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
    description: 'Thế Giới Nhập vai AD - Khởi đầu cho mọi hành trình Roleplay trên Google AI Studio. Khám phá Character, Prompt và kết nối với cộng đồng Creator.'
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
      <div className="min-h-screen bg-white dark:bg-black text-neutral-900 dark:text-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-16 h-16 rounded-2xl bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 flex items-center justify-center mb-6">
          <WifiOff className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold mb-3 tracking-tight">Mất kết nối mạng</h2>
        <p className="text-neutral-600 dark:text-neutral-400 max-w-md mb-8 leading-relaxed text-sm">
          Không thể kết nối. Vui lòng kiểm tra kết nối mạng và thử lại.
        </p>
        <button
          onClick={handleRetryConnection}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-black dark:bg-white text-white dark:text-black font-semibold text-sm hover:opacity-90 transition-opacity cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Thử lại</span>
        </button>
      </div>
    );
  }

  // Full-Screen Authentication View
  if (viewMode === 'auth') {
    return (
      <div className="min-h-screen bg-white dark:bg-black text-neutral-900 dark:text-white flex flex-col justify-between font-sans selection:bg-neutral-200 dark:selection:bg-neutral-800 animate-in fade-in duration-200">
        {/* Full-Screen Top Bar */}
        <header className="p-6 max-w-7xl mx-auto w-full flex items-center justify-between">
          <button
            onClick={() => {
              setViewMode('welcome');
              resetAuthForm();
            }}
            className="inline-flex items-center gap-2 text-sm font-bold text-neutral-600 hover:text-black dark:text-neutral-400 dark:hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>QUAY LẠI</span>
          </button>

          <div className="flex items-center gap-3">
            <ThemeToggle />
          </div>
        </header>

        {/* Full-Screen Form Content */}
        <main className="flex-1 flex items-center justify-center p-6 my-auto">
          <div className="max-w-md w-full mx-auto space-y-6">
            
            <div className="text-center space-y-2">
              <div className="inline-block px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-900 text-[11px] font-bold uppercase tracking-widest text-neutral-600 dark:text-neutral-400">
                THẾ GIỚI NHẬP VAI AD
              </div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-neutral-900 dark:text-white uppercase">
                {authTab === 'login' ? 'ĐĂNG NHẬP' : 'TẠO TÀI KHOẢN'}
              </h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Khởi đầu cho mọi hành trình Roleplay trên Google AI Studio.
              </p>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="grid grid-cols-2 p-1 bg-neutral-100 dark:bg-neutral-900 rounded-2xl text-xs font-bold border border-neutral-200/60 dark:border-neutral-800/60">
              <button
                type="button"
                onClick={() => switchAuthTab('login')}
                className={`py-3 rounded-xl transition-all cursor-pointer ${
                  authTab === 'login'
                    ? 'bg-white dark:bg-black text-black dark:text-white shadow-sm'
                    : 'text-neutral-500 hover:text-black dark:hover:text-white'
                }`}
              >
                Đăng Nhập
              </button>
              <button
                type="button"
                onClick={() => switchAuthTab('register')}
                className={`py-3 rounded-xl transition-all cursor-pointer ${
                  authTab === 'register'
                    ? 'bg-white dark:bg-black text-black dark:text-white shadow-sm'
                    : 'text-neutral-500 hover:text-black dark:hover:text-white'
                }`}
              >
                Đăng Ký
              </button>
            </div>

            {/* Error Alert Box */}
            {authError && (
              <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-start gap-3 text-xs text-red-600 dark:text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="leading-relaxed font-medium">{authError}</div>
              </div>
            )}

            {/* Google Sign In */}
            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={authLoading}
              className="w-full py-3.5 px-4 rounded-2xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-900 text-neutral-900 dark:text-white font-semibold text-sm transition-all flex items-center justify-center gap-3 shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
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
                <div className="w-full border-t border-neutral-200 dark:border-neutral-800" />
              </div>
              <span className="relative px-3 bg-white dark:bg-black text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                hoặc sử dụng Email
              </span>
            </div>

            {/* Email Form */}
            {authTab === 'login' ? (
              <form onSubmit={handleEmailLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
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
                      className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all text-neutral-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
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
                      className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all text-neutral-900 dark:text-white"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-4 rounded-2xl bg-black dark:bg-white hover:opacity-90 text-white dark:text-black font-extrabold text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{authLoading ? 'Đang xử lý...' : 'Đăng Nhập'}</span>
                </button>

                <div className="text-center pt-2">
                  <p className="text-xs text-neutral-500">
                    Bạn chưa có tài khoản?{' '}
                    <button
                      type="button"
                      onClick={() => switchAuthTab('register')}
                      className="font-bold text-black dark:text-white hover:underline cursor-pointer ml-1"
                    >
                      Đăng ký ngay
                    </button>
                  </p>
                </div>
              </form>
            ) : (
              <form onSubmit={handleEmailRegister} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
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
                      className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all text-neutral-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
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
                      className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all text-neutral-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
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
                      className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all text-neutral-900 dark:text-white"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-4 rounded-2xl bg-black dark:bg-white hover:opacity-90 text-white dark:text-black font-extrabold text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{authLoading ? 'Đang tạo tài khoản...' : 'Đăng Ký Tài Khoản'}</span>
                </button>

                <div className="text-center pt-2">
                  <p className="text-xs text-neutral-500">
                    Đã có tài khoản?{' '}
                    <button
                      type="button"
                      onClick={() => switchAuthTab('login')}
                      className="font-bold text-black dark:text-white hover:underline cursor-pointer ml-1"
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
        <footer className="p-6 text-xs text-neutral-400 text-center max-w-7xl mx-auto w-full">
          &copy; 2026 Thế Giới Nhập vai AD. All rights reserved.
        </footer>
      </div>
    );
  }

  // Minimalist Welcome View
  return (
    <div className="min-h-screen bg-white dark:bg-black text-neutral-900 dark:text-white flex flex-col justify-between font-sans selection:bg-neutral-200 dark:selection:bg-neutral-800">
      
      {/* Minimalist Header */}
      <header className="p-6 flex justify-between items-center max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-black dark:bg-white text-white dark:text-black flex items-center justify-center font-black text-sm">
            AD
          </div>
          <div className="font-bold text-base tracking-tight uppercase">THẾ GIỚI NHẬP VAI AD</div>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button 
            onClick={() => setViewMode('auth')} 
            className="text-xs font-bold uppercase tracking-wider text-neutral-700 hover:text-black dark:text-neutral-300 dark:hover:text-white transition-colors px-4 py-2 rounded-full border border-neutral-200 dark:border-neutral-800 cursor-pointer"
          >
            ĐĂNG NHẬP
          </button>
        </div>
      </header>

      {/* Pure Minimalist Hero Section */}
      <main className="flex-1 flex items-center justify-center p-6 my-auto">
        <div className="max-w-3xl w-full mx-auto text-center space-y-10 py-8">
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="space-y-5"
          >
            {/* 1. Tên Website ở chính giữa giao diện */}
            <div className="flex items-center justify-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-2xl bg-black dark:bg-white text-white dark:text-black flex items-center justify-center font-black text-base shadow-sm">
                AD
              </div>
            </div>

            <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-neutral-900 dark:text-white uppercase leading-[1.08]">
              THẾ GIỚI NHẬP VAI AD
            </h1>
            
            {/* 2. Slogan bên dưới tên Website */}
            <p className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-neutral-800 dark:text-neutral-200">
              Khởi đầu cho mọi hành trình Roleplay
            </p>
            
            {/* 3. Dòng chữ màu xám nhỏ hơn bên dưới Slogan */}
            <p className="text-sm sm:text-base md:text-lg text-neutral-500 dark:text-neutral-400 max-w-2xl mx-auto leading-relaxed font-normal pt-1 px-4">
              Nền tảng cộng đồng dành cho Google AI Studio, nơi bạn có thể khám phá, chia sẻ Character, Prompt, Creator và các tài nguyên hữu ích cho Roleplay.
            </p>
          </motion.div>

          {/* 4. Hai nút nổi bật BẮT ĐẦU và ĐĂNG NHẬP */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 max-w-md mx-auto"
          >
            <button 
              onClick={handleStart}
              className="w-full sm:flex-1 flex items-center justify-center gap-3 px-8 py-4 rounded-full bg-black dark:bg-white text-white dark:text-black font-extrabold text-sm sm:text-base tracking-wider hover:opacity-90 active:scale-95 transition-all shadow-lg hover:shadow-xl cursor-pointer uppercase"
            >
              <Compass className="w-5 h-5 shrink-0" />
              <span>BẮT ĐẦU</span>
            </button>

            <button 
              onClick={() => setViewMode('auth')} 
              className="w-full sm:flex-1 flex items-center justify-center gap-3 px-8 py-4 rounded-full bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-neutral-900 dark:text-white font-extrabold text-sm sm:text-base tracking-wider transition-all border border-neutral-300/80 dark:border-neutral-700/80 active:scale-95 shadow-sm cursor-pointer uppercase"
            >
              <LogIn className="w-5 h-5 shrink-0" />
              <span>ĐĂNG NHẬP</span>
            </button>
          </motion.div>

        </div>
      </main>

      {/* Minimalist Footer */}
      <footer className="p-6 text-xs text-neutral-500 border-t border-neutral-100 dark:border-neutral-900 max-w-7xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-center sm:text-left">
            <span className="font-bold text-neutral-900 dark:text-neutral-100">Thế Giới Nhập vai AD</span>
            <span className="opacity-40">|</span>
            <span className="hidden sm:inline">Khởi đầu cho mọi hành trình Roleplay.</span>
            <span className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-[10px] font-mono">v1.0</span>
          </div>

          <div className="flex items-center gap-6">
            <Link to="/privacy" className="hover:text-black dark:hover:text-white transition-colors">Bảo mật</Link>
            <Link to="/terms" className="hover:text-black dark:hover:text-white transition-colors">Điều khoản</Link>
            <Link to="/contact" className="hover:text-black dark:hover:text-white transition-colors">Liên hệ</Link>
          </div>

          <div className="text-center sm:text-right opacity-60">
            &copy; 2026 Thế Giới Nhập vai AD.
          </div>
        </div>
      </footer>
    </div>
  );
}

