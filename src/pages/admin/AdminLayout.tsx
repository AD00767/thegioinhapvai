import React, { useState } from 'react';
import { Navigate, Link, useLocation } from 'react-router-dom';
import { 
  ShieldCheck, Users, Sparkles, UserCheck, AlertTriangle, 
  Clock, FileText, BarChart3, Settings, BadgeCheck, MessageSquare,
  Menu, X
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { user } = useAuthStore();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  if (!user || (user.role !== 'ADMIN' && user.role !== 'MODERATOR' && user.role !== 'MOD')) {
    return <Navigate to="/welcome" replace />;
  }

  const isAdmin = user.role === 'ADMIN';

  const menuItems = isAdmin ? [
    { path: '/admin/dashboard', label: 'Thống Kê', icon: <BarChart3 className="w-5 h-5" /> },
    { path: '/admin/users', label: 'Thành Viên', icon: <Users className="w-5 h-5" /> },
    { path: '/admin/creators', label: 'Duyệt Creator', icon: <UserCheck className="w-5 h-5" /> },
    { path: '/admin/reports', label: 'Báo Cáo', icon: <AlertTriangle className="w-5 h-5" /> },
    { path: '/admin/content', label: 'Nội Dung', icon: <Sparkles className="w-5 h-5" /> },
    { path: '/admin/badges', label: 'Badge', icon: <BadgeCheck className="w-5 h-5" /> },
    { path: '/admin/support', label: 'Hỗ Trợ', icon: <MessageSquare className="w-5 h-5" /> },
    { path: '/admin/audit', label: 'Audit Log', icon: <Clock className="w-5 h-5" /> },
    { path: '/admin/managers', label: 'Quản Trị Viên', icon: <ShieldCheck className="w-5 h-5" /> },
  ] : [
    { path: '/admin/users', label: 'Thành Viên', icon: <Users className="w-5 h-5" /> },
    { path: '/admin/creators', label: 'Duyệt Creator', icon: <UserCheck className="w-5 h-5" /> },
    { path: '/admin/reports', label: 'Báo Cáo', icon: <AlertTriangle className="w-5 h-5" /> },
    { path: '/admin/content', label: 'Nội Dung', icon: <Sparkles className="w-5 h-5" /> },
    { path: '/admin/audit', label: 'Audit Log', icon: <Clock className="w-5 h-5" /> },
  ];

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-black text-neutral-900 dark:text-neutral-100 flex">
      {/* Sidebar Mobile Toggle */}
      <button 
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="lg:hidden fixed bottom-6 right-6 z-50 p-4 bg-neutral-900 dark:bg-white text-white dark:text-black rounded-full shadow-2xl"
      >
        {isSidebarOpen ? <X /> : <Menu />}
      </button>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 transition-transform lg:translate-x-0 lg:static lg:inset-auto
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-full flex flex-col p-6">
          <div className="flex items-center gap-3 mb-10 px-2">
            <div className="w-10 h-10 bg-neutral-900 dark:bg-white rounded-xl flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-white dark:text-black" />
            </div>
            <div>
              <h2 className="font-black text-lg leading-tight uppercase tracking-tighter">
                {isAdmin ? 'Admin Panel' : 'Moderator Panel'}
              </h2>
              <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">
                {isAdmin ? 'ADMIN' : 'MODERATOR'}
              </p>
            </div>
          </div>

          <nav className="flex-1 space-y-1">
            {menuItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsSidebarOpen(false)}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all
                  ${location.pathname === item.path 
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-black shadow-lg' 
                    : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white'}
                `}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>

          <div className="mt-auto pt-6 border-t border-neutral-100 dark:border-neutral-800">
            <Link to="/home" className="flex items-center gap-3 px-4 py-3 text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors text-sm font-bold">
              <Settings className="w-5 h-5" />
              <span>Về Website</span>
            </Link>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 p-4 md:p-8 lg:p-12 overflow-y-auto h-screen scrollbar-thin scrollbar-thumb-neutral-200 dark:scrollbar-thumb-neutral-800">
        {children}
      </main>
    </div>
  );
}
