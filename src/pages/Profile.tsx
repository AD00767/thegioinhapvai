import React, { useState, useEffect } from 'react';
import { 
  User as UserIcon, Settings, Plus, Pin, Heart, Bookmark, Users, UserCheck, 
  Sparkles, PenTool, ExternalLink, Edit3, Trash2, Copy, Check, Facebook, Instagram, Music, MessageSquare, ShieldAlert, ShieldCheck, X, Globe, Share2
} from 'lucide-react';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc, getDoc, addDoc, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { CharacterItem, PromptItem } from '../types';
import EditProfileModal from '../components/profile/EditProfileModal';
import CreateCharacterModal from '../components/profile/CreateCharacterModal';
import CreatePromptModal from '../components/profile/CreatePromptModal';
import FollowersModal from '../components/profile/FollowersModal';
import AdminApprovalSection from '../components/profile/AdminApprovalSection';
import PromptCard from '../components/PromptCard';
import UserBadge from '../components/UserBadge';
import ProfileCharacterCard from '../components/profile/ProfileCharacterCard';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import AppealModal from '../components/AppealModal';
import DisplayId from '../components/DisplayId';
import ShareModal from '../components/ShareModal';
import { getValidAvatar } from '../lib/avatar';
import toast from 'react-hot-toast';
import { reconcileFollowerCount } from '../lib/followService';
import { Link } from 'react-router-dom';

export default function Profile() {
  const { user } = useAuthStore();


  const [activeTab, setActiveTab] = useState<'characters' | 'prompts' | 'liked' | 'bookmarks' | 'appeals'>('characters');

  // Modals state
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isCreateCharacterOpen, setIsCreateCharacterOpen] = useState(false);
  const [isCreatePromptOpen, setIsCreatePromptOpen] = useState(false);
  const [isCreatorRequestModalOpen, setIsCreatorRequestModalOpen] = useState(false);
  const [isAppealModalOpen, setIsAppealModalOpen] = useState(false);
  const [characterToEdit, setCharacterToEdit] = useState<CharacterItem | null>(null);
  const [promptToEdit, setPromptToEdit] = useState<PromptItem | null>(null);
  const [characterToDelete, setCharacterToDelete] = useState<string | null>(null);
  const [promptToDelete, setPromptToDelete] = useState<string | null>(null);
  const [isShareOpen, setIsShareOpen] = useState(false);

  // Followers / Following Modal
  const [followModalTitle, setFollowModalTitle] = useState('');
  const [followModalUsers, setFollowModalUsers] = useState<any[]>([]);
  const [isFollowModalOpen, setIsFollowModalOpen] = useState(false);
  const [loadingFollows, setLoadingFollows] = useState(false);

  // User content state
  const [myCharacters, setMyCharacters] = useState<CharacterItem[]>([]);
  const [myPrompts, setMyPrompts] = useState<PromptItem[]>([]);
  const [likedCharacters, setLikedCharacters] = useState<CharacterItem[]>([]);
  const [bookmarkedItems, setBookmarkedItems] = useState<{ characters: CharacterItem[]; prompts: PromptItem[] }>({ characters: [], prompts: [] });
  const [myAppeals, setMyAppeals] = useState<any[]>([]);

  // Counts & stats
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [totalLikesCount, setTotalLikesCount] = useState(0);
  const [totalCharSavesCount, setTotalCharSavesCount] = useState(0);
  const [totalPromptSavesCount, setTotalPromptSavesCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);

  const [reqName, setReqName] = useState(user?.displayName || '');
  const [reqReason, setReqReason] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);

  useEffect(() => {
    if (user?.displayName) {
      setReqName(user.displayName);
    }
  }, [user?.displayName]);

  useEffect(() => {
    if (window.location.hash === '#creator-request' && !user?.creatorStatus) {
      setIsCreatorRequestModalOpen(true);
      const el = document.getElementById('creator-request');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [loading, user?.creatorStatus]);

  const handleSubmitCreatorRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqName.trim() || !reqReason.trim()) {
      toast.error("Vui lòng điền đầy đủ Tên và Lý do/Mong muốn.");
      return;
    }
    setSubmittingRequest(true);
    try {
      await addDoc(collection(db, 'creator_requests'), {
        userId: user.id,
        userDisplayName: reqName.trim(),
        userAvatar: user.avatar || '',
        userEmail: user.email || '',
        reason: reqReason.trim(),
        status: 'PENDING',
        createdAt: new Date().toISOString()
      });

      await updateDoc(doc(db, 'users', user.id), {
        creatorRequestStatus: 'PENDING'
      });

      toast.success("Đã gửi yêu cầu trở thành Creator thành công!");
      setHasPendingRequest(true);
      setReqReason('');
      setIsCreatorRequestModalOpen(false);
      loadUserData();
    } catch (err) {
      console.error(err);
      toast.error("Gửi yêu cầu thất bại.");
    } finally {
      setSubmittingRequest(false);
    }
  };

  const loadUserData = async () => {
    if (!user?.id) return;
    setLoading(true);

    try {
      // Check pending creator request
      const reqQuery = query(collection(db, 'creator_requests'), where('userId', '==', user.id), where('status', '==', 'PENDING'));
      const reqSnap = await getDocs(reqQuery);
      setHasPendingRequest(!reqSnap.empty);

      // 1. Fetch my Created Characters
      const charQuery = query(collection(db, 'characters'), where('creatorId', '==', user.id));
      const charSnap = await getDocs(charQuery);
      const fetchedChars: CharacterItem[] = [];
      let totalLikesOnMyCharsSum = 0;
      let totalCharSavesOnMyCharsSum = 0;

      charSnap.docs.forEach(d => {
        const data = d.data();
        if (!data.deletedAt && !data.isHidden) {
          const charItem = { id: d.id, ...data } as CharacterItem;
          fetchedChars.push(charItem);
          totalLikesOnMyCharsSum += Number(data.likesCount || 0);
          totalCharSavesOnMyCharsSum += Number(data.savesCount || 0);
        }
      });
      setMyCharacters(fetchedChars);

      // 2. Fetch my Created Prompts
      const promptQuery = query(collection(db, 'prompts'), where('authorId', '==', user.id));
      const promptSnap = await getDocs(promptQuery);
      const fetchedPrompts: PromptItem[] = [];
      let totalPromptSavesOnMyPromptsSum = 0;

      promptSnap.docs.forEach(d => {
        const data = d.data();
        if (!data.deletedAt && !data.isHidden) {
          const pItem = { id: d.id, ...data } as PromptItem;
          fetchedPrompts.push(pItem);
          totalPromptSavesOnMyPromptsSum += Number(data.savesCount || 0);
        }
      });
      setMyPrompts(fetchedPrompts);

      // 3. Fetch Liked Characters by THIS USER (checking both character_likes and legacy likes)
      const [charLikesSnap, legacyLikesSnap] = await Promise.all([
        getDocs(query(collection(db, 'character_likes'), where('userId', '==', user.id))),
        getDocs(query(collection(db, 'likes'), where('userId', '==', user.id)))
      ]);

      const likedCharIds = Array.from(new Set([
        ...charLikesSnap.docs.map(d => d.data().characterId || d.data().targetId),
        ...legacyLikesSnap.docs.map(d => d.data().characterId || d.data().targetId)
      ])).filter(Boolean) as string[];

      const likedCharsFetched: CharacterItem[] = [];
      if (likedCharIds.length > 0) {
        // Fetch in batches of 30 (Firestore limit for 'in' operator)
        const chunks = [];
        for (let i = 0; i < likedCharIds.length; i += 30) {
          chunks.push(likedCharIds.slice(i, i + 30));
        }

        const charDocsResults = await Promise.all(
          chunks.map(chunk => getDocs(query(collection(db, 'characters'), where('__name__', 'in', chunk))))
        );

        charDocsResults.forEach(snap => {
          snap.docs.forEach(d => {
            const data = d.data();
            if (!data.deletedAt && !data.isHidden) {
              likedCharsFetched.push({ id: d.id, ...data } as CharacterItem);
            }
          });
        });
      }
      setLikedCharacters(likedCharsFetched);

      // 4. Fetch Bookmarks (Saved Characters & Saved Prompts by THIS USER)
      const bmSnap = await getDocs(query(collection(db, 'bookmarks'), where('userId', '==', user.id)));
      
      const savedCharIds: string[] = [];
      const savedPromptIds: string[] = [];

      bmSnap.docs.forEach(bDoc => {
        const bData = bDoc.data();
        const targetId = bData.targetId || bData.characterId || bData.promptId;
        const targetType = bData.targetType || (bData.characterId ? 'CHARACTER' : bData.promptId ? 'PROMPT' : null);

        if (targetType === 'CHARACTER' && targetId) savedCharIds.push(targetId);
        else if (targetType === 'PROMPT' && targetId) savedPromptIds.push(targetId);
      });

      const uniqueSavedCharIds = Array.from(new Set(savedCharIds));
      const uniqueSavedPromptIds = Array.from(new Set(savedPromptIds));

      const [savedChars, savedPrompts] = await Promise.all([
        (async () => {
          const list: CharacterItem[] = [];
          if (uniqueSavedCharIds.length > 0) {
            const chunks = [];
            for (let i = 0; i < uniqueSavedCharIds.length; i += 30) chunks.push(uniqueSavedCharIds.slice(i, i + 30));
            const snaps = await Promise.all(chunks.map(c => getDocs(query(collection(db, 'characters'), where('__name__', 'in', c)))));
            snaps.forEach(s => s.docs.forEach(d => { if (!d.data().deletedAt && !d.data().isHidden) list.push({ id: d.id, ...d.data() } as CharacterItem); }));
          }
          return list;
        })(),
        (async () => {
          const list: PromptItem[] = [];
          if (uniqueSavedPromptIds.length > 0) {
            const chunks = [];
            for (let i = 0; i < uniqueSavedPromptIds.length; i += 30) chunks.push(uniqueSavedPromptIds.slice(i, i + 30));
            const snaps = await Promise.all(chunks.map(c => getDocs(query(collection(db, 'prompts'), where('__name__', 'in', c)))));
            snaps.forEach(s => s.docs.forEach(d => { if (!d.data().deletedAt && !d.data().isHidden) list.push({ id: d.id, ...d.data() } as PromptItem); }));
          }
          return list;
        })()
      ]);
      
      setBookmarkedItems({ characters: savedChars, prompts: savedPrompts });

      // Calculate 5 Stats Counters precisely based on USER'S PERSONAL COLLECTION
      // This ensures "Chuẩn xác" and "Trơn tru" between counters and tabs.
      
      // 1. Lượt thích: Number of characters the user has liked
      setTotalLikesCount(likedCharsFetched.length);

      // 2. Lưu Character: Number of unique characters saved in bookmarks
      setTotalCharSavesCount(savedChars.length);

      // 3. Lưu Prompt: Number of unique prompts saved in bookmarks
      setTotalPromptSavesCount(savedPrompts.length);

      // 4. Người Theo Dõi (Followers count)
      const exactFollowersCount = await reconcileFollowerCount(user.id);
      setFollowersCount(exactFollowersCount);

      // 5. Đang Theo Dõi (Following count)
      const followingQuery = query(collection(db, 'follows'), where('followerId', '==', user.id));
      const followingSnap = await getDocs(followingQuery);
      const followingCreatorIds = new Set<string>();
      followingSnap.docs.forEach(d => {
        const data = d.data();
        const targetId = data.targetCreatorId || data.creatorId;
        if (targetId && targetId !== user.id) {
          followingCreatorIds.add(targetId);
        }
      });
      setFollowingCount(followingCreatorIds.size);

      // 6. Fetch User Appeals
      const appealsQuery = query(collection(db, 'appeals'), where('userId', '==', user.id));
      const appealsSnap = await getDocs(appealsQuery);
      setMyAppeals(appealsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

    } catch (err) {
      console.error("Failed to load user profile data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUserData();
  }, [user?.id]);

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <ShieldAlert className="w-16 h-16 mx-auto mb-4 text-neutral-400" />
        <h2 className="text-xl font-bold mb-2">Chưa đăng nhập</h2>
        <p className="text-neutral-500 text-sm mb-6">Vui lòng đăng nhập bằng tài khoản Google để xem hồ sơ người dùng.</p>
      </div>
    );
  }

  // Handle Pin / Unpin Character
  const handleTogglePinCharacter = async (char: CharacterItem) => {
    const currentlyPinnedCount = myCharacters.filter(c => c.pinned).length;
    if (!char.pinned && currentlyPinnedCount >= 3) {
      toast.error("Bạn chỉ được ghim tối đa 3 Character.");
      return;
    }

    try {
      const charRef = doc(db, 'characters', char.id);
      await updateDoc(charRef, { pinned: !char.pinned });
      toast.success(char.pinned ? "Đã bỏ ghim Character." : "Đã ghim Character lên đầu trang!");
      loadUserData();
    } catch (err) {
      toast.error("Thao tác thất bại.");
    }
  };

  // Handle Pin / Unpin Prompt
  const handleTogglePinPrompt = async (p: PromptItem) => {
    try {
      const pRef = doc(db, 'prompts', p.id);
      await updateDoc(pRef, { pinned: !p.pinned });
      toast.success(p.pinned ? "Đã bỏ ghim Prompt." : "Đã ghim Prompt!");
      loadUserData();
    } catch (err) {
      toast.error("Thao tác thất bại.");
    }
  };

  // Handle Delete Character
  const handleDeleteCharacter = async (charId: string) => {
    setCharacterToDelete(charId);
  };

  const executeDeleteCharacter = async (charId: string) => {
    try {
      const charRef = doc(db, 'characters', charId);
      await deleteDoc(charRef);
      toast.success("Đã xóa hoàn toàn Character khỏi hệ thống.");
      loadUserData();
    } catch (err) {
      toast.error("Không thể xóa Character.");
    }
  };

  // Handle Delete Prompt
  const handleDeletePrompt = async (promptId: string) => {
    setPromptToDelete(promptId);
  };

  const executeDeletePrompt = async (promptId: string) => {
    try {
      await deleteDoc(doc(db, 'prompts', promptId));
      toast.success("Đã xóa hoàn toàn Prompt khỏi hệ thống.");
      loadUserData();
    } catch (err) {
      toast.error("Không thể xóa Prompt.");
    }
  };

  // Copy Prompt handler
  const handleCopyPrompt = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPromptId(id);
    toast.success("Đã sao chép nội dung Prompt!");
    setTimeout(() => setCopiedPromptId(null), 2000);
  };

  // Open Followers Modal
  const handleOpenFollowersModal = async () => {
    setFollowModalTitle("Người theo dõi");
    setIsFollowModalOpen(true);
    setLoadingFollows(true);
    try {
      const q = query(collection(db, 'follows'), where('targetCreatorId', '==', user.id));
      const snap = await getDocs(q);
      const q2 = query(collection(db, 'follows'), where('creatorId', '==', user.id));
      const snap2 = await getDocs(q2);

      const allDocs = [...snap.docs, ...snap2.docs];
      const seen = new Set<string>();
      const usersList: any[] = [];

      for (const d of allDocs) {
        const followerId = d.data().followerId;
        if (!followerId || followerId === user.id || seen.has(followerId)) continue;
        seen.add(followerId);

        const uDoc = await getDoc(doc(db, 'users', followerId));
        if (uDoc.exists()) {
          usersList.push({ id: uDoc.id, ...uDoc.data() });
        }
      }
      setFollowModalUsers(usersList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingFollows(false);
    }
  };

  // Open Following Modal
  const handleOpenFollowingModal = async () => {
    setFollowModalTitle("Đang theo dõi");
    setIsFollowModalOpen(true);
    setLoadingFollows(true);
    try {
      const q = query(collection(db, 'follows'), where('followerId', '==', user.id));
      const snap = await getDocs(q);
      const seen = new Set<string>();
      const usersList: any[] = [];

      for (const d of snap.docs) {
        const creatorId = d.data().targetCreatorId || d.data().creatorId;
        if (!creatorId || creatorId === user.id || seen.has(creatorId)) continue;
        seen.add(creatorId);

        const uDoc = await getDoc(doc(db, 'users', creatorId));
        if (uDoc.exists()) {
          usersList.push({ id: uDoc.id, ...uDoc.data() });
        }
      }
      setFollowModalUsers(usersList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingFollows(false);
    }
  };

  // Un-like a character directly from profile
  const handleUnlikeCharacterFromProfile = async (charId: string) => {
    if (!user?.id) return;
    try {
      const q1 = query(collection(db, 'character_likes'), where('userId', '==', user.id), where('characterId', '==', charId));
      const snap1 = await getDocs(q1);
      for (const d of snap1.docs) {
        await deleteDoc(doc(db, 'character_likes', d.id));
      }

      const q2 = query(collection(db, 'likes'), where('userId', '==', user.id), where('characterId', '==', charId));
      const snap2 = await getDocs(q2);
      for (const d of snap2.docs) {
        await deleteDoc(doc(db, 'likes', d.id));
      }

      const charRef = doc(db, 'characters', charId);
      await updateDoc(charRef, { likesCount: increment(-1) });

      toast.success("Đã bỏ thích Character.");
      loadUserData();
    } catch (err) {
      console.error(err);
      toast.error("Thao tác thất bại.");
    }
  };

  // Un-bookmark a character or prompt directly from profile
  const handleRemoveBookmarkFromProfile = async (targetId: string, targetType: 'CHARACTER' | 'PROMPT') => {
    if (!user?.id) return;
    try {
      const q = query(collection(db, 'bookmarks'), where('userId', '==', user.id));
      const snap = await getDocs(q);

      for (const d of snap.docs) {
        const data = d.data();
        const tId = data.targetId || data.characterId || data.promptId;
        const tType = data.targetType || (data.characterId ? 'CHARACTER' : data.promptId ? 'PROMPT' : null);

        if (tId === targetId && tType === targetType) {
          await deleteDoc(doc(db, 'bookmarks', d.id));
        }
      }

      if (targetType === 'CHARACTER') {
        const charRef = doc(db, 'characters', targetId);
        await updateDoc(charRef, { savesCount: increment(-1) });
        toast.success("Đã bỏ lưu Character.");
      } else {
        const promptRef = doc(db, 'prompts', targetId);
        await updateDoc(promptRef, { savesCount: increment(-1) });
        toast.success("Đã bỏ lưu Prompt.");
      }

      loadUserData();
    } catch (err) {
      console.error(err);
      toast.error("Thao tác thất bại.");
    }
  };

  const pinnedCharacters = myCharacters.filter(c => c.pinned);
  const pinnedPrompts = myPrompts.filter(p => p.pinned);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header Profile Info Card */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 md:p-8 shadow-sm mb-8">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
          {/* Avatar */}
          <div className="relative">
            <img 
              src={getValidAvatar(user.avatar)} 
              alt={user.displayName} 
              className="w-28 h-28 md:w-32 md:h-32 rounded-full object-cover border-4 border-neutral-100 dark:border-neutral-800 shadow-md"
            />
            {user.creatorStatus && (
              <span className="absolute bottom-1 right-1 px-2 py-0.5 bg-amber-500 text-black text-[10px] font-black rounded-full shadow-sm uppercase tracking-wider">
                Creator
              </span>
            )}
          </div>

          {/* Info & Stats */}
          <div className="flex-1 text-center md:text-left">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 justify-center md:justify-start flex-wrap">
                  <span>{user.displayName}</span>
                  <UserBadge 
                    subject={{ 
                      creatorStatus: user.creatorStatus, 
                      role: user.role, 
                      characterCount: myCharacters.length, 
                      createdAt: user.createdAt,
                      badges: user.badges || []
                    }} 
                    size="md"
                    maxVisible={10}
                  />
                  {user.role === 'ADMIN' && (
                    <span className="px-2 py-0.5 bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 text-[10px] font-extrabold rounded-md flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> ADMIN
                    </span>
                  )}
                </h1>
                {user.numericId && user.role !== 'ADMIN' && user.role !== 'MODERATOR' && (
                  <div className="mt-1 flex justify-center md:justify-start">
                    <DisplayId type={user.creatorStatus ? 'creator' : 'user'} numericId={user.numericId} />
                  </div>
                )}
                {(user.statusMessage || (user as any).activityStatus) && (
                  <div className="mt-1 flex justify-center md:justify-start">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>{user.statusMessage || (user as any).activityStatus}</span>
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {!user.creatorStatus && !hasPendingRequest && user.creatorRequestStatus !== 'PENDING' && (
                  <button 
                    onClick={() => setIsCreatorRequestModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-black text-xs font-extrabold transition-colors shadow-sm"
                  >
                    <Sparkles className="w-4 h-4" />
                    Gửi Yêu Cầu Trở Thành Creator
                  </button>
                )}
                {!user.creatorStatus && (hasPendingRequest || user.creatorRequestStatus === 'PENDING') && (
                  <span className="px-3 py-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-bold rounded-xl flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    Chờ Xét Duyệt Creator
                  </span>
                )}
                {user.role !== 'ADMIN' && user.role !== 'MODERATOR' && (
                  <button 
                    onClick={() => setIsShareOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-xs font-semibold transition-colors"
                    title="Chia sẻ hồ sơ cá nhân"
                  >
                    <Share2 className="w-4 h-4 text-amber-500" />
                    <span>Chia sẻ</span>
                  </button>
                )}
                <button 
                  onClick={() => setIsEditProfileOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-xs font-semibold transition-colors"
                >
                  <Edit3 className="w-4 h-4" />
                  Chỉnh sửa hồ sơ
                </button>
              </div>
            </div>

            {/* Bio */}
            {user.bio ? (
              <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300 max-w-2xl leading-relaxed whitespace-pre-line">
                {user.bio}
              </p>
            ) : (
              <p className="mt-3 text-sm text-neutral-400 italic">Chưa có thông tin giới thiệu bản thân.</p>
            )}

            {/* Social Links & Custom Links */}
            {((user.socialLinks && (user.socialLinks.facebook || user.socialLinks.instagram || user.socialLinks.tiktok || user.socialLinks.discord)) || (user.customLinks && user.customLinks.length > 0)) && (
              <div className="flex flex-wrap items-center gap-3 mt-4 justify-center md:justify-start text-neutral-500">
                {user.socialLinks?.facebook && (
                  <a href={user.socialLinks.facebook} target="_blank" rel="noreferrer" className="hover:text-blue-600 transition-colors">
                    <Facebook className="w-4 h-4" />
                  </a>
                )}
                {user.socialLinks?.instagram && (
                  <a href={user.socialLinks.instagram} target="_blank" rel="noreferrer" className="hover:text-pink-500 transition-colors">
                    <Instagram className="w-4 h-4" />
                  </a>
                )}
                {user.socialLinks?.tiktok && (
                  <a href={user.socialLinks.tiktok} target="_blank" rel="noreferrer" className="hover:text-black dark:hover:text-white transition-colors">
                    <Music className="w-4 h-4" />
                  </a>
                )}
                {user.socialLinks?.discord && (
                  <span className="flex items-center gap-1 text-xs hover:text-indigo-500 transition-colors" title={user.socialLinks.discord}>
                    <MessageSquare className="w-4 h-4" />
                    <span>{user.socialLinks.discord}</span>
                  </span>
                )}
                {user.customLinks && user.customLinks.map((link: any, idx: number) => (
                  <a 
                    key={link.id || idx}
                    href={link.url} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                  >
                    <Globe className="w-3.5 h-3.5 text-neutral-400" />
                    <span>{link.title || 'Link'}</span>
                  </a>
                ))}
              </div>
            )}

            {/* Stats Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mt-6 pt-6 border-t border-neutral-100 dark:border-neutral-800 text-center md:text-left">
              <button onClick={() => setActiveTab('liked')} className="text-center md:text-left hover:opacity-80 transition-opacity">
                <div className="text-xl font-extrabold">{totalLikesCount}</div>
                <div className="text-xs text-neutral-400 font-medium">Lượt thích</div>
              </button>
              <button onClick={() => setActiveTab('bookmarks')} className="text-center md:text-left hover:opacity-80 transition-opacity">
                <div className="text-xl font-extrabold">{totalCharSavesCount}</div>
                <div className="text-xs text-neutral-400 font-medium">Lưu Character</div>
              </button>
              <button onClick={() => setActiveTab('bookmarks')} className="text-center md:text-left hover:opacity-80 transition-opacity">
                <div className="text-xl font-extrabold">{totalPromptSavesCount}</div>
                <div className="text-xs text-neutral-400 font-medium">Lưu Prompt</div>
              </button>
              <button onClick={handleOpenFollowersModal} className="text-center md:text-left hover:opacity-80 transition-opacity">
                <div className="text-xl font-extrabold">{followersCount}</div>
                <div className="text-xs text-neutral-400 font-medium">Người theo dõi</div>
              </button>
              <button onClick={handleOpenFollowingModal} className="text-center md:text-left hover:opacity-80 transition-opacity">
                <div className="text-xl font-extrabold">{followingCount}</div>
                <div className="text-xs text-neutral-400 font-medium">Đang theo dõi</div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Panel Section if user is ADMIN */}
      {user.role === 'ADMIN' && <AdminApprovalSection />}

      {/* Creator Request Section */}
      {!user.creatorStatus && (
        <div id="creator-request" className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 rounded-3xl p-6 md:p-8 mb-8 shadow-sm">
          {hasPendingRequest || user.creatorRequestStatus === 'PENDING' ? (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 text-center space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500 text-black text-xs font-bold rounded-full uppercase tracking-wider">
                Chờ Xét Duyệt
              </div>
              <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                Yêu cầu trở thành Creator của bạn đã được gửi và đang chờ Quản trị viên xem xét.
              </p>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-2xl shrink-0">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base md:text-lg font-extrabold text-neutral-900 dark:text-neutral-100">
                    Trở thành Creator
                  </h2>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5">
                    Đăng ký để sáng tạo Character, chia sẻ với cộng đồng và xây dựng bộ sưu tập Roleplay của riêng bạn.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsCreatorRequestModalOpen(true)}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-xs transition-all shrink-0 shadow-sm flex items-center gap-2 hover:scale-[1.02]"
              >
                <Sparkles className="w-4 h-4" />
                Gửi Yêu Cầu Trở Thành Creator
              </button>
            </div>
          )}
        </div>
      )}

      {/* Actions: Create Character & Create Prompt Buttons (Mục tạo nhân vật & Prompt) */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          {user.creatorStatus ? (
            <button
              onClick={() => {
                setCharacterToEdit(null);
                setIsCreateCharacterOpen(true);
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-black dark:bg-white text-white dark:text-black text-xs font-bold hover:opacity-90 transition-opacity shadow-sm"
            >
              <Sparkles className="w-4 h-4" />
              Tạo Character mới
            </button>
          ) : (
            <button
              onClick={() => setIsCreatorRequestModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 text-xs font-bold hover:bg-amber-500/20 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              Gửi Yêu Cầu Trở Thành Creator
            </button>
          )}

          <button
            onClick={() => {
              setPromptToEdit(null);
              setIsCreatePromptOpen(true);
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-xs font-bold hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-colors"
          >
            <PenTool className="w-4 h-4" />
            Đăng Prompt mới
          </button>

          {(user.creatorStatus || user.role === 'ADMIN') && (
            <Link
              to="/creator/dashboard"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 text-xs font-bold hover:bg-amber-500/20 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              Bảng điều khiển Creator
            </Link>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-neutral-200 dark:border-neutral-800 mb-6 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('characters')}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'characters'
              ? 'border-black dark:border-white text-black dark:text-white'
              : 'border-transparent text-neutral-500 hover:text-black dark:hover:text-white'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Character đã tạo ({myCharacters.length})
        </button>

        <button
          onClick={() => setActiveTab('prompts')}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'prompts'
              ? 'border-black dark:border-white text-black dark:text-white'
              : 'border-transparent text-neutral-500 hover:text-black dark:hover:text-white'
          }`}
        >
          <PenTool className="w-4 h-4" />
          Prompt đã tạo ({myPrompts.length})
        </button>

        <button
          onClick={() => setActiveTab('liked')}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'liked'
              ? 'border-black dark:border-white text-black dark:text-white'
              : 'border-transparent text-neutral-500 hover:text-black dark:hover:text-white'
          }`}
        >
          <Heart className="w-4 h-4" />
          Character đã thích ({likedCharacters.length})
        </button>

        <button
          onClick={() => setActiveTab('bookmarks')}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'bookmarks'
              ? 'border-black dark:border-white text-black dark:text-white'
              : 'border-transparent text-neutral-500 hover:text-black dark:hover:text-white'
          }`}
        >
          <Bookmark className="w-4 h-4" />
          Đã lưu ({bookmarkedItems.characters.length + bookmarkedItems.prompts.length})
        </button>

        <button
          onClick={() => setActiveTab('appeals')}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'appeals'
              ? 'border-black dark:border-white text-black dark:text-white'
              : 'border-transparent text-neutral-500 hover:text-black dark:hover:text-white'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          Kháng nghị của tôi ({myAppeals.length})
        </button>
      </div>

      {/* Tab Contents */}
      {loading ? (
        <div className="py-12 text-center text-sm text-neutral-400">Đang tải dữ liệu...</div>
      ) : (
        <>
          {/* TAB 1: CHARACTERS */}
          {activeTab === 'characters' && (
            <div className="space-y-8">
              {/* Pinned Characters Section */}
              {pinnedCharacters.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Pin className="w-3.5 h-3.5 text-amber-500" />
                    Character đã ghim ({pinnedCharacters.length}/3)
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {pinnedCharacters.map(char => (
                      <ProfileCharacterCard
                        key={char.id}
                        character={{
                          ...char,
                          creatorName: char.creatorName || user.displayName,
                          pinned: true
                        }}
                        isOwner={true}
                        onEdit={(c) => { setCharacterToEdit(c); setIsCreateCharacterOpen(true); }}
                        onDelete={handleDeleteCharacter}
                        onPin={handleTogglePinCharacter}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* All Created Characters */}
              <div>
                <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">
                  Tất cả Character đã tạo
                </h3>
                {myCharacters.length === 0 ? (
                  <div className="p-8 text-center bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
                    <p className="text-sm text-neutral-500">Bạn chưa tạo Character nào.</p>
                    {user.creatorStatus && (
                      <button
                        onClick={() => { setCharacterToEdit(null); setIsCreateCharacterOpen(true); }}
                        className="mt-3 px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-semibold"
                      >
                        Tạo Character ngay
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {myCharacters.map(char => (
                      <ProfileCharacterCard
                        key={char.id}
                        character={{
                          ...char,
                          creatorName: char.creatorName || user.displayName
                        }}
                        isOwner={true}
                        onEdit={(c) => { setCharacterToEdit(c); setIsCreateCharacterOpen(true); }}
                        onDelete={handleDeleteCharacter}
                        onPin={handleTogglePinCharacter}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: PROMPTS */}
          {activeTab === 'prompts' && (
            <div className="space-y-8">
              {/* Pinned Prompts Section */}
              {pinnedPrompts.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Pin className="w-3.5 h-3.5 text-indigo-500" />
                    Prompt đã ghim
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {pinnedPrompts.map(p => (
                      <PromptCard
                        key={p.id}
                        prompt={p}
                        isOwner={true}
                        onEdit={(item) => { setPromptToEdit(item); setIsCreatePromptOpen(true); }}
                        onDelete={handleDeletePrompt}
                        onPin={handleTogglePinPrompt}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* All Created Prompts */}
              <div>
                <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">
                  Tất cả Prompt đã tạo
                </h3>
                {myPrompts.length === 0 ? (
                  <div className="p-8 text-center bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
                    <p className="text-sm text-neutral-500">Bạn chưa đăng Prompt nào.</p>
                    <button
                      onClick={() => { setPromptToEdit(null); setIsCreatePromptOpen(true); }}
                      className="mt-3 px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-semibold"
                    >
                      Đăng Prompt ngay
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {myPrompts.map(p => (
                      <PromptCard
                        key={p.id}
                        prompt={p}
                        isOwner={true}
                        onEdit={(item) => { setPromptToEdit(item); setIsCreatePromptOpen(true); }}
                        onDelete={handleDeletePrompt}
                        onPin={handleTogglePinPrompt}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: LIKED CHARACTERS */}
          {activeTab === 'liked' && (
            <div>
              {likedCharacters.length === 0 ? (
                <div className="p-8 text-center bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
                  <p className="text-sm text-neutral-500">Bạn chưa thích Character nào.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {likedCharacters.map(char => (
                    <ProfileCharacterCard
                      key={char.id}
                      character={char}
                      onUpdate={fetchProfileData}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: BOOKMARKS */}
          {activeTab === 'bookmarks' && (
            <div className="space-y-6">
              {/* Saved Characters */}
              <div>
                <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">
                  Character đã lưu ({bookmarkedItems.characters.length})
                </h3>
                {bookmarkedItems.characters.length === 0 ? (
                  <p className="text-xs text-neutral-400 italic">Chưa có Character nào được lưu.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {bookmarkedItems.characters.map(char => (
                      <ProfileCharacterCard
                        key={char.id}
                        character={char}
                        onUpdate={fetchProfileData}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Saved Prompts */}
              <div>
                <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">
                  Prompt đã lưu ({bookmarkedItems.prompts.length})
                </h3>
                {bookmarkedItems.prompts.length === 0 ? (
                  <p className="text-xs text-neutral-400 italic">Chưa có Prompt nào được lưu.</p>
                ) : (
                  <div className="space-y-3">
                    {bookmarkedItems.prompts.map(p => (
                      <div key={p.id} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="font-bold text-sm">{p.name}</div>
                            <div className="text-xs text-neutral-500 mt-0.5">Tác giả: {p.authorName}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleRemoveBookmarkFromProfile(p.id, 'PROMPT')}
                              className="flex items-center gap-1 px-3 py-1.5 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-lg text-xs font-medium hover:bg-red-100 dark:hover:bg-red-900/40"
                            >
                              <Bookmark className="w-3.5 h-3.5 fill-current" /> Bỏ lưu
                            </button>
                            <button onClick={() => handleCopyPrompt(p.content, p.id)} className="flex items-center gap-1 px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-xs font-medium hover:bg-neutral-200 dark:hover:bg-neutral-700">
                              {copiedPromptId === p.id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                              Sao chép
                            </button>
                          </div>
                        </div>
                        <div className="mt-3 p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl font-mono text-xs text-neutral-600 dark:text-neutral-300 line-clamp-3">
                          {p.content}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: APPEALS */}
          {activeTab === 'appeals' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-5 rounded-2xl">
                <div>
                  <h3 className="text-sm font-extrabold text-neutral-900 dark:text-neutral-100">Yêu Cầu Kháng Nghị (Appeals)</h3>
                  <p className="text-xs text-neutral-500 mt-0.5">Gửi yêu cầu xem xét lại nếu nội dung hoặc tài khoản của bạn bị kiểm duyệt hoặc hạn chế.</p>
                </div>
                <button
                  onClick={() => setIsAppealModalOpen(true)}
                  className="px-4 py-2.5 bg-amber-500 text-black font-bold text-xs rounded-xl hover:bg-amber-600 transition-all shadow-md shrink-0 flex items-center gap-2"
                >
                  <ShieldAlert className="w-4 h-4" />
                  Gửi Kháng Nghị Mới
                </button>
              </div>

              {myAppeals.length === 0 ? (
                <div className="p-12 text-center bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl">
                  <ShieldCheck className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
                  <p className="text-sm font-bold text-neutral-700 dark:text-neutral-300">Bạn chưa có yêu cầu kháng nghị nào</p>
                  <p className="text-xs text-neutral-400 mt-1">Mọi yêu cầu kháng nghị khiếu nại quyết định kiểm duyệt sẽ hiển thị tại đây.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {myAppeals.map(item => (
                    <div key={item.id} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-xs font-bold text-neutral-800 dark:text-neutral-200">
                            {item.targetType}
                          </span>
                          <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                            {item.targetName}
                          </span>
                        </div>
                        <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                          item.status === 'PENDING' ? 'bg-amber-500/15 text-amber-600' :
                          item.status === 'RESOLVED' ? 'bg-emerald-500/15 text-emerald-600' : 'bg-neutral-500/15 text-neutral-500'
                        }`}>
                          {item.status === 'PENDING' ? 'Chờ xem xét' : item.status === 'RESOLVED' ? 'Đã giải quyết (Chấp nhận)' : 'Đã từ chối'}
                        </span>
                      </div>

                      <div className="text-xs space-y-1">
                        <p><strong className="text-neutral-700 dark:text-neutral-300">Lý do:</strong> {item.reason}</p>
                        <p className="text-neutral-600 dark:text-neutral-400"><strong className="text-neutral-700 dark:text-neutral-300">Nội dung:</strong> {item.description}</p>
                        {item.adminResponse && (
                          <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 mt-2">
                            <p className="font-bold text-neutral-900 dark:text-neutral-100">Phản hồi từ Ban quản trị:</p>
                            <p className="text-neutral-700 dark:text-neutral-300 mt-0.5">{item.adminResponse}</p>
                          </div>
                        )}
                      </div>

                      <div className="flex justify-between items-center text-[11px] text-neutral-400 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                        <span>Gửi lúc: {item.createdAt ? new Date(item.createdAt).toLocaleString('vi-VN') : 'N/A'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Edit Profile Modal */}
      <EditProfileModal
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
        onSaveSuccess={loadUserData}
      />

      {/* Create / Edit Character Modal */}
      <CreateCharacterModal
        isOpen={isCreateCharacterOpen}
        onClose={() => setIsCreateCharacterOpen(false)}
        onSuccess={loadUserData}
        characterToEdit={characterToEdit}
      />

      {/* Create / Edit Prompt Modal */}
      <CreatePromptModal
        isOpen={isCreatePromptOpen}
        onClose={() => setIsCreatePromptOpen(false)}
        onSuccess={loadUserData}
        promptToEdit={promptToEdit}
      />

      {/* Followers / Following List Modal */}
      <FollowersModal
        isOpen={isFollowModalOpen}
        onClose={() => setIsFollowModalOpen(false)}
        title={followModalTitle}
        users={followModalUsers}
        loading={loadingFollows}
      />

      {/* Appeal Modal */}
      <AppealModal
        isOpen={isAppealModalOpen}
        onClose={() => {
          setIsAppealModalOpen(false);
          loadUserData();
        }}
        targetType="ACCOUNT"
        targetName={user?.displayName || 'Tài khoản cá nhân'}
      />

      {/* Creator Request Modal */}
      {isCreatorRequestModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setIsCreatorRequestModalOpen(false)}
        >
          <div 
            className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setIsCreatorRequestModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-full text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5 pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-2xl">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-neutral-900 dark:text-neutral-100">
                  Gửi Yêu Cầu Trở Thành Creator
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Điền thông tin và lý do để đăng ký quyền Creator.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmitCreatorRequest} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Tên hiển thị (Name)
                </label>
                <input
                  type="text"
                  value={reqName}
                  onChange={(e) => setReqName(e.target.value)}
                  required
                  placeholder="Nhập tên hiển thị của bạn..."
                  className="w-full px-4 py-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-400 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Lý do / Mong muốn
                </label>
                <textarea
                  rows={4}
                  value={reqReason}
                  onChange={(e) => setReqReason(e.target.value)}
                  placeholder="Chia sẻ kinh nghiệm hoặc lý do bạn muốn tạo Character trên Thế Giới Nhập Vai..."
                  required
                  className="w-full px-4 py-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-400 transition-all resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsCreatorRequestModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submittingRequest}
                  className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-xs transition-opacity disabled:opacity-50 shadow-sm flex items-center gap-2"
                >
                  {submittingRequest ? "Đang gửi..." : "Gửi Yêu Cầu"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Character Confirmation Modal */}
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

      {/* Delete Prompt Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={promptToDelete !== null}
        onClose={() => setPromptToDelete(null)}
        title="Xóa hoàn toàn Prompt?"
        description="Bạn có chắc chắn muốn xóa hoàn toàn Prompt này không? Hành động này không thể hoàn tác và Prompt sẽ biến mất ngay lập tức khỏi hệ thống."
        onConfirm={async () => {
          if (!promptToDelete) return;
          const targetId = promptToDelete;
          setPromptToDelete(null);
          await executeDeletePrompt(targetId);
        }}
      />

      {/* Share Modal */}
      {user && user.role !== 'ADMIN' && user.role !== 'MODERATOR' && (
        <ShareModal
          isOpen={isShareOpen}
          onClose={() => setIsShareOpen(false)}
          type={user.creatorStatus ? 'CREATOR' : 'USER'}
          targetId={user.numericId || user.id}
          title={user.displayName}
          avatar={user.avatar}
          description={user.bio}
        />
      )}
    </div>
  );
}
