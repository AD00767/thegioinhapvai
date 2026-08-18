import React, { useState } from 'react';
import { X, Mail, Lock, LogIn, UserPlus, AlertCircle, Sparkles, ArrowLeft } from 'lucide-react';
import { loginWithGoogle, loginWithEmail, registerWithEmail } from '../../lib/firebase';
import { useAuthStore } from '../../store/useAuthStore';
import toast from 'react-hot-toast';
import ThemeToggle from '../ThemeToggle';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: 'login' | 'register';
  onSuccess?: () => void;
  fullScreen?: boolean;
}

export default function AuthModal({ isOpen, onClose, defaultMode = 'login', onSuccess, fullScreen = true }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>(defaultMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setErrorMsg(null);
  };

  const handleSwitchMode = (newMode: 'login' | 'register') => {
    setMode(newMode);
    resetForm();
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      await loginWithGoogle();
      sessionStorage.setItem('has_entered_app', 'true');
      window.dispatchEvent(new Event('app-entered-changed'));
      toast.success("Đăng nhập bằng Google thành công!");
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Không thể đăng nhập bằng Google. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!email.trim() || !password) {
      setErrorMsg("Vui lòng điền đầy đủ Email và Mật khẩu.");
      return;
    }

    setLoading(true);
    try {
      const res = await loginWithEmail(email, password);
      if (res && res.user) {
        useAuthStore.getState().setAuth(res.user, res.backendData);
      }
      sessionStorage.setItem('has_entered_app', 'true');
      window.dispatchEvent(new Event('app-entered-changed'));
      toast.success("Đăng nhập thành công!");
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Đăng nhập thất bại.");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !password || !confirmPassword) {
      setErrorMsg("Vui lòng điền đầy đủ các thông tin đăng ký.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setErrorMsg("Địa chỉ Email không đúng định dạng.");
      return;
    }

    if (password.length < 6) {
      setErrorMsg("Mật khẩu phải chứa ít nhất 6 ký tự.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("Mật khẩu xác nhận không trùng khớp.");
      return;
    }

    setLoading(true);
    try {
      const res = await registerWithEmail(cleanEmail, password);
      if (res && res.user) {
        useAuthStore.getState().setAuth(res.user, res.backendData);
      }
      sessionStorage.setItem('has_entered_app', 'true');
      window.dispatchEvent(new Event('app-entered-changed'));
      toast.success("Đăng ký tài khoản thành công!");
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Đăng ký thất bại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-black text-neutral-900 dark:text-white flex flex-col justify-between overflow-y-auto animate-in fade-in duration-200">
      {/* Full-screen Top Navigation */}
      <header className="p-6 max-w-7xl mx-auto w-full flex items-center justify-between">
        <button
          onClick={onClose}
          className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-600 hover:text-black dark:text-neutral-400 dark:hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại</span>
        </button>

        <div className="flex items-center gap-4">
          <ThemeToggle />
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900 text-neutral-500 hover:text-black dark:hover:text-white transition-colors cursor-pointer"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Centered Form Container */}
      <main className="flex-1 flex items-center justify-center p-6 my-auto">
        <div className="max-w-md w-full mx-auto space-y-6">
          
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="inline-block px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-900 text-xs font-bold uppercase tracking-widest text-neutral-600 dark:text-neutral-400">
              THẾ GIỚI NHẬP VAI AD
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-900 dark:text-white uppercase">
              {mode === 'login' ? 'ĐĂNG NHẬP' : 'TẠO TÀI KHOẢN'}
            </h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Khởi đầu cho mọi hành trình Roleplay trên Google AI Studio.
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 p-1 bg-neutral-100 dark:bg-neutral-900 rounded-2xl text-xs font-bold border border-neutral-200/60 dark:border-neutral-800/60">
            <button
              type="button"
              onClick={() => handleSwitchMode('login')}
              className={`py-3 rounded-xl transition-all cursor-pointer ${
                mode === 'login'
                  ? 'bg-white dark:bg-black text-black dark:text-white shadow-sm'
                  : 'text-neutral-500 hover:text-black dark:hover:text-white'
              }`}
            >
              Đăng Nhập
            </button>
            <button
              type="button"
              onClick={() => handleSwitchMode('register')}
              className={`py-3 rounded-xl transition-all cursor-pointer ${
                mode === 'register'
                  ? 'bg-white dark:bg-black text-black dark:text-white shadow-sm'
                  : 'text-neutral-500 hover:text-black dark:hover:text-white'
              }`}
            >
              Đăng Ký
            </button>
          </div>

          {/* Error Alert Box */}
          {errorMsg && (
            <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-start gap-3 text-xs text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="leading-relaxed font-medium">{errorMsg}</div>
            </div>
          )}

          {/* Method 1: Google Sign In */}
          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={loading}
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
            <span>{mode === 'login' ? 'Đăng nhập bằng Google' : 'Đăng ký nhanh bằng Google'}</span>
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

          {/* Method 2: Email Form */}
          {mode === 'login' ? (
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
                disabled={loading}
                className="w-full py-4 rounded-2xl bg-black dark:bg-white hover:opacity-90 text-white dark:text-black font-extrabold text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>{loading ? 'Đang xử lý...' : 'Đăng Nhập'}</span>
              </button>

              <div className="text-center pt-2">
                <p className="text-xs text-neutral-500">
                  Bạn chưa có tài khoản?{' '}
                  <button
                    type="button"
                    onClick={() => handleSwitchMode('register')}
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
                disabled={loading}
                className="w-full py-4 rounded-2xl bg-black dark:bg-white hover:opacity-90 text-white dark:text-black font-extrabold text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>{loading ? 'Đang tạo tài khoản...' : 'Đăng Ký Tài Khoản'}</span>
              </button>

              <div className="text-center pt-2">
                <p className="text-xs text-neutral-500">
                  Đã có tài khoản?{' '}
                  <button
                    type="button"
                    onClick={() => handleSwitchMode('login')}
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
