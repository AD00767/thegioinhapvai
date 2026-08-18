import React, { useState, useEffect } from 'react';
import { 
  User as UserIcon, Bell, Monitor, LogOut, Lock, ShieldCheck, 
  Check, Sun, Moon, Laptop, Type, CheckCircle2, AlertTriangle, 
  Sparkles, Mail, Calendar, UserCheck, Smartphone, Key, Eye, EyeOff, Shield
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { logout, db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { applyTheme, applyFontSize, ThemeMode, FontSize } from '../lib/themeFont';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function Settings() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  // Active Tab: 'ACCOUNT' | 'NOTIFICATIONS' | 'APPEARANCE' | 'LOGOUT'
  const [activeTab, setActiveTab] = useState<'ACCOUNT' | 'NOTIFICATIONS' | 'APPEARANCE' | 'LOGOUT'>('ACCOUNT');

  // Theme & Font states
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    return (localStorage.getItem('app_theme_mode') as ThemeMode) || 'SYSTEM';
  });

  const [fontSize, setFontSizeState] = useState<FontSize>(() => {
    return (localStorage.getItem('app_font_size') as FontSize) || 'MEDIUM';
  });

  // Notification toggles
  const [notifFollow, setNotifFollow] = useState(true);
  const [notifFeedback, setNotifFeedback] = useState(true);
  const [notifNewContent, setNotifNewContent] = useState(true);
  const [notifInteractions, setNotifInteractions] = useState(true);
  const [notifEmail, setNotifEmail] = useState(true);

  // Email mask toggle
  const [showEmail, setShowEmail] = useState(false);

  // Logout modal confirmation state
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Load user saved notification settings if available
  useEffect(() => {
    const saved = localStorage.getItem('app_notif_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setNotifFollow(parsed.follow ?? true);
        setNotifFeedback(parsed.feedback ?? true);
        setNotifNewContent(parsed.newContent ?? true);
        setNotifInteractions(parsed.interactions ?? true);
        setNotifEmail(parsed.email ?? true);
      } catch (e) {
        console.error("Parse settings error", e);
      }
    }

    const handleThemeChangeEvt = (e: Event) => {
      const customEvent = e as CustomEvent<ThemeMode>;
      if (customEvent.detail) {
        setThemeMode(customEvent.detail);
      }
    };

    window.addEventListener('app-theme-changed', handleThemeChangeEvt);
    return () => {
      window.removeEventListener('app-theme-changed', handleThemeChangeEvt);
    };
  }, []);

  // Handle Theme Change
  const handleThemeChange = async (mode: ThemeMode) => {
    setThemeMode(mode);
    applyTheme(mode);
    toast.success(
      mode === 'LIGHT' ? 'Đã chuyển sang Chế độ Sáng' :
      mode === 'DARK' ? 'Đã chuyển sang Chế độ Tối' :
      'Đã thiết lập Theo hệ thống'
    );

    if (user?.id) {
      try {
        await updateDoc(doc(db, 'users', user.id), {
          themePreference: mode
        });
      } catch (err) {
        console.error("Failed to save theme preference to user profile:", err);
      }
    }
  };

  // Handle Font Size Change
  const handleFontSizeChange = (size: FontSize) => {
    setFontSizeState(size);
    applyFontSize(size);
    toast.success(
      size === 'SMALL' ? 'Đã điều chỉnh cỡ chữ: Nhỏ' :
      size === 'LARGE' ? 'Đã điều chỉnh cỡ chữ: Lớn' :
      'Đã điều chỉnh cỡ chữ: Trung bình'
    );
  };

  // Save Notification settings
  const handleSaveNotifications = async (updated: any) => {
    localStorage.setItem('app_notif_settings', JSON.stringify(updated));
    toast.success('Đã lưu thiết lập thông báo!');

    if (user?.id) {
      try {
        await updateDoc(doc(db, 'users', user.id), {
          notificationPreferences: updated
        });
      } catch (err) {
        console.error("Firestore update error:", err);
      }
    }
  };

  // Handle Logout All Devices
  const handleConfirmLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      useAuthStore.getState().setAuth(null, null);
      localStorage.removeItem('app_notif_settings');
      toast.success('Đã đăng xuất thành công khỏi tất cả thiết bị!');
      setShowLogoutModal(false);
      navigate('/welcome');
    } catch (err) {
      console.error("Logout error:", err);
      toast.error('Có lỗi xảy ra khi đăng xuất.');
    } finally {
      setLoggingOut(false);
    }
  };

  // Format Join Date
  const getFormattedJoinDate = () => {
    if (!user) return 'Chưa cập nhật';
    if (user.createdAt) {
      if (user.createdAt.toDate) {
        return user.createdAt.toDate().toLocaleDateString('vi-VN', { year: 'numeric', month: 'long', day: 'numeric' });
      }
      if (typeof user.createdAt === 'string' || typeof user.createdAt === 'number') {
        return new Date(user.createdAt).toLocaleDateString('vi-VN', { year: 'numeric', month: 'long', day: 'numeric' });
      }
    }
    return 'Tháng 7, 2026';
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-neutral-900 via-neutral-800 to-black text-white p-6 md:p-8 rounded-3xl shadow-xl border border-neutral-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-neutral-800 text-neutral-300 rounded-full text-xs font-bold border border-neutral-700">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>Quản Lý Hệ Thống</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Cài Đặt Hệ Thống</h1>
          <p className="text-neutral-400 text-xs md:text-sm">
            Tùy chỉnh thông tin tài khoản, cài đặt thông báo, giao diện hiển thị và bảo mật đăng xuất.
          </p>
        </div>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
        {/* Navigation Sidebar / Mobile Tab bar */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-2 md:p-3 shadow-sm grid grid-cols-2 sm:grid-cols-4 md:flex md:flex-col gap-1">
          <button
            onClick={() => setActiveTab('ACCOUNT')}
            className={`flex items-center justify-center md:justify-start gap-2.5 px-3 md:px-4 py-2.5 md:py-3 rounded-2xl text-xs md:text-sm font-bold transition-all text-center md:text-left ${
              activeTab === 'ACCOUNT'
                ? 'bg-black dark:bg-white text-white dark:text-black shadow-md'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            <UserIcon className="w-4 h-4 shrink-0" />
            <span className="truncate">Tài khoản</span>
          </button>

          <button
            onClick={() => setActiveTab('NOTIFICATIONS')}
            className={`flex items-center justify-center md:justify-start gap-2.5 px-3 md:px-4 py-2.5 md:py-3 rounded-2xl text-xs md:text-sm font-bold transition-all text-center md:text-left ${
              activeTab === 'NOTIFICATIONS'
                ? 'bg-black dark:bg-white text-white dark:text-black shadow-md'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            <Bell className="w-4 h-4 shrink-0" />
            <span className="truncate">Thông báo</span>
          </button>

          <button
            onClick={() => setActiveTab('APPEARANCE')}
            className={`flex items-center justify-center md:justify-start gap-2.5 px-3 md:px-4 py-2.5 md:py-3 rounded-2xl text-xs md:text-sm font-bold transition-all text-center md:text-left ${
              activeTab === 'APPEARANCE'
                ? 'bg-black dark:bg-white text-white dark:text-black shadow-md'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            <Monitor className="w-4 h-4 shrink-0" />
            <span className="truncate">Giao diện</span>
          </button>

          <button
            onClick={() => setActiveTab('LOGOUT')}
            className={`flex items-center justify-center md:justify-start gap-2.5 px-3 md:px-4 py-2.5 md:py-3 rounded-2xl text-xs md:text-sm font-bold transition-all text-center md:text-left ${
              activeTab === 'LOGOUT'
                ? 'bg-red-500 text-white shadow-md'
                : 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30'
            }`}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span className="truncate">Đăng xuất</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="md:col-span-3 space-y-6">
          
          {/* TAB 1: TÀI KHOẢN (ACCOUNT) */}
          {activeTab === 'ACCOUNT' && (
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 md:p-8 space-y-6 shadow-sm">
              <div className="border-b border-neutral-100 dark:border-neutral-800 pb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                    Thông Tin Tài Khoản
                  </h2>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Dữ liệu định danh tài khoản được xác thực thông qua Google Auth.
                  </p>
                </div>
                <div className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded-2xl">
                  <UserIcon className="w-5 h-5 text-amber-500" />
                </div>
              </div>

              {!user ? (
                <div className="p-6 text-center bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl space-y-3">
                  <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
                  <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                    Bạn chưa đăng nhập. Vui lòng đăng nhập bằng Google để xem chi tiết tài khoản.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Field 1: Email Google */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                        <Mail className="w-4 h-4 text-blue-500" />
                        <span>Email Google (Riêng tư)</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                          <Shield className="w-3 h-3 text-emerald-500" />
                          Hoàn toàn ẩn với người khác
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-2.5 py-0.5 rounded-full border border-neutral-200 dark:border-neutral-700">
                          <Lock className="w-3 h-3 text-amber-500" />
                          Cố định
                        </span>
                      </div>
                    </div>

                    <div className="relative">
                      <input
                        type="text"
                        value={
                          !user.email 
                            ? '' 
                            : showEmail 
                              ? user.email 
                              : user.email.replace(/(.{2})(.*)(@.*)/, '$1••••••$3')
                        }
                        disabled
                        className="w-full px-4 py-3 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-mono text-sm cursor-not-allowed border border-neutral-200 dark:border-neutral-700 pr-24"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setShowEmail(!showEmail)}
                          className="p-1.5 rounded-xl hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500 transition-colors"
                          title={showEmail ? "Ẩn email" : "Hiện email"}
                        >
                          {showEmail ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <ShieldCheck className="w-5 h-5 text-emerald-500" title="Đã xác thực bảo mật" />
                      </div>
                    </div>
                    <p className="text-[11px] text-neutral-400 flex items-center gap-1">
                      <Shield className="w-3 h-3 text-emerald-500 shrink-0" />
                      <span>Email chỉ hiển thị cho chính bạn trong trang Cài đặt. Hệ thống không bao giờ công khai email này cho bất kỳ thành viên nào khác.</span>
                    </p>
                  </div>

                  {/* Field 2: Ngày tạo / Ngày tham gia */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-amber-500" />
                      <span>Ngày Tạo / Ngày Tham Gia</span>
                    </label>

                    <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
                          <Calendar className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">Thành viên từ</p>
                          <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100">{getFormattedJoinDate()}</p>
                        </div>
                      </div>
                      <span className="text-xs font-bold px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full border border-emerald-500/20">
                        Đang hoạt động
                      </span>
                    </div>
                  </div>

                  {/* Field 3: Creator Status */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-indigo-500" />
                      <span>Trạng Thái Creator (Creator Status)</span>
                    </label>

                    <div className="p-5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                          user.creatorStatus || user.role === 'ADMIN'
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : user.creatorRequestStatus === 'PENDING'
                            ? 'bg-amber-500/10 text-amber-500'
                            : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-500'
                        }`}>
                          <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                            {user.creatorStatus || user.role === 'ADMIN' 
                              ? 'Đã kích hoạt Creator' 
                              : user.creatorRequestStatus === 'PENDING'
                              ? 'Chờ Xét Duyệt (Pending)'
                              : 'Thành viên thường (User)'}
                          </p>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">
                            {user.creatorStatus || user.role === 'ADMIN'
                              ? 'Bạn có đầy đủ quyền đăng Character, ghim Character và có Trang Creator riêng.'
                              : user.creatorRequestStatus === 'PENDING'
                              ? 'Yêu cầu của bạn đang chờ Quản trị viên xét duyệt.'
                              : 'Bạn hiện có quyền User chuẩn. Đăng ký để trở thành Creator.'}
                          </p>
                        </div>
                      </div>

                      {!(user.creatorStatus || user.role === 'ADMIN') && user.creatorRequestStatus !== 'PENDING' && (
                        <button
                          onClick={() => navigate('/profile#creator-request')}
                          className="px-4 py-2 rounded-xl bg-black dark:bg-white text-white dark:text-black text-xs font-bold hover:opacity-90 transition-opacity shrink-0 shadow-sm"
                        >
                          Đăng ký Creator
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: THÔNG BÁO (NOTIFICATIONS) */}
          {activeTab === 'NOTIFICATIONS' && (
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 md:p-8 space-y-6 shadow-sm">
              <div className="border-b border-neutral-100 dark:border-neutral-800 pb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                    Cài Đặt Thông Báo
                  </h2>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Bật hoặc tắt các kênh nhận thông báo trong ứng dụng và qua Email.
                  </p>
                </div>
                <div className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded-2xl">
                  <Bell className="w-5 h-5 text-indigo-500" />
                </div>
              </div>

              <div className="space-y-4">
                {/* Switch 1: Follow */}
                <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/80 flex items-center justify-between gap-4">
                  <div>
                    <h4 className="font-bold text-sm text-neutral-900 dark:text-neutral-100">Thông báo khi có người Follow</h4>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">Nhận thông báo mỗi khi có người dùng mới theo dõi trang của bạn.</p>
                  </div>
                  <button
                    onClick={() => {
                      const val = !notifFollow;
                      setNotifFollow(val);
                      handleSaveNotifications({ follow: val, feedback: notifFeedback, newContent: notifNewContent, interactions: notifInteractions, email: notifEmail });
                    }}
                    className={`w-12 h-6 rounded-full transition-colors relative p-1 ${
                      notifFollow ? 'bg-amber-500' : 'bg-neutral-300 dark:bg-neutral-700'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${notifFollow ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>

                {/* Switch 2: Feedback */}
                <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/80 flex items-center justify-between gap-4">
                  <div>
                    <h4 className="font-bold text-sm text-neutral-900 dark:text-neutral-100">Thông báo khi có Feedback mới</h4>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">Nhận thông báo khi ai đó gửi cho bạn Feedback công khai hoặc riêng tư.</p>
                  </div>
                  <button
                    onClick={() => {
                      const val = !notifFeedback;
                      setNotifFeedback(val);
                      handleSaveNotifications({ follow: notifFollow, feedback: val, newContent: notifNewContent, interactions: notifInteractions, email: notifEmail });
                    }}
                    className={`w-12 h-6 rounded-full transition-colors relative p-1 ${
                      notifFeedback ? 'bg-amber-500' : 'bg-neutral-300 dark:bg-neutral-700'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${notifFeedback ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>

                {/* Switch 3: Creator mới ra bài */}
                <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/80 flex items-center justify-between gap-4">
                  <div>
                    <h4 className="font-bold text-sm text-neutral-900 dark:text-neutral-100">Nội dung từ Creator đang follow</h4>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">Nhận thông báo khi Creator bạn follow đăng Character hoặc Prompt mới.</p>
                  </div>
                  <button
                    onClick={() => {
                      const val = !notifNewContent;
                      setNotifNewContent(val);
                      handleSaveNotifications({ follow: notifFollow, feedback: notifFeedback, newContent: val, interactions: notifInteractions, email: notifEmail });
                    }}
                    className={`w-12 h-6 rounded-full transition-colors relative p-1 ${
                      notifNewContent ? 'bg-amber-500' : 'bg-neutral-300 dark:bg-neutral-700'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${notifNewContent ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>

                {/* Switch 4: Email */}
                <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/80 flex items-center justify-between gap-4">
                  <div>
                    <h4 className="font-bold text-sm text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                      <Mail className="w-4 h-4 text-amber-500" />
                      <span>Thông báo qua Email</span>
                    </h4>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">Gửi tổng hợp thông báo quan trọng đến hộp thư Email của bạn.</p>
                  </div>
                  <button
                    onClick={() => {
                      const val = !notifEmail;
                      setNotifEmail(val);
                      handleSaveNotifications({ follow: notifFollow, feedback: notifFeedback, newContent: notifNewContent, interactions: notifInteractions, email: val });
                    }}
                    className={`w-12 h-6 rounded-full transition-colors relative p-1 ${
                      notifEmail ? 'bg-amber-500' : 'bg-neutral-300 dark:bg-neutral-700'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${notifEmail ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: GIAO DIỆN (APPEARANCE) */}
          {activeTab === 'APPEARANCE' && (
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 md:p-8 space-y-8 shadow-sm">
              <div className="border-b border-neutral-100 dark:border-neutral-800 pb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                    Tùy Chỉnh Giao Diện
                  </h2>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Điều chỉnh chế độ màu nền và cỡ chữ hiển thị phù hợp với thiết bị của bạn.
                  </p>
                </div>
                <div className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded-2xl">
                  <Monitor className="w-5 h-5 text-blue-500" />
                </div>
              </div>

              {/* Theme Mode Selector */}
              <div className="space-y-4">
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                  Chế Độ Giao Diện (Theme Mode)
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Light */}
                  <button
                    onClick={() => handleThemeChange('LIGHT')}
                    className={`p-5 rounded-2xl border transition-all flex flex-col items-center justify-center gap-3 text-center ${
                      themeMode === 'LIGHT'
                        ? 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/20 text-black dark:text-white font-bold'
                        : 'bg-neutral-50 dark:bg-neutral-800/60 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shadow-sm">
                      <Sun className="w-6 h-6" />
                    </div>
                    <span className="text-sm font-bold">Sáng (Light)</span>
                    <span className="text-[11px] text-neutral-400 font-normal">Tối ưu ban ngày</span>
                  </button>

                  {/* Dark */}
                  <button
                    onClick={() => handleThemeChange('DARK')}
                    className={`p-5 rounded-2xl border transition-all flex flex-col items-center justify-center gap-3 text-center ${
                      themeMode === 'DARK'
                        ? 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/20 text-black dark:text-white font-bold'
                        : 'bg-neutral-50 dark:bg-neutral-800/60 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-neutral-900 text-amber-400 flex items-center justify-center shadow-sm border border-neutral-700">
                      <Moon className="w-6 h-6" />
                    </div>
                    <span className="text-sm font-bold">Tối (Dark)</span>
                    <span className="text-[11px] text-neutral-400 font-normal">Dịu mắt, bảo vệ thị lực</span>
                  </button>

                  {/* System */}
                  <button
                    onClick={() => handleThemeChange('SYSTEM')}
                    className={`p-5 rounded-2xl border transition-all flex flex-col items-center justify-center gap-3 text-center ${
                      themeMode === 'SYSTEM'
                        ? 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/20 text-black dark:text-white font-bold'
                        : 'bg-neutral-50 dark:bg-neutral-800/60 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-sm">
                      <Laptop className="w-6 h-6" />
                    </div>
                    <span className="text-sm font-bold">Theo hệ thống</span>
                    <span className="text-[11px] text-neutral-400 font-normal">Tự động đồng bộ OS</span>
                  </button>
                </div>
              </div>

              {/* Font Size Selector */}
              <div className="space-y-4 pt-4 border-t border-neutral-100 dark:border-neutral-800">
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                  <Type className="w-4 h-4 text-amber-500" />
                  <span>Điều Chỉnh Cỡ Chữ (Font Size)</span>
                </label>

                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => handleFontSizeChange('SMALL')}
                    className={`py-3 px-4 rounded-2xl border font-bold text-xs transition-all ${
                      fontSize === 'SMALL'
                        ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white shadow-sm'
                        : 'bg-neutral-50 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:border-amber-500'
                    }`}
                  >
                    Nhỏ (14px)
                  </button>

                  <button
                    onClick={() => handleFontSizeChange('MEDIUM')}
                    className={`py-3 px-4 rounded-2xl border font-bold text-sm transition-all ${
                      fontSize === 'MEDIUM'
                        ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white shadow-sm'
                        : 'bg-neutral-50 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:border-amber-500'
                    }`}
                  >
                    Trung bình (16px)
                  </button>

                  <button
                    onClick={() => handleFontSizeChange('LARGE')}
                    className={`py-3 px-4 rounded-2xl border font-bold text-base transition-all ${
                      fontSize === 'LARGE'
                        ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white shadow-sm'
                        : 'bg-neutral-50 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:border-amber-500'
                    }`}
                  >
                    Lớn (18px)
                  </button>
                </div>

                {/* Preview Box */}
                <div className="p-4 rounded-2xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 space-y-1">
                  <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Xem trước văn bản mẫu:</p>
                  <p className="text-neutral-800 dark:text-neutral-200 leading-relaxed font-medium">
                    "Thế giới nhập vai_AD — Khởi đầu cho mọi hành trình Roleplay trên Google AI Studio."
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ĐĂNG XUẤT (LOGOUT) */}
          {activeTab === 'LOGOUT' && (
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 md:p-8 space-y-6 shadow-sm">
              <div className="border-b border-neutral-100 dark:border-neutral-800 pb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 text-red-600 dark:text-red-400">
                    Bảo Mật & Đăng Xuất
                  </h2>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Quản lý phiên đăng nhập và xóa dữ liệu kết nối an toàn.
                  </p>
                </div>
                <div className="p-2 bg-red-500/10 rounded-2xl text-red-500">
                  <LogOut className="w-5 h-5" />
                </div>
              </div>

              {!user ? (
                <div className="p-6 text-center bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-neutral-400 mx-auto" />
                  <p className="text-sm font-semibold text-neutral-600 dark:text-neutral-400">
                    Tài khoản hiện đang không trong phiên đăng nhập nào.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="p-5 rounded-2xl bg-red-500/5 border border-red-500/20 space-y-3">
                    <div className="flex items-start gap-3">
                      <Smartphone className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <h4 className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                          Đăng Xuất Khỏi Tất Cả Thiết Bị
                        </h4>
                        <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                          Thao tác này sẽ hủy kết nối phiên làm việc hiện tại và thu hồi token ủy quyền từ Google Auth trên tất cả trình duyệt và thiết bị đã từng truy cập.
                        </p>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        onClick={() => setShowLogoutModal(true)}
                        className="px-6 py-3 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs md:text-sm shadow-md transition-all flex items-center gap-2"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Đăng xuất tất cả thiết bị</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl max-w-md w-full p-6 space-y-6 shadow-2xl">
            <div className="w-14 h-14 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mx-auto border border-red-500/20">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                Xác Nhận Đăng Xuất?
              </h3>
              <p className="text-xs md:text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
                Bạn có chắc chắn muốn <strong className="text-red-500">đăng xuất khỏi tất cả thiết bị</strong>? Bạn sẽ cần đăng nhập lại bằng Google để tiếp tục sử dụng các tính năng cá nhân.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 py-3 px-4 rounded-2xl border border-neutral-300 dark:border-neutral-700 font-bold text-xs md:text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                Hủy bỏ
              </button>

              <button
                type="button"
                disabled={loggingOut}
                onClick={handleConfirmLogout}
                className="flex-1 py-3 px-4 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs md:text-sm shadow-md transition-colors disabled:opacity-50"
              >
                {loggingOut ? 'Đang xử lý...' : 'Xác nhận Đăng xuất'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
