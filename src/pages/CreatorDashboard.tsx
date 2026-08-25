import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, User as UserIcon, PenTool, MessageSquare, Eye, Heart, Bookmark, 
  Users, Pin, Edit3, Trash2, Plus, Search, Sparkles, Send, CheckCircle2, Lock, 
  Globe, AlertCircle, RefreshCw, ChevronRight, CornerDownRight, X
} from 'lucide-react';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc, addDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { CharacterItem, PromptItem } from '../types';
import CreateCharacterModal from '../components/profile/CreateCharacterModal';
import CreatePromptModal from '../components/profile/CreatePromptModal';
import PromptCard from '../components/PromptCard';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import { getValidAvatar } from '../lib/avatar';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

interface FeedbackItem {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  recipientId: string;
  mode: 'PUBLIC' | 'PRIVATE';
  title?: string;
  content: string;
  createdAt: string;
  replyContent?: string;
  replyCreatedAt?: string;
}

interface FollowerItem {
  id: string;
  followerId: string;
  followerName: string;
  followerAvatar?: string;
  createdAt: string;
}

export default function CreatorDashboard() {
  const { user } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'characters' | 'prompts' | 'feedbacks' | 'followers'>('characters');

  // Content lists
  const [characters, setCharacters] = useState<CharacterItem[]>([]);
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [followers, setFollowers] = useState<FollowerItem[]>([]);

  // Search & Filters
  const [charSearch, setCharSearch] = useState('');
  const [promptSearch, setPromptSearch] = useState('');
  const [feedbackFilter, setFeedbackFilter] = useState<'ALL' | 'PUBLIC' | 'PRIVATE'>('ALL');

  // Stats
  const [totalViews, setTotalViews] = useState(0);
  const [totalLikes, setTotalLikes] = useState(0);
  const [totalSaves, setTotalSaves] = useState(0);

  // Modals & Edit state
  const [isCreateCharacterOpen, setIsCreateCharacterOpen] = useState(false);
  const [characterToEdit, setCharacterToEdit] = useState<CharacterItem | null>(null);

  const [isCreatePromptOpen, setIsCreatePromptOpen] = useState(false);
  const [promptToEdit, setPromptToEdit] = useState<PromptItem | null>(null);

  const [characterToDelete, setCharacterToDelete] = useState<string | null>(null);
  const [promptToDelete, setPromptToDelete] = useState<string | null>(null);

  // Reply Feedback state
  const [replyingFeedbackId, setReplyingFeedbackId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  const [loading, setLoading] = useState(true);

  // Fetch all dashboard data
  const loadDashboardData = async () => {
    if (!user?.id) return;
    setLoading(true);

    try {
      // 1. Fetch Creator's Characters
      const charQ = query(collection(db, 'characters'), where('creatorId', '==', user.id));
      const charSnap = await getDocs(charQ);
      const charList: CharacterItem[] = [];
      let viewsSum = 0;
      let likesSum = 0;
      let savesSum = 0;

      charSnap.docs.forEach(d => {
        const data = d.data();
        if (!data.deletedAt) {
          const item = { id: d.id, ...data } as CharacterItem;
          charList.push(item);
          viewsSum += data.viewsCount || 0;
          likesSum += data.likesCount || 0;
          savesSum += data.savesCount || 0;
        }
      });
      setCharacters(charList);

      // 2. Fetch Creator's Prompts
      const promptQ = query(collection(db, 'prompts'), where('authorId', '==', user.id));
      const promptSnap = await getDocs(promptQ);
      const promptList: PromptItem[] = [];

      promptSnap.docs.forEach(d => {
        const data = d.data();
        if (!data.deletedAt) {
          const item = { id: d.id, ...data } as PromptItem;
          promptList.push(item);
          viewsSum += data.viewsCount || 0;
          savesSum += data.savesCount || 0;
        }
      });
      setPrompts(promptList);

      setTotalViews(viewsSum);
      setTotalLikes(likesSum);
      setTotalSaves(savesSum);

      // 3. Fetch Feedbacks received
      const fbQ = query(collection(db, 'feedbacks'), where('recipientId', '==', user.id));
      const fbSnap = await getDocs(fbQ);
      const fbList: FeedbackItem[] = [];
      fbSnap.docs.forEach(d => {
        const data = d.data();
        if (!data.deletedAt) {
          fbList.push({ id: d.id, ...data } as FeedbackItem);
        }
      });
      fbList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setFeedbacks(fbList);

      // 4. Fetch Followers
      const followQ = query(collection(db, 'follows'), where('targetCreatorId', '==', user.id));
      const followSnap = await getDocs(followQ);
      const followerList: FollowerItem[] = [];

      for (const fDoc of followSnap.docs) {
        const fData = fDoc.data();
        const followerUserDoc = await getDoc(doc(db, 'users', fData.followerId));
        let name = fData.followerName || 'Người dùng';
        let avatar = fData.followerAvatar || '';

        if (followerUserDoc.exists()) {
          const uData = followerUserDoc.data();
          name = uData.displayName || name;
          avatar = uData.avatar || avatar;
        }

        followerList.push({
          id: fDoc.id,
          followerId: fData.followerId,
          followerName: name,
          followerAvatar: avatar,
          createdAt: fData.createdAt || new Date().toISOString()
        });
      }
      followerList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setFollowers(followerList);

    } catch (err) {
      console.error("Lỗi tải dữ liệu Creator Dashboard:", err);
      toast.error("Không thể tải đầy đủ dữ liệu bảng điều khiển.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [user?.id]);

  // Non-creator fallback view
  if (!user?.creatorStatus && user?.role !== 'ADMIN') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <Sparkles className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Bảng điều khiển dành riêng cho Creator</h1>
        <p className="text-neutral-500 dark:text-neutral-400 max-w-md mx-auto mb-6 text-sm">
          Bạn chưa kích hoạt trạng thái Creator. Vui lòng gửi yêu cầu phê duyệt trong trang Hồ sơ cá nhân để bắt đầu sáng tạo và đăng Character!
        </p>
        <Link 
          to="/profile" 
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-black dark:bg-white text-white dark:text-black font-bold text-sm hover:opacity-90 transition-opacity"
        >
          <UserIcon className="w-4 h-4" />
          <span>Đi đến Hồ sơ của tôi</span>
        </Link>
      </div>
    );
  }

  // --- Character Pin / Delete Handlers ---
  const handleTogglePinCharacter = async (char: CharacterItem) => {
    const currentlyPinned = char.isPinned || false;
    if (!currentlyPinned) {
      const pinnedCount = characters.filter(c => c.isPinned).length;
      if (pinnedCount >= 3) {
        toast.error("Bạn chỉ được ghim tối đa 3 Character lên đầu trang!");
        return;
      }
    }

    try {
      await updateDoc(doc(db, 'characters', char.id), {
        isPinned: !currentlyPinned,
        updatedAt: serverTimestamp()
      });
      toast.success(currentlyPinned ? "Đã bỏ ghim Character." : "Đã ghim Character thành công (tối đa 3)!");
      loadDashboardData();
    } catch (err) {
      toast.error("Thao tác ghim thất bại.");
    }
  };

  const handleDeleteCharacter = async (charId: string) => {
    setCharacterToDelete(charId);
  };

  const executeDeleteCharacter = async (charId: string) => {
    try {
      await deleteDoc(doc(db, 'characters', charId));
      toast.success("Đã xóa hoàn toàn Character khỏi hệ thống!");
      loadDashboardData();
    } catch (err) {
      toast.error("Xoá Character thất bại.");
    }
  };

  // --- Prompt Pin / Delete Handlers ---
  const handleTogglePinPrompt = async (promptItem: PromptItem) => {
    const currentlyPinned = promptItem.isPinned || promptItem.pinned || false;
    if (!currentlyPinned) {
      const pinnedCount = prompts.filter(p => p.isPinned || p.pinned).length;
      if (pinnedCount >= 3) {
        toast.error("Bạn chỉ được ghim tối đa 3 Prompt!");
        return;
      }
    }

    try {
      await updateDoc(doc(db, 'prompts', promptItem.id), {
        isPinned: !currentlyPinned,
        pinned: !currentlyPinned,
        updatedAt: serverTimestamp()
      });
      toast.success(currentlyPinned ? "Đã bỏ ghim Prompt." : "Đã ghim Prompt thành công (tối đa 3)!");
      loadDashboardData();
    } catch (err) {
      toast.error("Thao tác ghim thất bại.");
    }
  };

  const handleDeletePrompt = async (promptId: string) => {
    setPromptToDelete(promptId);
  };

  const executeDeletePrompt = async (promptId: string) => {
    try {
      await deleteDoc(doc(db, 'prompts', promptId));
      toast.success("Đã xóa hoàn toàn Prompt khỏi hệ thống!");
      loadDashboardData();
    } catch (err) {
      toast.error("Xoá Prompt thất bại.");
    }
  };

  // --- Feedback Reply & Delete Handlers ---
  const handleReplyFeedback = async (feedbackId: string) => {
    if (!replyText.trim()) {
      toast.error("Vui lòng nhập nội dung phản hồi.");
      return;
    }
    setSubmittingReply(true);
    try {
      await updateDoc(doc(db, 'feedbacks', feedbackId), {
        replyContent: replyText.trim(),
        replyCreatedAt: new Date().toISOString()
      });

      toast.success("Đã gửi trả lời Feedback!");
      setReplyingFeedbackId(null);
      setReplyText('');
      loadDashboardData();
    } catch (err) {
      toast.error("Gửi trả lời thất bại.");
    } finally {
      setSubmittingReply(false);
    }
  };

  const [deleteFeedbackItem, setDeleteFeedbackItem] = useState<string | null>(null);

  const handleDeleteFeedback = async () => {
    if (!deleteFeedbackItem) return;
    try {
      await updateDoc(doc(db, 'feedbacks', deleteFeedbackItem), {
        deletedAt: new Date().toISOString(),
        deletedBy: user?.id
      });
      toast.success("Đã xóa Feedback thành công!");
      loadDashboardData();
    } catch (err) {
      console.error("Lỗi khi xoá doc feedback:", err);
      toast.error("Xoá Feedback thất bại.");
    } finally {
      setDeleteFeedbackItem(null);
    }
  };

  // Filtered lists
  const filteredCharacters = characters.filter(c => 
    c.name.toLowerCase().includes(charSearch.toLowerCase()) || 
    c.slogan.toLowerCase().includes(charSearch.toLowerCase())
  );

  const filteredPrompts = prompts.filter(p => 
    p.name.toLowerCase().includes(promptSearch.toLowerCase()) || 
    p.purpose.toLowerCase().includes(promptSearch.toLowerCase())
  );

  const filteredFeedbacks = feedbacks.filter(fb => {
    if (feedbackFilter === 'PUBLIC') return fb.mode === 'PUBLIC';
    if (feedbackFilter === 'PRIVATE') return fb.mode === 'PRIVATE';
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Top Header Banner */}
      <div className="bg-gradient-to-r from-neutral-900 via-neutral-800 to-black text-white p-6 md:p-8 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-neutral-800">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-amber-500/20 text-amber-400 text-xs font-bold rounded-full border border-amber-500/30 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              Creator Center
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-3">
            Bảng Điều Khiển Creator
          </h1>
          <p className="text-neutral-400 text-xs md:text-sm max-w-xl">
            Quản lý Characters, Prompts, Feedback và theo dõi toàn bộ hiệu suất tương tác từ cộng đồng.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            onClick={() => {
              setCharacterToEdit(null);
              setIsCreateCharacterOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-black text-xs font-bold hover:bg-neutral-200 transition-colors shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>Đăng Character</span>
          </button>

          <button
            onClick={() => {
              setPromptToEdit(null);
              setIsCreatePromptOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold border border-neutral-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Đăng Prompt</span>
          </button>
        </div>
      </div>

      {/* Overview Stat Cards Grid (Thống kê - 6 thẻ) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total Views */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-medium">Tổng Lượt Xem</span>
            <Eye className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-xl md:text-2xl font-black">{totalViews.toLocaleString()}</div>
        </div>

        {/* Total Likes */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-medium">Tổng Lượt Thích</span>
            <Heart className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-xl md:text-2xl font-black">{totalLikes.toLocaleString()}</div>
        </div>

        {/* Total Saves */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-medium">Tổng Lượt Lưu</span>
            <Bookmark className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl md:text-2xl font-black">{totalSaves.toLocaleString()}</div>
        </div>

        {/* Total Characters */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-medium">Character</span>
            <UserIcon className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-xl md:text-2xl font-black">{characters.length}</div>
        </div>

        {/* Total Prompts */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-medium">Prompt</span>
            <PenTool className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl md:text-2xl font-black">{prompts.length}</div>
        </div>

        {/* Followers */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-medium">Người Theo Dõi</span>
            <Users className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-xl md:text-2xl font-black">{followers.length}</div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-neutral-800 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setActiveTab('characters')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'characters'
              ? 'border-black dark:border-white text-black dark:text-white'
              : 'border-transparent text-neutral-500 hover:text-black dark:hover:text-white'
          }`}
        >
          <UserIcon className="w-4 h-4" />
          <span>Quản lý Character</span>
          <span className="px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-xs">
            {characters.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('prompts')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'prompts'
              ? 'border-black dark:border-white text-black dark:text-white'
              : 'border-transparent text-neutral-500 hover:text-black dark:hover:text-white'
          }`}
        >
          <PenTool className="w-4 h-4" />
          <span>Quản lý Prompt</span>
          <span className="px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-xs">
            {prompts.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('feedbacks')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'feedbacks'
              ? 'border-black dark:border-white text-black dark:text-white'
              : 'border-transparent text-neutral-500 hover:text-black dark:hover:text-white'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Quản lý Feedback</span>
          <span className="px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-xs">
            {feedbacks.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('followers')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'followers'
              ? 'border-black dark:border-white text-black dark:text-white'
              : 'border-transparent text-neutral-500 hover:text-black dark:hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Người Theo Dõi Mới</span>
          <span className="px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-xs">
            {followers.length}
          </span>
        </button>
      </div>

      {/* --- TAB CONTENT 1: QUẢN LÝ CHARACTER --- */}
      {activeTab === 'characters' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input 
                type="text"
                placeholder="Tìm kiếm Character của bạn..."
                value={charSearch}
                onChange={e => setCharSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
              />
            </div>
            <div className="text-xs text-neutral-500 flex items-center gap-2">
              <Pin className="w-3.5 h-3.5 text-amber-500" />
              Đã ghim: <span className="font-bold text-black dark:text-white">{characters.filter(c => c.isPinned).length}/3</span> (Tối đa 3 Character)
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12 text-xs text-neutral-400">Đang tải danh sách Character...</div>
          ) : filteredCharacters.length === 0 ? (
            <div className="text-center py-16 bg-neutral-50 dark:bg-neutral-900/50 rounded-2xl border border-dashed border-neutral-200 dark:border-neutral-800">
              <UserIcon className="w-10 h-10 text-neutral-400 mx-auto mb-2 opacity-50" />
              <p className="font-semibold text-sm">Chưa có Character nào</p>
              <p className="text-xs text-neutral-500 mb-4">Hãy tạo Character đầu tiên để chia sẻ với cộng đồng!</p>
              <button
                onClick={() => {
                  setCharacterToEdit(null);
                  setIsCreateCharacterOpen(true);
                }}
                className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-bold"
              >
                + Tạo Character ngay
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCharacters.map(char => (
                <div 
                  key={char.id}
                  className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 relative group flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow"
                >
                  <div>
                    {/* Header line: Avatar, name, Pinned Badge */}
                    <div className="flex items-start gap-3 mb-3">
                      <img 
                        src={getValidAvatar(char.avatar)}
                        alt={char.name}
                        className="w-12 h-12 rounded-full object-cover shrink-0 border border-neutral-200 dark:border-neutral-700"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-bold text-base truncate">{char.name}</h3>
                          {char.isPinned && (
                            <span className="px-2 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-md text-[10px] font-extrabold shrink-0 flex items-center gap-1">
                              <Pin className="w-2.5 h-2.5 fill-amber-500" /> Ghim
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-1">{char.gender}</p>
                      </div>
                    </div>

                    <p className="text-xs text-neutral-600 dark:text-neutral-300 line-clamp-2 mb-4">
                      "{char.slogan}"
                    </p>

                    {/* Tags */}
                    {char.tags && char.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-4">
                        {char.tags.map(t => (
                          <span key={t} className="px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-[10px] rounded-md font-medium text-neutral-500">
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Metrics & Actions */}
                  <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs text-neutral-400">
                      <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {char.viewsCount || 0}</span>
                      <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5" /> {char.likesCount || 0}</span>
                      <span className="flex items-center gap-1"><Bookmark className="w-3.5 h-3.5" /> {char.savesCount || 0}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleTogglePinCharacter(char)}
                        title={char.isPinned ? "Bỏ ghim" : "Ghim lên đầu (Tối đa 3)"}
                        className={`p-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                          char.isPinned 
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400' 
                            : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:text-black dark:hover:text-white'
                        }`}
                      >
                        <Pin className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => {
                          setCharacterToEdit(char);
                          setIsCreateCharacterOpen(true);
                        }}
                        title="Chỉnh sửa"
                        className="p-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:text-black dark:hover:text-white transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDeleteCharacter(char.id)}
                        title="Xoá"
                        className="p-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* --- TAB CONTENT 2: QUẢN LÝ PROMPT --- */}
      {activeTab === 'prompts' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input 
                type="text"
                placeholder="Tìm kiếm Prompt của bạn..."
                value={promptSearch}
                onChange={e => setPromptSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
              />
            </div>
            <div className="text-xs text-neutral-500 flex items-center gap-2">
              <Pin className="w-3.5 h-3.5 text-amber-500" />
              Đã ghim: <span className="font-bold text-black dark:text-white">{prompts.filter(p => p.isPinned || p.pinned).length}/3</span> (Tối đa 3 Prompt)
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12 text-xs text-neutral-400">Đang tải danh sách Prompt...</div>
          ) : filteredPrompts.length === 0 ? (
            <div className="text-center py-16 bg-neutral-50 dark:bg-neutral-900/50 rounded-2xl border border-dashed border-neutral-200 dark:border-neutral-800">
              <PenTool className="w-10 h-10 text-neutral-400 mx-auto mb-2 opacity-50" />
              <p className="font-semibold text-sm">Chưa có Prompt nào</p>
              <p className="text-xs text-neutral-500 mb-4">Hãy tạo Prompt đầu tiên để chia sẻ với cộng đồng!</p>
              <button
                onClick={() => {
                  setPromptToEdit(null);
                  setIsCreatePromptOpen(true);
                }}
                className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-bold"
              >
                + Tạo Prompt ngay
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredPrompts.map(p => (
                <PromptCard
                  key={p.id}
                  prompt={p}
                  isOwner={true}
                  onEdit={(item) => {
                    setPromptToEdit(item);
                    setIsCreatePromptOpen(true);
                  }}
                  onDelete={handleDeletePrompt}
                  onPin={handleTogglePinPrompt}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* --- TAB CONTENT 3: QUẢN LÝ FEEDBACK --- */}
      {activeTab === 'feedbacks' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-base">Feedback Đã Nhận</h2>
            <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setFeedbackFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${feedbackFilter === 'ALL' ? 'bg-white dark:bg-neutral-900 shadow-sm' : 'text-neutral-500'}`}
              >
                Tất cả ({feedbacks.length})
              </button>
              <button
                onClick={() => setFeedbackFilter('PUBLIC')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${feedbackFilter === 'PUBLIC' ? 'bg-white dark:bg-neutral-900 shadow-sm' : 'text-neutral-500'}`}
              >
                Công khai ({feedbacks.filter(f => f.mode === 'PUBLIC').length})
              </button>
              <button
                onClick={() => setFeedbackFilter('PRIVATE')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${feedbackFilter === 'PRIVATE' ? 'bg-white dark:bg-neutral-900 shadow-sm' : 'text-neutral-500'}`}
              >
                Riêng tư ({feedbacks.filter(f => f.mode === 'PRIVATE').length})
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12 text-xs text-neutral-400">Đang tải Feedback...</div>
          ) : filteredFeedbacks.length === 0 ? (
            <div className="text-center py-16 bg-neutral-50 dark:bg-neutral-900/50 rounded-2xl border border-dashed border-neutral-200 dark:border-neutral-800">
              <MessageSquare className="w-10 h-10 text-neutral-400 mx-auto mb-2 opacity-50" />
              <p className="font-semibold text-sm">Chưa có Feedback nào</p>
              <p className="text-xs text-neutral-500">Các Feedback từ người dùng khác dành cho bạn sẽ hiển thị tại đây.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredFeedbacks.map(fb => (
                <div 
                  key={fb.id}
                  className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 space-y-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <img 
                        src={getValidAvatar(fb.senderAvatar)} 
                        alt={fb.senderName}
                        className="w-10 h-10 rounded-full object-cover shrink-0 border border-neutral-200 dark:border-neutral-700" 
                      />
                      <div>
                        <div className="font-bold text-sm flex items-center gap-2">
                          {fb.senderName}
                          {fb.mode === 'PRIVATE' ? (
                            <span className="px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700 text-[10px] font-bold rounded-md flex items-center gap-1">
                              <Lock className="w-3 h-3" /> Riêng tư
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold rounded-md flex items-center gap-1">
                              <Globe className="w-3 h-3" /> Công khai
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-neutral-400 mt-0.5">
                          {new Date(fb.createdAt).toLocaleString('vi-VN')}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setDeleteFeedbackItem(fb.id)}
                      title="Xoá Feedback"
                      className="p-1.5 text-neutral-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {fb.title && (
                    <h4 className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                      {fb.title}
                    </h4>
                  )}

                  <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed bg-neutral-50 dark:bg-neutral-800/40 p-3 rounded-xl border border-neutral-100 dark:border-neutral-800/60">
                    {fb.content}
                  </p>

                  {/* Reply Section */}
                  {fb.replyContent ? (
                    <div className="pl-4 border-l-2 border-amber-500 space-y-1 mt-3">
                      <div className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <CornerDownRight className="w-3.5 h-3.5" /> Phản hồi từ bạn (Creator):
                      </div>
                      <p className="text-xs text-neutral-600 dark:text-neutral-300 bg-amber-500/5 p-2.5 rounded-lg border border-amber-500/10">
                        {fb.replyContent}
                      </p>
                    </div>
                  ) : replyingFeedbackId === fb.id ? (
                    <div className="mt-3 space-y-2 pl-2">
                      <textarea
                        rows={2}
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        placeholder="Nhập nội dung phản hồi cho người dùng..."
                        className="w-full px-3 py-2 text-xs rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white resize-none"
                      />
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => setReplyingFeedbackId(null)}
                          className="px-3 py-1.5 text-xs text-neutral-500 hover:text-black dark:hover:text-white"
                        >
                          Hủy
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReplyFeedback(fb.id)}
                          disabled={submittingReply}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-bold disabled:opacity-50"
                        >
                          <Send className="w-3.5 h-3.5" />
                          Gửi trả lời
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setReplyingFeedbackId(fb.id);
                        setReplyText('');
                      }}
                      className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 pt-1"
                    >
                      <CornerDownRight className="w-3.5 h-3.5" />
                      Trả lời Feedback này
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* --- TAB CONTENT 4: NGƯỜI THEO DÕI MỚI --- */}
      {activeTab === 'followers' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-base">Danh Sách Người Theo Dõi ({followers.length})</h2>
          </div>

          {loading ? (
            <div className="text-center py-12 text-xs text-neutral-400">Đang tải danh sách...</div>
          ) : followers.length === 0 ? (
            <div className="text-center py-16 bg-neutral-50 dark:bg-neutral-900/50 rounded-2xl border border-dashed border-neutral-200 dark:border-neutral-800">
              <Users className="w-10 h-10 text-neutral-400 mx-auto mb-2 opacity-50" />
              <p className="font-semibold text-sm">Chưa có người theo dõi nào</p>
              <p className="text-xs text-neutral-500">Đăng nhiều Character và Prompt chất lượng để thu hút cộng đồng theo dõi bạn!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {followers.map(f => (
                <div 
                  key={f.id}
                  className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 flex items-center gap-3 shadow-sm"
                >
                  <img 
                    src={getValidAvatar(f.followerAvatar)} 
                    alt={f.followerName}
                    className="w-11 h-11 rounded-full object-cover shrink-0 border border-neutral-200 dark:border-neutral-700" 
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-sm truncate">{f.followerName}</h4>
                    <p className="text-[10px] text-neutral-400">
                      Theo dõi: {new Date(f.createdAt).toLocaleDateString('vi-VN')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals for Create/Edit Character and Prompt */}
      {isCreateCharacterOpen && (
        <CreateCharacterModal
          isOpen={isCreateCharacterOpen}
          onClose={() => {
            setIsCreateCharacterOpen(false);
            setCharacterToEdit(null);
          }}
          onSuccess={() => {
            loadDashboardData();
          }}
          characterToEdit={characterToEdit}
        />
      )}

      {isCreatePromptOpen && (
        <CreatePromptModal
          isOpen={isCreatePromptOpen}
          onClose={() => {
            setIsCreatePromptOpen(false);
            setPromptToEdit(null);
          }}
          onSuccess={() => {
            loadDashboardData();
          }}
          promptToEdit={promptToEdit}
        />
      )}

      {/* Delete Feedback Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deleteFeedbackItem !== null}
        onClose={() => setDeleteFeedbackItem(null)}
        title="Xóa Feedback?"
        description="Bạn có chắc chắn muốn xóa Feedback này không? Hành động này sẽ gỡ Feedback khỏi danh sách của bạn."
        confirmText="Xác nhận xóa"
        onConfirm={handleDeleteFeedback}
      />

      {/* Custom Delete Confirmation Modals */}
      <DeleteConfirmModal
        isOpen={characterToDelete !== null}
        onClose={() => setCharacterToDelete(null)}
        title="Xóa hoàn toàn Character?"
        description="Bạn có chắc chắn muốn xóa Character này không? Nội dung sẽ bị xóa hoàn toàn khỏi hệ thống và không thể hoàn tác."
        confirmText="Xác nhận xóa"
        onConfirm={async () => {
          if (!characterToDelete) return;
          const targetId = characterToDelete;
          setCharacterToDelete(null);
          await executeDeleteCharacter(targetId);
        }}
      />

      <DeleteConfirmModal
        isOpen={promptToDelete !== null}
        onClose={() => setPromptToDelete(null)}
        title="Xoá Prompt?"
        description="Bạn có chắc chắn muốn xóa hoàn toàn Prompt này không? Hành động này không thể hoàn tác và Prompt sẽ biến mất ngay lập tức khỏi hệ thống."
        onConfirm={async () => {
          if (!promptToDelete) return;
          const targetId = promptToDelete;
          setPromptToDelete(null);
          await executeDeletePrompt(targetId);
        }}
      />
    </div>
  );
}
