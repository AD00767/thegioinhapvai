import React, { useState, useEffect } from 'react';
import { 
  X, PenTool, Link as LinkIcon, Plus, Trash2, Image as ImageIcon, Upload, Sparkles, FileText, Check, AlertCircle 
} from 'lucide-react';
import { collection, addDoc, doc, updateDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/useAuthStore';
import { PromptItem } from '../../types';
import { enforceActivityCheck } from '../../lib/restrictions';
import toast from 'react-hot-toast';

interface CreatePromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  promptToEdit?: PromptItem | null;
}

export default function CreatePromptModal({ isOpen, onClose, onSuccess, promptToEdit }: CreatePromptModalProps) {
  const { user } = useAuthStore();

  // 1. Thông tin cơ bản
  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [referenceLinkInput, setReferenceLinkInput] = useState('');
  const [referenceLinks, setReferenceLinks] = useState<string[]>([]);

  // 2. Hình ảnh minh họa & Giao diện sử dụng
  const [images, setImages] = useState<string[]>([]);

  // 3. Nội dung cấu trúc Prompt & Ghi chú
  const [content, setContent] = useState('');
  const [notes, setNotes] = useState('');

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (promptToEdit) {
      setName(promptToEdit.title || promptToEdit.name || '');
      setPurpose(promptToEdit.purpose || '');
      setTags(promptToEdit.tags || []);
      setReferenceLinks(promptToEdit.referenceLinks || []);
      setImages(promptToEdit.images || []);
      setContent(promptToEdit.content || '');
      setNotes(promptToEdit.notes || '');
    } else {
      setName('');
      setPurpose('');
      setTags([]);
      setReferenceLinks([]);
      setImages([]);
      setContent('');
      setNotes('');
    }
  }, [promptToEdit, isOpen]);

  if (!isOpen || !user) return null;

  // --- Handlers for Tags ---
  const handleAddTag = () => {
    const trimmed = tagInput.trim().toLowerCase();
    if (!trimmed) return;
    if (trimmed.length > 30) {
      toast.error("Tên Tag không quá 30 ký tự.");
      return;
    }
    if (tags.length >= 6) {
      toast.error("Tối đa 6 Tag cho một Prompt.");
      return;
    }
    if (tags.includes(trimmed)) {
      toast.error("Tag đã tồn tại.");
      return;
    }
    setTags([...tags, trimmed]);
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  // --- Handlers for Reference Links ---
  const handleAddReferenceLink = () => {
    const trimmed = referenceLinkInput.trim();
    if (!trimmed) return;
    try {
      new URL(trimmed);
    } catch {
      toast.error("Vui lòng nhập đường dẫn URL hợp lệ (VD: https://example.com)");
      return;
    }
    if (referenceLinks.includes(trimmed)) {
      toast.error("Đường dẫn này đã được thêm.");
      return;
    }
    setReferenceLinks([...referenceLinks, trimmed]);
    setReferenceLinkInput('');
  };

  const handleRemoveReferenceLink = (index: number) => {
    setReferenceLinks(referenceLinks.filter((_, i) => i !== index));
  };

  // --- Handlers for Images ---
  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: File) => {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`Ảnh ${file.name} vượt quá dung lượng 10MB.`);
        return;
      }
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const result = uploadEvent.target?.result as string;
        if (result) {
          setImages(prev => [...prev, result]);
        }
      };
      reader.readAsDataURL(file);
    });
    // Reset file input
    e.target.value = '';
  };

  const handleRemoveImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  // --- Form Submit ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!enforceActivityCheck(user, 'POST_PROMPT')) {
      return;
    }

    if (!name.trim()) {
      toast.error("Vui lòng nhập tên Prompt.");
      return;
    }
    if (!purpose.trim()) {
      toast.error("Vui lòng nhập mục đích sử dụng Prompt.");
      return;
    }
    if (!content.trim()) {
      toast.error("Vui lòng nhập nội dung Prompt.");
      return;
    }

    setSaving(true);
    try {
      if (promptToEdit) {
        const promptRef = doc(db, 'prompts', promptToEdit.id);
        await updateDoc(promptRef, {
          name: name.trim(),
          purpose: purpose.trim(),
          content: content.trim(),
          tags,
          referenceLinks,
          images,
          notes: notes.trim(),
          updatedAt: serverTimestamp()
        });
        toast.success("Cập nhật Prompt thành công!");
      } else {
        const { generateUniqueId } = await import('../../lib/generateId');
        const numericId = await generateUniqueId(db, 'prompt', '');

        await addDoc(collection(db, 'prompts'), {
          numericId,
          authorId: user.id,
          authorName: user.displayName,
          authorAvatar: user.avatar || '',
          name: name.trim(),
          purpose: purpose.trim(),
          content: content.trim(),
          tags,
          referenceLinks,
          images,
          notes: notes.trim(),
          pinned: false,
          copyCount: 0,
          savesCount: 0,
          viewsCount: 0,
          createdAt: new Date().toISOString(),
          deletedAt: null
        });
        toast.success("Tạo Prompt mới thành công!");

        // Notify followers
        try {
          const followersQuery = query(collection(db, 'follows'), where('targetCreatorId', '==', user.id));
          const followersSnap = await getDocs(followersQuery);
          for (const fDoc of followersSnap.docs) {
            const fData = fDoc.data();
            if (fData.followerId && fData.followerId !== user.id) {
              await addDoc(collection(db, 'notifications'), {
                userId: fData.followerId,
                type: 'NEW_CONTENT',
                title: 'Prompt mới từ Creator bạn follow',
                body: `${user.displayName} đã đăng một Prompt mới: ${name.trim()}`,
                read: false,
                createdAt: serverTimestamp()
              });
            }
          }
        } catch (notifErr) {
          console.error("Failed to notify followers about new prompt:", notifErr);
        }
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error("Lỗi khi lưu Prompt: " + (err.message || "Lỗi hệ thống"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/90 backdrop-blur-md flex flex-col h-screen overflow-hidden text-neutral-900 dark:text-neutral-100">
      {/* Top Navigation Bar */}
      <div className="shrink-0 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <PenTool className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 leading-tight">
              {promptToEdit ? "Chỉnh sửa Prompt" : "Tạo Prompt mới"}
            </h2>
            <p className="text-xs text-neutral-500">
              Chia sẻ cấu trúc System Instruction & tài nguyên Prompt cho cộng đồng
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-xl text-neutral-500 hover:text-black dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          title="Đóng"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Full-Screen Body */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-neutral-50 dark:bg-neutral-950">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-8 pb-16">

          {/* MỤC 1: THÔNG TIN CƠ BẢN */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 shadow-sm space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-neutral-100 dark:border-neutral-800">
              <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-extrabold text-sm flex items-center justify-center shrink-0">
                1
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                  Thông tin cơ bản
                </h3>
                <p className="text-xs text-neutral-500">
                  Tên, đường dẫn tham khảo, mục đích sử dụng và các thẻ phân loại
                </p>
              </div>
            </div>

            <div className="space-y-5">
              {/* Tên Prompt */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-2">
                  Tên Prompt <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="VD: Prompt tạo nhân vật phản diện quyến rũ & sắc sảo"
                  className="w-full px-4 py-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm font-medium"
                />
              </div>

              {/* Cho phép người dùng thêm nhiều link tham khảo */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-2">
                  Các đường dẫn link tham khảo (Nếu có)
                </label>
                <div className="flex gap-2 mb-3">
                  <div className="relative flex-1">
                    <LinkIcon className="w-4 h-4 absolute left-3.5 top-3.5 text-neutral-400" />
                    <input
                      type="url"
                      value={referenceLinkInput}
                      onChange={e => setReferenceLinkInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddReferenceLink(); } }}
                      placeholder="Thêm link (https://aistudio.google.com/..., docs, github...)"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddReferenceLink}
                    className="px-4 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 font-semibold text-xs hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors flex items-center gap-1.5 shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Thêm link</span>
                  </button>
                </div>

                {referenceLinks.length > 0 && (
                  <div className="space-y-2">
                    {referenceLinks.map((link, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-800 text-xs">
                        <a href={link} target="_blank" rel="noopener noreferrer" className="text-amber-600 dark:text-amber-400 hover:underline truncate font-mono">
                          {link}
                        </a>
                        <button
                          type="button"
                          onClick={() => handleRemoveReferenceLink(idx)}
                          className="p-1 text-neutral-400 hover:text-red-500 transition-colors shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Mục đích sử dụng */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-2">
                  Mục đích sử dụng <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={purpose}
                  onChange={e => setPurpose(e.target.value)}
                  placeholder="VD: Dùng cho Roleplay học đường, World Building, Viết kịch bản, Jailbreak..."
                  className="w-full px-4 py-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm font-medium"
                />
              </div>

              {/* Thẻ phân loại (Tối đa 6 tag) */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-2">
                  Thẻ phân loại (Tối đa 6 Tag)
                </label>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
                    placeholder="Nhập tên tag rồi ấn Thêm (VD: roleplay, system, coding)..."
                    className="flex-1 px-4 py-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="px-4 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 font-semibold text-xs hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors shrink-0"
                  >
                    Thêm Tag
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {tags.map(tag => (
                    <span key={tag} className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-xl text-xs font-semibold">
                      #{tag}
                      <button type="button" onClick={() => handleRemoveTag(tag)} className="hover:text-red-500 transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* MỤC 2: HÌNH ẢNH MINH HỌA & GIAO DIỆN SỬ DỤNG */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 shadow-sm space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-neutral-100 dark:border-neutral-800">
              <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-extrabold text-sm flex items-center justify-center shrink-0">
                2
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                  Hình ảnh minh họa & Giao diện sử dụng
                </h3>
                <p className="text-xs text-neutral-500">
                  Tải lên các ảnh chụp màn hình minh họa kết quả & giao diện từ thiết bị khi áp dụng Prompt
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Image Upload Area */}
              <div>
                {/* Upload via File Picker */}
                <label className="border-2 border-dashed border-neutral-300 dark:border-neutral-700 hover:border-amber-500 dark:hover:border-amber-500 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors bg-neutral-50 dark:bg-neutral-800/40 group">
                  <Upload className="w-8 h-8 text-neutral-400 group-hover:text-amber-500 transition-colors mb-2" />
                  <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                    Chọn ảnh từ máy tính / điện thoại
                  </span>
                  <span className="text-[11px] text-neutral-400 mt-1">
                    Hỗ trợ JPG, JPEG, PNG, WEBP (Tối đa 10MB/ảnh)
                  </span>
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={handleImageFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Image Gallery Preview Grid */}
              {images.length > 0 ? (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-neutral-600 dark:text-neutral-400">
                    Ảnh minh họa đã tải ({images.length}):
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {images.map((imgUrl, idx) => (
                      <div key={idx} className="relative group rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-700 aspect-video bg-neutral-100 dark:bg-neutral-800">
                        <img
                          src={imgUrl}
                          alt={`Minh họa ${idx + 1}`}
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
                  Chưa có ảnh minh họa nào được thêm.
                </div>
              )}
            </div>
          </div>

          {/* MỤC 3: NỘI DUNG CẤU TRÚC PROMPT & GHI CHÚ */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 shadow-sm space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-neutral-100 dark:border-neutral-800">
              <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-extrabold text-sm flex items-center justify-center shrink-0">
                3
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                  Nội dung cấu trúc Prompt & Ghi chú
                </h3>
                <p className="text-xs text-neutral-500">
                  Nội dung lệnh System Instruction gốc và hướng dẫn / ghi chú phụ trợ cho người dùng
                </p>
              </div>
            </div>

            <div className="space-y-5">
              {/* Nội dung Prompt */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-2">
                  Nội dung Prompt (System Instruction) <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={10}
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="Nhập toàn bộ System Instruction, luật ngữ cảnh, ví dụ phản hồi của Prompt..."
                  className="w-full px-4 py-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono text-xs md:text-sm leading-relaxed"
                />
              </div>

              {/* Ghi chú thêm (Nếu có) */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-2">
                  Ghi chú thêm (Nếu có)
                </label>
                <textarea
                  rows={4}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Nhập ghi chú hướng dẫn cài đặt Temperature, Safety Settings, cách sử dụng tốt nhất trên Google AI Studio..."
                  className="w-full px-4 py-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs md:text-sm font-medium"
                />
              </div>
            </div>
          </div>

          {/* Bottom Action Footer */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3 rounded-2xl border border-neutral-200 dark:border-neutral-700 text-xs font-bold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-center"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-8 py-3 rounded-2xl bg-black dark:bg-white text-white dark:text-black text-xs font-bold hover:opacity-90 transition-all disabled:opacity-50 shadow-md flex items-center justify-center gap-2"
            >
              {saving ? "Đang lưu..." : (promptToEdit ? "Lưu thay đổi" : "Hoàn tất & Đăng Prompt")}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
