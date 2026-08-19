import React, { useState, useEffect } from 'react';
import { 
  X, Lock, Globe, UserCheck, Send, AlertCircle, Search, Upload, Trash2, 
  Image as ImageIcon, Check, ShieldCheck, User, Sparkles
} from 'lucide-react';
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/useAuthStore';
import { getValidAvatar } from '../../lib/avatar';
import toast from 'react-hot-toast';

export interface UserOption {
  id: string;
  numericId?: string;
  displayName: string;
  avatar: string;
  email?: string;
  creatorStatus?: boolean;
}

interface CreateFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultRecipientId?: string;
}

export default function CreateFeedbackModal({
  isOpen,
  onClose,
  onSuccess,
  defaultRecipientId
}: CreateFeedbackModalProps) {
  const { user, firebaseUser } = useAuthStore();

  const [usersList, setUsersList] = useState<UserOption[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [recipientSearch, setRecipientSearch] = useState('');
  const [selectedRecipient, setSelectedRecipient] = useState<UserOption | null>(null);

  const [mode, setMode] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Fetch available users for recipient selection
  useEffect(() => {
    if (!isOpen) return;

    const fetchUsers = async () => {
      setLoadingUsers(true);
      try {
        const snap = await getDocs(collection(db, 'users'));
        const list: UserOption[] = [];
        snap.docs.forEach(docSnap => {
          const uData = docSnap.data();
          if (docSnap.id !== user?.id && !uData.deletedAt) {
            list.push({
              id: docSnap.id,
              numericId: uData.numericId || docSnap.id,
              displayName: uData.displayName || 'Thành viên',
              avatar: getValidAvatar(uData.avatar),
              creatorStatus: uData.creatorStatus
            });
          }
        });
        setUsersList(list);

        if (defaultRecipientId) {
          const match = list.find(u => u.id === defaultRecipientId || u.numericId === defaultRecipientId);
          if (match) setSelectedRecipient(match);
        }
      } catch (err) {
        console.error("Lỗi khi tải danh sách người dùng:", err);
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchUsers();
  }, [isOpen, user?.id, defaultRecipientId]);

  if (!isOpen) return null;

  // Search Logic & ID validation (Exactly 9 digits)
  const searchTrim = recipientSearch.trim();
  const isDigitOnly = /^\d+$/.test(searchTrim);

  let filteredUsers: UserOption[] = usersList;
  let searchError: string | null = null;

  if (searchTrim) {
    if (isDigitOnly) {
      if (searchTrim.length !== 9) {
        searchError = `ID người nhận phải bao gồm đúng 9 chữ số (Ví dụ: 123456789). Chuỗi bạn vừa nhập có ${searchTrim.length} chữ số.`;
        filteredUsers = []; // Do not display users if ID is wrong format!
      } else {
        filteredUsers = usersList.filter(u => u.numericId === searchTrim || u.id === searchTrim);
        if (filteredUsers.length === 0) {
          searchError = `Không tìm thấy người dùng có ID 9 chữ số trùng khớp với "${searchTrim}".`;
        }
      }
    } else {
      const term = searchTrim.toLowerCase();
      filteredUsers = usersList.filter(u => 
        u.displayName.toLowerCase().includes(term) ||
        u.numericId.includes(term)
      );
    }
  }

  // --- Handlers for Images (Max 10) ---
  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const currentCount = images.length;
    const selectedFiles = Array.from(files) as File[];

    if (currentCount + selectedFiles.length > 10) {
      toast.error("Cho phép tải lên tối đa là 10 ảnh đính kèm.");
    }

    const allowedToTake = 10 - currentCount;
    if (allowedToTake <= 0) {
      e.target.value = '';
      return;
    }

    const filesToProcess = selectedFiles.slice(0, allowedToTake);

    filesToProcess.forEach(file => {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`Ảnh ${file.name} vượt quá dung lượng 10MB.`);
        return;
      }
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const result = uploadEvent.target?.result as string;
        if (result) {
          setImages(prev => {
            if (prev.length >= 10) return prev;
            return [...prev, result];
          });
        }
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  const handleRemoveImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error("Vui lòng đăng nhập để gửi Feedback!");
      return;
    }

    if (!selectedRecipient) {
      toast.error("Vui lòng chọn người nhận Feedback!");
      return;
    }

    if (!content.trim()) {
      toast.error("Vui lòng nhập nội dung Phản hồi!");
      return;
    }

    setSubmitting(true);
    try {
      const currentSenderId = user.id || firebaseUser?.uid;
      const feedbackData = {
        senderId: currentSenderId,
        senderName: user.displayName,
        senderAvatar: getValidAvatar(user.avatar),
        recipientId: selectedRecipient.id,
        recipientName: selectedRecipient.displayName,
        recipientAvatar: getValidAvatar(selectedRecipient.avatar),
        mode: mode,
        title: title.trim(),
        content: content.trim(),
        images: images,
        reactions: {},
        reactionsCount: 0,
        commentsCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        deletedAt: null
      };

      const fbRef = await addDoc(collection(db, 'feedbacks'), feedbackData);

      // Create notification for recipient
      await addDoc(collection(db, 'notifications'), {
        userId: selectedRecipient.id,
        recipientId: selectedRecipient.id,
        senderId: user.id,
        senderName: user.displayName,
        senderAvatar: user.avatar || '',
        type: 'FEEDBACK',
        targetId: fbRef.id,
        targetType: 'FEEDBACK',
        title: mode === 'PUBLIC' ? 'Có Feedback công khai mới' : 'Có Feedback riêng tư mới',
        message: `${user.displayName} vừa gửi cho bạn một Feedback ${mode === 'PUBLIC' ? 'công khai' : 'riêng tư'}.`,
        link: '/feedbacks',
        read: false,
        createdAt: serverTimestamp()
      });

      toast.success(`Đã gửi Feedback ${mode === 'PUBLIC' ? 'công khai' : 'riêng tư'} thành công!`);
      
      // Reset form
      setContent('');
      setTitle('');
      setImages([]);
      setSelectedRecipient(null);
      setRecipientSearch('');

      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Gửi Feedback thất bại, vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/90 backdrop-blur-md flex flex-col h-screen overflow-hidden text-neutral-900 dark:text-neutral-100">
      {/* Top Navigation Bar */}
      <div className="shrink-0 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 leading-tight">
              Tạo Feedback mới
            </h2>
            <p className="text-xs text-neutral-500">
              Gửi nhận xét công khai trên cộng đồng hoặc tin nhắn riêng tư bảo mật
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !selectedRecipient || !content.trim()}
            className="px-6 py-2 rounded-xl bg-black dark:bg-white text-white dark:text-black text-xs font-bold hover:opacity-90 transition-all disabled:opacity-50 shadow-sm flex items-center gap-2"
          >
            {submitting ? (
              <span>Đang gửi...</span>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Gửi Feedback</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Full-Screen Body */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-neutral-50 dark:bg-neutral-950">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-8 pb-16">

          {/* MỤC 1: NGƯỜI GỬI (TỰ ĐỘNG) */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 md:p-8 shadow-sm space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-extrabold text-sm flex items-center justify-center shrink-0">
                1
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                  Người gửi (Tự động)
                </h3>
                <p className="text-xs text-neutral-500">
                  Thông tin người gửi được xác thực tự động từ tài khoản đang đăng nhập
                </p>
              </div>
            </div>

            <div className="p-4 bg-neutral-50 dark:bg-neutral-800/60 rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60 flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <img
                  src={getValidAvatar(user?.avatar)}
                  alt={user?.displayName || "Sender"}
                  className="w-12 h-12 rounded-full object-cover border border-neutral-200 dark:border-neutral-700"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-neutral-900 dark:text-neutral-100">
                      {user?.displayName}
                    </span>
                    <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] rounded-full">
                      Tài khoản của bạn
                    </span>
                  </div>
                  <div className="text-xs text-neutral-500 font-mono mt-0.5">
                    ID: user/{user?.numericId || user?.id}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                <ShieldCheck className="w-4 h-4" />
                <span>Đã xác thực hệ thống</span>
              </div>
            </div>
          </div>

          {/* MỤC 2: NGƯỜI NHẬN */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 md:p-8 shadow-sm space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-extrabold text-sm flex items-center justify-center shrink-0">
                2
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                  Người nhận <span className="text-red-500">*</span>
                </h3>
                <p className="text-xs text-neutral-500">
                  Tìm kiếm theo tên hoặc chính xác ID 9 chữ số của người nhận
                </p>
              </div>
            </div>

            {selectedRecipient ? (
              <div className="flex items-center justify-between p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl">
                <div className="flex items-center gap-3.5">
                  <img
                    src={selectedRecipient.avatar}
                    alt={selectedRecipient.displayName}
                    className="w-12 h-12 rounded-full border border-indigo-500/30 object-cover"
                  />
                  <div>
                    <div className="font-extrabold text-sm text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                      <span>{selectedRecipient.displayName}</span>
                      {selectedRecipient.creatorStatus && (
                        <span className="px-2 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-extrabold text-[10px] rounded-full">
                          Creator
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-neutral-500 font-mono mt-0.5">
                      ID: user/{selectedRecipient.numericId || selectedRecipient.id}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedRecipient(null)}
                  className="px-4 py-2 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:text-red-500 hover:border-red-300 transition-colors"
                >
                  Thay đổi người nhận
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="Nhập tên người dùng hoặc ID 9 chữ số (Ví dụ: 123456789)..."
                    value={recipientSearch}
                    onChange={e => setRecipientSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 text-xs md:text-sm rounded-2xl bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>

                {searchError ? (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs text-amber-600 dark:text-amber-400 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{searchError}</span>
                  </div>
                ) : (
                  <div className="max-h-52 overflow-y-auto border border-neutral-200 dark:border-neutral-800 rounded-2xl divide-y divide-neutral-100 dark:divide-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
                    {loadingUsers ? (
                      <div className="p-6 text-center text-xs text-neutral-400">Đang tải danh sách thành viên...</div>
                    ) : filteredUsers.length === 0 ? (
                      <div className="p-6 text-center text-xs text-neutral-400">
                        {searchTrim ? "Không tìm thấy người dùng phù hợp." : "Nhập tên hoặc ID để tìm kiếm người nhận."}
                      </div>
                    ) : (
                      filteredUsers.map(u => (
                        <button
                          type="button"
                          key={u.id}
                          onClick={() => setSelectedRecipient(u)}
                          className="w-full p-3.5 flex items-center justify-between text-left hover:bg-neutral-100 dark:hover:bg-neutral-800/80 transition-colors group"
                        >
                          <div className="flex items-center gap-3">
                            <img src={u.avatar} alt={u.displayName} className="w-8 h-8 rounded-full object-cover border border-neutral-200 dark:border-neutral-700" />
                            <div>
                              <div className="text-xs font-bold text-neutral-800 dark:text-neutral-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 flex items-center gap-2">
                                <span>{u.displayName}</span>
                                {u.creatorStatus && (
                                  <span className="text-[9px] font-extrabold px-1.5 py-0.2 bg-amber-500/10 text-amber-600 rounded">Creator</span>
                                )}
                              </div>
                              <div className="text-[11px] text-neutral-400 font-mono">
                                ID: user/{u.numericId || u.id}
                              </div>
                            </div>
                          </div>
                          <UserCheck className="w-4 h-4 text-neutral-400 group-hover:text-indigo-500 transition-colors" />
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* MỤC 3: CHẾ ĐỘ FEEDBACK */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 md:p-8 shadow-sm space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-extrabold text-sm flex items-center justify-center shrink-0">
                3
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                  Chế độ Feedback <span className="text-red-500">*</span>
                </h3>
                <p className="text-xs text-neutral-500">
                  Chọn hình thức công khai trên bảng tin cộng đồng hoặc tin nhắn riêng tư bảo mật
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Public Feedback Option */}
              <button
                type="button"
                onClick={() => setMode('PUBLIC')}
                className={`p-5 rounded-2xl border text-left flex flex-col gap-2 transition-all ${
                  mode === 'PUBLIC'
                    ? 'bg-blue-500/10 border-blue-500/50 text-blue-600 dark:text-blue-400 ring-2 ring-blue-500/20 shadow-sm'
                    : 'bg-neutral-50 dark:bg-neutral-800/40 border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:text-black dark:hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2 font-extrabold text-sm">
                  <Globe className="w-5 h-5 text-blue-500" />
                  <span>Feedback Công Khai</span>
                </div>
                <p className="text-xs opacity-80 leading-relaxed">
                  Hiển thị như bài đăng cộng đồng trên bảng tin Feedback. Mọi người đều có thể xem, thả cảm xúc và bình luận.
                </p>
              </button>

              {/* Private Feedback Option */}
              <button
                type="button"
                onClick={() => setMode('PRIVATE')}
                className={`p-5 rounded-2xl border text-left flex flex-col gap-2 transition-all ${
                  mode === 'PRIVATE'
                    ? 'bg-amber-500/10 border-amber-500/50 text-amber-600 dark:text-amber-400 ring-2 ring-amber-500/20 shadow-sm'
                    : 'bg-neutral-50 dark:bg-neutral-800/40 border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:text-black dark:hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2 font-extrabold text-sm">
                  <Lock className="w-5 h-5 text-amber-500" />
                  <span>Feedback Riêng Tư</span>
                </div>
                <p className="text-xs opacity-80 leading-relaxed">
                  Thư bảo mật trực tiếp. Chỉ duy nhất bạn và người nhận có thể đọc, phản hồi và trao đổi tin nhắn.
                </p>
              </button>
            </div>
          </div>

          {/* MỤC 4: THÔNG TIN CHI TIẾT */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 md:p-8 shadow-sm space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-extrabold text-sm flex items-center justify-center shrink-0">
                4
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                  Thông tin chi tiết
                </h3>
                <p className="text-xs text-neutral-500">
                  Tiêu đề và nội dung phản hồi nhận xét của bạn
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Tiêu đề Feedback */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-2">
                  Tiêu đề Feedback <span className="text-neutral-400 font-normal">(Tùy chọn)</span>
                </label>
                <input
                  type="text"
                  placeholder="VD: Cảm ơn kịch bản Roleplay xuất sắc của bạn..."
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                />
              </div>

              {/* Nội dung Phản hồi */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-2">
                  Nội dung Phản hồi <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={6}
                  placeholder={
                    mode === 'PUBLIC'
                      ? 'Viết nhận xét, góp ý công khai cho thành viên này...'
                      : 'Viết tin nhắn, góp ý riêng tư bảo mật...'
                  }
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium leading-relaxed resize-none"
                />
              </div>
            </div>
          </div>

          {/* MỤC 5: ẢNH MINH HỌA / ĐÍNH KÈM (TỐI ĐA 10 ĂNH) */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 md:p-8 shadow-sm space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-extrabold text-sm flex items-center justify-center shrink-0">
                  5
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                    Ảnh minh họa/Đính kèm (Nếu có)
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Cho phép tải lên tối đa là 10 ảnh minh họa hoặc bằng chứng đính kèm
                  </p>
                </div>
              </div>
              <span className={`text-xs font-bold px-3 py-1 rounded-xl border ${
                images.length >= 10
                  ? 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700'
              }`}>
                {images.length}/10 ảnh
              </span>
            </div>

            <div className="space-y-4">
              <div>
                {/* File Picker Upload */}
                <label className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors bg-neutral-50 dark:bg-neutral-800/40 group ${
                  images.length >= 10
                    ? 'border-neutral-200 dark:border-neutral-800 opacity-50 pointer-events-none'
                    : 'border-neutral-300 dark:border-neutral-700 hover:border-indigo-500 dark:hover:border-indigo-500'
                }`}>
                  <Upload className="w-8 h-8 text-neutral-400 group-hover:text-indigo-500 transition-colors mb-2" />
                  <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                    Tải ảnh từ máy tính / điện thoại
                  </span>
                  <span className="text-[11px] text-neutral-400 mt-1">
                    Hỗ trợ JPG, JPEG, PNG, WEBP (Tối đa 10MB/ảnh)
                  </span>
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    disabled={images.length >= 10}
                    onChange={handleImageFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Uploaded Gallery Grid */}
              {images.length > 0 ? (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-neutral-600 dark:text-neutral-400">
                    Danh sách ảnh đã đính kèm ({images.length}/10):
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    {images.map((imgUrl, idx) => (
                      <div key={idx} className="relative group rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-700 aspect-square bg-neutral-100 dark:bg-neutral-800">
                        <img
                          src={imgUrl}
                          alt={`Đính kèm ${idx + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(idx)}
                          className="absolute top-2 right-2 p-1.5 rounded-full bg-red-600 text-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                          title="Xóa ảnh này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-xs text-neutral-400 italic">
                  Chưa có ảnh đính kèm nào được thêm.
                </div>
              )}
            </div>
          </div>

          {/* Bottom Action Footer */}
          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3 rounded-2xl border border-neutral-200 dark:border-neutral-700 text-xs font-bold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={submitting || !selectedRecipient || !content.trim()}
              className="px-8 py-3 rounded-2xl bg-black dark:bg-white text-white dark:text-black text-xs font-bold hover:opacity-90 transition-all disabled:opacity-50 shadow-md flex items-center gap-2"
            >
              {submitting ? "Đang gửi..." : "Gửi Feedback"}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
