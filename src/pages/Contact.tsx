import React, { useState } from 'react';
import { 
  Mail, Send, Paperclip, CheckCircle2, AlertCircle, MessageSquare, 
  HelpCircle, Bug, Sparkles, UserCheck, FileText, X, ShieldAlert 
} from 'lucide-react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { enforceActivityCheck } from '../lib/restrictions';
import toast from 'react-hot-toast';
import CaptchaModal from '../components/CaptchaModal';

export type ContactCategory = 'Báo lỗi' | 'Góp ý' | 'Đề xuất tính năng' | 'Liên hệ quản trị viên';

export default function Contact() {
  const { user } = useAuthStore();

  const [name, setName] = useState(user?.displayName || '');
  const [category, setCategory] = useState<ContactCategory>('Góp ý');
  const [subjectTitle, setSubjectTitle] = useState('');
  const [content, setContent] = useState('');
  
  // File attachment state
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentBase64, setAttachmentBase64] = useState<string>('');

  // Response required question: null = not answered, 'YES' = Có, 'NO' = Không
  const [needsResponse, setNeedsResponse] = useState<'YES' | 'NO' | null>(null);
  const [contactInfo, setContactInfo] = useState(user?.email || '');

  const [submitting, setSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCaptchaOpen, setIsCaptchaOpen] = useState(false);

  // Handle File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Tệp đính kèm không được vượt quá 10MB');
      return;
    }

    setAttachmentFile(file);

    // Convert small files to base64 preview/storage if needed
    const reader = new FileReader();
    reader.onloadend = () => {
      setAttachmentBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeAttachment = () => {
    setAttachmentFile(null);
    setAttachmentBase64('');
  };

  const handleSubmitTrigger = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (user && !enforceActivityCheck(user, 'CONTACT')) {
      return;
    }

    // 1. Validation: Content not empty
    if (!content.trim()) {
      setErrorMessage('Vui lòng nhập nội dung liên hệ.');
      toast.error('Nội dung không được để trống');
      return;
    }

    // 2. Validation: Needs Response question answered?
    if (needsResponse === null) {
      setErrorMessage('Vui lòng chọn câu trả lời "Có" hoặc "Không" cho mục nhu cầu phản hồi.');
      toast.error('Chưa chọn câu trả lời Có hoặc Không!');
      return;
    }

    // 3. Validation: If YES, contactInfo required
    if (needsResponse === 'YES' && !contactInfo.trim()) {
      setErrorMessage('Bạn đã chọn cần phản hồi, vui lòng cung cấp Thông tin liên hệ (Email / Số điện thoại / Telegram...).');
      toast.error('Chưa thêm Thông tin liên hệ khi chọn Có');
      return;
    }

    // Trigger CAPTCHA modal
    setIsCaptchaOpen(true);
  };

  const executeSubmit = async () => {
    const fullSubject = subjectTitle.trim() ? `[${category}] ${subjectTitle.trim()}` : `[${category}]`;
    const senderName = name.trim() || user?.displayName || 'Khách truy cập';

    setSubmitting(true);
    try {
      // Create contact_forms document
      const contactDoc = {
        name: senderName,
        category,
        subject: subjectTitle.trim() || category,
        fullSubject,
        content: content.trim(),
        attachmentName: attachmentFile ? attachmentFile.name : null,
        attachmentData: attachmentBase64 || null,
        needsResponse: needsResponse === 'YES',
        contactInfo: needsResponse === 'YES' ? contactInfo.trim() : null,
        senderId: user?.id || null,
        senderEmail: user?.email || null,
        createdAt: new Date().toISOString(),
        status: 'PENDING'
      };

      await addDoc(collection(db, 'contact_forms'), contactDoc);

      // Send notification to Admin queue
      await addDoc(collection(db, 'notifications'), {
        recipientId: 'ADMIN',
        senderId: user?.id || 'GUEST',
        senderName: senderName,
        senderAvatar: user?.avatar || '',
        type: 'CONTACT',
        title: `Liên hệ mới: ${category}`,
        message: `${senderName} đã gửi yêu cầu [${category}]: ${subjectTitle.trim() || content.trim().substring(0, 60)}...`,
        read: false,
        createdAt: new Date().toISOString()
      });

      setSubmittedSuccess(true);
      toast.success('Gửi yêu cầu liên hệ thành công!');
    } catch (err) {
      console.error('Lỗi khi gửi liên hệ:', err);
      setErrorMessage('Có lỗi xảy ra khi gửi liên hệ. Vui lòng thử lại sau.');
      toast.error('Không thể gửi liên hệ');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setName(user?.displayName || '');
    setCategory('Góp ý');
    setSubjectTitle('');
    setContent('');
    setAttachmentFile(null);
    setAttachmentBase64('');
    setNeedsResponse(null);
    setContactInfo(user?.email || '');
    setSubmittedSuccess(false);
    setErrorMessage(null);
  };

  const categoryIcons: Record<ContactCategory, React.ReactNode> = {
    'Báo lỗi': <Bug className="w-5 h-5 text-red-500" />,
    'Góp ý': <MessageSquare className="w-5 h-5 text-blue-500" />,
    'Đề xuất tính năng': <Sparkles className="w-5 h-5 text-amber-500" />,
    'Liên hệ quản trị viên': <ShieldAlert className="w-5 h-5 text-indigo-500" />
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <CaptchaModal 
        isOpen={isCaptchaOpen}
        onClose={() => setIsCaptchaOpen(false)}
        onSuccess={executeSubmit}
        actionLabel="gửi biểu mẫu liên hệ"
      />
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-neutral-900 via-neutral-800 to-black text-white p-6 md:p-10 rounded-3xl shadow-xl border border-neutral-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Mail className="w-48 h-48 text-white" />
        </div>
        
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-neutral-800 text-neutral-300 rounded-full text-xs font-bold border border-neutral-700">
            <Mail className="w-3.5 h-3.5 text-amber-400" />
            <span>Trung Tâm Hỗ Trợ & Liên Hệ</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">
            Liên Hệ Với Chúng Tôi
          </h1>
          <p className="text-neutral-400 text-sm md:text-base leading-relaxed">
            Bạn muốn báo lỗi, đóng góp ý kiến hay gửi đề xuất tính năng mới cho <strong className="text-white">Thế giới nhập vai_AD</strong>? Ban quản trị luôn lắng nghe phản hồi của bạn!
          </p>
        </div>
      </div>

      {/* Main Content Area */}
      {submittedSuccess ? (
        /* Success Confirmation Card */
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-8 md:p-12 text-center space-y-6 shadow-sm">
          <div className="w-20 h-20 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-2 max-w-lg mx-auto">
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
              Gửi Yêu Cầu Thành Công!
            </h2>
            <p className="text-neutral-600 dark:text-neutral-300 text-sm leading-relaxed">
              Cảm ơn bạn đã liên hệ với chúng tôi. Ban quản trị hệ thống đã nhận được thông tin và sẽ xem xét xử lý trong thời gian sớm nhất.
            </p>

            {needsResponse === 'YES' && (
              <div className="mt-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs text-left space-y-1">
                <p className="font-bold">✉️ Thông tin phản hồi đã đăng ký:</p>
                <p className="font-mono">{contactInfo}</p>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Chúng tôi sẽ phản hồi trực tiếp qua thông tin liên hệ này khi có kết quả.
                </p>
              </div>
            )}
          </div>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={handleResetForm}
              className="px-6 py-3 rounded-2xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-bold text-sm hover:opacity-90 transition-all shadow-md w-full sm:w-auto"
            >
              Gửi Yêu Cầu Khác
            </button>
          </div>
        </div>
      ) : (
        /* Contact Form */
        <form onSubmit={handleSubmitTrigger} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 md:p-8 space-y-6 shadow-sm">
          
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-bold">Không thể gửi yêu cầu</p>
                <p className="text-xs">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Form Header Info */}
          <div className="border-b border-neutral-100 dark:border-neutral-800 pb-4">
            <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
              Biểu Mẫu Thông Tin Liên Hệ
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Mọi ý kiến đóng góp của bạn đều giúp cộng đồng ngày một hoàn thiện hơn.
            </p>
          </div>

          {/* Field 1: Sender Name & Category */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Sender Name */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                Tên Người Gửi
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nhập tên của bạn..."
                className="w-full px-4 py-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              {user && (
                <p className="text-[11px] text-neutral-400 flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                  Đang đăng nhập với tư cách: <strong className="text-neutral-600 dark:text-neutral-300">{user.displayName}</strong>
                </p>
              )}
            </div>

            {/* Topic Category */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                Loại Yêu Cầu / Chủ Đề <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ContactCategory)}
                  className="w-full px-4 py-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
                >
                  <option value="Báo lỗi">🐛 Báo lỗi (Bug Report)</option>
                  <option value="Góp ý">💬 Góp ý (Feedback)</option>
                  <option value="Đề xuất tính năng">✨ Đề xuất tính năng</option>
                  <option value="Liên hệ quản trị viên">🛡️ Liên hệ quản trị viên</option>
                </select>
              </div>
            </div>
          </div>

          {/* Specific Subject Title */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
              Tiêu Đề Chi Tiết <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={subjectTitle}
              onChange={(e) => setSubjectTitle(e.target.value)}
              placeholder="VD: Lỗi không xem được chi tiết Character trên điện thoại..."
              className="w-full px-4 py-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Content Textarea */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
              Nội Dung Chi Tiết <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={5}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Mô tả chi tiết nội dung hoặc các bước tái hiện lỗi/góp ý..."
              className="w-full px-4 py-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 leading-relaxed resize-y"
            />
          </div>

          {/* Attachment File Input */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
              Tệp Đính Kèm <span className="text-neutral-400 font-normal">(Không bắt buộc, tối đa 10MB)</span>
            </label>

            {attachmentFile ? (
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700">
                <div className="flex items-center gap-3 overflow-hidden">
                  <FileText className="w-5 h-5 text-amber-500 shrink-0" />
                  <span className="text-xs font-semibold truncate text-neutral-800 dark:text-neutral-200">
                    {attachmentFile.name} ({(attachmentFile.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={removeAttachment}
                  className="p-1 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500 transition-colors"
                  title="Xóa tệp đính kèm"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="border-2 border-dashed border-neutral-300 dark:border-neutral-700 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer hover:border-amber-500 transition-colors bg-neutral-50/50 dark:bg-neutral-800/30">
                <Paperclip className="w-6 h-6 text-neutral-400 mb-1" />
                <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
                  Bấm để chọn tệp (Ảnh chụp màn hình, tài liệu...)
                </span>
                <span className="text-[10px] text-neutral-400">Hỗ trợ PNG, JPG, WEBP, PDF, TXT (Tối đa 10MB)</span>
                <input
                  type="file"
                  onChange={handleFileChange}
                  accept="image/*,.pdf,.txt,.doc,.docx"
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* REQUIRED QUESTION: Needs Response? */}
          <div className="p-5 rounded-3xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 space-y-4">
            <div className="space-y-1">
              <label className="block text-sm font-extrabold text-neutral-900 dark:text-neutral-100">
                Bạn có cần phản hồi lại từ chúng tôi không? <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Vui lòng chọn câu trả lời để chúng tôi sắp xếp phản hồi phù hợp.
              </p>
            </div>

            {/* Answer Options Buttons */}
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setNeedsResponse('YES')}
                className={`flex-1 py-3 px-4 rounded-2xl font-bold text-xs md:text-sm border transition-all flex items-center justify-center gap-2 ${
                  needsResponse === 'YES'
                    ? 'bg-amber-500 text-black border-amber-500 shadow-md ring-2 ring-amber-500/20'
                    : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-neutral-700 hover:border-amber-500'
                }`}
              >
                <CheckCircle2 className={`w-4 h-4 ${needsResponse === 'YES' ? 'text-black' : 'text-neutral-400'}`} />
                <span>Có, tôi cần phản hồi</span>
              </button>

              <button
                type="button"
                onClick={() => setNeedsResponse('NO')}
                className={`flex-1 py-3 px-4 rounded-2xl font-bold text-xs md:text-sm border transition-all flex items-center justify-center gap-2 ${
                  needsResponse === 'NO'
                    ? 'bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-900 border-neutral-800 dark:border-neutral-200 shadow-md'
                    : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-neutral-700 hover:border-neutral-500'
                }`}
              >
                <X className={`w-4 h-4 ${needsResponse === 'NO' ? 'text-white dark:text-neutral-900' : 'text-neutral-400'}`} />
                <span>Không cần phản hồi</span>
              </button>
            </div>

            {/* Conditional Input: Contact Info if YES */}
            {needsResponse === 'YES' && (
              <div className="pt-2 space-y-2 animate-fadeIn">
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                  Thông Tin Liên Hệ <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={contactInfo}
                  onChange={(e) => setContactInfo(e.target.value)}
                  placeholder="Nhập Email, SĐT hoặc Telegram/Discord để nhận phản hồi..."
                  className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-neutral-800 border border-amber-500/40 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <p className="text-[11px] text-neutral-500">
                  Chúng tôi sẽ liên hệ lại qua địa chỉ/số điện thoại này.
                </p>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-neutral-900 via-neutral-800 to-black hover:from-black hover:to-neutral-900 text-white font-extrabold text-sm md:text-base shadow-xl border border-neutral-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <span>Đang gửi yêu cầu...</span>
              ) : (
                <>
                  <Send className="w-4 h-4 text-amber-400" />
                  <span>Gửi Yêu Cầu Liên Hệ</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
