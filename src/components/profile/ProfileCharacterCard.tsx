import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Pin, 
  Edit3, 
  Trash2, 
  ExternalLink, 
  Share2, 
  MoreVertical, 
  Heart, 
  Bookmark, 
  Eye, 
  Sparkles,
  User as UserIcon,
  Tag
} from 'lucide-react';
import { CharacterItem } from '../../types';
import DisplayId from '../DisplayId';
import toast from 'react-hot-toast';

interface ProfileCharacterCardProps {
  character: CharacterItem;
  isOwner?: boolean;
  onEdit?: (character: CharacterItem) => void;
  onDelete?: (characterId: string) => void;
  onPin?: (character: CharacterItem) => void;
  onShare?: (character: CharacterItem) => void;
}

export default function ProfileCharacterCard({
  character,
  isOwner = true,
  onEdit,
  onDelete,
  onPin,
  onShare
}: ProfileCharacterCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  const handleCopyShareLink = () => {
    const charIdentifier = character.numericId || character.id;
    const shareUrl = `${window.location.origin}/character/${charIdentifier}`;
    navigator.clipboard.writeText(shareUrl);
    toast.success("Đã sao chép liên kết chia sẻ Character!");
    setIsMenuOpen(false);
  };

  const characterUrl = `/character/${character.numericId || character.id}`;

  return (
    <div className={`relative group bg-white dark:bg-neutral-900 border rounded-2xl p-4 md:p-5 shadow-sm transition-all duration-200 hover:shadow-md flex flex-col justify-between ${
      character.pinned 
        ? 'border-amber-500/50 dark:border-amber-500/40 bg-gradient-to-b from-amber-500/5 to-transparent' 
        : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700'
    }`}>
      
      {/* Top Header Row: Avatar, Name, ID, Author & 3-dots Menu */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex gap-3 min-w-0 flex-1">
            {/* Character Avatar */}
            <Link to={characterUrl} className="shrink-0 group-hover:scale-105 transition-transform duration-200">
              <img 
                src={character.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"} 
                alt={character.name} 
                className="w-16 h-16 md:w-20 md:h-20 rounded-xl object-cover border border-neutral-200 dark:border-neutral-800 shadow-sm"
              />
            </Link>

            {/* Title, Numeric ID & Author */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <Link 
                  to={characterUrl} 
                  className="font-extrabold text-sm md:text-base text-neutral-900 dark:text-neutral-100 hover:text-amber-600 dark:hover:text-amber-400 transition-colors line-clamp-1"
                  title={character.name}
                >
                  {character.name}
                </Link>
                {character.pinned && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[10px] font-bold rounded-full">
                    <Sparkles className="w-2.5 h-2.5" />
                    Đã ghim
                  </span>
                )}
              </div>

              {/* ID Badge using Numeric ID */}
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <DisplayId type="character" numericId={character.numericId} />
                {character.gender && (
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-medium">
                    {character.gender}
                  </span>
                )}
              </div>

              {/* Author */}
              <div className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-1 truncate">
                <UserIcon className="w-3 h-3 text-neutral-400 shrink-0" />
                <span className="truncate">
                  Tác giả: <strong className="text-neutral-700 dark:text-neutral-300 font-semibold">{character.creatorName || "Thành viên"}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Three Dots Menu Button */}
          <div className="relative shrink-0" ref={menuRef}>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-1.5 rounded-xl text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              title="Tùy chọn"
              aria-label="Tùy chọn Character"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {/* Dropdown Menu */}
            {isMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-48 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl z-30 py-1.5 animate-in fade-in duration-150">
                {isOwner && onPin && (
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      onPin(character);
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2 transition-colors"
                  >
                    <Pin className="w-3.5 h-3.5 text-amber-500" />
                    <span>{character.pinned ? 'Bỏ ghim' : 'Ghim lên đầu'}</span>
                  </button>
                )}

                {isOwner && onEdit && (
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      onEdit(character);
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2 transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-blue-500" />
                    <span>Chỉnh sửa Character</span>
                  </button>
                )}

                {character.link && (
                  <a
                    href={character.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setIsMenuOpen(false)}
                    className="w-full text-left px-3.5 py-2 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Mở Google AI Studio</span>
                  </a>
                )}

                <button
                  onClick={() => {
                    if (onShare) {
                      setIsMenuOpen(false);
                      onShare(character);
                    } else {
                      handleCopyShareLink();
                    }
                  }}
                  className="w-full text-left px-3.5 py-2 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2 transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Chia sẻ liên kết</span>
                </button>

                {isOwner && onDelete && (
                  <div className="border-t border-neutral-100 dark:border-neutral-800 my-1 pt-1">
                    <button
                      onClick={() => {
                        setIsMenuOpen(false);
                        onDelete(character.id);
                      }}
                      className="w-full text-left px-3.5 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Xóa Character</span>
                    </button>
                  </div>
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
            {character.tags.slice(0, 5).map((tag, idx) => (
              <span 
                key={idx} 
                className="inline-flex items-center gap-1 text-[11px] font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 px-2 py-0.5 rounded-md"
              >
                <Tag className="w-2.5 h-2.5 text-neutral-400" />
                <span>{tag}</span>
              </span>
            ))}
            {character.tags.length > 5 && (
              <span className="text-[11px] text-neutral-400 self-center">
                +{character.tags.length - 5}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Card Footer: Stats & Link */}
      <div className="flex items-center justify-between pt-3 mt-2 border-t border-neutral-100 dark:border-neutral-800 text-xs text-neutral-500 dark:text-neutral-400">
        <div className="flex items-center gap-3 font-medium">
          <span className="flex items-center gap-1" title="Lượt xem">
            <Eye className="w-3.5 h-3.5 text-neutral-400" />
            <span>{character.viewsCount || 0}</span>
          </span>
          <span className="flex items-center gap-1" title="Lượt thích">
            <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500/20" />
            <span>{character.likesCount || 0}</span>
          </span>
          <span className="flex items-center gap-1" title="Lượt lưu">
            <Bookmark className="w-3.5 h-3.5 text-amber-500 fill-amber-500/20" />
            <span>{character.savesCount || 0}</span>
          </span>
        </div>

        {character.link ? (
          <a
            href={character.link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 font-semibold text-neutral-800 dark:text-neutral-200 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
          >
            <span>AI Studio</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        ) : (
          <span className="text-[11px] text-neutral-400">
            Chưa có link
          </span>
        )}
      </div>
    </div>
  );
}
