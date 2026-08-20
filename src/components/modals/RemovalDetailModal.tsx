import React, { useState, useEffect } from 'react';
import { 
  X, ShieldAlert, Clock, CheckCircle2, XCircle, AlertCircle, Send, FileText, ExternalLink 
} from 'lucide-react';
import { 
  collection, query, where, getDocs, addDoc, doc, updateDoc, getDoc 
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/useAuthStore';
import toast from 'react-hot-toast';
import { AppealItem } from '../../types';

interface RemovalDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: string;
  targetId: string;
  targetName?: string;
  removalReason?: string;
  removalDetails?: string;
  removalTime?: string;
}

export default function RemovalDetailModal({
  isOpen,
  onClose,
  targetType,
  targetId,
  targetName: initialName,
  removalReason: initialReason,
  removalDetails: initialDetails,
  removalTime: initialTime,
}: RemovalDetailModalProps) {
  const { user } = useAuthStore();
  
  const [loading, setLoading] = useState(true);
  const [targetData, setTargetData] = useState<{
    name: string;
    reason: string;
    details: string;
    time: string;
  }>({
    name: initialName || 'Nội dung',
    reason: initialReason || 'Vi phạm quy định cộng đồng',
    details: initialDetails || 'Nội dung đã bị quản trị viên gỡ hoặc ẩn.',
    time: initialTime || new Date().toISOString()
  });

  const [appeal, setAppeal] = useState<AppealItem | null>(null);
  const [appealReason, setAppealReason] = useState('');
  const [proofImageUrl, setProofImageUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAppealForm, setShowAppealForm] = useState(false);

  useEffect(() => {
    if (isOpen && user && targetId) {
      fetchRemovalAndAppealDetails();
    }
  }, [isOpen, targetId, user?.id]);

  const fetchRemovalAndAppealDetails = async () => {
    setLoading(true);
    try {
      // 1. Fetch content document if initial props missing
      let name = initialName || '';
      let reason = initialReason || '';
      let details = initialDetails || '';
      let time = initialTime || '';

      if ((!name || !reason) && targetType !== 'ACCOUNT') {
        const collectionMap: Record<string, string> = {
          'CHARACTER': 'characters',
          'PROMPT': 'prompts',
          'FEEDBACK': 'feedbacks',
          'COMMENT': 'comments'
        };
        const collName = collectionMap[targetType] || 'characters';
        const targetSnap = await getDoc(doc(db, collName, targetId));
        if (targetSnap.exists()) {
          const d = targetSnap.data();
          name = d.name || d.title || d.message || name || 'Nội dung';
          reason = d.removalReason || reason || 'Vi phạm tiêu chuẩn cộng đồng';
          details = d.removalDetails || details || 'Nội dung chứa hình ảnh hoặc ngôn từ không phù hợp.';
          time = d.removalTime || d.deletedAt || time || new Date().toISOString();
        }
      }

      setTargetData({
        name: name || (targetType === 'ACCOUNT' ? 'Tài khoản cá nhân' : 'Nội dung'),
        reason: reason || 'Vi phạm quy định nền tảng',
        details: details || 'Nội dung đã bị ẩn/gỡ bởi quản trị viên.',
        time: time || new Date().toISOString()
      });

      // 2. Fetch user's appeal for this target if exists
      const appealsQuery = query(
        collection(db, 'appeals'),
        where('userId', '==', user?.id),
        where('targetId', '==', targetId)
      );
      const appealSnap = await getDocs(appealsQuery);
      if (!appealSnap.empty) {
        const firstDoc = appealSnap.docs[0];
        setAppeal({ id: firstDoc.id, ...firstDoc.data() } as AppealItem);
      } else {
        setAppeal(null);
      }
    } catch (err) {
      console.error("Error fetching appeal details:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAppeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !targetId) return;

    if (!appealReason.trim() || appealReason.trim().length < 10) {
      toast.error("Vui lòng nhập lý do kháng nghị chi tiết (tối thiểu 10 ký tự).");
      return;
    }

    setIsSubmitting(true);
    try {
      const appealData = {
        userId: user.id,
        userName: user.displayName || 'Thành viên',
        userEmail: user.email || '',
        targetType,
        targetId,
        targetName: targetData.name,
        removalReason: targetData.reason,
        removalDetails: targetData.details,
        removalTime: targetData.time,
        reason: appealReason.trim(),
        proofImageUrl: proofImageUrl.trim() || null,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, 'appeals'), appealData);

      // Update target document's appealStatus
      if (targetType !== 'ACCOUNT') {
        const collectionMap: Record<string, string> = {
          'CHARACTER': 'characters',
          'PROMPT': 'prompts',
          'FEEDBACK': 'feedbacks',
          'COMMENT': 'comments'
        };
        const collName = collectionMap[targetType];
        if (collName) {
          await updateDoc(doc(db, collName, targetId), {
            appealStatus: 'PENDING'
          }).catch(() => {});
        }
      } else {
        await updateDoc(doc(db, 'users', user.id), {
          appealStatus: 'PENDING'
        }).catch(() => {});
      }

      toast.success("Đã gửi đơn kháng nghị thành công! Ban quản trị sẽ xem xét sớm nhất.");
      setAppeal({ id: docRef.id, ...appealData } as AppealItem);
      setShowAppealForm(false);
      setAppealReason('');
      setProofImageUrl('');
    } catch (err) {
      console.error("Submit appeal error:", err);
      toast.error("Gửi kháng nghị thất bại. Vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-neutral-900 rounded-[2.5rem] w-full max-w-xl overflow-hidden shadow-2xl border border-neutral-200 dark:border-neutral-800 relative flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 md:p-8 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between shrink-0 bg-neutral-50/50 dark:bg-neutral-900/50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center font-black">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-neutral-900 dark:text-neutral-100 uppercase">
                Chi Tiết Xử Lý & Kháng Nghị
              </h2>
              <p className="text-[10px] text-neutral-400 font-extrabold uppercase tracking-widest">
                Loại: {targetType} • ID: {targetId.substring(0, 8)}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2.5 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 md:p-8 space-y-6 overflow-y-auto scrollbar-thin flex-1">
          {loading ? (
            <div className="py-12 text-center text-neutral-500 font-medium animate-pulse space-y-2">
              <Clock className="w-8 h-8 mx-auto opacity-40 animate-spin" />
              <p className="text-xs font-bold uppercase tracking-widest">Đang tải chi tiết...</p>
            </div>
          ) : (
            <>
              {/* Removal Summary Info Box */}
              <div className="bg-neutral-50 dark:bg-neutral-800/40 rounded-3xl p-6 border border-neutral-200/80 dark:border-neutral-800 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block mb-1">
                      Tên nội dung / Đối tượng
                    </span>
                    <h3 className="text-base font-extrabold text-neutral-900 dark:text-neutral-100">
                      {targetData.name}
                    </h3>
                  </div>

                  {/* Current Appeal Status Badge */}
                  <div className="shrink-0">
                    {!appeal ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                        Chưa gửi kháng nghị
                      </span>
                    ) : appeal.status === 'PENDING' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        <Clock className="w-3 h-3 animate-spin" /> Đang chờ xem xét
                      </span>
                    ) : appeal.status === 'APPROVED' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" /> Đã được khôi phục
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                        <XCircle className="w-3 h-3" /> Kháng nghị bị từ chối
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Lý do xử lý</span>
                    <p className="text-xs font-bold text-red-600 dark:text-red-400 bg-red-500/10 p-3 rounded-2xl border border-red-500/20">
                      {targetData.reason}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Thời gian xử lý</span>
                    <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300 p-3 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800">
                      {new Date(targetData.time).toLocaleString('vi-VN')}
                    </p>
                  </div>
                </div>

                {targetData.details && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Chi tiết vi phạm từ Admin</span>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 p-3 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 italic">
                      "{targetData.details}"
                    </p>
                  </div>
                )}
              </div>

              {/* Submitted Appeal Detail view if exists */}
              {appeal && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-3xl p-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-2">
                      <FileText className="w-4 h-4" /> Đơn kháng nghị của bạn
                    </h4>
                    <span className="text-[10px] text-neutral-400 font-medium">
                      {new Date(appeal.createdAt).toLocaleString('vi-VN')}
                    </span>
                  </div>
                  <div className="p-4 bg-white dark:bg-neutral-900 rounded-2xl text-xs text-neutral-700 dark:text-neutral-300 space-y-2 border border-neutral-200 dark:border-neutral-800">
                    <p className="font-medium whitespace-pre-line">{appeal.reason}</p>
                    {appeal.proofImageUrl && (
                      <div className="pt-2">
                        <a 
                          href={appeal.proofImageUrl} 
                          target="_blank" 
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-[10px] text-amber-600 dark:text-amber-400 font-bold hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" /> Xem ảnh minh chứng đính kèm
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Admin Response Note */}
                  {appeal.adminResponse && (
                    <div className={`p-4 rounded-2xl text-xs space-y-1 ${
                      appeal.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30' : 'bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/30'
                    }`}>
                      <p className="font-extrabold uppercase text-[10px] tracking-widest">Phản hồi từ Ban Quản Trị:</p>
                      <p className="italic">{appeal.adminResponse}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Appeal Form Section */}
              {(!appeal || (appeal.status === 'REJECTED' && showAppealForm)) && (
                <div className="space-y-4 pt-2">
                  {!showAppealForm && !appeal ? (
                    <button
                      onClick={() => setShowAppealForm(true)}
                      className="w-full py-4 bg-black dark:bg-white text-white dark:text-black font-black text-xs uppercase tracking-widest rounded-2xl hover:scale-[1.01] active:scale-95 transition-all shadow-xl flex items-center justify-center gap-2"
                    >
                      <Send className="w-4 h-4" /> Gửi Đơn Kháng Nghị
                    </button>
                  ) : !showAppealForm && appeal?.status === 'REJECTED' ? (
                    <button
                      onClick={() => setShowAppealForm(true)}
                      className="w-full py-3.5 bg-neutral-800 text-white font-bold text-xs rounded-2xl hover:bg-neutral-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <Send className="w-4 h-4" /> Gửi Lại Đơn Kháng Nghị
                    </button>
                  ) : (
                    <form onSubmit={handleSubmitAppeal} className="space-y-4 animate-in fade-in duration-300 bg-neutral-50 dark:bg-neutral-800/20 p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800">
                      <div className="space-y-1">
                        <h4 className="text-xs font-black uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                          Nhập Lý Do Kháng Nghị
                        </h4>
                        <p className="text-[11px] text-neutral-500">
                          Hãy giải thích rõ lý do tại sao bạn tin rằng nội dung/tài khoản của mình tuân thủ quy định cộng đồng.
                        </p>
                      </div>

                      <textarea
                        rows={4}
                        value={appealReason}
                        onChange={(e) => setAppealReason(e.target.value)}
                        placeholder="Trình bày chi tiết lý do và lập luận của bạn..."
                        className="w-full p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                      />

                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                          Đường dẫn ảnh minh chứng (Không bắt buộc)
                        </label>
                        <input
                          type="url"
                          value={proofImageUrl}
                          onChange={(e) => setProofImageUrl(e.target.value)}
                          placeholder="https://..."
                          className="w-full px-4 py-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>

                      <div className="flex items-center gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowAppealForm(false)}
                          className="px-5 py-3.5 bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 text-neutral-700 dark:text-neutral-300 font-black text-xs uppercase tracking-widest rounded-2xl transition-colors"
                        >
                          Hủy
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="flex-1 py-3.5 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-widest rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {isSubmitting ? (
                            <Clock className="w-4 h-4 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                          <span>Xác Nhận Gửi Kháng Nghị</span>
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-neutral-100 dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 text-center shrink-0">
          <p className="text-[10px] text-neutral-400 font-semibold">
            Chỉ bạn và Ban Quản Trị mới có thể xem chi tiết thông tin kháng nghị này.
          </p>
        </div>
      </div>
    </div>
  );
}
