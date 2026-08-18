import React, { useState, useEffect } from 'react';
import { 
  X, Upload, Link as LinkIcon, Sparkles, ExternalLink, Plus, Trash2, 
  Image as ImageIcon, Check, AlertCircle, Info, FileText, User, MessageSquare
} from 'lucide-react';
import { collection, addDoc, doc, updateDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/useAuthStore';
import { CharacterItem } from '../../types';
import toast from 'react-hot-toast';

interface CreateCharacterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  characterToEdit?: CharacterItem | null;
}

export default function CreateCharacterModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  characterToEdit 
}: CreateCharacterModalProps) {
  const { user } = useAuthStore();

  // State initialization
  const [avatar, setAvatar] = useState('');
  const [avatarUrlInput, setAvatarUrlInput] = useState('');

  const [name, setName] = useState('');
  const [gender, setGender] = useState('Nữ');
  const [slogan, setSlogan] = useState('');
  const [creatorNote, setCreatorNote] = useState('');

  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  const [plot, setPlot] = useState('');
  const [openingScene, setOpeningScene] = useState('');

  // Link mode: true = Đã có link, false = Chưa có link
  const [hasLink, setHasLink] = useState<boolean>(true);
  const [mainLink, setMainLink] = useState('');
  const [additionalLinks, setAdditionalLinks] = useState<string[]>([]);
  const [newAddLinkInput, setNewAddLinkInput] = useState('');

  const [saving, setSaving] = useState(false);

  // Sync state when opening or when characterToEdit changes
  useEffect(() => {
    if (!isOpen) return;

    if (characterToEdit) {
      setAvatar(characterToEdit.avatar || '');
      setAvatarUrlInput('');
      setName(characterToEdit.name || '');
      setGender(characterToEdit.gender || 'Nữ');
      setSlogan(characterToEdit.slogan || '');
      setCreatorNote(characterToEdit.creatorNote || '');
      setTags(characterToEdit.tags || []);
      setPlot(characterToEdit.plot || '');
      setOpeningScene(characterToEdit.openingScene || '');

      const existingMainLink = characterToEdit.characterLink || characterToEdit.link || '';
      const existingHasLink = characterToEdit.hasLink !== undefined 
        ? characterToEdit.hasLink 
        : Boolean(existingMainLink.trim());
      
      setHasLink(existingHasLink);
      setMainLink(existingMainLink);
      setAdditionalLinks(characterToEdit.additionalLinks || []);
    } else {
      setAvatar('');
      setAvatarUrlInput('');
      setName('');
      setGender('Nữ');
      setSlogan('');
      setCreatorNote('');
      setTagInput('');
      setTags([]);
      setPlot('');
      setOpeningScene('');
      setHasLink(true);
      setMainLink('');
      setAdditionalLinks([]);
      setNewAddLinkInput('');
    }
  }, [isOpen, characterToEdit]);

  if (!isOpen || !user) return null;

  // --- Avatar Handlers ---
  const handleAvatarFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Dung lượng file vượt quá 10MB!");
      return;
    }

    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error("Chỉ chấp nhận định dạng JPG, JPEG, PNG, WEBP!");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const res = event.target?.result as string;
      if (res) {
        setAvatar(res);
        toast.success("Tải ảnh đại diện thành công!");
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleApplyAvatarUrl = () => {
    const trimmed = avatarUrlInput.trim();
    if (!trimmed) return;
    try {
      new URL(trimmed);
    } catch {
      toast.error("Vui lòng nhập URL hình ảnh hợp lệ.");
      return;
    }
    setAvatar(trimmed);
    setAvatarUrlInput('');
    toast.success("Đã áp dụng link ảnh đại diện!");
  };

  // --- Tag Handlers (Max 12 tags) ---
  const handleAddTag = () => {
    const trimmed = tagInput.trim().toLowerCase();
    if (!trimmed) return;
    if (trimmed.length > 30) {
      toast.error("Tên Tag không quá 30 ký tự.");
      return;
    }
    if (tags.length >= 12) {
      toast.error("Tối đa 12 Tag cho một Character.");
      return;
    }
    if (tags.includes(trimmed)) {
      toast.error("Tag này đã tồn tại trong danh sách.");
      return;
    }
    setTags([...tags, trimmed]);
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  // --- Link Handlers ---
  const handleAddAdditionalLink = () => {
    const trimmed = newAddLinkInput.trim();
    if (!trimmed) return;
    try {
      new URL(trimmed);
    } catch {
      toast.error("Vui lòng nhập đường dẫn URL hợp lệ.");
      return;
    }
    if (additionalLinks.includes(trimmed) || trimmed === mainLink) {
      toast.error("Liên kết này đã tồn tại.");
      return;
    }
    setAdditionalLinks([...additionalLinks, trimmed]);
    setNewAddLinkInput('');
    toast.success("Đã thêm liên kết phụ thành công!");
  };

  const handleRemoveAdditionalLink = (index: number) => {
    setAdditionalLinks(additionalLinks.filter((_, i) => i !== index));
  };

  const handleOpenLink = (url: string) => {
    if (!url) return;
    let targetUrl = url.trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  // --- Form Submit Handler ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Vui lòng nhập tên Character.");
      return;
    }
    if (name.length > 50) {
      toast.error("Tên Character tối đa 50 ký tự.");
      return;
    }
    if (!avatar) {
      toast.error("Vui lòng chọn hoặc dán link ảnh đại diện cho Character.");
      return;
    }
    if (!slogan.trim()) {
      toast.error("Vui lòng nhập Slogan.");
      return;
    }
    if (slogan.length > 700) {
      toast.error("Slogan tối đa 700 ký tự.");
      return;
    }
    if (!plot.trim()) {
      toast.error("Vui lòng nhập Cốt truyện (Plot).");
      return;
    }

    // Link validation if hasLink is true
    if (hasLink) {
      if (!mainLink.trim()) {
        toast.error("Bạn đã chọn 'Đã có link'. Vui lòng nhập Link Character từ Google AI Studio.");
        return;
      }
      if (!mainLink.includes("aistudio.google.com") && !mainLink.includes("alkalicdn") && !mainLink.includes("google.com")) {
        toast.error("Link Character phải xuất phát từ Google AI Studio (aistudio.google.com).");
        return;
      }
    }

    setSaving(true);
    try {
      const finalLink = hasLink ? mainLink.trim() : '';
      const finalAddLinks = hasLink ? additionalLinks : [];

      if (characterToEdit) {
        const charRef = doc(db, 'characters', characterToEdit.id);
        await updateDoc(charRef, {
          name: name.trim(),
          avatar,
          gender,
          slogan: slogan.trim(),
          creatorNote: creatorNote.trim(),
          plot: plot.trim(),
          openingScene: openingScene.trim(),
          hasLink: hasLink,
          characterLink: finalLink,
          link: finalLink,
          additionalLinks: finalAddLinks,
          tags,
          updatedAt: serverTimestamp()
        });
        toast.success("Cập nhật Character thành công!");
      } else {
        const { generateUniqueId } = await import('../../lib/generateId');
        const numericId = await generateUniqueId(db, 'character', '');

        await addDoc(collection(db, 'characters'), {
          numericId,
          creatorId: user.id,
          creatorName: user.displayName,
          creatorAvatar: user.avatar || '',
          name: name.trim(),
          avatar,
          gender,
          slogan: slogan.trim(),
          creatorNote: creatorNote.trim(),
          plot: plot.trim(),
          openingScene: openingScene.trim(),
          hasLink: hasLink,
          characterLink: finalLink,
          link: finalLink,
          additionalLinks: finalAddLinks,
          tags,
          pinned: false,
          likesCount: 0,
          savesCount: 0,
          viewsCount: 0,
          createdAt: new Date().toISOString(),
          deletedAt: null
        });
        toast.success("Tạo Character mới thành công!");

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
                title: 'Character mới từ Creator bạn theo dõi',
                body: `${user.displayName} vừa đăng một Character mới: ${name.trim()}`,
                read: false,
                createdAt: serverTimestamp()
              });
            }
          }
        } catch (notifErr) {
          console.error("Failed to notify followers:", notifErr);
        }
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error("Lỗi khi lưu Character: " + (err.message || "Lỗi hệ thống"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/90 backdrop-blur-md flex flex-col h-screen overflow-hidden text-neutral-900 dark:text-neutral-100">
      {/* Top Header Bar */}
      <div className="shrink-0 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 leading-tight">
              {characterToEdit ? "Chỉnh sửa Character" : "Tạo Character Mới"}
            </h2>
            <p className="text-xs text-neutral-500">
              Chia sẻ kịch bản nhân vật nhập vai của bạn đến cộng đồng Google AI Studio
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
            disabled={saving}
            className="px-6 py-2 rounded-xl bg-black dark:bg-white text-white dark:text-black text-xs font-bold hover:opacity-90 transition-all disabled:opacity-50 shadow-sm flex items-center gap-2"
          >
            {saving ? (
              <span>Đang lưu...</span>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>{characterToEdit ? "Lưu thay đổi" : "Tạo Character Mới"}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Full-Screen Body */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-neutral-50 dark:bg-neutral-950">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-8 pb-16">

          {/* MỤC 1: ẢNH ĐẠI DIỆN CHARACTER */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 md:p-8 shadow-sm space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-extrabold text-sm flex items-center justify-center shrink-0">
                1
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                  Ảnh đại diện Character <span className="text-red-500">*</span>
                </h3>
                <p className="text-xs text-neutral-500">
                  Tải trực tiếp ảnh từ thiết bị hoặc dán đường dẫn URL hình ảnh
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
              {/* Preview Box */}
              <div className="flex flex-col items-center justify-center p-4 bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
                {avatar ? (
                  <div className="relative group w-36 h-36 rounded-2xl overflow-hidden border-2 border-amber-500/30 shadow-md">
                    <img src={avatar} alt="Character Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setAvatar('')}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700 shadow-lg"
                      title="Xóa ảnh này"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="w-36 h-36 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex flex-col items-center justify-center text-neutral-400 gap-2 border-2 border-dashed border-neutral-300 dark:border-neutral-700">
                    <ImageIcon className="w-8 h-8" />
                    <span className="text-xs font-semibold">Chưa chọn ảnh</span>
                  </div>
                )}
                <span className="text-[11px] text-neutral-400 mt-2 text-center">
                  {avatar ? "Ảnh đã chọn" : "Khung xem trước avatar"}
                </span>
              </div>

              {/* Upload Options */}
              <div className="md:col-span-2 space-y-4">
                {/* File Upload Button */}
                <div className="p-4 bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800 rounded-2xl space-y-2">
                  <span className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                    Lựa chọn 1: Tải trực tiếp từ thiết bị
                  </span>
                  <label className="inline-flex items-center gap-2 px-5 py-2.5 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-black rounded-xl text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer shadow-sm">
                    <Upload className="w-4 h-4" />
                    <span>Chọn tệp ảnh từ máy tính / điện thoại</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      onChange={handleAvatarFileUpload}
                      className="hidden"
                    />
                  </label>
                  <p className="text-[11px] text-neutral-400">
                    Hỗ trợ các định dạng JPG, JPEG, PNG, WEBP (Dung lượng tối đa 10MB).
                  </p>
                </div>

                {/* URL Input */}
                <div className="p-4 bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800 rounded-2xl space-y-2">
                  <span className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                    Lựa chọn 2: Đường dẫn link URL ảnh trực tiếp
                  </span>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={avatarUrlInput}
                      onChange={e => setAvatarUrlInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleApplyAvatarUrl(); } }}
                      placeholder="https://example.com/character-avatar.png"
                      className="flex-1 px-3.5 py-2 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-medium"
                    />
                    <button
                      type="button"
                      onClick={handleApplyAvatarUrl}
                      className="px-4 py-2 bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-xl font-bold text-xs hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors shrink-0"
                    >
                      Sử dụng URL
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* MỤC 2: THÔNG TIN CƠ BẢN */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 md:p-8 shadow-sm space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-extrabold text-sm flex items-center justify-center shrink-0">
                2
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                  Thông tin cơ bản
                </h3>
                <p className="text-xs text-neutral-500">
                  Tên nhân vật, giới tính, khẩu hiệu slogan và ghi chú tác giả
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tên Character */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-2">
                  Tên Character <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  maxLength={50}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="VD: Emi - Nữ sinh bí ẩn / Lord Malakor..."
                  className="w-full px-4 py-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                />
                <span className="text-[11px] text-neutral-400 mt-1 block text-right">{name.length}/50 ký tự</span>
              </div>

              {/* Giới tính */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-2">
                  Giới tính <span className="text-red-500">*</span>
                </label>
                <select
                  value={gender}
                  onChange={e => setGender(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                >
                  <option value="Nữ">Nữ</option>
                  <option value="Nam">Nam</option>
                  <option value="Phi giới tính">Phi giới tính</option>
                  <option value="Khác">Khác / Chưa xác định</option>
                </select>
              </div>
            </div>

            {/* Slogan */}
            <div>
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-2">
                Câu Slogan <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={2}
                maxLength={700}
                value={slogan}
                onChange={e => setSlogan(e.target.value)}
                placeholder="Câu thơ, lời thoại ấn tượng hoặc ấn tượng đầu tiên về nhân vật (Tối đa 700 ký tự)..."
                className="w-full px-4 py-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium resize-none leading-relaxed"
              />
              <span className="text-[11px] text-neutral-400 mt-1 block text-right">{slogan.length}/700 ký tự</span>
            </div>

            {/* Creator Note */}
            <div>
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-2">
                Creator Note (Ghi chú của tác giả)
              </label>
              <textarea
                rows={3}
                value={creatorNote}
                onChange={e => setCreatorNote(e.target.value)}
                placeholder="Lời khuyên, hướng dẫn tương tác, lưu ý model AI nên dùng hoặc ghi chú riêng từ tác giả..."
                className="w-full px-4 py-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium leading-relaxed resize-none"
              />
            </div>
          </div>

          {/* MỤC 3: TAG PHÂN LOẠI (TỐI ĐA 12 TAG) */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 md:p-8 shadow-sm space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-extrabold text-sm flex items-center justify-center shrink-0">
                  3
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                    Tag phân loại (Tối đa 12 tag)
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Thêm các thẻ nhãn giúp người dùng dễ dàng tìm kiếm qua AI Search
                  </p>
                </div>
              </div>
              <span className={`text-xs font-bold px-3 py-1 rounded-xl border ${
                tags.length >= 12
                  ? 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700'
              }`}>
                {tags.length}/12 tag
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tagInput}
                  disabled={tags.length >= 12}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
                  placeholder="Nhập tên tag (VD: romance, modern, fantasy)..."
                  className="flex-1 px-4 py-2.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-medium"
                />
                <button
                  type="button"
                  disabled={tags.length >= 12 || !tagInput.trim()}
                  onClick={handleAddTag}
                  className="px-5 py-2.5 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-black rounded-2xl font-bold text-xs hover:opacity-90 transition-opacity disabled:opacity-40 shrink-0"
                >
                  Thêm Tag
                </button>
              </div>

              {tags.length > 0 ? (
                <div className="flex flex-wrap gap-2 pt-2">
                  {tags.map((t, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-semibold text-neutral-800 dark:text-neutral-200"
                    >
                      <span>#{t}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(t)}
                        className="p-0.5 hover:text-red-500 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-neutral-400 italic pt-1">
                  Chưa có tag nào được thêm. Nhập tag bên trên và bấm "Thêm Tag".
                </p>
              )}
            </div>
          </div>

          {/* MỤC 4: CỐT TRUYỆN (PLOT) */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 md:p-8 shadow-sm space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-extrabold text-sm flex items-center justify-center shrink-0">
                4
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                  Cốt truyện (Plot) <span className="text-red-500">*</span>
                </h3>
                <p className="text-xs text-neutral-500">
                  Chi tiết bối cảnh, tính cách, ngoại hình và quy tắc nhập vai nhân vật
                </p>
              </div>
            </div>

            <textarea
              rows={7}
              value={plot}
              onChange={e => setPlot(e.target.value)}
              placeholder="Mô tả chi tiết cốt truyện, thế giới, quy tắc tính cách và định hướng câu chuyện Roleplay..."
              className="w-full px-4 py-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium leading-relaxed resize-y"
            />
          </div>

          {/* MỤC 5: CẢNH MỞ ĐẦU (OPENING SCENE) */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 md:p-8 shadow-sm space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-extrabold text-sm flex items-center justify-center shrink-0">
                5
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                  Cảnh Mở Đầu (OPENING SCENE)
                </h3>
                <p className="text-xs text-neutral-500">
                  Đoạn đối thoại / văn cảnh đầu tiên kích hoạt hội thoại Roleplay
                </p>
              </div>
            </div>

            <textarea
              rows={4}
              value={openingScene}
              onChange={e => setOpeningScene(e.target.value)}
              placeholder="Đoạn thoại mở đầu kịch bản (VD: *Emi khẽ ngẩng đầu nhìn bạn dưới ánh đèn đường khuya...*)..."
              className="w-full px-4 py-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium leading-relaxed resize-y font-mono"
            />
          </div>

          {/* MỤC 6: LINK CHARACTER */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 md:p-8 shadow-sm space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-extrabold text-sm flex items-center justify-center shrink-0">
                6
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                  Link Character (Google AI Studio)
                </h3>
                <p className="text-xs text-neutral-500">
                  Quản lý các liên kết thử nghiệm Character trực tiếp trên Google AI Studio
                </p>
              </div>
            </div>

            {/* Toggle Status Buttons: Đã có link VS Chưa có link */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setHasLink(true)}
                className={`flex-1 py-3 px-4 rounded-2xl border font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                  hasLink
                    ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-600 dark:text-emerald-400 ring-2 ring-emerald-500/20'
                    : 'bg-neutral-50 dark:bg-neutral-800/40 border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:text-black dark:hover:text-white'
                }`}
              >
                <Check className={`w-4 h-4 ${hasLink ? 'opacity-100' : 'opacity-0'}`} />
                <span>Đã có link</span>
              </button>

              <button
                type="button"
                onClick={() => setHasLink(false)}
                className={`flex-1 py-3 px-4 rounded-2xl border font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                  !hasLink
                    ? 'bg-amber-500/10 border-amber-500/50 text-amber-600 dark:text-amber-400 ring-2 ring-amber-500/20'
                    : 'bg-neutral-50 dark:bg-neutral-800/40 border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:text-black dark:hover:text-white'
                }`}
              >
                <AlertCircle className={`w-4 h-4 ${!hasLink ? 'opacity-100' : 'opacity-0'}`} />
                <span>Chưa có link</span>
              </button>
            </div>

            {/* If "Đã có link" */}
            {hasLink ? (
              <div className="space-y-4 pt-2">
                {/* Main Link Input */}
                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-2">
                    Link chính (Google AI Studio) <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <LinkIcon className="w-4 h-4 absolute left-3.5 top-3.5 text-neutral-400" />
                      <input
                        type="url"
                        value={mainLink}
                        onChange={e => setMainLink(e.target.value)}
                        placeholder="https://aistudio.google.com/..."
                        className="w-full pl-10 pr-4 py-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-medium"
                      />
                    </div>
                    {mainLink.trim() && (
                      <button
                        type="button"
                        onClick={() => handleOpenLink(mainLink)}
                        className="px-4 py-3 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/20 transition-colors font-bold text-xs flex items-center gap-1.5 shrink-0"
                        title="Mở link này trong tab mới"
                      >
                        <span>Mở link</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-1">
                    Bắt buộc phải là liên kết hợp lệ từ Google AI Studio (aistudio.google.com).
                  </p>
                </div>

                {/* Additional Links Section */}
                <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                      Các link phụ / Liên kết bổ sung
                    </label>
                    <span className="text-[11px] text-neutral-400">
                      Thêm nhiều link trải nghiệm khác
                    </span>
                  </div>

                  {/* Add Extra Link Input */}
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={newAddLinkInput}
                      onChange={e => setNewAddLinkInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddAdditionalLink(); } }}
                      placeholder="Nhập link bổ sung (VD: link dự phòng / link bản nâng cấp)..."
                      className="flex-1 px-4 py-2.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-medium"
                    />
                    <button
                      type="button"
                      onClick={handleAddAdditionalLink}
                      className="px-4 py-2.5 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-black rounded-2xl font-bold text-xs hover:opacity-90 transition-opacity flex items-center gap-1.5 shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Thêm link</span>
                    </button>
                  </div>

                  {/* Additional Links List */}
                  {additionalLinks.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <span className="text-[11px] font-bold text-neutral-500">Danh sách link phụ đã thêm:</span>
                      {additionalLinks.map((aLink, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 gap-2"
                        >
                          <div className="flex items-center gap-2 overflow-hidden flex-1">
                            <LinkIcon className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                            <span className="text-xs font-mono text-neutral-700 dark:text-neutral-300 truncate">
                              {aLink}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleOpenLink(aLink)}
                              className="px-3 py-1.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[11px] font-bold flex items-center gap-1 hover:bg-indigo-500/20 transition-colors"
                            >
                              <span>Mở link</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveAdditionalLink(idx)}
                              className="p-1.5 rounded-xl hover:bg-red-500/10 hover:text-red-500 text-neutral-400 transition-colors"
                              title="Xóa link phụ này"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs text-amber-600 dark:text-amber-400 flex items-center gap-3">
                <Info className="w-5 h-5 shrink-0" />
                <span>
                  Trạng thái được chọn là <strong>Chưa có link</strong>. Bạn vẫn có thể đăng Character này và cập nhật link Google AI Studio sau.
                </span>
              </div>
            )}
          </div>

          {/* Bottom Submit Actions */}
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
              disabled={saving}
              className="px-8 py-3 rounded-2xl bg-black dark:bg-white text-white dark:text-black text-xs font-bold hover:opacity-90 transition-all disabled:opacity-50 shadow-md flex items-center gap-2"
            >
              {saving ? "Đang lưu..." : (characterToEdit ? "Lưu thay đổi" : "Tạo Character Mới")}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
