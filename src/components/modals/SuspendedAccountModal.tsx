import React, { useState } from 'react';
import { Lock, AlertOctagon, LogOut, FileText, Send, ShieldAlert } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { auth } from '../../lib/firebase';
import { signOut } from 'firebase/auth';
import RemovalDetailModal from './RemovalDetailModal';

export default function SuspendedAccountModal() {
  const { user, setAuth } = useAuthStore();
  const [showAppealModal, setShowAppealModal] = useState(false);

  if (!user || !user.isLocked) return null;

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('custom_auth_user');
      setAuth(null, null);
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  const lockExpiresDate = user.lockExpiresAt 
    ? new Date(user.lockExpiresAt).toLocaleString('vi-VN') 
    : 'Vô thời hạn';

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-neutral-950/90 backdrop-blur-xl animate-in fade-in duration-300">
        <div className="bg-white dark:bg-neutral-900 rounded-[2.5rem] w-full max-w-lg p-8 md:p-10 shadow-2xl border border-red-500/20 text-center relative overflow-hidden space-y-6">
          
          {/* Decorative Glow */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Icon Header */}
          <div className="mx-auto w-20 h-20 rounded-3xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center font-black animate-bounce">
            <Lock className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-red-500 px-3 py-1 rounded-full bg-red-500/10 inline-block">
              Tài Khoản Đang Bị Tạm Khóa / Đình Chỉ
            </span>
            <h2 className="text-2xl font-black tracking-tight text-neutral-900 dark:text-neutral-100">
              Quyền Truy Cập Bị Hạn Chế
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto">
              Tài khoản <strong className="text-neutral-900 dark:text-neutral-200">{user.displayName}</strong> ({user.email}) đã bị khóa do vi phạm tiêu chuẩn cộng đồng.
            </p>
          </div>

          {/* Reason Box */}
          <div className="bg-neutral-50 dark:bg-neutral-800/50 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 text-left space-y-3 text-xs">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block mb-1">
                Lý do từ Ban Quản Trị:
              </span>
              <p className="font-bold text-red-600 dark:text-red-400 bg-red-500/10 p-3 rounded-xl border border-red-500/20">
                {user.lockReason || 'Vi phạm điều khoản và quy định cộng đồng.'}
              </p>
            </div>

            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-neutral-200/60 dark:border-neutral-800/60">
              <span className="text-neutral-400 font-medium">Thời hạn khóa:</span>
              <span className="font-extrabold text-neutral-800 dark:text-neutral-200">{lockExpiresDate}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3 pt-2">
            <button
              onClick={() => setShowAppealModal(true)}
              className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-widest rounded-2xl transition-all shadow-xl shadow-amber-500/10 flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" /> Xem Chi Tiết & Gửi Kháng Nghị
            </button>

            <button
              onClick={handleLogout}
              className="w-full py-3.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-black text-xs uppercase tracking-widest rounded-2xl transition-colors flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" /> Đăng Xuất Tài Khoản
            </button>
          </div>

        </div>
      </div>

      {/* Appeal Modal for Account */}
      <RemovalDetailModal
        isOpen={showAppealModal}
        onClose={() => setShowAppealModal(false)}
        targetType="ACCOUNT"
        targetId={user.id}
        targetName={user.displayName || 'Tài khoản cá nhân'}
        removalReason={user.lockReason || 'Vi phạm quy định cộng đồng'}
        removalDetails={`Thời hạn khóa: ${lockExpiresDate}`}
        removalTime={user.updatedAt || new Date().toISOString()}
      />
    </>
  );
}
