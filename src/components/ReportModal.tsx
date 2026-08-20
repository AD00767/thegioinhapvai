import React, { useState } from 'react';
import { X, AlertTriangle, Upload, FileText, CheckCircle2 } from 'lucide-react';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { enforceActivityCheck } from '../lib/restrictions';
import toast from 'react-hot-toast';
import CaptchaModal from './CaptchaModal';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: 'CHARACTER' | 'PROMPT' | 'FEEDBACK' | 'COMMENT' | 'CREATOR';
  targetId: string;
  targetName: string;
}

export default function ReportModal({ isOpen, onClose, targetType, targetId, targetName }: ReportModalProps) {
  const { user } = useAuthStore();
  const [reason, setReason] = useState('Nội dung không phù hợp');
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

  const handleSubmittingTrigger = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('Vui lòng đăng nhập để gửi báo cáo');
      return;
    }

    if (!enforceActivityCheck(user, 'REPORT')) {
      return;
    }

    setSubmitting(true);
    try {
      // Check duplicate report by same user for same targetId within last 5 minutes
      const reportsRef = collection(db, 'reports');
      const q = query(
        reportsRef,
        where('reporterId', '==', user.id),
        where('targetId', '==', targetId)
      );
      
      const querySnapshot = await getDocs(q);
      const now = new Date().getTime();
      let hasRecentReport = false;

      querySnapshot.forEach((doc) => {
        const reportData = doc.data();
        if (reportData.createdAt) {
          const reportTime = new Date(reportData.createdAt).getTime();
          // Check if report is within last 5 minutes (300,000 ms)
          if (now - reportTime < 5 * 60 * 1000) {
            hasRecentReport = true;
          }
        }
      });

      if (hasRecentReport) {
        toast.error('Bạn đã báo cáo nội dung này gần đây. Vui lòng chờ ban quản trị xử lý.');
        return;
      }

      // If checks pass, show CAPTCHA before submitting
      setIsCaptchaOpen(true);
    } catch (err) {
      console.error('Check duplicate report error:', err);
      toast.error('Có lỗi xảy ra khi kiểm tra báo cáo');
    } finally {
      setSubmitting(false);
    }
  };

  const executeSubmit = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      // 1. Submit report
      await addDoc(collection(db, 'reports'), {
        targetType,
        targetId,
        targetName,
        reason,
        description: description.trim(),
        proofImage: proofBase64 || null,
        reporterId: user.id,
        reporterName: user.displayName,
        reporterEmail: user.email,
        status: 'PENDING', // 'PENDING' | 'PROCESSING' | 'RESOLVED' | 'REJECTED'
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // 2. Add activity log
      await addDoc(collection(db, 'activity_logs'), {
        userId: user.id,
        userEmail: user.email,
        userName: user.displayName,
        action: 'REPORT_SUBMIT',
        details: `Đã gửi báo cáo cho ${targetType}: ${targetName}`,
        createdAt: new Date().toISOString()
      });

      // 3. Admin Notification
      await addDoc(collection(db, 'notifications'), {
        userId: 'ADMIN', // Admin-wide notice
        type: 'REPORT',
        title: 'Báo cáo vi phạm mới',
        body: `${user.displayName} đã báo cáo ${targetType}: "${targetName}" với lý do: ${reason}`,
        read: false,
        createdAt: serverTimestamp()
      });

      toast.success('Gửi báo cáo thành công. Ban quản trị sẽ xử lý sớm nhất.');
      onClose();
    } catch (err) {
      console.error('Submit report error:', err);
      toast.error('Gửi báo cáo thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  const reasonOptions = [
    'Nội dung không phù hợp',
    'Ngôn từ kích động, thù hận',
    'Quấy rối hoặc xúc phạm',
    'Spam / Quảng cáo trái phép',
    'Vi phạm bản quyền',
    'Lý do khác'
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      {/* Content */}
      <div className="relative bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl z-10">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-2 text-red-500">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="font-extrabold text-base">Báo Cáo Vi Phạm</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmittingTrigger} className="p-6 space-y-4">
          <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-500 space-y-1">
            <p className="font-bold text-neutral-700 dark:text-neutral-300">Đang báo cáo:</p>
            <p className="font-semibold text-neutral-900 dark:text-neutral-100">{targetType}: {targetName}</p>
          </div>

          {/* Reason Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
              Lý do báo cáo <span className="text-red-500">*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              {reasonOptions.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
              Mô tả chi tiết bổ sung
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Cung cấp thêm chi tiết giúp ban quản trị xác thực nhanh hơn (không bắt buộc)..."
              className="w-full px-4 py-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 leading-relaxed resize-none"
            />
          </div>

          {/* Proof Image Upload */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
              Ảnh minh chứng <span className="text-neutral-400 font-normal">(Tối đa 10MB)</span>
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
              <label className="border-2 border-dashed border-neutral-300 dark:border-neutral-700 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer hover:border-red-500 transition-colors bg-neutral-50/50 dark:bg-neutral-800/30">
                <Upload className="w-5 h-5 text-neutral-400 mb-1" />
                <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">Chọn ảnh minh chứng vi phạm</span>
                <input
                  type="file"
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Action Buttons */}
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
              className="flex-1 py-3 px-4 rounded-2xl bg-red-600 text-white font-bold text-xs hover:bg-red-700 transition-all shadow-md disabled:opacity-50"
            >
              {submitting ? 'Đang gửi...' : 'Gửi báo cáo'}
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
