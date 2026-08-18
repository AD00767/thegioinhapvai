import React from 'react';
import { X, UserCheck, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';

interface FollowUser {
  id: string;
  displayName: string;
  avatar?: string;
  bio?: string;
  creatorStatus?: boolean;
}

interface FollowersModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  users: FollowUser[];
  loading?: boolean;
}

export default function FollowersModal({ isOpen, onClose, title, users, loading }: FollowersModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-md w-full p-6 shadow-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between pb-4 border-b border-neutral-100 dark:border-neutral-800">
          <h3 className="text-lg font-bold">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-neutral-400 hover:text-black dark:hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto my-4 space-y-3">
          {loading ? (
            <div className="py-8 text-center text-sm text-neutral-400">Đang tải...</div>
          ) : users.length === 0 ? (
            <div className="py-8 text-center text-sm text-neutral-400">Chưa có danh sách.</div>
          ) : (
            users.map(u => (
              <div key={u.id} className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <img 
                    src={u.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=" + u.displayName} 
                    alt="Avatar" 
                    className="w-10 h-10 rounded-full object-cover shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate flex items-center gap-1.5">
                      <span>{u.displayName}</span>
                      {u.creatorStatus && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold rounded">
                          Creator
                        </span>
                      )}
                    </div>
                    {u.bio && <div className="text-xs text-neutral-400 truncate">{u.bio}</div>}
                  </div>
                </div>
                <Link 
                  to={`/creator/${u.id}`} 
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-lg bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 text-xs font-medium shrink-0"
                >
                  Xem
                </Link>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
