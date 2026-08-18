import React, { useState, useEffect } from 'react';
import AdminLayout from './AdminLayout';
import { 
  BadgeCheck, Plus, Trash2, Search, 
  Palette, Tag, User, ShieldCheck, X
} from 'lucide-react';
import { 
  collection, query, getDocs, doc, updateDoc, 
  orderBy, arrayUnion, arrayRemove, getDoc, serverTimestamp, addDoc 
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/useAuthStore';
import toast from 'react-hot-toast';

interface Badge {
  id: string;
  label: string;
  color: string;
  description: string;
}

const AVAILABLE_BADGES: Badge[] = [
  { id: 'verified', label: 'Verified', color: 'bg-blue-500', description: 'Người dùng đã xác minh danh tính.' },
  { id: 'top_creator', label: 'Top Creator', color: 'bg-amber-500', description: 'Creator nổi bật của cộng đồng.' },
  { id: 'contributor', label: 'Contributor', color: 'bg-emerald-500', description: 'Người đóng góp tích cực cho nền tảng.' },
  { id: 'og', label: 'OG Member', color: 'bg-purple-500', description: 'Thành viên tham gia từ những ngày đầu.' },
  { id: 'supporter', label: 'Supporter', color: 'bg-pink-500', description: 'Người ủng hộ nền tảng.' },
];

export default function BadgeManager() {
  const { user: currentUser } = useAuthStore();
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchUsers = async () => {
    if (!search.trim()) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'users'), orderBy('displayName'));
      const snap = await getDocs(q);
      const allUsers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setUsers(allUsers.filter((u: any) => 
        u.displayName.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase())
      ));
    } catch (err) {
      toast.error("Không thể tìm kiếm người dùng.");
    } finally {
      setLoading(false);
    }
  };

  const toggleBadge = async (userId: string, badgeId: string, hasBadge: boolean) => {
    try {
      const userRef = doc(db, 'users', userId);
      if (hasBadge) {
        await updateDoc(userRef, {
          badges: arrayRemove(badgeId),
          updatedAt: serverTimestamp()
        });
        toast.success("Đã gỡ Badge.");
      } else {
        await updateDoc(userRef, {
          badges: arrayUnion(badgeId),
          updatedAt: serverTimestamp()
        });
        toast.success("Đã cấp Badge.");
      }

      // Audit Log
      await addDoc(collection(db, 'audit_logs'), {
        executorId: currentUser.id,
        executorName: currentUser.displayName,
        executorRole: currentUser.role,
        action: hasBadge ? 'REMOVE_BADGE' : 'ADD_BADGE',
        targetId: userId,
        targetType: 'USER',
        details: `${hasBadge ? 'Gỡ' : 'Cấp'} badge ${badgeId} cho người dùng.`,
        createdAt: new Date().toISOString()
      });

      // Update local state
      setUsers(users.map(u => {
        if (u.id === userId) {
          const newBadges = hasBadge 
            ? u.badges.filter((b: string) => b !== badgeId)
            : [...(u.badges || []), badgeId];
          return { ...u, badges: newBadges };
        }
        return u;
      }));
    } catch (err) {
      toast.error("Thao tác thất bại.");
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-10 animate-in fade-in duration-500">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tighter uppercase">Quản Lý Danh Hiệu (Badges)</h1>
          <p className="text-sm text-neutral-500 font-medium">Cấp và thu hồi các danh hiệu đặc biệt cho thành viên ưu tú.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Left: Search & User List */}
          <div className="space-y-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input 
                type="text" 
                placeholder="Tìm tên hoặc email người dùng..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchUsers()}
                className="pl-11 pr-6 py-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl text-sm w-full focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white shadow-xl transition-all"
              />
              <button 
                onClick={fetchUsers}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-neutral-900 dark:bg-white text-white dark:text-black text-[10px] font-black uppercase tracking-widest rounded-xl hover:opacity-90 transition-opacity"
              >
                Tìm
              </button>
            </div>

            <div className="space-y-4">
              {loading ? (
                <div className="p-8 text-center bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 animate-pulse">
                  <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Đang tải...</p>
                </div>
              ) : users.length === 0 ? (
                <div className="p-12 text-center bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 border-dashed">
                  <User className="w-8 h-8 text-neutral-200 mx-auto mb-3" />
                  <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Nhập tên để bắt đầu tìm kiếm.</p>
                </div>
              ) : (
                users.map((u) => (
                  <div 
                    key={u.id}
                    className="p-6 bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex items-center justify-between group hover:border-neutral-900 dark:hover:border-white transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <img src={u.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.id}`} className="w-12 h-12 rounded-xl" alt="" />
                      <div>
                        <p className="font-bold text-sm">{u.displayName}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(u.badges || []).length === 0 ? (
                            <span className="text-[9px] text-neutral-400 font-medium italic">Chưa có badge</span>
                          ) : (
                            u.badges.map((bId: string) => {
                              const badge = AVAILABLE_BADGES.find(b => b.id === bId);
                              return (
                                <span key={bId} className={`px-2 py-0.5 rounded-full text-[8px] font-black text-white uppercase tracking-tighter ${badge?.color || 'bg-neutral-400'}`}>
                                  {badge?.label || bId}
                                </span>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => setSelectedUser(u)}
                      className="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-xl hover:bg-neutral-900 dark:hover:bg-white hover:text-white dark:hover:text-black transition-all"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right: Selected User Badges */}
          <div className="sticky top-8">
            {selectedUser ? (
              <div className="bg-neutral-900 dark:bg-white text-white dark:text-black p-10 rounded-[3rem] shadow-2xl space-y-8 animate-in slide-in-from-right-8 duration-500">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h2 className="text-2xl font-black tracking-tighter uppercase">Chỉnh Sửa Badge</h2>
                    <p className="text-xs font-bold opacity-50 uppercase tracking-widest">{selectedUser.displayName}</p>
                  </div>
                  <button onClick={() => setSelectedUser(null)} className="p-2 hover:bg-white/10 dark:hover:bg-black/10 rounded-full transition-colors">
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {AVAILABLE_BADGES.map((badge) => {
                    const hasBadge = (selectedUser.badges || []).includes(badge.id);
                    return (
                      <button
                        key={badge.id}
                        onClick={() => toggleBadge(selectedUser.id, badge.id, hasBadge)}
                        className={`
                          flex items-center justify-between p-5 rounded-[2rem] border transition-all text-left
                          ${hasBadge 
                            ? 'bg-white dark:bg-black text-neutral-900 dark:text-white border-white dark:border-black shadow-xl scale-[1.02]' 
                            : 'bg-white/5 dark:bg-black/5 border-white/10 dark:border-black/10 hover:bg-white/10 dark:hover:bg-black/10'}
                        `}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-2xl ${badge.color} text-white shadow-lg`}>
                            <BadgeCheck className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="font-black text-sm uppercase tracking-tight">{badge.label}</p>
                            <p className="text-[10px] opacity-60 font-medium leading-relaxed mt-0.5">{badge.description}</p>
                          </div>
                        </div>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${hasBadge ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-white/20 dark:border-black/20'}`}>
                          {hasBadge && <ShieldCheck className="w-3.5 h-3.5" />}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <p className="text-[10px] opacity-40 italic text-center font-medium">Thay đổi sẽ có hiệu lực ngay lập tức sau khi nhấn chọn.</p>
              </div>
            ) : (
              <div className="h-full min-h-[400px] bg-white dark:bg-neutral-900 rounded-[3rem] border-4 border-dashed border-neutral-100 dark:border-neutral-800 flex flex-col items-center justify-center text-center p-10">
                <div className="w-20 h-20 bg-neutral-50 dark:bg-neutral-800 rounded-full flex items-center justify-center mb-6">
                  <BadgeCheck className="w-10 h-10 text-neutral-200 dark:text-neutral-700" />
                </div>
                <h3 className="text-lg font-black tracking-tight text-neutral-300 dark:text-neutral-700 uppercase">Trình Quản Lý Badge</h3>
                <p className="text-xs font-bold text-neutral-400 uppercase tracking-[0.2em] mt-2">Chọn một người dùng từ danh sách bên trái để bắt đầu cấp danh hiệu.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
