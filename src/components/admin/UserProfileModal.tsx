import React, { useState, useEffect } from 'react';
import { X, Shield, UserCheck, Calendar, Mail, AlertTriangle, ExternalLink, Sparkles, FileText, Lock } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { getValidAvatar } from '../../lib/avatar';
import DisplayId from '../DisplayId';

interface UserProfileModalProps {
  userId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function UserProfileModal({ userId, isOpen, onClose }: UserProfileModalProps) {
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && userId) {
      fetchUser();
    } else {
      setUserData(null);
    }
  }, [isOpen, userId]);

  const fetchUser = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, 'users', userId));
      if (snap.exists()) {
        setUserData({ id: snap.id, ...snap.data() });
      } else {
        setUserData(null);
      }
    } catch (err) {
      console.error("Error fetching user profile for modal:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !userId) return null;

  const joinDate = userData?.createdAt 
    ? new Date(userData.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : 'Chưa rõ';

  const isSuspended = Boolean(userData?.isLocked || userData?.status === 'LOCKED' || userData?.isSuspended);
  const isRestricted = Boolean(userData?.isRestricted);

  return (
    <div 
      id="user-profile-modal-overlay"
      className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div 
        id="user-profile-modal-card"
        className="relative bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] max-w-lg w-full overflow-hidden shadow-2xl z-10 p-6 md:p-8 space-y-6 max-h-[90vh] flex flex-col"
      >
        {/* Header with Close */}
        <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-500" />
            <h3 className="font-black text-lg text-neutral-900 dark:text-neutral-100 tracking-tight">
              Thông Tin Tác Giả / Chủ Sở Hữu
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-neutral-500 font-medium animate-pulse">
            Đang tải thông tin thành viên...
          </div>
        ) : !userData ? (
          <div className="py-12 text-center text-neutral-500">
            Không tìm thấy thông tin tài khoản người dùng này (ID: {userId}).
          </div>
        ) : (
          <div className="space-y-6 overflow-y-auto scrollbar-thin pr-1">
            {/* User Main Banner Info */}
            <div className="flex items-start gap-4 bg-neutral-50 dark:bg-neutral-800/50 p-4 rounded-3xl border border-neutral-200/60 dark:border-neutral-800">
              <img 
                src={getValidAvatar(userData.avatar)} 
                alt={userData.displayName} 
                className="w-16 h-16 rounded-2xl object-cover shrink-0 border-2 border-white dark:border-neutral-800 shadow-md"
              />
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-bold text-base text-neutral-900 dark:text-neutral-100 truncate">
                    {userData.displayName || 'Thành viên'}
                  </h4>
                  {userData.role === 'ADMIN' && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-500/10 text-red-500 border border-red-500/20">
                      ADMIN
                    </span>
                  )}
                  {(userData.role === 'MODERATOR' || userData.role === 'MOD') && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-purple-500/10 text-purple-500 border border-purple-500/20">
                      MOD
                    </span>
                  )}
                  {userData.creatorStatus && userData.role !== 'ADMIN' && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                      CREATOR
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <DisplayId 
                    type={userData.creatorStatus ? 'creator' : 'user'} 
                    numericId={userData.numericId} 
                  />
                </div>

                {userData.email && (
                  <p className="text-xs text-neutral-500 flex items-center gap-1.5 truncate">
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    <span>{userData.email}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Status Warnings if Suspended / Restricted */}
            {isSuspended && (
              <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-500 text-xs font-bold">
                <Lock className="w-4 h-4 shrink-0" />
                <span>Tài khoản này đang bị Đình chỉ / Khóa hoạt động.</span>
              </div>
            )}
            {isRestricted && (
              <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-3 text-amber-600 dark:text-amber-400 text-xs font-bold">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Tài khoản này đang bị Giới hạn một số tính năng.</span>
              </div>
            )}

            {/* Account Details */}
            <div className="space-y-3">
              <h5 className="text-xs font-black uppercase tracking-wider text-neutral-400">Chi tiết tài khoản</h5>
              
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-neutral-50 dark:bg-neutral-800/40 rounded-2xl border border-neutral-100 dark:border-neutral-800 space-y-1">
                  <p className="text-neutral-400 font-medium">Ngày tham gia</p>
                  <p className="font-bold text-neutral-900 dark:text-neutral-100">{joinDate}</p>
                </div>

                <div className="p-3 bg-neutral-50 dark:bg-neutral-800/40 rounded-2xl border border-neutral-100 dark:border-neutral-800 space-y-1">
                  <p className="text-neutral-400 font-medium">Trạng thái Creator</p>
                  <p className="font-bold text-neutral-900 dark:text-neutral-100">
                    {userData.creatorStatus ? 'Đã kích hoạt' : 'Thành viên thường'}
                  </p>
                </div>
              </div>

              {userData.bio && (
                <div className="p-3.5 bg-neutral-50 dark:bg-neutral-800/40 rounded-2xl border border-neutral-100 dark:border-neutral-800 space-y-1">
                  <p className="text-neutral-400 text-xs font-medium">Tiểu sử (Bio)</p>
                  <p className="text-xs text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap leading-relaxed">
                    {userData.bio}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
