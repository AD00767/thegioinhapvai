import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { UserCheck, UserPlus, Users, User as UserIcon, BookOpen, PenTool, Sparkles, Flag } from 'lucide-react';
import { collection, addDoc, query, where, getDocs, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { CreatorItem } from '../types';
import ReportModal from './ReportModal';
import UserBadge from './UserBadge';
import DisplayId from './DisplayId';
import toast from 'react-hot-toast';
import { checkIsFollowing, toggleFollow } from '../lib/followService';

interface CreatorCardProps {
  key?: React.Key;
  creator: CreatorItem;
  onUpdate?: () => void;
}

export default function CreatorCard({ creator, onUpdate }: CreatorCardProps) {
  const { user } = useAuthStore();
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(creator.followerCount || 0);
  const [loading, setLoading] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);

  useEffect(() => {
    setFollowerCount(creator.followerCount || 0);
  }, [creator.followerCount]);

  useEffect(() => {
    if (!user?.id || !creator.id) return;
    if (user.id === creator.id) return;

    const checkFollow = async () => {
      try {
        const hasFollow = await checkIsFollowing(user.id, creator.id);
        setIsFollowing(hasFollow);
      } catch (e) {
        console.error("Check follow error:", e);
      }
    };
    checkFollow();
  }, [user?.id, creator.id]);

  const handleToggleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      toast.error("Vui lòng đăng nhập để theo dõi Creator này!");
      return;
    }
    if (user.id === creator.id) {
      toast.error("Bạn không thể tự theo dõi chính mình!");
      return;
    }

    setLoading(true);
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
      if (onUpdate) onUpdate();
    } catch (e) {
      console.error("Toggle follow error:", e);
      toast.error("Thao tác thất bại.");
    } finally {
      setLoading(false);
    }
  };

  const isSelf = user?.id === creator.id;

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5 hover:border-neutral-300 dark:hover:border-neutral-700 transition-all shadow-sm hover:shadow-md flex flex-col justify-between">
      <div>
        <Link to={`/creator/${creator.id}`} className="flex items-center gap-4 mb-4 group/creator">
          <img 
            src={creator.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${creator.displayName}`} 
            alt={creator.displayName}
            className="w-14 h-14 rounded-full object-cover border border-neutral-200 dark:border-neutral-800 shrink-0 group-hover/creator:scale-105 transition-transform"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="font-bold text-base text-neutral-900 dark:text-neutral-100 truncate group-hover/creator:text-amber-500 dark:group-hover/creator:text-amber-400 transition-colors">
                {creator.displayName}
              </h3>
              <UserBadge subject={{ ...creator, creatorStatus: true }} size="xs" />
            </div>
            {creator.role !== 'ADMIN' && creator.role !== 'MODERATOR' && (
              <div className="mt-1">
                <DisplayId type="creator" numericId={creator.numericId} />
              </div>
            )}
            <p className="text-xs text-neutral-500 truncate mt-0.5">
              Creator Roleplay
            </p>
          </div>
        </Link>

        <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2 mb-3 leading-relaxed">
          {creator.bio || "Chưa có lời giới thiệu."}
        </p>

        {/* Social Media Quick Access Icons */}
        {creator.socialLinks && (
          (creator.socialLinks.facebook || creator.socialLinks.instagram || creator.socialLinks.tiktok || creator.socialLinks.discord) ? (
            <div className="flex items-center gap-2 mb-4 pt-1">
              <span className="text-[11px] font-medium text-neutral-400">Liên kết:</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {creator.socialLinks.facebook && (
                  <a
                    href={creator.socialLinks.facebook.startsWith('http') ? creator.socialLinks.facebook : `https://${creator.socialLinks.facebook}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors"
                    title="Facebook"
                  >
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  </a>
                )}
                {creator.socialLinks.instagram && (
                  <a
                    href={creator.socialLinks.instagram.startsWith('http') ? creator.socialLinks.instagram : `https://${creator.socialLinks.instagram}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="p-1.5 rounded-lg bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 hover:bg-pink-100 dark:hover:bg-pink-900/60 transition-colors"
                    title="Instagram"
                  >
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                  </a>
                )}
                {creator.socialLinks.tiktok && (
                  <a
                    href={creator.socialLinks.tiktok.startsWith('http') ? creator.socialLinks.tiktok : `https://${creator.socialLinks.tiktok}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="p-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                    title="TikTok"
                  >
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.67 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.82.57-1.33 1.53-1.32 2.53a3.18 3.18 0 0 0 1.25 2.53 3.1 3.1 0 0 0 2.9.36 3.15 3.15 0 0 0 1.96-2.61c.14-1.21.05-2.43.07-3.65.01-4.27.01-8.54.01-12.81z"/>
                    </svg>
                  </a>
                )}
                {creator.socialLinks.discord && (
                  <a
                    href={creator.socialLinks.discord.startsWith('http') ? creator.socialLinks.discord : `https://${creator.socialLinks.discord}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors"
                    title="Discord"
                  >
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                    </svg>
                  </a>
                )}
              </div>
            </div>
          ) : null
        )}

        <div className="grid grid-cols-3 gap-2 bg-neutral-50 dark:bg-neutral-800/50 p-3 rounded-xl border border-neutral-100 dark:border-neutral-800 text-center mb-4">
          <div>
            <div className="text-xs text-neutral-500 flex items-center justify-center gap-1">
              <UserIcon className="w-3 h-3" />
              <span>Characters</span>
            </div>
            <div className="text-sm font-bold mt-0.5 text-neutral-900 dark:text-neutral-100">
              {creator.characterCount || 0}
            </div>
          </div>
          <div>
            <div className="text-xs text-neutral-500 flex items-center justify-center gap-1">
              <PenTool className="w-3 h-3" />
              <span>Prompts</span>
            </div>
            <div className="text-sm font-bold mt-0.5 text-neutral-900 dark:text-neutral-100">
              {creator.promptCount || 0}
            </div>
          </div>
          <div>
            <div className="text-xs text-neutral-500 flex items-center justify-center gap-1">
              <Users className="w-3 h-3" />
              <span>Followers</span>
            </div>
            <div className="text-sm font-bold mt-0.5 text-neutral-900 dark:text-neutral-100">
              {followerCount}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 w-full mt-4">
        <Link
          to={`/creator/${creator.id}`}
          className="w-full py-2.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-900 dark:text-neutral-100 font-bold text-xs uppercase tracking-widest rounded-xl text-center flex items-center justify-center gap-1 transition-all border border-neutral-200 dark:border-neutral-700"
        >
          <span>Xem Trang Creator</span>
        </Link>
        
        <div className="flex gap-2">
          {!isSelf && (
            <button
              onClick={handleToggleFollow}
              disabled={loading}
              className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                isFollowing
                  ? 'bg-neutral-150 dark:bg-neutral-850 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                  : 'bg-black dark:bg-white text-white dark:text-black hover:opacity-90'
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
                  <span>Theo dõi</span>
                </>
              )}
            </button>
          )}
          {!isSelf && (
            <button
              onClick={(e) => { e.stopPropagation(); setIsReportOpen(true); }}
              className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:text-red-500 transition-colors"
              title="Báo cáo Creator"
            >
              <Flag className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <ReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        targetType="CREATOR"
        targetId={creator.id}
        targetName={creator.displayName}
      />
    </div>
  );
}
