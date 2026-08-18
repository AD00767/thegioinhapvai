import React, { useState } from 'react';
import { X, ShieldAlert, Upload, FileText } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/useAuthStore';
import toast from 'react-hot-toast';
import CaptchaModal from './CaptchaModal';

interface AppealModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType?: 'CHARACTER' | 'PROMPT' | 'ACCOUNT' | 'OTHER';
  targetId?: string;
  targetName?: string;
}

export default function AppealModal({ 
  isOpen, 
  onClose, 
  targetType = 'ACCOUNT', 
  targetId = '', 
  targetName = 'Tài khoản cá nhân' 
}: AppealModalProps) {
  const { user } = useAuthStore();
  const [reason, setReason] = useState('Nội dung hoàn toàn tuân thủ quy định cộng đồng');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofBase64, setProofBase64] = useState<string>('');
  const [isCaptchaOpen, setIsCaptchaOpen] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Ảnh minh chứng không được vượt quá 10MB');
      return;
    }

    setProofFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setProofBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmittingTrigger = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('Vui lòng đăng nhập để gửi kháng nghị');
      return;
    }
    if (!description.trim()) {
      toast.error('Vui lòng cung cấp mô tả chi tiết lý do kháng nghị');
      return;
    }
    setIsCaptchaOpen(true);
  };

  const executeSubmit = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      // 1. Create appeal document in 'appeals' collection
      await addDoc(collection(db, 'appeals'), {
        userId: user.id,
        userName: user.displayName,
        userEmail: user.email,
        targetType,
        targetId: targetId || 'account',
        targetName,
        reason,
        description: description.trim(),
        proofImage: proofBase64 || null,
        status: 'PENDING', // PENDING | REVIEWING | RESOLVED | REJECTED | DISMISSED
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // 2. Record activity log
      await addDoc(collection(db, 'activity_logs'), {
        userId: user.id,
        userEmail: user.email,
        userName: user.displayName,
        action: 'SUBMIT_APPEAL',
        details: `Đã gửi yêu cầu kháng nghị đối với ${targetType}: ${targetName}`,
        createdAt: new Date().toISOString()
      });

      // 3. Trigger notification for Admin/Moderators
      await addDoc(collection(db, 'notifications'), {
        userId: 'ADMIN',
        type: 'APPEAL',
        title: 'Yêu cầu kháng nghị mới (Appeal)',
        body: `${user.displayName} đã gửi kháng nghị cho ${targetType}: "${targetName}" với lý do: ${reason}`,
        read: false,
        createdAt: serverTimestamp()
      });

      toast.success('Gửi kháng nghị thành công! Ban quản trị sẽ xem xét trong thời gian sớm nhất.');
      onClose();
    } catch (err) {
      console.error('Submit appeal error:', err);
      toast.error('Gửi kháng nghị thất bại. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const reasonOptions = [
    'Nội dung hoàn toàn tuân thủ quy định cộng đồng',
    'Hệ thống kiểm duyệt hiểu nhầm ngữ cảnh / có sai sót',
    'Đã tiến hành chỉnh sửa khắc phục nội dung theo góp ý',
    'Tài khoản bị khóa nhầm / khiếu nại quyết định phạt',
    'Lý do khác'
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl relative z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-2 text-amber-500">
            <ShieldAlert className="w-5 h-5" />
            <h3 className="font-extrabold text-base text-neutral-900 dark:text-neutral-100">Gửi Kháng Nghị (Appeal)</h3>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-black dark:hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmittingTrigger} className="p-6 space-y-4">
          <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-500 space-y-1">
            <p className="font-bold text-neutral-700 dark:text-neutral-300">Đối tượng kháng nghị:</p>
            <p className="font-semibold text-neutral-900 dark:text-neutral-100">
              {targetType === 'ACCOUNT' ? 'Tài khoản cá nhân' : targetType}: {targetName}
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
              Lý do kháng nghị <span className="text-red-500">*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 text-neutral-900 dark:text-neutral-100"
            >
              {reasonOptions.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
              Giải thích chi tiết <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={4}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Cung cấp lập luận, ngữ cảnh hoặc lý do chi tiết để hội đồng quản trị xem xét khôi phục..."
              className="w-full px-4 py-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 text-neutral-900 dark:text-neutral-100 leading-relaxed resize-none"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
              Ảnh / Tệp minh chứng bổ sung <span className="text-neutral-400 font-normal">(Tối đa 10MB)</span>
            </label>
            {proofFile ? (
              <div className="flex items-center justify-between p-3 rounded-2xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700">
                <div className="flex items-center gap-2 overflow-hidden">
                  <FileText className="w-5 h-5 text-amber-500 shrink-0" />
                  <span className="text-xs font-semibold truncate text-neutral-800 dark:text-neutral-200">
                    {proofFile.name} ({(proofFile.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => { setProofFile(null); setProofBase64(''); }}
                  className="p-1 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="border-2 border-dashed border-neutral-300 dark:border-neutral-700 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer hover:border-amber-500 transition-colors bg-neutral-50/50 dark:bg-neutral-800/30">
                <Upload className="w-5 h-5 text-neutral-400 mb-1" />
                <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">Tải ảnh minh chứng</span>
                <input
                  type="file"
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
              </label>
            )}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-2xl border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 font-bold text-xs hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-3 px-4 rounded-2xl bg-amber-500 text-black font-bold text-xs hover:bg-amber-600 transition-all shadow-md disabled:opacity-50"
            >
              {submitting ? 'Đang gửi...' : 'Gửi Kháng Nghị'}
            </button>
          </div>
        </form>
      </div>

      <CaptchaModal
        isOpen={isCaptchaOpen}
        onClose={() => setIsCaptchaOpen(false)}
        onSuccess={executeSubmit}
      />
    </div>
  );
}
