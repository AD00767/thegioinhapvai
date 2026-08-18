import React, { useState, useEffect } from 'react';
import AdminLayout from './AdminLayout';
import { 
  MessageSquare, Mail, User, Clock, 
  CheckCircle, Trash2, Reply, Search,
  Filter, MoreVertical, X, ExternalLink
} from 'lucide-react';
import { 
  collection, query, getDocs, doc, updateDoc, 
  orderBy, where, serverTimestamp, deleteDoc, addDoc 
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/useAuthStore';
import DeleteConfirmModal from '../../components/DeleteConfirmModal';
import toast from 'react-hot-toast';

export default function SupportManager() {
  const { user: currentUser } = useAuthStore();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'PENDING' | 'RESOLVED'>('PENDING');
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [reply, setReply] = useState('');
  const [ticketToDelete, setTicketToDelete] = useState<string | null>(null);

  useEffect(() => {
    fetchTickets();
  }, [filter]);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'contact_forms'), 
        where('status', '==', filter),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      setTickets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Error fetching tickets:", err);
      toast.error("Không thể tải danh sách yêu cầu.");
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedTicket || !reply.trim()) {
      toast.error("Vui lòng nhập phản hồi.");
      return;
    }
    
    try {
      const ticketRef = doc(db, 'contact_forms', selectedTicket.id);
      await updateDoc(ticketRef, {
        status: 'RESOLVED',
        moderatorId: currentUser.id,
        moderatorReply: reply,
        resolvedAt: serverTimestamp()
      });

      // Audit Log
      await addDoc(collection(db, 'audit_logs'), {
        executorId: currentUser.id,
        executorName: currentUser.displayName,
        executorRole: currentUser.role,
        action: 'RESOLVE_SUPPORT',
        targetId: selectedTicket.id,
        targetType: 'SUPPORT_TICKET',
        details: `Giải quyết yêu cầu hỗ trợ từ ${selectedTicket.email}`,
        reason: reply,
        createdAt: new Date().toISOString()
      });

      toast.success("Đã giải quyết yêu cầu.");
      setSelectedTicket(null);
      setReply('');
      fetchTickets();
    } catch (err) {
      toast.error("Thao tác thất bại.");
    }
  };

  const handleDelete = (id: string) => {
    setTicketToDelete(id);
  };

  const executeDelete = async () => {
    if (!ticketToDelete) return;
    try {
      await deleteDoc(doc(db, 'contact_forms', ticketToDelete));
      toast.success("Đã xóa hoàn toàn yêu cầu hỗ trợ khỏi hệ thống.");
      if (selectedTicket?.id === ticketToDelete) setSelectedTicket(null);
      setTicketToDelete(null);
      fetchTickets();
    } catch (err) {
      console.error("Delete support ticket error:", err);
      toast.error("Xóa thất bại.");
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-black tracking-tighter uppercase">Hỗ Trợ & Liên Hệ</h1>
            <p className="text-sm text-neutral-500 font-medium">Quản lý và phản hồi các yêu cầu từ người dùng.</p>
          </div>
          <div className="flex p-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm">
            <button
              onClick={() => setFilter('PENDING')}
              className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${filter === 'PENDING' ? 'bg-neutral-900 text-white dark:bg-white dark:text-black shadow-lg' : 'text-neutral-50'}`}
            >
              Chờ Phản Hồi
            </button>
            <button
              onClick={() => setFilter('RESOLVED')}
              className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${filter === 'RESOLVED' ? 'bg-neutral-900 text-white dark:bg-white dark:text-black shadow-lg' : 'text-neutral-50'}`}
            >
              Đã Giải Quyết
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            {loading ? (
              Array(3).fill(0).map((_, i) => (
                <div key={i} className="h-32 bg-neutral-100 dark:bg-neutral-800 animate-pulse rounded-3xl"></div>
              ))
            ) : tickets.length === 0 ? (
              <div className="py-20 text-center bg-white dark:bg-neutral-900 rounded-[2.5rem] border border-neutral-200 dark:border-neutral-800">
                <CheckCircle className="w-12 h-12 text-emerald-500/20 mx-auto mb-4" />
                <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Không có yêu cầu nào cần xử lý.</p>
              </div>
            ) : (
              tickets.map((t) => (
                <div 
                  key={t.id}
                  onClick={() => setSelectedTicket(t)}
                  className={`
                    p-6 bg-white dark:bg-neutral-900 rounded-3xl border transition-all cursor-pointer group hover:shadow-xl
                    ${selectedTicket?.id === t.id ? 'border-neutral-900 dark:border-white ring-2 ring-neutral-900/5' : 'border-neutral-200 dark:border-neutral-800'}
                  `}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-500">
                        <Mail className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-black text-sm uppercase tracking-tight">{t.subject}</h3>
                        <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest font-mono">
                          {t.name} • {t.email ? t.email.replace(/(.{2})(.*)(@.*)/, '$1••••••$3') : ''}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] text-neutral-400 font-medium">
                      {t.createdAt?.toDate ? t.createdAt.toDate().toLocaleString('vi-VN') : '---'}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-2 italic mb-4 leading-relaxed">"{t.message}"</p>
                  <div className="flex items-center justify-between pt-4 border-t border-neutral-50 dark:border-neutral-800">
                    <div className="flex items-center gap-4">
                      <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-tighter ${t.status === 'PENDING' ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                        {t.status}
                      </span>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }}
                      className="opacity-0 group-hover:opacity-100 p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Ticket Detail */}
          <div className="sticky top-8">
            {selectedTicket ? (
              <div className="bg-neutral-900 dark:bg-white text-white dark:text-black p-8 rounded-[2.5rem] shadow-2xl space-y-8 animate-in slide-in-from-right-8 duration-500">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h2 className="text-xl font-black tracking-tight uppercase">Yêu Cầu Hỗ Trợ</h2>
                    <p className="text-[10px] opacity-50 font-black uppercase tracking-widest">#{selectedTicket.id.substring(0, 8)}</p>
                  </div>
                  <button onClick={() => setSelectedTicket(null)} className="p-2 hover:bg-white/10 dark:hover:bg-black/10 rounded-full transition-colors">
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-white/5 dark:bg-black/5 rounded-2xl">
                      <p className="text-[9px] opacity-50 font-black uppercase tracking-widest mb-1">Người gửi</p>
                      <p className="text-xs font-bold truncate">{selectedTicket.name}</p>
                    </div>
                    <div className="p-4 bg-white/5 dark:bg-black/5 rounded-2xl">
                      <p className="text-[9px] opacity-50 font-black uppercase tracking-widest mb-1">Email</p>
                      <p className="text-xs font-bold truncate font-mono">{selectedTicket.email ? selectedTicket.email.replace(/(.{2})(.*)(@.*)/, '$1••••••$3') : 'Không có'}</p>
                    </div>
                  </div>

                  <div className="p-6 bg-white/5 dark:bg-black/5 rounded-[2rem] border border-white/10 dark:border-black/10 space-y-4">
                    <p className="text-[9px] opacity-50 font-black uppercase tracking-widest">Nội dung tin nhắn</p>
                    <p className="text-sm leading-relaxed italic">"{selectedTicket.message}"</p>
                  </div>

                  {filter === 'PENDING' ? (
                    <div className="space-y-4">
                      <p className="text-[10px] opacity-50 font-black uppercase tracking-widest">Phản hồi của bạn</p>
                      <textarea 
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        placeholder="Nhập nội dung phản hồi người dùng..."
                        className="w-full p-4 bg-white/5 dark:bg-black/5 border border-white/10 dark:border-black/10 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-white/50 resize-none h-32"
                      />
                      <button 
                        onClick={handleResolve}
                        className="w-full py-4 bg-white dark:bg-black text-black dark:text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all shadow-xl flex items-center justify-center gap-2"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Đã Xử Lý & Đóng
                      </button>
                    </div>
                  ) : (
                    <div className="p-6 bg-emerald-500/10 border border-emerald-500/30 rounded-[2rem] space-y-4">
                      <div className="flex items-center gap-2 text-emerald-400">
                        <CheckCircle className="w-5 h-5" />
                        <span className="text-xs font-black uppercase tracking-widest">Đã Giải Quyết</span>
                      </div>
                      <p className="text-sm opacity-80 italic">"{selectedTicket.moderatorReply}"</p>
                      <p className="text-[10px] opacity-40 font-medium">Bởi Mod: {selectedTicket.moderatorId}</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[400px] bg-white dark:bg-neutral-900 rounded-[3rem] border-4 border-dashed border-neutral-100 dark:border-neutral-800 flex flex-col items-center justify-center text-center p-10">
                <MessageSquare className="w-12 h-12 text-neutral-200 dark:text-neutral-700 mb-4" />
                <h3 className="text-lg font-black tracking-tight text-neutral-300 dark:text-neutral-700 uppercase">Hộp Thư Hỗ Trợ</h3>
                <p className="text-xs font-bold text-neutral-400 uppercase tracking-[0.2em] mt-2">Chọn một tin nhắn để xem chi tiết và phản hồi.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <DeleteConfirmModal
        isOpen={ticketToDelete !== null}
        onClose={() => setTicketToDelete(null)}
        onConfirm={executeDelete}
        title="Xóa yêu cầu hỗ trợ?"
        description="Bạn có chắc chắn muốn xóa yêu cầu hỗ trợ này không? Nội dung sẽ bị xóa hoàn toàn khỏi hệ thống."
        confirmText="Xác nhận xóa"
        cancelText="Hủy bỏ"
      />
    </AdminLayout>
  );
}
