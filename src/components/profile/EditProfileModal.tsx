import React, { useState, useEffect } from 'react';
import { 
  X, 
  Upload, 
  Send, 
  CheckCircle2, 
  Clock, 
  Sparkles, 
  Facebook, 
  Instagram, 
  Music, 
  MessageSquare,
  Plus,
  Trash2,
  Globe,
  Award,
  User as UserIcon,
  ShieldCheck,
  ArrowLeft,
  RefreshCw,
  Crown,
  AlertCircle,
  Check,
  Activity
} from 'lucide-react';
import { doc, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/useAuthStore';
import { BADGE_DEFINITIONS, evaluateUserBadges, BadgeId } from '../../lib/badges';
import { CustomSocialLink } from '../../types';
import toast from 'react-hot-toast';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: () => void;
}

export default function EditProfileModal({ isOpen, onClose, onSaveSuccess }: EditProfileModalProps) {
  const { user, setAuth, firebaseUser } = useAuthStore();
  
  // Section 1: Basic Info
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [bio, setBio] = useState(user?.bio || '');

  // Section 2: Badges & Status
  const [statusMessage, setStatusMessage] = useState(user?.statusMessage || '');
  const [featuredBadge, setFeaturedBadge] = useState<string>(user?.featuredBadge || '');

  // Section 3: Social Links & Custom Links
  const [facebook, setFacebook] = useState(user?.socialLinks?.facebook || '');
  const [instagram, setInstagram] = useState(user?.socialLinks?.instagram || '');
  const [tiktok, setTiktok] = useState(user?.socialLinks?.tiktok || '');
  const [discord, setDiscord] = useState(user?.socialLinks?.discord || '');
  const [customLinks, setCustomLinks] = useState<CustomSocialLink[]>(user?.customLinks || []);

  // Section 4: Creator Request state
  const [requestStatus, setRequestStatus] = useState<'IDLE' | 'PENDING' | 'APPROVED' | 'REJECTED'>('IDLE');
  const [requestReason, setRequestReason] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);
  
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'badges' | 'social' | 'creator'>('basic');

  useEffect(() => {
    if (isOpen && user?.id) {
      setDisplayName(user.displayName || '');
      setAvatar(user.avatar || '');
      setBio(user.bio || '');
      setStatusMessage(user.statusMessage || '');
      setFeaturedBadge(user.featuredBadge || '');
      setFacebook(user.socialLinks?.facebook || '');
      setInstagram(user.socialLinks?.instagram || '');
      setTiktok(user.socialLinks?.tiktok || '');
      setDiscord(user.socialLinks?.discord || '');
      setCustomLinks(user.customLinks || []);

      // Check existing creator request in Firestore
      const checkRequest = async () => {
        try {
          const reqRef = doc(db, 'creator_requests', user.id);
          const reqSnap = await getDoc(reqRef);
          if (reqSnap.exists()) {
            const data = reqSnap.data();
            setRequestStatus(data.status || 'IDLE');
            if (data.reason) setRequestReason(data.reason);
            if (data.adminNote) setAdminNote(data.adminNote);
          } else if (user.creatorRequestStatus) {
            setRequestStatus(user.creatorRequestStatus);
          } else {
            setRequestStatus('IDLE');
          }
        } catch (e) {
          console.error("Error fetching creator request:", e);
        }
      };
      checkRequest();
    }
  }, [isOpen, user]);

  if (!isOpen || !user) return null;

  // Handle Avatar Upload
  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      const base64Str = event.target?.result as string;
      setAvatar(base64Str);
      toast.success("Tải ảnh đại diện thành công!");
    };
    reader.readAsDataURL(file);
  };

  // Generate Random Avatar
  const handleRandomAvatar = () => {
    const randomSeed = Math.random().toString(36).substring(7);
    const newAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${randomSeed}`;
    setAvatar(newAvatar);
    toast.success("Đã tạo ảnh đại diện mới!");
  };

  // Add Custom Social Link
  const handleAddCustomLink = () => {
    const newLink: CustomSocialLink = {
      id: Date.now().toString(),
      title: '',
      url: ''
    };
    setCustomLinks([...customLinks, newLink]);
  };

  // Update Custom Link
  const handleUpdateCustomLink = (id: string, field: 'title' | 'url', value: string) => {
    setCustomLinks(customLinks.map(link => 
      link.id === id ? { ...link, [field]: value } : link
    ));
  };

  // Remove Custom Link
  const handleRemoveCustomLink = (id: string) => {
    setCustomLinks(customLinks.filter(link => link.id !== id));
  };

  // Creator Request Submission
  const handleSendCreatorRequest = async () => {
    if (!user?.id) return;
    setSubmittingRequest(true);
    try {
      const reqData = {
        userId: user.id,
        userDisplayName: displayName.trim() || user.displayName,
        userAvatar: avatar || user.avatar || '',
        userEmail: user.email || '',
        userRole: user.role || 'USER',
        reason: requestReason.trim(),
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'creator_requests', user.id), reqData);
      await updateDoc(doc(db, 'users', user.id), { creatorRequestStatus: 'PENDING' });

      setRequestStatus('PENDING');
      toast.success("Đã gửi yêu cầu trở thành Creator tới Quản trị viên (Admin)!");
    } catch (err: any) {
      console.error(err);
      toast.error("Gửi yêu cầu thất bại: " + (err.message || "Lỗi không xác định"));
    } finally {
      setSubmittingRequest(false);
    }
  };

  // Submit Profile Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      toast.error("Vui lòng nhập tên hiển thị.");
      return;
    }
    if (displayName.length > 50) {
      toast.error("Tên hiển thị tối đa 50 ký tự.");
      return;
    }
    if (bio.length > 600) {
      toast.error("Bio tối đa 600 ký tự.");
      return;
    }

    setSaving(true);
    try {
      // Filter out empty custom links
      const cleanedCustomLinks = customLinks.filter(
        link => link.title.trim() !== '' || link.url.trim() !== ''
      );

      const updatedData = {
        displayName: displayName.trim(),
        avatar,
        bio: bio.trim(),
        statusMessage: statusMessage.trim(),
        featuredBadge,
        socialLinks: {
          facebook: facebook.trim(),
          instagram: instagram.trim(),
          tiktok: tiktok.trim(),
          discord: discord.trim(),
        },
        customLinks: cleanedCustomLinks,
        updatedAt: new Date().toISOString()
      };

      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, updatedData);

      // Update local state in Zustand store
      setAuth(firebaseUser, { ...user, ...updatedData });

      toast.success("Cập nhật hồ sơ thành công!");
      onSaveSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error("Không thể cập nhật hồ sơ: " + (err.message || "Lỗi không xác định"));
    } finally {
      setSaving(false);
    }
  };

  // Evaluate user badges
  const calculatedBadgeIds: BadgeId[] = evaluateUserBadges({
    creatorStatus: user.creatorStatus,
    role: user.role,
    characterCount: user.characterCount || 0,
    createdAt: user.createdAt
  });

  // Preset status options
  const PRESET_STATUSES = [
    '🟢 Đang hoạt động',
    '✨ Đang sáng tạo Character',
    '📝 Đang viết Prompt mới',
    '💬 Rảnh rỗi trò chuyện',
    '🎭 Đam mê Roleplay',
    '🌙 Offline / Đang bận'
  ];

  return (
    <div className="fixed inset-0 z-50 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col overflow-y-auto animate-in fade-in duration-200">
      {/* Sticky Fullscreen Top Header */}
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-800 px-4 md:px-8 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button 
            type="button" 
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-500 hover:text-black dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            title="Quay lại"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg md:text-xl font-extrabold flex items-center gap-2">
              Chỉnh sửa hồ sơ cá nhân
              {user.creatorStatus && (
                <span className="px-2 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px] font-black rounded-md uppercase">
                  Creator
                </span>
              )}
            </h1>
            <p className="text-xs text-neutral-500">
              Cập nhật thông tin cơ bản, huy hiệu, liên kết và trạng thái Creator
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <button 
            type="button" 
            onClick={onClose} 
            className="px-4 py-2 rounded-xl text-xs md:text-sm font-semibold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            Hủy
          </button>
          <button 
            type="button"
            onClick={handleSubmit} 
            disabled={saving} 
            className="px-5 py-2 rounded-xl bg-black dark:bg-white text-white dark:text-black text-xs md:text-sm font-extrabold hover:opacity-90 transition-opacity disabled:opacity-50 shadow-md flex items-center gap-2"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Đang lưu...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Lưu thay đổi
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Fullscreen Form Body */}
      <div className="max-w-4xl mx-auto w-full px-4 md:px-6 py-6 space-y-8 flex-1">
        {/* Navigation Quick Tabs */}
        <nav className="flex items-center gap-2 border-b border-neutral-200 dark:border-neutral-800 pb-2 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('basic')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-bold whitespace-nowrap transition-colors ${
              activeTab === 'basic'
                ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm'
                : 'text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800'
            }`}
          >
            <UserIcon className="w-4 h-4" />
            1. Thông tin cơ bản
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('badges')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-bold whitespace-nowrap transition-colors ${
              activeTab === 'badges'
                ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm'
                : 'text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800'
            }`}
          >
            <Award className="w-4 h-4" />
            2. Huy hiệu & Trạng thái
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('social')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-bold whitespace-nowrap transition-colors ${
              activeTab === 'social'
                ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm'
                : 'text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800'
            }`}
          >
            <Globe className="w-4 h-4" />
            3. Liên kết mạng xã hội
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('creator')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-bold whitespace-nowrap transition-colors ${
              activeTab === 'creator'
                ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm'
                : 'text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            4. Trạng thái Creator
          </button>
        </nav>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* ==================== MỤC 1: THÔNG TIN CƠ BẢN ==================== */}
          <section id="section-basic" className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 md:p-8 shadow-sm space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-neutral-100 dark:border-neutral-800">
              <div className="p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100">
                <UserIcon className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold">1. Thông tin cơ bản</h2>
                <p className="text-xs text-neutral-500">Quản lý ảnh đại diện, tên hiển thị công khai và giới thiệu cá nhân</p>
              </div>
            </div>

            {/* Avatar Upload & Preview */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                Ảnh đại diện (Avatar)
              </label>
              <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700">
                <div className="relative group shrink-0">
                  <img 
                    src={avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=" + (displayName || "User")} 
                    alt="Avatar Preview" 
                    className="w-28 h-28 rounded-full object-cover border-4 border-white dark:border-neutral-800 shadow-md" 
                  />
                  <label htmlFor="avatar-file-input" className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-white text-xs font-semibold rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                    <Upload className="w-6 h-6 mb-1" />
                    Đổi ảnh
                  </label>
                  <input 
                    id="avatar-file-input" 
                    type="file" 
                    accept="image/jpeg,image/jpg,image/png,image/webp" 
                    onChange={handleAvatarUpload} 
                    className="hidden" 
                  />
                </div>

                <div className="space-y-3 text-center sm:text-left flex-1">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <label 
                      htmlFor="avatar-file-input" 
                      className="px-4 py-2 rounded-xl bg-black dark:bg-white text-white dark:text-black text-xs font-bold hover:opacity-90 cursor-pointer transition-opacity flex items-center gap-2"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Tải ảnh từ thiết bị
                    </label>
                    <button 
                      type="button" 
                      onClick={handleRandomAvatar}
                      className="px-4 py-2 rounded-xl bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 text-neutral-800 dark:text-neutral-100 text-xs font-bold transition-colors flex items-center gap-2"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Tạo ngẫu nhiên
                    </button>
                  </div>
                  <p className="text-xs text-neutral-500 leading-relaxed">
                    Hỗ trợ định dạng JPG, JPEG, PNG, WEBP. Dung lượng tối đa <strong>10 MB</strong>.
                  </p>
                </div>
              </div>
            </div>

            {/* Display Name */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  Tên hiển thị <span className="text-red-500">*</span>
                </label>
                <span className="text-xs text-neutral-400">{displayName.length}/50 ký tự</span>
              </div>
              <input 
                type="text" 
                value={displayName} 
                onChange={e => setDisplayName(e.target.value)} 
                maxLength={50}
                placeholder="Nhập tên hiển thị của bạn..." 
                className="w-full px-4 py-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white text-sm font-medium"
              />
            </div>

            {/* Bio */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  Bio / Giới thiệu bản thân
                </label>
                <span className="text-xs text-neutral-400">{bio.length}/600 ký tự</span>
              </div>
              <textarea 
                rows={4}
                value={bio} 
                onChange={e => setBio(e.target.value)} 
                maxLength={600}
                placeholder="Viết lời chào hoặc đôi dòng giới thiệu bản thân tới cộng đồng Roleplay..." 
                className="w-full px-4 py-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white text-sm resize-none"
              />
            </div>
          </section>

          {/* ==================== MỤC 2: HUY HIỆU & TRẠNG THÁI ==================== */}
          <section id="section-badges" className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 md:p-8 shadow-sm space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-neutral-100 dark:border-neutral-800">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold">2. Huy hiệu & Trạng thái</h2>
                <p className="text-xs text-neutral-500">Xem các huy hiệu thành tích bạn sở hữu và thiết lập trạng thái hoạt động</p>
              </div>
            </div>

            {/* Current Badges List */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                Huy hiệu hiện tại đang sở hữu
              </label>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {calculatedBadgeIds.length > 0 ? (
                  calculatedBadgeIds.map((bId) => {
                    const def = BADGE_DEFINITIONS[bId];
                    if (!def) return null;
                    const IconComp = def.icon;
                    const isSelected = featuredBadge === bId;

                    return (
                      <div 
                        key={bId}
                        onClick={() => setFeaturedBadge(isSelected ? '' : bId)}
                        className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3 relative ${
                          isSelected 
                            ? 'ring-2 ring-amber-500 border-amber-500 bg-amber-500/5' 
                            : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/40 hover:border-neutral-300 dark:hover:border-neutral-700'
                        }`}
                      >
                        <div className={`p-2.5 rounded-xl ${def.bgClass} ${def.iconColorClass} shrink-0`}>
                          <IconComp className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm">{def.name}</span>
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${def.bgClass} ${def.colorClass}`}>
                              {def.category}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                            {def.shortDescription}
                          </p>
                        </div>
                        {isSelected && (
                          <span className="absolute top-3 right-3 text-amber-500">
                            <CheckCircle2 className="w-4 h-4" />
                          </span>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="col-span-full p-4 rounded-xl bg-neutral-100 dark:bg-neutral-800/50 text-neutral-500 text-xs text-center">
                    Bạn hiện chưa sở hữu huy hiệu đặc biệt nào. Hãy đóng góp thêm Character/Prompt để nhận huy hiệu!
                  </div>
                )}
              </div>
              <p className="text-xs text-neutral-400 italic">
                Nhấn vào một huy hiệu để chọn làm "Huy hiệu nổi bật" hiển thị trên hồ sơ cá nhân.
              </p>
            </div>

            {/* Current Activity Status */}
            <div className="space-y-3 pt-4 border-t border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  Trạng thái hoạt động hiện tại
                </label>
                <span className="text-xs text-neutral-400">{statusMessage.length}/100 ký tự</span>
              </div>

              <div className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-800 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700">
                <Activity className="w-4 h-4 text-emerald-500 shrink-0" />
                <input 
                  type="text" 
                  value={statusMessage} 
                  onChange={e => setStatusMessage(e.target.value)} 
                  maxLength={100}
                  placeholder="Ví dụ: 🟢 Đang sáng tạo Character | Rảnh rỗi nhận Feedback..." 
                  className="bg-transparent border-none outline-none text-sm w-full font-medium"
                />
              </div>

              {/* Quick Status Presets */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-neutral-500">Gợi ý chọn nhanh:</p>
                <div className="flex flex-wrap gap-2">
                  {PRESET_STATUSES.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setStatusMessage(preset)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors border border-neutral-200 dark:border-neutral-700"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ==================== MỤC 3: LIÊN KẾT MẠNG XÃ HỘI ==================== */}
          <section id="section-social" className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 md:p-8 shadow-sm space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-neutral-100 dark:border-neutral-800">
              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold">3. Liên kết mạng xã hội</h2>
                <p className="text-xs text-neutral-500">Thêm trang cá nhân social và các đường dẫn tùy chỉnh bên ngoài</p>
              </div>
            </div>

            {/* Standard Social Links */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                Mạng xã hội phổ biến
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex items-center gap-2.5 bg-neutral-100 dark:bg-neutral-800 px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700">
                  <Facebook className="w-4 h-4 text-blue-600 shrink-0" />
                  <input 
                    type="url" 
                    value={facebook} 
                    onChange={e => setFacebook(e.target.value)} 
                    placeholder="Facebook URL (https://facebook.com/...)" 
                    className="bg-transparent border-none outline-none text-xs w-full font-medium"
                  />
                </div>

                <div className="flex items-center gap-2.5 bg-neutral-100 dark:bg-neutral-800 px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700">
                  <Instagram className="w-4 h-4 text-pink-500 shrink-0" />
                  <input 
                    type="url" 
                    value={instagram} 
                    onChange={e => setInstagram(e.target.value)} 
                    placeholder="Instagram URL (https://instagram.com/...)" 
                    className="bg-transparent border-none outline-none text-xs w-full font-medium"
                  />
                </div>

                <div className="flex items-center gap-2.5 bg-neutral-100 dark:bg-neutral-800 px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700">
                  <Music className="w-4 h-4 text-neutral-900 dark:text-white shrink-0" />
                  <input 
                    type="url" 
                    value={tiktok} 
                    onChange={e => setTiktok(e.target.value)} 
                    placeholder="TikTok URL (https://tiktok.com/@...)" 
                    className="bg-transparent border-none outline-none text-xs w-full font-medium"
                  />
                </div>

                <div className="flex items-center gap-2.5 bg-neutral-100 dark:bg-neutral-800 px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700">
                  <MessageSquare className="w-4 h-4 text-indigo-500 shrink-0" />
                  <input 
                    type="text" 
                    value={discord} 
                    onChange={e => setDiscord(e.target.value)} 
                    placeholder="Discord Username / Server Link" 
                    className="bg-transparent border-none outline-none text-xs w-full font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Custom Links Section */}
            <div className="space-y-4 pt-4 border-t border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-xs font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                    Các liên kết tùy chỉnh khác
                  </label>
                  <p className="text-xs text-neutral-500 mt-0.5">Thêm Website cá nhân, YouTube, X (Twitter), GitHub, Telegram, Zalo, Patreon...</p>
                </div>
                <button
                  type="button"
                  onClick={handleAddCustomLink}
                  className="px-3 py-1.5 rounded-xl bg-black dark:bg-white text-white dark:text-black text-xs font-bold hover:opacity-90 transition-opacity flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Thêm liên kết
                </button>
              </div>

              {customLinks.length > 0 ? (
                <div className="space-y-3">
                  {customLinks.map((link) => (
                    <div 
                      key={link.id} 
                      className="flex flex-col sm:flex-row items-center gap-2 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700"
                    >
                      <input 
                        type="text" 
                        value={link.title} 
                        onChange={e => handleUpdateCustomLink(link.id, 'title', e.target.value)} 
                        placeholder="Tên nền tảng (VD: Website, GitHub)" 
                        className="w-full sm:w-1/3 px-3 py-2 text-xs rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 focus:outline-none font-medium"
                      />
                      <input 
                        type="url" 
                        value={link.url} 
                        onChange={e => handleUpdateCustomLink(link.id, 'url', e.target.value)} 
                        placeholder="Đường dẫn URL (https://...)" 
                        className="w-full sm:flex-1 px-3 py-2 text-xs rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 focus:outline-none font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomLink(link.id)}
                        className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors shrink-0"
                        title="Xóa liên kết này"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 text-center text-xs text-neutral-500">
                  Chưa có liên kết tùy chỉnh nào. Nhấn "Thêm liên kết" để bổ sung trang web cá nhân của bạn.
                </div>
              )}
            </div>
          </section>

          {/* ==================== MỤC 4: TRẠNG THÁI YÊU CẦU CREATOR ==================== */}
          <section id="section-creator" className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 md:p-8 shadow-sm space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-neutral-100 dark:border-neutral-800">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Crown className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold">4. Trạng thái yêu cầu Creator</h2>
                <p className="text-xs text-neutral-500">Theo dõi trạng thái nâng cấp tài khoản thành Creator chính thức</p>
              </div>
            </div>

            {user.creatorStatus ? (
              <div className="p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-3">
                <div className="flex items-center gap-3 text-emerald-700 dark:text-emerald-300 font-extrabold text-base">
                  <CheckCircle2 className="w-6 h-6 shrink-0" />
                  <span>Tài khoản đã là Creator chính thức!</span>
                </div>
                <p className="text-xs text-emerald-800 dark:text-emerald-200 leading-relaxed">
                  Bạn đã được Ban quản trị phê duyệt quyền Creator. Bạn có thể tự do sáng tạo và đăng tải các Character Roleplay lên cộng đồng, ghim Character nổi bật, và xem thống kê chi tiết lượt theo dõi.
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 text-xs font-bold rounded-lg flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> Quyền Đăng Character
                  </span>
                  <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 text-xs font-bold rounded-lg flex items-center gap-1.5">
                    <Crown className="w-3.5 h-3.5" /> Trang Creator Cá Nhân
                  </span>
                </div>
              </div>
            ) : requestStatus === 'PENDING' ? (
              <div className="p-6 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-3">
                <div className="flex items-center gap-3 text-amber-700 dark:text-amber-300 font-extrabold text-base">
                  <Clock className="w-6 h-6 shrink-0 animate-spin" />
                  <span>Yêu cầu trở thành Creator đang chờ xét duyệt</span>
                </div>
                <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
                  Yêu cầu nâng cấp Creator của bạn đã được chuyển tới Ban quản trị (Admin). Vui lòng đợi trong thời gian xét duyệt.
                </p>
                {requestReason && (
                  <div className="p-3 rounded-xl bg-amber-100/50 dark:bg-amber-900/30 text-xs text-amber-900 dark:text-amber-100 font-medium">
                    <strong>Nội dung đăng ký:</strong> "{requestReason}"
                  </div>
                )}
              </div>
            ) : requestStatus === 'REJECTED' ? (
              <div className="p-6 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 space-y-4">
                <div className="flex items-center gap-3 text-red-700 dark:text-red-300 font-extrabold text-base">
                  <AlertCircle className="w-6 h-6 shrink-0" />
                  <span>Yêu cầu Creator trước đó đã bị từ chối</span>
                </div>
                {adminNote && (
                  <p className="text-xs text-red-800 dark:text-red-200 font-medium bg-red-100 dark:bg-red-900/40 p-3 rounded-xl">
                    <strong>Lý do từ Ban quản trị:</strong> {adminNote}
                  </p>
                )}
                <p className="text-xs text-neutral-600 dark:text-neutral-400">
                  Bạn có thể cập nhật thông tin và gửi lại yêu cầu mới dưới đây:
                </p>
                <div className="space-y-3">
                  <textarea
                    rows={3}
                    value={requestReason}
                    onChange={e => setRequestReason(e.target.value)}
                    placeholder="Nhập lý do hoặc thông tin cập nhật gửi Ban quản trị..."
                    className="w-full px-4 py-3 text-xs rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none font-medium"
                  />
                  <button
                    type="button"
                    onClick={handleSendCreatorRequest}
                    disabled={submittingRequest}
                    className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold transition-colors disabled:opacity-50 shadow-sm"
                  >
                    <Send className="w-4 h-4" />
                    {submittingRequest ? "Đang gửi yêu cầu..." : "Gửi lại yêu cầu trở thành Creator"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700 space-y-4">
                <div className="space-y-1">
                  <h3 className="font-bold text-sm flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    Đăng ký nâng cấp tài khoản Creator
                  </h3>
                  <p className="text-xs text-neutral-500 leading-relaxed">
                    Theo quy định cộng đồng <strong>Thế Giới Nhập vai AD</strong>, tài khoản Creator sẽ được phép đăng tải Character Roleplay không giới hạn và xuất hiện trên bảng danh sách Creator nổi bật.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-neutral-600 dark:text-neutral-400">
                    Lý do / Mong muốn trở thành Creator (Không bắt buộc):
                  </label>
                  <textarea
                    rows={3}
                    value={requestReason}
                    onChange={e => setRequestReason(e.target.value)}
                    placeholder="Mô tả kinh nghiệm viết Character hoặc thể loại Roleplay yêu thích của bạn..."
                    className="w-full px-4 py-3 text-xs rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none font-medium"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSendCreatorRequest}
                  disabled={submittingRequest}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-black text-xs font-extrabold transition-colors disabled:opacity-50 shadow-sm"
                >
                  <Send className="w-4 h-4" />
                  {submittingRequest ? "Đang gửi yêu cầu..." : "Gửi yêu cầu trở thành Creator cho Quản trị viên (Admin)"}
                </button>
              </div>
            )}
          </section>

          {/* Bottom Action Footer */}
          <div className="flex items-center justify-end gap-3 pt-6 border-t border-neutral-200 dark:border-neutral-800">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
            >
              Hủy
            </button>
            <button 
              type="submit" 
              disabled={saving} 
              className="px-6 py-2.5 rounded-xl bg-black dark:bg-white text-white dark:text-black text-sm font-extrabold hover:opacity-90 transition-opacity disabled:opacity-50 shadow-md flex items-center gap-2"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Đang lưu...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Lưu thay đổi
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
