import React, { useState, useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { 
  Home, Compass, User as UserIcon, BookOpen, PenTool, 
  MessageSquare, Bell, Settings, LogIn, Menu, X, Sparkles, LayoutDashboard, Mail, ShieldAlert, ShieldCheck,
  Sun, Moon, Laptop, Search
} from "lucide-react";
import { useAuthStore } from "../../store/useAuthStore";
import { loginWithGoogle, logout, db } from "../../lib/firebase";
import { collection, query, where, onSnapshot, doc, updateDoc, getDocs } from "firebase/firestore";
import toast from "react-hot-toast";
import clsx from "clsx";
import CaptchaModal from "../CaptchaModal";
import AuthModal from "../auth/AuthModal";
import ThemeToggle from "../ThemeToggle";
import { applyTheme, ThemeMode } from "../../lib/themeFont";
import { parseIdQuery, lookupIdInFirebase } from "../../lib/searchUtils";

interface LayoutProps {
  children?: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, isInitialized } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [isCaptchaOpen, setIsCaptchaOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<ThemeMode>(() => {
    return (localStorage.getItem('app_theme_mode') as ThemeMode) || 'SYSTEM';
  });
  const [headerSearchQuery, setHeaderSearchQuery] = useState("");
  const location = useLocation();
  const navigate = useNavigate();

  const handleHeaderSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const queryStr = headerSearchQuery.trim();
    if (!queryStr) return;

    const idParse = parseIdQuery(queryStr);
    if (idParse.isIdQuery) {
      if (idParse.error) {
        toast.error(idParse.error);
        navigate(`/ai-search?q=${encodeURIComponent(queryStr)}`);
        setHeaderSearchQuery("");
        return;
      }

      if (idParse.numericId) {
        try {
          const lookup = await lookupIdInFirebase(idParse.numericId, idParse.typeHint);
          if (lookup && lookup.found && lookup.path) {
            toast.success("Đã tìm thấy đối tượng chính xác theo ID!");
            setHeaderSearchQuery("");
            navigate(lookup.path);
            return;
          } else {
            const errorMsg = lookup?.error || "Mã ID không tồn tại trên hệ thống.";
            toast.error(errorMsg);
            navigate(`/ai-search?q=${encodeURIComponent(queryStr)}`);
            setHeaderSearchQuery("");
            return;
          }
        } catch (err) {
          console.error("Exact lookup error in Header:", err);
          navigate(`/ai-search?q=${encodeURIComponent(queryStr)}`);
          setHeaderSearchQuery("");
          return;
        }
      }
    }

    // Standard text queries redirect to search
    navigate(`/ai-search?q=${encodeURIComponent(queryStr)}`);
    setHeaderSearchQuery("");
  };

  useEffect(() => {
    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent<ThemeMode>;
      if (customEvent.detail) {
        setCurrentTheme(customEvent.detail);
      }
    };
    window.addEventListener('app-theme-changed', handleThemeChange);
    return () => window.removeEventListener('app-theme-changed', handleThemeChange);
  }, []);

  const handleMobileThemeChange = async (mode: ThemeMode) => {
    setCurrentTheme(mode);
    applyTheme(mode);
    toast.success(
      mode === 'LIGHT' ? 'Đã chuyển sang Chế độ Sáng' :
      mode === 'DARK' ? 'Đã chuyển sang Chế độ Tối' :
      'Đã thiết lập Theo hệ thống'
    );
    if (user?.id) {
      try {
        await updateDoc(doc(db, 'users', user.id), { themePreference: mode });
      } catch (e) {
        console.error("Error saving theme preference to Firestore:", e);
      }
    }
  };

  useEffect(() => {
    setSidebarOpen(false);
  }, [location]);

  useEffect(() => {
    if (!user) {
      setUnreadNotifCount(0);
      return;
    }

    const qRecipient = query(
      collection(db, 'notifications'),
      where('recipientId', '==', user.id),
      where('read', '==', false)
    );

    const qUser = query(
      collection(db, 'notifications'),
      where('userId', '==', user.id),
      where('read', '==', false)
    );

    let unreadRecipientIds = new Set<string>();
    let unreadUserIds = new Set<string>();

    const updateCount = () => {
      const combined = new Set([...unreadRecipientIds, ...unreadUserIds]);
      setUnreadNotifCount(combined.size);
    };

    const unsubRecipient = onSnapshot(qRecipient, (snapshot) => {
      unreadRecipientIds = new Set(snapshot.docs.map(doc => doc.id));
      updateCount();
    }, (err) => {
      console.error("Recipient notifications listener error:", err);
    });

    const unsubUser = onSnapshot(qUser, (snapshot) => {
      unreadUserIds = new Set(snapshot.docs.map(doc => doc.id));
      updateCount();
    }, (err) => {
      console.error("User notifications listener error:", err);
    });

    return () => {
      unsubRecipient();
      unsubUser();
    };
  }, [user?.id]);

  if (!isInitialized) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;

  const handleLoginClick = () => {
    setIsAuthModalOpen(true);
  };

  const handleCaptchaSuccess = async () => {
    try {
      await loginWithGoogle();
      toast.success("Đăng nhập thành công!");
    } catch (err) {
      toast.error("Đăng nhập thất bại.");
    }
  };

  const handleLogout = async () => {
    await logout();
    sessionStorage.removeItem('has_entered_app');
    window.dispatchEvent(new Event('app-entered-changed'));
    useAuthStore.getState().setAuth(null, null);
    toast.success("Đã đăng xuất.");
    navigate('/welcome');
  };

  const menuItems = [
    { label: "Trang chủ / Khám phá", path: "/", icon: <Compass className="w-5 h-5" /> },
    { label: "Character", path: "/characters", icon: <UserIcon className="w-5 h-5" /> },
    { label: "Prompt", path: "/prompts", icon: <PenTool className="w-5 h-5" /> },
    { label: "Creator", path: "/creators", icon: <BookOpen className="w-5 h-5" /> },
    { label: "Feedback", path: "/feedbacks", icon: <MessageSquare className="w-5 h-5" /> },
    { label: "Liên hệ", path: "/contact", icon: <Mail className="w-5 h-5" /> },
  ];

  if (user) {
    if (user.creatorStatus || user.role === 'ADMIN') {
      menuItems.push(
        { label: "Bảng điều khiển Creator", path: "/creator/dashboard", icon: <LayoutDashboard className="w-5 h-5 text-amber-500" /> }
      );
    }
    if (user.role === 'ADMIN') {
      menuItems.push(
        { label: "Quản trị & Kiểm duyệt", path: "/admin", icon: <ShieldAlert className="w-5 h-5 text-red-500" /> }
      );
    } else if (user.role === 'MOD' || user.role === 'MODERATOR') {
      menuItems.push(
        { label: "Moderator Panel", path: "/admin/users", icon: <ShieldCheck className="w-5 h-5 text-amber-500" /> }
      );
    }
    menuItems.push(
      { label: "Thông báo", path: "/notifications", icon: <Bell className="w-5 h-5" /> },
      { label: "Hồ sơ người dùng", path: "/profile", icon: <UserIcon className="w-5 h-5" /> },
      { label: "Cài đặt", path: "/settings", icon: <Settings className="w-5 h-5" /> }
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-50 flex flex-col font-sans transition-colors duration-200">
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
      <CaptchaModal 
        isOpen={isCaptchaOpen}
        onClose={() => setIsCaptchaOpen(false)}
        onSuccess={handleCaptchaSuccess}
        actionLabel="đăng nhập tài khoản"
      />
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button className="lg:hidden p-2 -ml-2" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-6 h-6" />
            </button>
            <Link to="/" className="text-xl font-bold tracking-tight shrink-0">Thế Giới Nhập vai AD</Link>
          </div>

          {/* Global Header Search Bar */}
          <div className="hidden md:flex flex-1 max-w-md mx-4 lg:mx-8">
            <form onSubmit={handleHeaderSearchSubmit} className="relative w-full">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="Tìm kiếm Character, Prompt, ID (VD: character/12345)..."
                value={headerSearchQuery}
                onChange={e => setHeaderSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 text-xs md:text-sm rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-transparent focus:outline-none focus:ring-1 focus:ring-neutral-200 dark:focus:ring-neutral-800 transition-all text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500"
              />
            </form>
          </div>
          
          <div className="flex items-center gap-3">
            <Link to="/ai-search" className="p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 transition-colors" title="AI Search">
              <Sparkles className="w-5 h-5" />
            </Link>
            <ThemeToggle />
            {user ? (
              <div className="flex items-center gap-3">
                <Link to="/notifications" className="relative p-2 text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white" title="Thông báo">
                  <Bell className="w-5 h-5" />
                  {unreadNotifCount > 0 && (
                    <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white dark:ring-black">
                      {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                    </span>
                  )}
                </Link>
                <div className="group relative">
                  <button className="flex items-center gap-2">
                    <img src={user.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=" + user.displayName} alt="Avatar" className="w-8 h-8 rounded-full border border-neutral-200 dark:border-neutral-800" />
                  </button>
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-neutral-900 rounded-xl shadow-lg border border-neutral-100 dark:border-neutral-800 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                    <div className="p-2">
                       <Link to="/profile" className="block px-4 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg">Hồ sơ của tôi</Link>
                       {(user.creatorStatus || user.role === 'ADMIN') && (
                         <Link to="/creator/dashboard" className="block px-4 py-2 text-sm text-amber-600 dark:text-amber-400 font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg">
                           Bảng điều khiển Creator
                         </Link>
                       )}
                       {user.role === 'ADMIN' && (
                         <Link to="/admin" className="block px-4 py-2 text-sm text-red-600 dark:text-red-400 font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg">
                           Quản trị & Kiểm duyệt
                         </Link>
                       )}
                       {(user.role === 'MOD' || user.role === 'MODERATOR') && (
                         <Link to="/admin/users" className="block px-4 py-2 text-sm text-amber-600 dark:text-amber-400 font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg">
                           Moderator Panel
                         </Link>
                       )}
                       <Link to="/settings" className="block px-4 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg">Cài đặt</Link>
                       <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">Đăng xuất</button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <button onClick={handleLoginClick} className="flex items-center gap-2 px-4 py-2 rounded-full bg-black dark:bg-white text-white dark:text-black text-sm font-medium hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors">
                <LogIn className="w-4 h-4" />
                <span>Đăng nhập</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-7xl mx-auto w-full flex">
        {/* Sidebar Desktop */}
        <aside className="hidden lg:block w-64 shrink-0 py-8 pr-8 border-r border-neutral-200 dark:border-neutral-800/50">
          <nav className="space-y-1 sticky top-24">
            {menuItems.map(item => (
              <Link 
                key={item.path} 
                to={item.path}
                className={clsx(
                  "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
                  location.pathname === item.path 
                    ? "bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white" 
                    : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 hover:text-black dark:hover:text-white"
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        {/* Sidebar Mobile Overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
            <aside className="fixed inset-y-0 left-0 w-72 bg-white dark:bg-neutral-900 shadow-2xl p-6 flex flex-col">
              <div className="flex items-center justify-between mb-8">
                <span className="font-bold text-lg">Menu</span>
                <button onClick={() => setSidebarOpen(false)} className="p-2 -mr-2"><X className="w-5 h-5" /></button>
              </div>
              <nav className="space-y-2 flex-1 overflow-y-auto">
                {menuItems.map(item => (
                  <Link 
                    key={item.path} 
                    to={item.path}
                    className={clsx(
                      "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
                      location.pathname === item.path 
                        ? "bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white" 
                        : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                    )}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                ))}
              </nav>

              {/* Mobile Theme Switcher */}
              <div className="pt-4 mt-4 border-t border-neutral-200 dark:border-neutral-800 space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 px-1">
                  Giao diện (Theme)
                </div>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-neutral-100 dark:bg-neutral-800/80 rounded-2xl">
                  <button
                    onClick={() => handleMobileThemeChange('LIGHT')}
                    className={clsx(
                      "flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl text-[11px] font-bold transition-all",
                      currentTheme === 'LIGHT'
                        ? "bg-white dark:bg-neutral-900 text-amber-600 dark:text-amber-400 shadow-sm"
                        : "text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white"
                    )}
                  >
                    <Sun className="w-4 h-4 text-amber-500" />
                    <span>Sáng</span>
                  </button>
                  <button
                    onClick={() => handleMobileThemeChange('DARK')}
                    className={clsx(
                      "flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl text-[11px] font-bold transition-all",
                      currentTheme === 'DARK'
                        ? "bg-white dark:bg-neutral-900 text-amber-600 dark:text-amber-400 shadow-sm"
                        : "text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white"
                    )}
                  >
                    <Moon className="w-4 h-4 text-blue-400" />
                    <span>Tối</span>
                  </button>
                  <button
                    onClick={() => handleMobileThemeChange('SYSTEM')}
                    className={clsx(
                      "flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl text-[11px] font-bold transition-all",
                      currentTheme === 'SYSTEM'
                        ? "bg-white dark:bg-neutral-900 text-amber-600 dark:text-amber-400 shadow-sm"
                        : "text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white"
                    )}
                  >
                    <Laptop className="w-4 h-4 text-indigo-400" />
                    <span>Hệ thống</span>
                  </button>
                </div>
              </div>
            </aside>
          </div>
        )}

      {/* Main Content */}
      <main className="flex-1 w-full min-w-0 pb-10 lg:pb-0">
        {children || <Outlet />}
      </main>
    </div>

    {/* Footer */}
      <footer className="border-t border-neutral-200 dark:border-neutral-800 py-8 bg-white dark:bg-black mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-neutral-500">
          <p className="font-medium text-neutral-900 dark:text-neutral-100 mb-2">Thế Giới Nhập vai AD</p>
          <p className="mb-4">Khởi đầu cho mọi hành trình Roleplay.</p>
          <div className="flex items-center justify-center gap-4">
            <Link to="/privacy" className="hover:text-black dark:hover:text-white transition-colors">Bảo mật</Link>
            <Link to="/terms" className="hover:text-black dark:hover:text-white transition-colors">Điều khoản</Link>
            <Link to="/contact" className="hover:text-black dark:hover:text-white transition-colors">Liên hệ</Link>
          </div>
          <p className="mt-8 text-xs opacity-50">&copy; 2026 Thế Giới Nhập vai AD. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
