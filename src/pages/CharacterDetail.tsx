import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  Heart, Bookmark, Eye, ExternalLink, Sparkles, User as UserIcon, Tag, MessageSquare, ArrowLeft, Flag, AlertCircle, Trash2, Share2, ShieldAlert 
} from 'lucide-react';
import { doc, getDoc, updateDoc, increment, collection, addDoc, query, where, getDocs, deleteDoc, serverTimestamp, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { useUserInteractions } from '../context/UserInteractionsContext';
import { CharacterItem } from '../types';
import { useSeo } from '../hooks/useSeo';
import CommentSection from '../components/comments/CommentSection';
import ReportModal from '../components/ReportModal';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import CharacterCard from '../components/CharacterCard';
import DisplayId from '../components/DisplayId';
import ShareModal from '../components/ShareModal';
import RemovalDetailModal from '../components/modals/RemovalDetailModal';
import { getValidAvatar } from '../lib/avatar';
import toast from 'react-hot-toast';

export default function CharacterDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [character, setCharacter] = useState<CharacterItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [savesCount, setSavesCount] = useState(0);
  const [viewsCount, setViewsCount] = useState(0);

  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isRemovalModalOpen, setIsRemovalModalOpen] = useState(false);

  const [relatedCharacters, setRelatedCharacters] = useState<CharacterItem[]>([]);

  useSeo({
    title: character?.name,
    description: character?.slogan,
    image: character?.avatar,
    type: 'article'
  });

  const fetchCharacter = async () => {
    if (!id) return;
    setLoading(true);
    setError(false);

    try {
      let snap;
      let docId = '';
      const isNumeric = /^[0-9]{9}$/.test(id);

      if (isNumeric) {
        const q = query(collection(db, 'characters'), where('numericId', '==', id), limit(1));
        const querySnap = await getDocs(q);
        if (!querySnap.empty) {
          snap = querySnap.docs[0];
          docId = snap.id;
        }
      }

      if (!snap) {
        const docRef = doc(db, 'characters', id);
        const directSnap = await getDoc(docRef);
        if (directSnap.exists()) {
          snap = directSnap;
          docId = directSnap.id;
        }
      }

      if (!snap || !snap.exists()) {
        setError(true);
        setLoading(false);
        return;
      }

      const data = snap.data();
      const isStaffOrOwner = Boolean(
        user && (
          user.id === data.creatorId ||
          user.role === 'ADMIN' ||
          user.role === 'MODERATOR' ||
          user.role === 'MOD'
        )
      );

      if ((data.deletedAt || data.isHidden) && !isStaffOrOwner) {
        setError(true);
        setLoading(false);
        return;
      }

      const item = { id: docId, ...data } as CharacterItem;
      setCharacter(item);
      setLikesCount(item.likesCount || 0);
      setSavesCount(item.savesCount || 0);

      // View count with throttle (only if not hidden)
      if (!data.deletedAt && !data.isHidden) {
        const storageKey = `vviewed_char_${docId}`;
        const lastViewed = localStorage.getItem(storageKey);
        const now = Date.now();
        const throttleTime = 5 * 60 * 1000; // 5 minutes

        if (!lastViewed || (now - parseInt(lastViewed, 10)) > throttleTime) {
          setViewsCount((item.viewsCount || 0) + 1);
          localStorage.setItem(storageKey, now.toString());
          try {
            const docRefReal = doc(db, 'characters', docId);
            await updateDoc(docRefReal, { viewsCount: increment(1) });
          } catch (e) {
            console.error("View count update error:", e);
          }
        } else {
          setViewsCount(item.viewsCount || 0);
        }
      } else {
        setViewsCount(item.viewsCount || 0);
      }

      // Update document title
      document.title = `${item.name} - Character Roleplay | Thế giới nhập vai_AD`;

      // Fetch related characters
      fetchRelated(item);
    } catch (err) {
      console.error("Fetch character detail error:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const fetchRelated = async (currentChar: CharacterItem) => {
    try {
      const q = query(collection(db, 'characters'));
      const snap = await getDocs(q);
      const list: CharacterItem[] = [];

      snap.docs.forEach(d => {
        const data = d.data();
        if (d.id !== currentChar.id && !data.deletedAt && !data.isHidden) {
          list.push({ id: d.id, ...data } as CharacterItem);
        }
      });

      // Filter by same creator or tag match
      const related = list.filter(c => 
        c.creatorId === currentChar.creatorId ||
        c.tags?.some(t => currentChar.tags?.includes(t))
      ).slice(0, 3);

      setRelatedCharacters(related);
    } catch (e) {
      console.error("Fetch related characters error:", e);
    }
  };

  const { isCharacterLiked, isCharacterBookmarked, setLikedState, setBookmarkState } = useUserInteractions();

  // Sync initial likes & bookmarks from UserInteractionsContext
  useEffect(() => {
    if (!user?.id || !character?.id) {
      setIsLiked(false);
      setIsBookmarked(false);
      return;
    }
    setIsLiked(isCharacterLiked(character.id));
    setIsBookmarked(isCharacterBookmarked(character.id));
  }, [user?.id, character?.id, isCharacterLiked, isCharacterBookmarked]);

  useEffect(() => {
    fetchCharacter();
  }, [id]);

  const handleToggleLike = async () => {
    if (!user) {
      toast.error("Vui lòng đăng nhập để thích Character!");
      return;
    }
    if (!character) return;

    try {
      const q = query(
        collection(db, 'character_likes'),
        where('userId', '==', user.id),
        where('characterId', '==', character.id)
      );
      const snap = await getDocs(q);
      const charRef = doc(db, 'characters', character.id);

      if (!snap.empty) {
        for (const d of snap.docs) {
          await deleteDoc(doc(db, 'character_likes', d.id));
        }
        await updateDoc(charRef, { likesCount: increment(-1) });
        setIsLiked(false);
        setLikesCount(prev => Math.max(0, prev - 1));
      } else {
        await addDoc(collection(db, 'character_likes'), {
          userId: user.id,
          characterId: character.id,
          createdAt: serverTimestamp()
        });
        await updateDoc(charRef, { likesCount: increment(1) });
        setIsLiked(true);
        setLikesCount(prev => prev + 1);
        toast.success("Đã thích Character!");
      }
    } catch (err) {
      console.error("Toggle like error:", err);
      toast.error("Thao tác thất bại.");
    }
  };

  const handleToggleSave = async () => {
    if (!user) {
      toast.error("Vui lòng đăng nhập để lưu Character!");
      return;
    }
    if (!character) return;

    try {
      const q = query(
        collection(db, 'bookmarks'),
        where('userId', '==', user.id),
        where('targetId', '==', character.id),
        where('targetType', '==', 'CHARACTER')
      );
      const snap = await getDocs(q);
      const charRef = doc(db, 'characters', character.id);

      if (!snap.empty) {
        for (const d of snap.docs) {
          await deleteDoc(doc(db, 'bookmarks', d.id));
        }
        await updateDoc(charRef, { savesCount: increment(-1) });
        setIsBookmarked(false);
        setSavesCount(prev => Math.max(0, prev - 1));
      } else {
        await addDoc(collection(db, 'bookmarks'), {
          userId: user.id,
          targetId: character.id,
          targetType: 'CHARACTER',
          createdAt: serverTimestamp()
        });
        await updateDoc(charRef, { savesCount: increment(1) });
        setIsBookmarked(true);
        setSavesCount(prev => prev + 1);
        toast.success("Đã lưu Character vào bộ sưu tập!");
      }
    } catch (err) {
      console.error("Toggle save error:", err);
      toast.error("Thao tác thất bại.");
    }
  };

  const isOwner = user?.id === character?.creatorId;
  const isOwnerOrStaff = Boolean(
    user && (
      isOwner || 
      user.role === 'ADMIN' || 
      user.role === 'MODERATOR' || 
      user.role === 'MOD'
    )
  );

  const handleDeleteCharacter = () => {
    if (!character) return;
    setIsDeleteConfirmOpen(true);
  };

  const executeDeleteCharacter = async (reason?: string, details?: string) => {
    if (!character) return;
    try {
      const now = new Date().toISOString();
      const charRef = doc(db, 'characters', character.id);

      if (isOwner) {
        // Owner self-delete
        await updateDoc(charRef, {
          deletedAt: now,
          isHidden: true,
          deletedBy: user?.id
        });
        toast.success("Đã xóa Character thành công!");
      } else {
        // Admin / Moderator removal
        const finalReason = reason || "Vi phạm tiêu chuẩn cộng đồng";
        const finalDetails = details || finalReason;
        await updateDoc(charRef, {
          isHidden: true,
          deletedAt: now,
          deletedBy: user?.id,
          removalReason: finalReason,
          removalDetails: finalDetails,
          removalTime: now,
          appealStatus: 'NONE'
        });

        // Send notification to character owner
        if (character.creatorId) {
          await addDoc(collection(db, 'notifications'), {
            userId: character.creatorId,
            recipientId: character.creatorId,
            type: 'CONTENT_REMOVED',
            title: `Character "${character.name}" đã bị gỡ bỏ`,
            message: `Character của bạn đã bị gỡ bỏ bởi Quản trị viên. Lý do: ${finalReason}. Nhấp vào để xem chi tiết và gửi kháng nghị.`,
            targetType: 'CHARACTER',
            targetId: character.id,
            targetName: character.name,
            removalReason: finalReason,
            removalDetails: finalDetails,
            removalTime: now,
            read: false,
            createdAt: now
          });
        }

        // Log audit
        await addDoc(collection(db, 'audit_logs'), {
          executorId: user?.id,
          executorName: user?.displayName,
          action: 'DELETE_CHARACTER',
          targetId: character.id,
          targetType: 'CHARACTER',
          details: `Gỡ bỏ Character "${character.name}". Lý do: ${finalReason}`,
          createdAt: now
        });

        toast.success("Đã gỡ bỏ Character và gửi thông báo tới tác giả!");
      }

      navigate('/characters');
    } catch (err) {
      console.error("Delete character error:", err);
      toast.error("Không thể xóa Character.");
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-6">
        <div className="h-8 w-32 bg-neutral-200 dark:bg-neutral-800 rounded-xl animate-pulse" />
        <div className="h-80 bg-neutral-100 dark:bg-neutral-800 rounded-3xl animate-pulse" />
      </div>
    );
  }

  if (error || !character) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-16 h-16 bg-red-50 dark:bg-red-950/40 text-red-500 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
          Nội dung này không còn khả dụng
        </h2>
        <p className="text-neutral-500 text-sm max-w-md mx-auto">
          Character này có thể đã bị tác giả xoá, hoặc đường dẫn không đúng.
        </p>
        <button
          onClick={() => navigate('/characters')}
          className="mt-4 px-6 py-2.5 rounded-2xl bg-black dark:bg-white text-white dark:text-black font-bold text-sm hover:opacity-90 transition-opacity"
        >
          Khám phá Character khác
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 animate-fade-in">
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-xs font-bold text-neutral-500 hover:text-black dark:hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Quay lại</span>
      </button>

      {/* Removed / Hidden Warning Banner for Owner / Staff */}
      {(character.isHidden || character.deletedAt) && (
        <div className="p-5 rounded-2xl bg-red-500/10 border border-red-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-red-600 dark:text-red-400">
                Nội dung này đang bị ẩn / đã bị gỡ bỏ bởi Quản trị viên
              </h3>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                Lý do: <span className="font-semibold">{character.removalReason || 'Vi phạm tiêu chuẩn cộng đồng'}</span>
                {character.removalDetails && ` — ${character.removalDetails}`}
              </p>
            </div>
          </div>
          {isOwner && (
            <button
              onClick={() => setIsRemovalModalOpen(true)}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-colors shrink-0 shadow-sm"
            >
              Xem chi tiết & Kháng nghị
            </button>
          )}
        </div>
      )}

      {/* Main Character Hero Card */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-6 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-5">
            <img 
              src={getValidAvatar(character.avatar)} 
              alt={character.name}
              className="w-20 h-20 md:w-24 md:h-24 rounded-2xl object-cover border border-neutral-200 dark:border-neutral-800 shrink-0 shadow-md"
            />
            <div className="space-y-1.5">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl md:text-3xl font-extrabold text-neutral-900 dark:text-neutral-100">
                    {character.name}
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                    {character.gender || "Chưa xác định"}
                  </span>
                </div>
                <div>
                  <DisplayId type="character" numericId={character.numericId} />
                </div>
              </div>

              <p className="text-xs text-neutral-500 flex items-center gap-2">
                <span>Tác giả:</span>
                <Link 
                  to={`/creator/${character.creatorId}`}
                  className="font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
                >
                  <span>{character.creatorName || "Khuyết danh"}</span>
                  <Sparkles className="w-3 h-3 fill-current" />
                </Link>
              </p>

              <div className="flex items-center gap-4 pt-1 text-xs text-neutral-500 font-medium">
                <span className="flex items-center gap-1"><Eye className="w-4 h-4 text-neutral-400" /> {viewsCount} lượt xem</span>
                <span className="flex items-center gap-1"><Heart className="w-4 h-4 text-red-500 fill-red-500" /> {likesCount} thích</span>
                <span className="flex items-center gap-1"><Bookmark className="w-4 h-4 text-amber-500 fill-amber-500" /> {savesCount} lưu</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto shrink-0">
            <button
              onClick={handleToggleLike}
              className={`flex-1 md:flex-none px-4 py-3 md:py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                isLiked 
                  ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-600 dark:text-red-400' 
                  : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100'
              }`}
            >
              <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
              <span>{isLiked ? 'Đã thích' : 'Thích'}</span>
            </button>

            <button
              onClick={handleToggleSave}
              className={`flex-1 md:flex-none px-4 py-3 md:py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                isBookmarked 
                  ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-600 dark:text-amber-400' 
                  : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100'
              }`}
            >
              <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
              <span>{isBookmarked ? 'Đã lưu' : 'Lưu'}</span>
            </button>

            <button
              onClick={() => setIsShareOpen(true)}
              className="p-3 md:p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 transition-colors flex items-center justify-center gap-1.5 text-xs font-bold"
              title="Chia sẻ Character"
            >
              <Share2 className="w-4 h-4 text-amber-500" />
              <span>Chia sẻ</span>
            </button>

            <button
              onClick={() => setIsReportOpen(true)}
              className="p-3 md:p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:text-red-500 transition-colors"
              title="Báo cáo"
            >
              <Flag className="w-4 h-4" />
            </button>

            {isOwnerOrStaff && (
              <button
                onClick={handleDeleteCharacter}
                className="p-3 md:p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/60 transition-colors"
                title="Xóa Character"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Details Grid */}
        <div className="space-y-6">
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-neutral-400 mb-2">
              Khẩu hiệu / Slogan
            </h3>
            <div className="p-4 bg-neutral-50 dark:bg-neutral-800/60 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 text-sm font-medium italic text-neutral-800 dark:text-neutral-200 leading-relaxed">
              "{character.slogan}"
            </div>
          </div>

          {character.creatorNote && (
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-2">
                Ghi chú của Tác giả (Creator Note)
              </h3>
              <div className="p-5 bg-amber-500/10 rounded-2xl border border-amber-500/20 text-sm text-neutral-800 dark:text-neutral-200 leading-relaxed whitespace-pre-wrap">
                {character.creatorNote}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-neutral-400 mb-2">
              Cốt truyện & Thiết lập nhân vật (Plot)
            </h3>
            <div className="p-5 bg-neutral-50 dark:bg-neutral-800/60 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 text-sm text-neutral-800 dark:text-neutral-200 leading-relaxed whitespace-pre-wrap">
              {character.plot}
            </div>
          </div>

          {character.openingScene && (
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-neutral-400 mb-2">
                Cảnh mở đầu (Opening Scene)
              </h3>
              <div className="p-5 bg-neutral-50 dark:bg-neutral-800/60 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 text-sm font-mono text-neutral-800 dark:text-neutral-200 leading-relaxed whitespace-pre-wrap">
                {character.openingScene}
              </div>
            </div>
          )}

          {character.tags && character.tags.length > 0 && (
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-neutral-400 mb-2">
                Thẻ / Tags
              </h3>
              <div className="flex flex-wrap gap-2">
                {character.tags.map((t, i) => (
                  <span key={i} className="px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-xs font-medium text-neutral-600 dark:text-neutral-300">
                    #{t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Primary & Additional Links to Launch on AI Studio */}
          <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800 space-y-3">
            {(character.characterLink || (character.additionalLinks && character.additionalLinks.length > 0)) ? (
              <>
                {character.characterLink && (
                  <a 
                    href={character.characterLink} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="w-full py-3.5 px-6 rounded-2xl bg-black dark:bg-white text-white dark:text-black font-extrabold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-md active:scale-[0.99]"
                  >
                    <span>Trải nghiệm ngay trên Google AI Studio</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}

                {character.additionalLinks && character.additionalLinks.length > 0 && (
                  <div className="space-y-2.5 pt-2">
                    <h4 className="text-xs font-extrabold text-neutral-500 uppercase tracking-wider">
                      Các liên kết thử nghiệm bổ sung:
                    </h4>
                    {character.additionalLinks.map((aLink, idx) => (
                      <a
                        key={idx}
                        href={aLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-3.5 px-6 rounded-2xl bg-black dark:bg-white text-white dark:text-black font-extrabold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-md active:scale-[0.99]"
                      >
                        <span>
                          {character.additionalLinks!.length > 1
                            ? `Trải nghiệm ngay trên Google AI Studio #${idx + 1}`
                            : `Trải nghiệm ngay trên Google AI Studio`}
                        </span>
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs text-amber-600 dark:text-amber-400 font-medium text-center">
                Tác giả chưa đính kèm liên kết Google AI Studio cho Character này.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Comment Section */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 md:p-8 shadow-sm">
        <h2 className="text-lg font-bold mb-6 text-neutral-900 dark:text-neutral-100">
          Thảo luận cộng đồng
        </h2>
        <CommentSection
          targetId={character.id}
          targetType="CHARACTER"
          targetTitle={character.name}
          targetOwnerId={character.creatorId}
        />
      </div>

      {/* Related Characters */}
      {relatedCharacters.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-extrabold text-base text-neutral-900 dark:text-neutral-100">
            Character tương tự
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {relatedCharacters.map(c => (
              <CharacterCard key={c.id} character={c} />
            ))}
          </div>
        </div>
      )}

      {/* Report Modal */}
      <ReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        targetType="CHARACTER"
        targetId={character.id}
        targetName={character.name}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={executeDeleteCharacter}
        onConfirmWithReason={(r, d) => executeDeleteCharacter(r, d)}
        requireReason={!isOwner}
        title={!isOwner ? "Gỡ bỏ Character của thành viên?" : "Xóa Character?"}
        description={
          !isOwner 
            ? "Vui lòng chọn và nhập lý do gỡ bỏ để thông báo chính thức tới tác giả và lưu vào Nhật ký kiểm duyệt." 
            : "Bạn có chắc chắn muốn xóa Character này không? Hành động này sẽ gỡ bỏ Character khỏi danh sách công khai."
        }
        confirmText={!isOwner ? "Xác nhận gỡ bỏ" : "Xác nhận xóa"}
        cancelText="Hủy bỏ"
      />

      {/* Removal & Appeal Modal for Owner */}
      {character && (
        <RemovalDetailModal
          isOpen={isRemovalModalOpen}
          onClose={() => setIsRemovalModalOpen(false)}
          targetType="CHARACTER"
          targetId={character.id}
          targetName={character.name}
          removalReason={character.removalReason}
          removalDetails={character.removalDetails}
          removalTime={character.removalTime || character.deletedAt}
        />
      )}

      {/* Share Modal */}
      {character && (
        <ShareModal
          isOpen={isShareOpen}
          onClose={() => setIsShareOpen(false)}
          type="CHARACTER"
          targetId={character.numericId || character.id}
          title={character.name}
          avatar={character.avatar}
          description={character.slogan}
        />
      )}
    </div>
  );
}
