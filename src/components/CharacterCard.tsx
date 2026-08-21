import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Bookmark, Eye, ExternalLink, Sparkles, User as UserIcon, Tag, MessageSquare, X, Flag } from 'lucide-react';
import { doc, updateDoc, increment, collection, addDoc, query, where, getDocs, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { useUserInteractions } from '../context/UserInteractionsContext';
import { CharacterItem } from '../types';
import CommentSection from './comments/CommentSection';
import ReportModal from './ReportModal';
import UserBadge from './UserBadge';
import DisplayId from './DisplayId';
import toast from 'react-hot-toast';

interface CharacterCardProps {
  key?: React.Key;
  character: CharacterItem;
  onUpdate?: () => void;
}

export default function CharacterCard({ character, onUpdate }: CharacterCardProps) {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(character.likesCount || 0);

  const [isBookmarked, setIsBookmarked] = useState(false);
  const [savesCount, setSavesCount] = useState(character.savesCount || 0);

  const [viewsCount, setViewsCount] = useState(character.viewsCount || 0);
  const [isReportOpen, setIsReportOpen] = useState(false);

  const { isCharacterLiked, isCharacterBookmarked, setLikedState, setBookmarkState } = useUserInteractions();

  // Sync initial like & bookmark state from context without sending per-card queries
  useEffect(() => {
    if (!user?.id || !character.id) {
      setIsLiked(false);
      setIsBookmarked(false);
      return;
    }
    setIsLiked(isCharacterLiked(character.id));
    setIsBookmarked(isCharacterBookmarked(character.id));
  }, [user?.id, character.id, isCharacterLiked, isCharacterBookmarked]);

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

        // Gửi thông báo đến Creator
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

        // Gửi thông báo đến Creator
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

  return (
    <>
      <div 
        onClick={handleOpenDetail}
        className="group cursor-pointer bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5 hover:border-neutral-300 dark:hover:border-neutral-700 transition-all shadow-sm hover:shadow-md flex flex-col justify-between relative overflow-hidden"
      >
        {character.pinned && (
          <div className="absolute top-3 right-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1 border border-amber-500/20">
            <Sparkles className="w-3 h-3" />
            Được ghim
          </div>
        )}

        <div>
          <div className="flex items-start gap-4 mb-4">
            <img 
              src={character.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"} 
              alt={character.name}
              className="w-16 h-16 rounded-xl object-cover shrink-0 border border-neutral-200 dark:border-neutral-800 group-hover:scale-105 transition-transform"
            />
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-base text-neutral-900 dark:text-neutral-100 truncate group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                {character.name}
              </h3>
              
              <div className="flex items-center gap-2 mt-1 mb-2">
                <DisplayId type="character" numericId={character.numericId} />
              </div>
              
              <div className="flex items-center gap-2 text-xs text-neutral-500">
                <span className="bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-md font-medium text-neutral-700 dark:text-neutral-300">
                  {character.gender || "Không xác định"}
                </span>
                <span>•</span>
                <span className="inline-flex items-center gap-1 truncate">
                  {character.creatorId ? (
                    <span 
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/creator/${character.creatorId}`);
                      }}
                      className="hover:text-amber-600 dark:hover:text-amber-400 hover:underline cursor-pointer font-medium"
                    >
                      Tác giả: {character.creatorName || "Khuyết danh"}
                    </span>
                  ) : (
                    <span>Tác giả: {character.creatorName || "Khuyết danh"}</span>
                  )}
                  <UserBadge subject={{ creatorStatus: true, characterCount: 1 }} size="xs" />
                </span>
              </div>
            </div>
          </div>

          <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2 mb-4 leading-relaxed">
            {character.slogan}
          </p>

          {character.tags && character.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {character.tags.slice(0, 4).map((tag, idx) => (
                <span key={idx} className="text-xs bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-xs text-neutral-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" />
              {viewsCount}
            </span>
            <button 
              onClick={handleToggleLike} 
              className={`flex items-center gap-1 p-2 -m-2 hover:text-red-500 transition-colors ${isLiked ? 'text-red-500 font-medium' : ''}`}
            >
              <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} />
              {likesCount}
            </button>
            <button 
              onClick={handleToggleSave} 
              className={`flex items-center gap-1 p-2 -m-2 hover:text-amber-500 transition-colors ${isBookmarked ? 'text-amber-500 font-medium' : ''}`}
            >
              <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current' : ''}`} />
              {savesCount}
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); setIsReportOpen(true); }} 
              className="flex items-center gap-1 p-2 -m-2 hover:text-red-500 transition-colors text-neutral-500"
              title="Báo cáo vi phạm"
            >
              <Flag className="w-3.5 h-3.5" />
            </button>
          </div>

          {character.characterLink ? (
            <a 
              href={character.characterLink} 
              target="_blank" 
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 font-medium text-neutral-800 dark:text-neutral-200 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
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
    </>
  );
}
