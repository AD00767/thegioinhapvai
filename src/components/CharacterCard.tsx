import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Heart, 
  Bookmark, 
  Eye, 
  ExternalLink, 
  Sparkles, 
  User as UserIcon, 
  Tag, 
  MoreVertical, 
  Pin, 
  Edit3, 
  Trash2, 
  Share2, 
  Flag 
} from 'lucide-react';
import { doc, updateDoc, increment, collection, addDoc, query, where, getDocs, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { useUserInteractions } from '../context/UserInteractionsContext';
import { CharacterItem } from '../types';
import ReportModal from './ReportModal';
import DeleteConfirmModal from './DeleteConfirmModal';
import ShareModal from './ShareModal';
import DisplayId from './DisplayId';
import { buildCharacterUrl } from '../lib/urls';
import toast from 'react-hot-toast';

interface CharacterCardProps {
  key?: React.Key;
  character: CharacterItem;
  isOwner?: boolean;
  onUpdate?: () => void;
  onEdit?: (character: CharacterItem) => void;
  onDelete?: (characterId: string) => void;
  onPin?: (character: CharacterItem) => void;
  onShare?: (character: CharacterItem) => void;
}

export default function CharacterCard({ 
  character, 
  isOwner,
  onUpdate,
  onEdit,
  onDelete,
  onPin,
  onShare
}: CharacterCardProps) {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(character.likesCount || 0);

  const [isBookmarked, setIsBookmarked] = useState(false);
  const [savesCount, setSavesCount] = useState(character.savesCount || 0);

  const [viewsCount, setViewsCount] = useState(character.viewsCount || 0);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { isCharacterLiked, isCharacterBookmarked, setLikedState, setBookmarkState } = useUserInteractions();

  // Determine owner state
  const isCardOwner = isOwner !== undefined 
    ? isOwner 
    : Boolean(user?.id && character.creatorId && (user.id === character.creatorId || user.role === 'ADMIN'));

  // Sync initial like & bookmark state from context
  useEffect(() => {
    if (!user?.id || !character.id) {
      setIsLiked(false);
      setIsBookmarked(false);
      return;
    }
    setIsLiked(isCharacterLiked(character.id));
    setIsBookmarked(isCharacterBookmarked(character.id));
  }, [user?.id, character.id, isCharacterLiked, isCharacterBookmarked]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  const handleToggleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      toast.error("Vui lòng đăng nhập để thích Character này!");
      return;
    }

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
        setLikedState(character.id, false);
        setLikesCount(prev => Math.max(0, prev - 1));
      } else {
        await addDoc(collection(db, 'character_likes'), {
          userId: user.id,
          characterId: character.id,
          createdAt: serverTimestamp()
        });
        await updateDoc(charRef, { likesCount: increment(1) });
        setIsLiked(true);
        setLikedState(character.id, true);
        setLikesCount(prev => prev + 1);
        toast.success("Đã thích Character!");

        if (character.creatorId && character.creatorId !== user.id) {
          await addDoc(collection(db, 'notifications'), {
            recipientId: character.creatorId,
            senderId: user.id,
            senderName: user.displayName || 'Người dùng',
            senderAvatar: user.avatar || '',
            type: 'CHARACTER_LIKE',
            title: 'Character được yêu thích',
            message: `${user.displayName || 'Một người dùng'} đã thích Character "${character.name}" của bạn.`,
            targetId: character.id,
            targetType: 'CHARACTER',
            read: false,
            createdAt: new Date().toISOString()
          });
        }
      }
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error("Toggle like error:", err);
      toast.error("Thao tác thất bại.");
    }
  };

  const handleToggleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      toast.error("Vui lòng đăng nhập để lưu Character này!");
      return;
    }

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
        setBookmarkState(character.id, 'CHARACTER', false);
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
        setBookmarkState(character.id, 'CHARACTER', true);
        setSavesCount(prev => prev + 1);
        toast.success("Đã lưu Character vào bộ sưu tập!");

        if (character.creatorId && character.creatorId !== user.id) {
          await addDoc(collection(db, 'notifications'), {
            recipientId: character.creatorId,
            senderId: user.id,
            senderName: user.displayName || 'Người dùng',
            senderAvatar: user.avatar || '',
            type: 'CHARACTER_SAVE',
            title: 'Character được thêm vào yêu thích/lưu',
            message: `${user.displayName || 'Một người dùng'} đã lưu Character "${character.name}" của bạn vào bộ sưu tập.`,
            targetId: character.id,
            targetType: 'CHARACTER',
            read: false,
            createdAt: new Date().toISOString()
          });
        }
      }
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error("Toggle save error:", err);
      toast.error("Thao tác thất bại.");
    }
  };

  const handleOpenDetail = () => {
    if (character.numericId) {
      navigate(`/character/${character.numericId}`);
    } else {
      navigate(`/character/${character.id}`);
    }
  };

  const handleTogglePin = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen(false);
    if (onPin) {
      onPin(character);
      return;
    }
    try {
      const charRef = doc(db, 'characters', character.id);
      const newPinned = !character.pinned;
      await updateDoc(charRef, { pinned: newPinned });
      toast.success(newPinned ? "Đã ghim Character!" : "Đã bỏ ghim Character!");
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error("Pin error:", err);
      toast.error("Không thể ghim Character.");
    }
  };

  const handleConfirmDelete = async () => {
    if (onDelete) {
      onDelete(character.id);
      setIsDeleteOpen(false);
      return;
    }
    try {
      await deleteDoc(doc(db, 'characters', character.id));
      toast.success("Đã xóa Character!");
      setIsDeleteOpen(false);
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("Không thể xóa Character.");
    }
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen(false);
    if (onEdit) {
      onEdit(character);
    } else {
      handleOpenDetail();
    }
  };

  const handleShareClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen(false);
    if (onShare) {
      onShare(character);
    } else {
      setIsShareOpen(true);
    }
  };

  const characterLinkUrl = character.characterLink || character.link;

  return (
    <>
      <div 
        onClick={handleOpenDetail}
        className={`group cursor-pointer bg-white dark:bg-neutral-900 border rounded-2xl p-4 md:p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden ${
          character.pinned 
            ? 'border-amber-500/50 dark:border-amber-500/40 bg-gradient-to-b from-amber-500/5 to-transparent' 
            : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700'
        }`}
      >
        <div>
          {/* Header Row: Avatar, Title, ID, Author & 3-Dots Menu */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex gap-3 min-w-0 flex-1">
              <img 
                src={character.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"} 
                alt={character.name}
                className="w-16 h-16 md:w-20 md:h-20 rounded-xl object-cover shrink-0 border border-neutral-200 dark:border-neutral-800 shadow-sm group-hover:scale-105 transition-transform"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className="font-extrabold text-sm md:text-base text-neutral-900 dark:text-neutral-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors line-clamp-1">
                    {character.name}
                  </h3>
                  {character.pinned && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[10px] font-bold rounded-full shrink-0">
                      <Sparkles className="w-2.5 h-2.5" />
                      Đã ghim
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <DisplayId type="character" numericId={character.numericId} />
                  {character.gender && (
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-medium shrink-0">
                      {character.gender}
                    </span>
                  )}
                </div>

                <div className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-1 truncate">
                  <UserIcon className="w-3 h-3 text-neutral-400 shrink-0" />
                  <span className="truncate">
                    Tác giả: {character.creatorId ? (
                      <span 
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/creator/${character.creatorId}`);
                        }}
                        className="text-neutral-700 dark:text-neutral-300 font-semibold hover:text-amber-600 dark:hover:text-amber-400 hover:underline"
                      >
                        {character.creatorName || "Khuyết danh"}
                      </span>
                    ) : (
                      <span className="text-neutral-700 dark:text-neutral-300 font-semibold">
                        {character.creatorName || "Khuyết danh"}
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Three Dots Menu Button */}
            <div className="relative shrink-0" ref={menuRef}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMenuOpen(!isMenuOpen);
                }}
                className="p-1.5 rounded-xl text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                title="Tùy chọn"
                aria-label="Tùy chọn Character"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {/* Dropdown Menu */}
              {isMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-48 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl z-30 py-1.5 text-xs font-semibold animate-in fade-in duration-150">
                  {isCardOwner ? (
                    <>
                      <button
                        onClick={handleEditClick}
                        className="w-full text-left px-3.5 py-2 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2 transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-blue-500" />
                        <span>Chỉnh sửa</span>
                      </button>

                      <button
                        onClick={handleTogglePin}
                        className="w-full text-left px-3.5 py-2 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2 transition-colors"
                      >
                        <Pin className="w-3.5 h-3.5 text-amber-500" />
                        <span>{character.pinned ? 'Bỏ ghim' : 'Ghim'}</span>
                      </button>

                      {characterLinkUrl && (
                        <a
                          href={characterLinkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsMenuOpen(false);
                          }}
                          className="w-full text-left px-3.5 py-2 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Mở link</span>
                        </a>
                      )}

                      <button
                        onClick={handleShareClick}
                        className="w-full text-left px-3.5 py-2 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2 transition-colors"
                      >
                        <Share2 className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Chia sẻ</span>
                      </button>

                      <div className="border-t border-neutral-100 dark:border-neutral-800 my-1 pt-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsMenuOpen(false);
                            setIsDeleteOpen(true);
                          }}
                          className="w-full text-left px-3.5 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Xóa</span>
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={handleShareClick}
                        className="w-full text-left px-3.5 py-2 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2 transition-colors"
                      >
                        <Share2 className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Chia sẻ</span>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsMenuOpen(false);
                          setIsReportOpen(true);
                        }}
                        className="w-full text-left px-3.5 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2 transition-colors"
                      >
                        <Flag className="w-3.5 h-3.5" />
                        <span>Báo cáo</span>
                      </button>

                      {characterLinkUrl && (
                        <a
                          href={characterLinkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsMenuOpen(false);
                          }}
                          className="w-full text-left px-3.5 py-2 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Mở link</span>
                        </a>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Slogan */}
          <p className="text-xs md:text-sm text-neutral-600 dark:text-neutral-300 line-clamp-2 my-2.5 leading-relaxed">
            {character.slogan || "Chưa có slogan."}
          </p>

          {/* Tags */}
          {character.tags && character.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 my-3">
              {character.tags.slice(0, 4).map((tag, idx) => (
                <span 
                  key={idx} 
                  className="inline-flex items-center gap-1 text-[11px] font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 px-2 py-0.5 rounded-md"
                >
                  <Tag className="w-2.5 h-2.5 text-neutral-400" />
                  <span>#{tag}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Card Footer: Stats & Link */}
        <div className="flex items-center justify-between pt-3 mt-2 border-t border-neutral-100 dark:border-neutral-800 text-xs text-neutral-500 dark:text-neutral-400">
          <div className="flex items-center gap-3 font-medium">
            <span className="flex items-center gap-1" title="Lượt xem">
              <Eye className="w-3.5 h-3.5 text-neutral-400" />
              <span>{viewsCount}</span>
            </span>
            <button 
              onClick={handleToggleLike} 
              className={`flex items-center gap-1 hover:text-red-500 transition-colors ${isLiked ? 'text-red-500 font-medium' : ''}`}
              title="Lượt thích"
            >
              <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} />
              <span>{likesCount}</span>
            </button>
            <button 
              onClick={handleToggleSave} 
              className={`flex items-center gap-1 hover:text-amber-500 transition-colors ${isBookmarked ? 'text-amber-500 font-medium' : ''}`}
              title="Lượt lưu"
            >
              <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current' : ''}`} />
              <span>{savesCount}</span>
            </button>
          </div>

          {characterLinkUrl ? (
            <a 
              href={characterLinkUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 font-semibold text-neutral-800 dark:text-neutral-200 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
            >
              <span>AI Studio</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          ) : (
            <span className="text-[11px] text-neutral-400 font-medium">
              Chưa có link
            </span>
          )}
        </div>
      </div>

      <ReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        targetType="CHARACTER"
        targetId={character.id}
        targetName={character.name}
      />

      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        type="CHARACTER"
        targetId={character.numericId || character.id}
        title={character.name}
        avatar={character.avatar}
        description={character.slogan}
      />

      <DeleteConfirmModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Xóa Character?"
        description={`Bạn có chắc chắn muốn xóa Character "${character.name}" không? Hành động này không thể hoàn tác.`}
        confirmText="Xác nhận xóa"
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
