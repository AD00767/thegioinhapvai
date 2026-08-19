import React, { useState, useEffect } from 'react';
import AdminLayout from './AdminLayout';
import { 
  UserCheck, CheckCircle, XCircle, Clock, 
  ExternalLink, User, ShieldCheck, Mail,
  MessageSquare, Search, Filter, Sparkles, ShieldAlert
} from 'lucide-react';
import { 
  collection, query, getDocs, doc, updateDoc, 
  orderBy, where, serverTimestamp, addDoc, getDoc 
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/useAuthStore';
import { getValidAvatar } from '../../lib/avatar';
import toast from 'react-hot-toast';

export default function CreatorManager() {
  const { user: currentUser } = useAuthStore();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [note, setNote] = useState('');

  const [selectedUser, setSelectedUser] = useState<any>(null);

  useEffect(() => {
    fetchRequests();
  }, [filter]);

  useEffect(() => {
    if (selectedRequest) {
      fetchUserDetails(selectedRequest.userId);
    } else {
      setSelectedUser(null);
    }
  }, [selectedRequest]);

  const fetchUserDetails = async (userId: string) => {
    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        setSelectedUser(userSnap.data());
      }
    } catch (err) {
      console.error("Error fetching user details:", err);
    }
  };

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'creator_requests'), 
        where('status', '==', filter),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Error fetching requests:", err);
      toast.error("Không thể tải danh sách yêu cầu.");
    } finally {
      setLoading(false);
    }
  };

  const handleProcessRequest = async (status: 'APPROVED' | 'REJECTED') => {
    if (!selectedRequest) return;
    
    const isApplicantModerator = selectedRequest.userRole === 'MODERATOR' || selectedRequest.userRole === 'MOD';
    if (isApplicantModerator && currentUser?.role !== 'ADMIN') {
      toast.error("Yêu cầu trở thành Creator của Moderator chỉ có thể do Admin xử lý.");
      return;
    }

    if (status === 'REJECTED' && !note.trim()) {
      toast.error("Vui lòng nhập lý do từ chối.");
      return;
    }

    try {
      const requestRef = doc(db, 'creator_requests', selectedRequest.id);
      await updateDoc(requestRef, {
        status,
        moderatorId: currentUser.id,
        moderatorNote: note,
        updatedAt: serverTimestamp()
      });

      if (status === 'APPROVED') {
        const userRef = doc(db, 'users', selectedRequest.userId);
        await updateDoc(userRef, {
          creatorStatus: true,
          updatedAt: serverTimestamp()
        });

        // Update global_ids mapping if numericId exists
        if (selectedUser?.numericId) {
          const idRef = doc(db, 'global_ids', selectedUser.numericId);
          await updateDoc(idRef, {
            objectType: 'creator',
            updatedAt: serverTimestamp()
          }).catch(err => console.warn("Failed to update global_ids mapping:", err));
        }

        // Send notification
        await addDoc(collection(db, 'notifications'), {
          userId: selectedRequest.userId,
          title: 'Chúc mừng! Bạn đã trở thành Creator',
          content: 'Yêu cầu của bạn đã được phê duyệt. Bây giờ bạn có thể tạo Character và truy cập Bảng điều khiển Creator.',
          type: 'SYSTEM',
          read: false,
          createdAt: serverTimestamp()
        });

        toast.success("Đã phê duyệt và cấp quyền Creator.");
      } else {
        // Send notification for rejection
        await addDoc(collection(db, 'notifications'), {
          userId: selectedRequest.userId,
          title: 'Yêu cầu trở thành Creator bị từ chối',
          content: `Rất tiếc, yêu cầu của bạn không được phê duyệt. Lý do: ${note}`,
          type: 'SYSTEM',
          read: false,
          createdAt: serverTimestamp()
        });

        toast.success("Đã từ chối yêu cầu.");
      }

      // Audit Log
      await addDoc(collection(db, 'audit_logs'), {
        executorId: currentUser.id,
        executorName: currentUser.displayName,
        executorRole: currentUser.role,
        action: status === 'APPROVED' ? 'APPROVE_CREATOR' : 'REJECT_CREATOR',
        targetId: selectedRequest.userId,
        targetType: 'USER',
        details: `${status === 'APPROVED' ? 'Phê duyệt' : 'Từ chối'} yêu cầu làm Creator của ${selectedRequest.displayName}`,
        reason: note,
        createdAt: new Date().toISOString()
      });

      setSelectedRequest(null);
      setNote('');
      fetchRequests();
    } catch (err) {
      toast.error("Thao tác thất bại.");
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-black tracking-tighter uppercase">Quản Lý Creator</h1>
            <p className="text-sm text-neutral-500 font-medium">Xét duyệt và quản lý hồ sơ những người sáng tạo nội dung.</p>
          </div>
          <div className="flex p-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm">
            {(['PENDING', 'APPROVED', 'REJECTED'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${filter === s ? 'bg-neutral-900 text-white dark:bg-white dark:text-black shadow-lg' : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'}`}
              >
                {s === 'PENDING' ? 'Chờ Phê Duyệt' : s === 'APPROVED' ? 'Đã Duyệt' : 'Đã Từ Chối'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            {loading ? (
              Array(3).fill(0).map((_, i) => (
                <div key={i} className="h-32 bg-neutral-100 dark:bg-neutral-800 animate-pulse rounded-3xl"></div>
              ))
            ) : requests.length === 0 ? (
              <div className="py-20 text-center bg-white dark:bg-neutral-900 rounded-[2.5rem] border border-neutral-200 dark:border-neutral-800">
                <UserCheck className="w-12 h-12 text-emerald-500/20 mx-auto mb-4" />
                <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Không có yêu cầu xét duyệt nào.</p>
              </div>
            ) : (
              requests.map((r) => (
                <div 
                  key={r.id}
                  onClick={() => setSelectedRequest(r)}
                  className={`
                    p-6 bg-white dark:bg-neutral-900 rounded-3xl border transition-all cursor-pointer group hover:shadow-xl
                    ${selectedRequest?.id === r.id ? 'border-neutral-900 dark:border-white ring-2 ring-neutral-900/5' : 'border-neutral-200 dark:border-neutral-800'}
                  `}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <img src={getValidAvatar(r.avatar)} className="w-12 h-12 rounded-xl object-cover" alt="" />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-black text-sm uppercase tracking-tight">{r.displayName}</h3>
                          {(r.userRole === 'MODERATOR' || r.userRole === 'MOD') && (
                            <span className="px-2 py-0.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[9px] font-black rounded-full uppercase tracking-wider">
                              Moderator
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest font-mono">
                          {r.email ? r.email.replace(/(.{2})(.*)(@.*)/, '$1••••••$3') : ''}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] text-neutral-400 font-medium">
                      {r.createdAt?.toDate ? r.createdAt.toDate().toLocaleDateString('vi-VN') : '---'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">
                    <span className="flex items-center gap-1"><Sparkles className="w-3 h-3" /> {r.experience || "Newbie"}</span>
                    <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {r.portfolioCount || 0} Sản phẩm</span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="sticky top-8">
            {selectedRequest ? (
              <div className="bg-neutral-900 dark:bg-white text-white dark:text-black p-8 rounded-[2.5rem] shadow-2xl space-y-8 animate-in slide-in-from-right-8 duration-500">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h2 className="text-xl font-black tracking-tight uppercase">Chi Tiết Đơn Đăng Ký</h2>
                    <div className="flex flex-col gap-1">
                      <p className="text-[10px] opacity-50 font-black uppercase tracking-widest">Doc ID: {selectedRequest.userId}</p>
                      {selectedUser && (
                        <p className="text-[10px] text-amber-400 font-black uppercase tracking-widest">
                          ID Hệ thống: {selectedUser.creatorStatus ? 'creator' : 'user'}/{selectedUser.numericId}
                        </p>
                      )}
                    </div>
                  </div>
                  <button onClick={() => setSelectedRequest(null)} className="p-2 hover:bg-white/10 dark:hover:bg-black/10 rounded-full transition-colors">
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-6">
                  {selectedUser && (
                    <div className="p-6 bg-white/5 dark:bg-black/5 rounded-[2rem] space-y-4">
                      <p className="text-[10px] opacity-50 font-black uppercase tracking-widest">Thông tin Creator</p>
                      <div className="space-y-2">
                        <p className="text-sm font-bold">{selectedUser.displayName}</p>
                        <p className="text-xs opacity-80 leading-relaxed">
                          <span className="font-bold">Tiểu sử:</span> {selectedUser.bio || "Chưa có tiểu sử."}
                        </p>
                      </div>
                    </div>
                  )}

                  {(selectedRequest.userRole === 'MODERATOR' || selectedRequest.userRole === 'MOD') && (
                    <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-2xl flex items-center gap-3">
                      <ShieldAlert className="w-5 h-5 shrink-0 text-amber-400" />
                      <div className="text-xs">
                        <p className="font-bold">Đơn đăng ký từ Moderator</p>
                        <p className="opacity-80 text-[11px]">Yêu cầu trở thành Creator của Moderator chỉ do Admin có quyền phê duyệt.</p>
                      </div>
                    </div>
                  )}

                  <div className="p-6 bg-white/5 dark:bg-black/5 rounded-[2rem] space-y-4">
                    <p className="text-[10px] opacity-50 font-black uppercase tracking-widest">Lý do muốn làm Creator</p>
                    <p className="text-sm leading-relaxed italic">"{selectedRequest.reason || "Không có mô tả."}"</p>
                  </div>

                  {filter === 'PENDING' && (
                    <div className="space-y-4">
                      {((selectedRequest.userRole === 'MODERATOR' || selectedRequest.userRole === 'MOD') && currentUser?.role !== 'ADMIN') ? (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-300 rounded-2xl text-xs text-center font-bold">
                          Chỉ Admin mới có quyền xét duyệt yêu cầu làm Creator của Moderator.
                        </div>
                      ) : (
                        <>
                          <p className="text-[10px] opacity-50 font-black uppercase tracking-widest">Ghi chú (Tùy chọn)</p>
                          <textarea 
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Nhập ghi chú cho người dùng..."
                            className="w-full p-4 bg-white/5 dark:bg-black/5 border border-white/10 dark:border-black/10 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-white/50 resize-none h-24"
                          />
                          <div className="grid grid-cols-2 gap-4">
                            <button 
                              onClick={() => handleProcessRequest('REJECTED')}
                              className="py-4 bg-red-500/20 text-red-500 border border-red-500/30 font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-red-500/30 transition-all"
                            >
                              Từ Chối
                            </button>
                            <button 
                              onClick={() => handleProcessRequest('APPROVED')}
                              className="py-4 bg-white dark:bg-black text-black dark:text-white font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-xl hover:opacity-90 transition-all"
                            >
                              Phê Duyệt
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {filter !== 'PENDING' && (
                    <div className={`p-6 rounded-[2rem] border space-y-2 ${filter === 'APPROVED' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                      <div className="flex items-center gap-2">
                        {filter === 'APPROVED' ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                        <span className="text-xs font-black uppercase tracking-widest">{filter === 'APPROVED' ? 'Đã Phê Duyệt' : 'Đã Từ Chối'}</span>
                      </div>
                      <p className="text-xs opacity-80 italic">"{selectedRequest.moderatorNote || "Không có ghi chú."}"</p>
                      <p className="text-[10px] opacity-40 font-medium">Bởi Mod: {selectedRequest.moderatorId}</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[400px] bg-white dark:bg-neutral-900 rounded-[3rem] border-4 border-dashed border-neutral-100 dark:border-neutral-800 flex flex-col items-center justify-center text-center p-10">
                <UserCheck className="w-12 h-12 text-neutral-200 dark:text-neutral-700 mb-4" />
                <h3 className="text-lg font-black tracking-tight text-neutral-300 dark:text-neutral-700 uppercase">Hệ Thống Phê Duyệt</h3>
                <p className="text-xs font-bold text-neutral-400 uppercase tracking-[0.2em] mt-2">Chọn một yêu cầu để xem chi tiết và xét duyệt.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
