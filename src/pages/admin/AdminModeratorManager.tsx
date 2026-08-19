import React, { useState, useEffect } from 'react';
import AdminLayout from './AdminLayout';
import { 
  ShieldCheck, Shield, UserMinus, Plus, 
  Search, X, MoreVertical, ShieldAlert,
  AlertCircle, Key
} from 'lucide-react';
import { 
  collection, query, getDocs, doc, updateDoc, 
  orderBy, where, serverTimestamp, addDoc 
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/useAuthStore';
import { getValidAvatar } from '../../lib/avatar';
import toast from 'react-hot-toast';

export default function AdminModeratorManager() {
  const { user: currentUser } = useAuthStore();
  const [managers, setManagers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchEmail, setSearchEmail] = useState('');
  const [foundUser, setFoundUser] = useState<any>(null);

  const isAdmin = currentUser?.role === 'ADMIN';

  useEffect(() => {
    fetchManagers();
  }, []);

  const fetchManagers = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'users'), 
        where('role', 'in', ['ADMIN', 'MODERATOR']),
        orderBy('createdAt', 'desc')
      );
      const qInvites = query(
        collection(db, 'users'),
        where('moderatorInviteStatus', '==', 'PENDING')
      );
      
      const [snap, snapInvites] = await Promise.all([
        getDocs(q),
        getDocs(qInvites)
      ]);

      const map = new Map<string, any>();
      snap.docs.forEach(d => map.set(d.id, { id: d.id, ...d.data() }));
      snapInvites.docs.forEach(d => map.set(d.id, { id: d.id, ...d.data() }));

      const list = Array.from(map.values()).sort((a, b) => {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      });

      setManagers(list);
    } catch (err) {
      console.error("Error fetching managers:", err);
    } finally {
      setLoading(false);
    }
  };

  const findUserByEmail = async () => {
    if (!searchEmail.trim()) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'users'), where('email', '==', searchEmail.trim()));
      const snap = await getDocs(q);
      if (snap.empty) {
        toast.error("Không tìm thấy người dùng.");
        setFoundUser(null);
      } else {
        setFoundUser({ id: snap.docs[0].id, ...snap.docs[0].data() });
      }
    } catch (err) {
      toast.error("Lỗi khi tìm kiếm.");
    } finally {
      setLoading(false);
    }
  };

  const updateRole = async (userId: string, newRole: string) => {
    if (!isAdmin) {
      toast.error("Chỉ Admin mới có quyền này.");
      return;
    }
    
    try {
      if (newRole === 'MODERATOR') {
        // Invite instead of immediate promote
        await updateDoc(doc(db, 'users', userId), {
          moderatorInviteStatus: 'PENDING',
          updatedAt: serverTimestamp()
        });

        await addDoc(collection(db, 'notifications'), {
          userId: userId,
          recipientId: userId,
          type: 'MODERATOR_INVITE',
          title: 'Lời mời làm Moderator',
          message: `Quản trị viên ${currentUser?.displayName || 'Admin'} đã gửi lời mời bạn trở thành Moderator của hệ thống.`,
          read: false,
          createdAt: new Date().toISOString()
        });

        await addDoc(collection(db, 'audit_logs'), {
          executorId: currentUser.id,
          executorName: currentUser.displayName,
          executorRole: currentUser.role,
          action: 'INVITE_MODERATOR',
          targetId: userId,
          targetType: 'USER',
          details: `Gửi lời mời làm Moderator cho ${userId}`,
          createdAt: new Date().toISOString()
        });

        toast.success("Đã gửi lời mời làm Moderator!");
        setIsModalOpen(false);
        setSearchEmail('');
        setFoundUser(null);
        fetchManagers();
        return;
      }

      await updateDoc(doc(db, 'users', userId), {
        role: newRole,
        permissions: newRole === 'ADMIN' ? ['ALL'] : ['MANAGE_REPORTS', 'MANAGE_CONTENT', 'MANAGE_USERS'],
        updatedAt: serverTimestamp(),
        // Clear invite status if demoted or promoted to Admin
        moderatorInviteStatus: null
      });

      await addDoc(collection(db, 'audit_logs'), {
        executorId: currentUser.id,
        executorName: currentUser.displayName,
        executorRole: currentUser.role,
        action: 'UPDATE_STAFF_ROLE',
        targetId: userId,
        targetType: 'USER',
        details: `Cập nhật vai trò quản trị cho ${userId} thành ${newRole}`,
        createdAt: new Date().toISOString()
      });

      toast.success(`Đã cập nhật thành ${newRole}`);
      setIsModalOpen(false);
      setSearchEmail('');
      setFoundUser(null);
      fetchManagers();
    } catch (err) {
      toast.error("Thao tác thất bại.");
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-10 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-black tracking-tighter uppercase">Quản Trị Viên & Moderator</h1>
            <p className="text-sm text-neutral-500 font-medium">Quản lý đội ngũ vận hành hệ thống.</p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="px-6 py-4 bg-neutral-900 dark:bg-white text-white dark:text-black font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl flex items-center gap-2 hover:opacity-90 transition-all"
          >
            <Plus className="w-4 h-4" />
            Thêm Quản Trị Viên
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading && !managers.length ? (
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="h-64 bg-neutral-100 dark:bg-neutral-800 animate-pulse rounded-[2.5rem]"></div>
            ))
          ) : (
            managers.map((m) => (
              <div key={m.id} className="bg-white dark:bg-neutral-900 p-8 rounded-[2.5rem] border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-6 relative group overflow-hidden">
                <div className={`absolute top-0 left-0 w-full h-1.5 ${m.role === 'ADMIN' ? 'bg-red-500' : 'bg-blue-500'}`}></div>
                
                <div className="flex items-center gap-4">
                  <img src={getValidAvatar(m.avatar)} className="w-16 h-16 rounded-[1.5rem] object-cover" alt="" />
                  <div>
                    <h3 className="font-black text-lg tracking-tight truncate max-w-[150px]">{m.displayName}</h3>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg ${m.role === 'ADMIN' ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'}`}>
                        {m.role || 'USER'}
                      </span>
                      {m.moderatorInviteStatus === 'PENDING' && (
                        <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-500 animate-pulse">
                          Chờ Chấp Nhận
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Quyền Hạn</p>
                    <div className="flex flex-wrap gap-1.5">
                      {m.permissions?.map((p: string) => (
                        <span key={p} className="px-2 py-0.5 bg-white dark:bg-neutral-900 text-[9px] font-bold text-neutral-500 border border-neutral-100 dark:border-neutral-800 rounded-md">
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-neutral-400 font-mono">
                    <span>Email: {m.email ? m.email.replace(/(.{2})(.*)(@.*)/, '$1••••••$3') : 'Không có'}</span>
                  </div>

                  {isAdmin && m.id !== currentUser.id && (
                    <button 
                      onClick={() => updateRole(m.id, 'USER')}
                      className="w-full py-3 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-all rounded-xl font-black text-[10px] uppercase tracking-widest"
                    >
                      Gỡ Quyền Quản Trị
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal Add Manager */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white dark:bg-neutral-900 rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl border border-neutral-200 dark:border-neutral-800">
              <div className="p-8 space-y-8">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="text-2xl font-black tracking-tighter uppercase">Thêm Quản Trị Viên</h3>
                    <p className="text-xs text-neutral-500 font-medium">Tìm người dùng qua email để cấp quyền.</p>
                  </div>
                  <button onClick={() => { setIsModalOpen(false); setFoundUser(null); setSearchEmail(''); }} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors">
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="relative">
                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                    <input 
                      type="email" 
                      placeholder="Nhập email người dùng..."
                      value={searchEmail}
                      onChange={(e) => setSearchEmail(e.target.value)}
                      className="w-full pl-11 pr-24 py-4 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-2xl text-sm focus:outline-none"
                    />
                    <button 
                      onClick={findUserByEmail}
                      className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-neutral-900 dark:bg-white text-white dark:text-black font-black text-[10px] uppercase tracking-widest rounded-xl"
                    >
                      Tìm
                    </button>
                  </div>

                  {foundUser && (
                    <div className="p-6 bg-neutral-50 dark:bg-neutral-800/50 rounded-3xl border border-neutral-100 dark:border-neutral-800 flex items-center justify-between animate-in slide-in-from-bottom-4 duration-500">
                      <div className="flex items-center gap-3">
                        <img src={getValidAvatar(foundUser.avatar)} className="w-12 h-12 rounded-xl object-cover" alt="" />
                        <div>
                          <p className="text-sm font-bold">{foundUser.displayName}</p>
                          <p className="text-[10px] text-neutral-500 font-mono">
                            {foundUser.email ? foundUser.email.replace(/(.{2})(.*)(@.*)/, '$1••••••$3') : `ID: ${foundUser.numericId || foundUser.id}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button 
                          onClick={() => updateRole(foundUser.id, 'MODERATOR')}
                          className="px-4 py-2 bg-blue-500 text-white font-black text-[9px] uppercase tracking-widest rounded-lg shadow-lg hover:opacity-90"
                        >
                          Cấp Moderator
                        </button>
                        <button 
                          onClick={() => updateRole(foundUser.id, 'ADMIN')}
                          className="px-4 py-2 bg-red-500 text-white font-black text-[9px] uppercase tracking-widest rounded-lg shadow-lg hover:opacity-90"
                        >
                          Cấp Admin
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl flex gap-3">
                    <ShieldAlert className="w-5 h-5 text-amber-500 flex-shrink-0" />
                    <p className="text-[10px] text-amber-600 font-medium leading-relaxed">
                      Lưu ý: Việc cấp quyền quản trị cho phép người dùng truy cập vào dữ liệu nhạy cảm. Chỉ cấp quyền cho những người bạn tin tưởng tuyệt đối.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
