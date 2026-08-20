import React, { useState, useEffect } from 'react';
import { 
  FileCheck, Clock, CheckCircle2, XCircle, Search, Filter, ExternalLink, 
  User, ShieldAlert, MessageSquare, Sparkles, RefreshCw, ChevronRight, AlertCircle 
} from 'lucide-react';
import { 
  collection, query, getDocs, doc, updateDoc, addDoc, orderBy, where 
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/useAuthStore';
import toast from 'react-hot-toast';
import { AppealItem } from '../../types';

export default function AppealManagement() {
  const { user: currentUser } = useAuthStore();
  const [appeals, setAppeals] = useState<AppealItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Decision Modal State
  const [selectedAppeal, setSelectedAppeal] = useState<AppealItem | null>(null);
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT' | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchAppeals();
  }, []);

  const fetchAppeals = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'appeals'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const list: AppealItem[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as AppealItem));
      setAppeals(list);
    } catch (err) {
      console.error("Error fetching appeals:", err);
      toast.error("Không thể tải danh sách kháng nghị.");
    } finally {
      setLoading(false);
    }
  };

  const handleResolveAppeal = async () => {
    if (!selectedAppeal || !actionType || !currentUser) return;

    setIsProcessing(true);
    try {
      const isApproved = actionType === 'APPROVE';
      const newStatus = isApproved ? 'APPROVED' : 'REJECTED';
      const now = new Date().toISOString();

      // 1. Update Appeal record
      await updateDoc(doc(db, 'appeals', selectedAppeal.id), {
        status: newStatus,
        adminResponse: adminNote.trim() || (isApproved ? 'Đã duyệt khôi phục.' : 'Từ chối kháng nghị.'),
        processedBy: currentUser.id,
        processedByName: currentUser.displayName || 'Admin',
        processedAt: now,
        updatedAt: now
      });

      // 2. Perform Content / Account Restoration or Status Update
      const { targetType, targetId } = selectedAppeal;

      if (isApproved) {
        if (targetType === 'ACCOUNT') {
          await updateDoc(doc(db, 'users', targetId), {
            isLocked: false,
            lockReason: null,
            lockExpiresAt: null,
            appealStatus: 'APPROVED'
          });
        } else {
          const collectionMap: Record<string, string> = {
            'CHARACTER': 'characters',
            'PROMPT': 'prompts',
            'FEEDBACK': 'feedbacks',
            'COMMENT': 'comments'
          };
          const collName = collectionMap[targetType];
          if (collName) {
            await updateDoc(doc(db, collName, targetId), {
              isHidden: false,
              deletedAt: null,
              appealStatus: 'APPROVED'
            });
          }
        }
      } else {
        // If rejected, set target appealStatus to REJECTED
        if (targetType === 'ACCOUNT') {
          await updateDoc(doc(db, 'users', targetId), {
            appealStatus: 'REJECTED'
          }).catch(() => {});
        } else {
          const collectionMap: Record<string, string> = {
            'CHARACTER': 'characters',
            'PROMPT': 'prompts',
            'FEEDBACK': 'feedbacks',
            'COMMENT': 'comments'
          };
          const collName = collectionMap[targetType];
          if (collName) {
            await updateDoc(doc(db, collName, targetId), {
              appealStatus: 'REJECTED'
            }).catch(() => {});
          }
        }
      }

      // 3. Send Notification to User
      await addDoc(collection(db, 'notifications'), {
        userId: selectedAppeal.userId,
        recipientId: selectedAppeal.userId,
        type: isApproved ? 'APPEAL_APPROVED' : 'APPEAL_REJECTED',
        title: isApproved ? 'Đơn kháng nghị đã được CHẤP NHẬN' : 'Đơn kháng nghị đã bị TỪ CHỐI',
        message: isApproved 
          ? `Kháng nghị cho "${selectedAppeal.targetName}" đã được duyệt. Nội dung/tài khoản của bạn đã được khôi phục.`
          : `Kháng nghị cho "${selectedAppeal.targetName}" đã bị từ chối. Lời nhắn từ Admin: ${adminNote.trim() || 'Không đủ điều kiện khôi phục.'}`,
        targetType: selectedAppeal.targetType,
        targetId: selectedAppeal.targetId,
        targetName: selectedAppeal.targetName,
        read: false,
        createdAt: now
      });

      // 4. Log Audit Log
      await addDoc(collection(db, 'audit_logs'), {
        executorId: currentUser.id,
        executorName: currentUser.displayName,
        action: isApproved ? 'APPEAL_APPROVE' : 'APPEAL_REJECT',
        targetType: selectedAppeal.targetType,
        targetId: selectedAppeal.targetId,
        details: `Xử lý kháng nghị (${newStatus}) cho ${selectedAppeal.targetName}. Ghi chú: ${adminNote.trim()}`,
        createdAt: now
      });

      toast.success(isApproved ? "Đã chấp nhận kháng nghị và khôi phục!" : "Đã từ chối đơn kháng nghị.");
      setSelectedAppeal(null);
      setActionType(null);
      setAdminNote('');
      fetchAppeals();
    } catch (err) {
      console.error("Resolve appeal error:", err);
      toast.error("Thao tác thất bại. Vui lòng thử lại.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Filtered List
  const filteredAppeals = appeals.filter(item => {
    const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
    const matchesType = typeFilter === 'ALL' || item.targetType === typeFilter;
    const matchesSearch = 
      item.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.targetName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.reason?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesType && matchesSearch;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-amber-500 font-extrabold text-xs uppercase tracking-widest mb-1">
            <FileCheck className="w-4 h-4" /> Quản Lý Kháng Nghị
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-neutral-900 dark:text-neutral-100">
            Hệ Thống Xem Xét Kháng Nghị
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            Tiếp nhận và xử lý yêu cầu khôi phục nội dung hoặc tài khoản từ cộng đồng.
          </p>
        </div>

        <button
          onClick={fetchAppeals}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-bold text-xs transition-colors self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Làm mới
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-neutral-900 p-4 md:p-6 rounded-[2rem] border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
        
        {/* Status Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-neutral-100 dark:border-neutral-800">
          {(['PENDING', 'ALL', 'APPROVED', 'REJECTED'] as const).map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                statusFilter === st 
                  ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/10' 
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}
            >
              {st === 'PENDING' && '⏳ Đang chờ xem xét'}
              {st === 'ALL' && 'Tất cả'}
              {st === 'APPROVED' && '✅ Đã chấp nhận'}
              {st === 'REJECTED' && '❌ Đã từ chối'}
            </button>
          ))}
        </div>

        {/* Search & Type Filter */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo tên người dùng, đối tượng hoặc nội dung kháng nghị..."
              className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full sm:w-48 px-3 py-2.5 bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs font-bold text-neutral-700 dark:text-neutral-300 focus:outline-none"
          >
            <option value="ALL">Tất cả loại đối tượng</option>
            <option value="CHARACTER">Character</option>
            <option value="PROMPT">Prompt</option>
            <option value="FEEDBACK">Feedback</option>
            <option value="COMMENT">Comment</option>
            <option value="ACCOUNT">Tài khoản</option>
          </select>
        </div>
      </div>

      {/* Appeals List */}
      {loading ? (
        <div className="py-20 text-center text-neutral-400 space-y-3">
          <Clock className="w-10 h-10 mx-auto animate-spin opacity-40 text-amber-500" />
          <p className="text-xs font-bold uppercase tracking-widest">Đang tải danh sách kháng nghị...</p>
        </div>
      ) : filteredAppeals.length === 0 ? (
        <div className="py-16 text-center bg-white dark:bg-neutral-900 rounded-[2rem] border border-neutral-200 dark:border-neutral-800 p-8 space-y-3">
          <FileCheck className="w-12 h-12 mx-auto text-neutral-300 dark:text-neutral-700" />
          <h3 className="text-base font-extrabold text-neutral-700 dark:text-neutral-300">
            Không Có Đơn Kháng Nghị Nào
          </h3>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto">
            Hiện không có đơn kháng nghị nào phù hợp với bộ lọc đã chọn.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredAppeals.map(appeal => (
            <div 
              key={appeal.id}
              className="bg-white dark:bg-neutral-900 rounded-3xl p-6 border border-neutral-200 dark:border-neutral-800 shadow-sm hover:border-amber-500/30 transition-all space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 dark:border-neutral-800/80 pb-4">
                
                {/* User Info */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 font-black flex items-center justify-center uppercase">
                    {appeal.userName.charAt(0)}
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-neutral-900 dark:text-neutral-100">
                      {appeal.userName}
                    </h4>
                    <span className="text-[10px] text-neutral-400 font-medium">
                      {appeal.userEmail || appeal.userId}
                    </span>
                  </div>
                </div>

                {/* Target Type & Status Badges */}
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                    {appeal.targetType}
                  </span>

                  {appeal.status === 'PENDING' && (
                    <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1">
                      <Clock className="w-3 h-3 animate-spin" /> Chờ duyệt
                    </span>
                  )}
                  {appeal.status === 'APPROVED' && (
                    <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Đã duyệt
                    </span>
                  )}
                  {appeal.status === 'REJECTED' && (
                    <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 flex items-center gap-1">
                      <XCircle className="w-3 h-3" /> Từ chối
                    </span>
                  )}
                </div>
              </div>

              {/* Content Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Left: Original Removal Info */}
                <div className="bg-neutral-50 dark:bg-neutral-800/40 p-4 rounded-2xl border border-neutral-200/60 dark:border-neutral-800 space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block">
                    Thông tin xử lý ban đầu
                  </span>
                  <p className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                    Đối tượng: {appeal.targetName}
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                    Lý do gỡ/khóa: {appeal.removalReason || 'Vi phạm tiêu chuẩn cộng đồng'}
                  </p>
                  <p className="text-[10px] text-neutral-400">
                    Thời gian xử lý: {new Date(appeal.removalTime || appeal.createdAt).toLocaleString('vi-VN')}
                  </p>
                </div>

                {/* Right: User's Appeal Reason */}
                <div className="bg-amber-500/5 p-4 rounded-2xl border border-amber-500/20 space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 block">
                    Nội dung kháng nghị từ người dùng
                  </span>
                  <p className="text-xs text-neutral-800 dark:text-neutral-200 font-medium whitespace-pre-line italic">
                    "{appeal.reason}"
                  </p>
                  {appeal.proofImageUrl && (
                    <a 
                      href={appeal.proofImageUrl} 
                      target="_blank" 
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-bold hover:underline pt-1"
                    >
                      <ExternalLink className="w-3 h-3" /> Xem ảnh minh chứng đính kèm
                    </a>
                  )}
                </div>
              </div>

              {/* Admin Note if already processed */}
              {appeal.adminResponse && (
                <div className="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-xl text-xs space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                    Phản hồi từ Admin ({appeal.processedByName || 'Ban Quản Trị'}) - {new Date(appeal.processedAt || appeal.updatedAt).toLocaleString('vi-VN')}:
                  </p>
                  <p className="font-medium text-neutral-700 dark:text-neutral-300">{appeal.adminResponse}</p>
                </div>
              )}

              {/* Actions Footer */}
              {appeal.status === 'PENDING' && (
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    onClick={() => {
                      setSelectedAppeal(appeal);
                      setActionType('REJECT');
                      setAdminNote('');
                    }}
                    className="px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5"
                  >
                    <XCircle className="w-4 h-4" /> Từ chối
                  </button>

                  <button
                    onClick={() => {
                      setSelectedAppeal(appeal);
                      setActionType('APPROVE');
                      setAdminNote('');
                    }}
                    className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Chấp nhận & Khôi phục
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Decision Modal */}
      {selectedAppeal && actionType && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-neutral-900 rounded-[2.5rem] w-full max-w-lg p-6 md:p-8 space-y-6 border border-neutral-200 dark:border-neutral-800 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black ${
                actionType === 'APPROVE' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
              }`}>
                {actionType === 'APPROVE' ? <CheckCircle2 className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
              </div>
              <div>
                <h3 className="text-lg font-black text-neutral-900 dark:text-neutral-100">
                  {actionType === 'APPROVE' ? 'Xác Nhận Khôi Phục Nội Dung / Tài Khoản' : 'Từ Chối Đơn Kháng Nghị'}
                </h3>
                <p className="text-xs text-neutral-500">
                  Kháng nghị từ {selectedAppeal.userName} cho "{selectedAppeal.targetName}"
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                Lời nhắn phản hồi gửi người dùng (Không bắt buộc)
              </label>
              <textarea
                rows={3}
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder={actionType === 'APPROVE' ? "Nhập lời nhắn gửi người dùng (ví dụ: 'Nội dung đã được xác minh lại và khôi phục thành công.')..." : "Nhập lý do từ chối cụ thể..."}
                className="w-full p-4 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedAppeal(null);
                  setActionType(null);
                }}
                className="px-5 py-3.5 bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 text-neutral-700 dark:text-neutral-300 font-bold text-xs rounded-2xl"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleResolveAppeal}
                className={`flex-1 py-3.5 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all shadow-xl flex items-center justify-center gap-2 ${
                  actionType === 'APPROVE' 
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-black' 
                    : 'bg-red-600 hover:bg-red-500'
                }`}
              >
                {isProcessing ? <Clock className="w-4 h-4 animate-spin" /> : null}
                <span>{actionType === 'APPROVE' ? 'Đồng Ý Khôi Phục' : 'Xác Nhận Từ Chối'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
