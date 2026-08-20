import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  Sparkles, UserCheck, UserPlus, Users, BookOpen, PenTool, ArrowLeft, Flag, AlertCircle, RefreshCw,
  Facebook, Instagram, Music, MessageSquare, Share2
} from 'lucide-react';
import { doc, getDoc, collection, query, where, getDocs, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { CreatorItem, CharacterItem, PromptItem } from '../types';
import { useSeo } from '../hooks/useSeo';
import CharacterCard from '../components/CharacterCard';
import PromptCard from '../components/PromptCard';
import ReportModal from '../components/ReportModal';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import UserBadge from '../components/UserBadge';
import DisplayId from '../components/DisplayId';
import ShareModal from '../components/ShareModal';
import toast from 'react-hot-toast';
import { getValidAvatar } from '../lib/avatar';
import { checkIsFollowing, toggleFollow, reconcileFollowerCount } from '../lib/followService';

export default function CreatorDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [creator, setCreator] = useState<CreatorItem | null>(null);
  const [characters, setCharacters] = useState<CharacterItem[]>([]);
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<'CHARACTERS' | 'PROMPTS'>('CHARACTERS');

  const [isReportOpen, setIsReportOpen] = useState(false);
  const [promptToDelete, setPromptToDelete] = useState<string | null>(null);
  const [isShareOpen, setIsShareOpen] = useState(false);

  useSeo({
    title: creator?.displayName,
    description: creator?.bio,
    image: creator?.avatar,
    type: 'profile'
  });

  const fetchCreatorData = async () => {
    if (!id) return;
    setLoading(true);
    setError(false);

    try {
      // 1. Fetch user doc
      const userRef = doc(db, 'users', id);
      const userSnap = await getDoc(userRef);

      // Allow any user who is not deleted
      if (!userSnap.exists()) {
        setError(true);
        return;
      }

      const userData = userSnap.data();
      if (userData.deletedAt) {
        setError(true);
        return;
      }

      const cItem = { id: userSnap.id, ...userData } as CreatorItem;
      setCreator(cItem);

      // Reconcile and get exact database follower count
      const exactFollowerCount = await reconcileFollowerCount(id);
      setFollowerCount(exactFollowerCount);

      document.title = `${cItem.displayName} - Creator Profile | Thế giới nhập vai_AD`;

      // 2. Fetch Creator's characters
      const qChar = query(collection(db, 'characters'), where('creatorId', '==', id));
      const snapChar = await getDocs(qChar);
      const charList: CharacterItem[] = [];
      let totalLikesReceived = 0;
      let totalSavesReceived = 0;
      let totalViewsReceived = 0;

      snapChar.docs.forEach(d => {
        const data = d.data();
        if (!data.deletedAt) {
          const item = { id: d.id, ...data } as CharacterItem;
          charList.push(item);
          totalLikesReceived += Number(data.likesCount || 0);
          totalSavesReceived += Number(data.savesCount || 0);
          totalViewsReceived += Number(data.viewsCount || 0);
        }
      });
      // Sort pinned first, then newest
      charList.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });
      setCharacters(charList);
      
      // Set default tab to PROMPTS if no characters and it's a regular user
      if (charList.length === 0) {
        setActiveTab('PROMPTS');
      }

      // Update creator object with fresh sums for UserBadge and SEO
      setCreator(prev => prev ? { 
        ...prev, 
        totalLikes: totalLikesReceived, 
        totalSaves: totalSavesReceived,
        viewsCount: totalViewsReceived
      } : null);

      // 3. Fetch Creator's prompts
      const qPrompt = query(collection(db, 'prompts'), where('authorId', '==', id));
      const snapPrompt = await getDocs(qPrompt);
      const promptList: PromptItem[] = [];
      snapPrompt.docs.forEach(d => {
        const data = d.data();
        if (!data.deletedAt) promptList.push({ id: d.id, ...data } as PromptItem);
      });
      // Sort pinned first, then newest
      promptList.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });
      setPrompts(promptList);

    } catch (err) {
      console.error("Fetch creator error:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  // Check follow status
  useEffect(() => {
    if (!user?.id || !id || user.id === id) return;

    const checkFollow = async () => {
      try {
        const hasFollow = await checkIsFollowing(user.id, id);
        setIsFollowing(hasFollow);
      } catch (e) {
        console.error("Check follow error:", e);
      }
    };

    checkFollow();
  }, [user?.id, id]);

  useEffect(() => {
    fetchCreatorData();
  }, [id]);

  const handleToggleFollow = async () => {
    if (!user) {
      toast.error("Vui lòng đăng nhập để theo dõi Creator!");
      return;
    }
    if (!creator || user.id === creator.id) {
      toast.error("Bạn không thể tự theo dõi chính mình!");
      return;
    }

    setFollowLoading(true);
    try {
      const res = await toggleFollow(user.id, creator.id, {
        displayName: user.displayName,
        avatar: user.photoURL || user.avatar
      });

      if (res.success) {
        setIsFollowing(res.following);
        setFollowerCount(res.followerCount);
        toast.success(res.message || (res.following ? `Đã theo dõi ${creator.displayName}` : `Đã hủy theo dõi ${creator.displayName}`));
      } else {
        toast.error(res.message || "Thao tác thất bại.");
      }
    } catch (e) {
      console.error("Toggle follow error:", e);
      toast.error("Thao tác thất bại.");
    } finally {
      setFollowLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12 space-y-6">
        <div className="h-8 w-32 bg-neutral-200 dark:bg-neutral-800 rounded-xl animate-pulse" />
        <div className="h-64 bg-neutral-100 dark:bg-neutral-800 rounded-3xl animate-pulse" />
      </div>
    );
  }

  if (error || !creator) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-16 h-16 bg-red-50 dark:bg-red-950/40 text-red-500 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
          Nội dung này không còn khả dụng
        </h2>
        <p className="text-neutral-500 text-sm max-w-md mx-auto">
          Trang Creator này không tồn tại hoặc đã bị khóa.
        </p>
        <button
          onClick={() => navigate('/creators')}
          className="mt-4 px-6 py-2.5 rounded-2xl bg-black dark:bg-white text-white dark:text-black font-bold text-sm hover:opacity-90 transition-opacity"
        >
          Khám phá Creator khác
        </button>
      </div>
    );
  }

  const isSelf = user?.id === creator.id;
  const pinnedCharacters = characters.filter(c => c.pinned);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 animate-fade-in">
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-xs font-bold text-neutral-500 hover:text-black dark:hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Quay lại</span>
      </button>

      {/* Creator Profile Hero Banner */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 md:p-8 shadow-sm space-y-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <img 
              src={getValidAvatar(creator.avatar)} 
              alt={creator.displayName}
              className="w-20 h-20 md:w-24 md:h-24 rounded-full object-cover border-2 border-neutral-200 dark:border-neutral-700 shrink-0 shadow-md"
            />
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-extrabold text-neutral-900 dark:text-neutral-100 flex items-center gap-2 flex-wrap">
                  <span>{creator.displayName}</span>
                  <UserBadge 
                    subject={{ 
                      creatorStatus: creator.creatorStatus,
                      role: creator.role,
                      createdAt: creator.createdAt,
                      characterCount: characters.length, 
                      promptCount: prompts.length,
                      totalLikes: creator.totalLikes || 0,
                      totalSaves: creator.totalSaves || 0,
                      viewsCount: creator.viewsCount || 0
                    }} 
                    size="md"
                  />
                  {creator.creatorStatus && (
                    <Sparkles className="w-5 h-5 text-amber-500 fill-amber-500 shrink-0" />
                  )}
                </h1>
              </div>
              {creator.role !== 'ADMIN' && creator.role !== 'MODERATOR' && (
                <div className="mt-1 mb-2">
                  <DisplayId type="creator" numericId={creator.numericId} />
                </div>
              )}

              <p className="text-sm text-neutral-600 dark:text-neutral-400 max-w-xl leading-relaxed">
                {creator.bio || (creator.creatorStatus 
                  ? "Tác giả sáng tạo nhân vật Roleplay và Prompt trên Google AI Studio." 
                  : "Thành viên cộng đồng Thế giới nhập vai_AD.")}
              </p>

              {/* Social links */}
              {creator.socialLinks && (creator.socialLinks.facebook || creator.socialLinks.instagram || creator.socialLinks.tiktok || creator.socialLinks.discord) && (
                <div className="flex items-center gap-2 pt-2 flex-wrap">
                  {creator.socialLinks.facebook && (
                    <a 
                      href={creator.socialLinks.facebook.startsWith('http') ? creator.socialLinks.facebook : `https://${creator.socialLinks.facebook}`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="p-2 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-blue-500 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                      title="Facebook"
                    >
                      <Facebook className="w-4 h-4" />
                    </a>
                  )}
                  {creator.socialLinks.instagram && (
                    <a 
                      href={creator.socialLinks.instagram.startsWith('http') ? creator.socialLinks.instagram : `https://${creator.socialLinks.instagram}`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="p-2 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-pink-500 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                      title="Instagram"
                    >
                      <Instagram className="w-4 h-4" />
                    </a>
                  )}
                  {creator.socialLinks.tiktok && (
                    <a 
                      href={creator.socialLinks.tiktok.startsWith('http') ? creator.socialLinks.tiktok : `https://${creator.socialLinks.tiktok}`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="p-2 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                      title="TikTok"
                    >
                      <Music className="w-4 h-4" />
                    </a>
                  )}
                  {creator.socialLinks.discord && (
                    <a 
                      href={creator.socialLinks.discord.startsWith('http') ? creator.socialLinks.discord : `https://${creator.socialLinks.discord}`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="p-2 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-indigo-500 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                      title="Discord"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
            {creator.role !== 'ADMIN' && creator.role !== 'MODERATOR' && (
              <button
                onClick={() => setIsShareOpen(true)}
                className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 transition-colors flex items-center justify-center gap-1.5 text-xs font-bold"
                title="Chia sẻ hồ sơ"
              >
                <Share2 className="w-4 h-4 text-amber-500" />
                <span className="hidden sm:inline">Chia sẻ</span>
              </button>
            )}

            {!isSelf && (
              <button
                onClick={handleToggleFollow}
                disabled={followLoading}
                className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                  isFollowing
                    ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200'
                    : 'bg-black dark:bg-white text-white dark:text-black hover:opacity-90 shadow-sm'
                }`}
              >
                {isFollowing ? (
                  <>
                    <UserCheck className="w-4 h-4 text-emerald-500" />
                    <span>Đang theo dõi</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Theo dõi Creator</span>
                  </>
                )}
              </button>
            )}

            {!isSelf && (
              <button
                onClick={() => setIsReportOpen(true)}
                className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:text-red-500 transition-colors"
                title="Báo cáo"
              >
                <Flag className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Creator Statistics Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl border border-neutral-100 dark:border-neutral-800 text-center">
          <div>
            <div className="text-xs text-neutral-500 font-medium">Characters</div>
            <div className="text-lg font-extrabold text-neutral-900 dark:text-neutral-100 mt-0.5">{characters.length}</div>
          </div>
          <div>
            <div className="text-xs text-neutral-500 font-medium">Prompts</div>
            <div className="text-lg font-extrabold text-neutral-900 dark:text-neutral-100 mt-0.5">{prompts.length}</div>
          </div>
          <div>
            <div className="text-xs text-neutral-500 font-medium">Lượt thích</div>
            <div className="text-lg font-extrabold text-neutral-900 dark:text-neutral-100 mt-0.5">{creator.totalLikes || 0}</div>
          </div>
          <div>
            <div className="text-xs text-neutral-500 font-medium">Lượt lưu</div>
            <div className="text-lg font-extrabold text-neutral-900 dark:text-neutral-100 mt-0.5">{creator.totalSaves || 0}</div>
          </div>
          <div className="col-span-2 md:col-span-1">
            <div className="text-xs text-neutral-500 font-medium">Người theo dõi</div>
            <div className="text-lg font-extrabold text-neutral-900 dark:text-neutral-100 mt-0.5">{followerCount}</div>
          </div>
        </div>
      </div>

      {/* Pinned Characters Section (if any) */}
      {pinnedCharacters.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-extrabold text-base text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500 fill-amber-500" />
            <span>Character Nổi Bật Được Ghim ({pinnedCharacters.length}/3)</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {pinnedCharacters.map(c => (
              <CharacterCard key={c.id} character={c} onUpdate={fetchCreatorData} />
            ))}
          </div>
        </div>
      )}

      {/* Tabs Selection: Characters vs Prompts */}
      <div className="border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-6">
        <button
          onClick={() => setActiveTab('CHARACTERS')}
          className={`pb-3 text-sm font-extrabold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'CHARACTERS'
              ? 'border-black dark:border-white text-black dark:text-white'
              : 'border-transparent text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Danh Sách Character ({characters.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('PROMPTS')}
          className={`pb-3 text-sm font-extrabold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'PROMPTS'
              ? 'border-black dark:border-white text-black dark:text-white'
              : 'border-transparent text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
          }`}
        >
          <PenTool className="w-4 h-4" />
          <span>Danh Sách Prompt ({prompts.length})</span>
        </button>
      </div>

      {/* Tab Content Display */}
      {activeTab === 'CHARACTERS' ? (
        characters.length === 0 ? (
          <div className="py-16 text-center bg-white dark:bg-neutral-900 rounded-3xl border border-dashed border-neutral-200 dark:border-neutral-800 p-8 space-y-2">
            <p className="text-neutral-500 text-sm">Creator chưa đăng Character nào.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {characters.map(c => (
              <CharacterCard key={c.id} character={c} onUpdate={fetchCreatorData} />
            ))}
          </div>
        )
      ) : (
        prompts.length === 0 ? (
          <div className="py-16 text-center bg-white dark:bg-neutral-900 rounded-3xl border border-dashed border-neutral-200 dark:border-neutral-800 p-8 space-y-2">
            <p className="text-neutral-500 text-sm">Creator chưa đăng Prompt nào.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {prompts.map(p => (
              <PromptCard 
                key={p.id} 
                prompt={p} 
                isOwner={user?.id === p.authorId || user?.role === 'ADMIN'} 
                onDelete={(promptId) => setPromptToDelete(promptId)}
              />
            ))}
          </div>
        )
      )}

      {/* Report Modal */}
      <ReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        targetType="CREATOR"
        targetId={creator.id}
        targetName={creator.displayName}
      />

      {/* Delete Prompt Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={promptToDelete !== null}
        onClose={() => setPromptToDelete(null)}
        title="Xóa hoàn toàn Prompt?"
        description="Bạn có chắc chắn muốn xóa Prompt này không? Nội dung sẽ bị xóa hoàn toàn khỏi hệ thống và không thể hoàn tác."
        confirmText="Xác nhận xóa"
        onConfirm={async () => {
          if (!promptToDelete) return;
          try {
            await deleteDoc(doc(db, 'prompts', promptToDelete));
            toast.success("Đã xóa hoàn toàn Prompt khỏi hệ thống.");
            setPromptToDelete(null);
            fetchCreatorData();
          } catch (e) {
            toast.error("Không thể xóa Prompt.");
          }
        }}
      />

      {/* Share Modal */}
      {creator && creator.role !== 'ADMIN' && creator.role !== 'MODERATOR' && (
        <ShareModal
          isOpen={isShareOpen}
          onClose={() => setIsShareOpen(false)}
          type={creator.creatorStatus ? 'CREATOR' : 'USER'}
          targetId={creator.numericId || creator.id}
          title={creator.displayName}
          avatar={creator.avatar}
          description={creator.bio}
        />
      )}
    </div>
  );
}
