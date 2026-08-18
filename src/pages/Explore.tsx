import React, { useState, useEffect } from 'react';
import { 
  Compass, Sparkles, User as UserIcon, PenTool, BookOpen, 
  Search, Filter, Flame, Clock, Star, ArrowRight, Tag, RefreshCw
} from 'lucide-react';
import { collection, query, getDocs, orderBy, limit, where, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { CharacterItem, PromptItem, CreatorItem } from '../types';
import CharacterCard from '../components/CharacterCard';
import PromptCard from '../components/PromptCard';
import CreatorCard from '../components/CreatorCard';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { useSeo } from '../hooks/useSeo';
import toast from 'react-hot-toast';

import { parseIdQuery, lookupIdInFirebase, matchesSearchText } from '../lib/searchUtils';

type FilterTab = 'all' | 'featured_characters' | 'new_characters' | 'featured_prompts' | 'new_prompts' | 'featured_creators' | 'new_creators';

export default function Explore() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [promptToDelete, setPromptToDelete] = useState<string | null>(null);

  useSeo({
    title: 'Khám Phá',
    description: 'Khám phá thế giới Roleplay và Prompt AI chất lượng nhất từ cộng đồng Google AI Studio.'
  });

  const [featuredCharacters, setFeaturedCharacters] = useState<CharacterItem[]>([]);
  const [newCharacters, setNewCharacters] = useState<CharacterItem[]>([]);
  
  const [featuredPrompts, setFeaturedPrompts] = useState<PromptItem[]>([]);
  const [newPrompts, setNewPrompts] = useState<PromptItem[]>([]);

  const [featuredCreators, setFeaturedCreators] = useState<CreatorItem[]>([]);
  const [newCreators, setNewCreators] = useState<CreatorItem[]>([]);

  const [allTags, setAllTags] = useState<string[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Characters
      const charsSnap = await getDocs(collection(db, 'characters'));
      const rawChars: CharacterItem[] = charsSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as CharacterItem))
        .filter(c => !c.deletedAt);

      // Featured Characters: sorted by likes/saves/views or pinned
      const featChars = [...rawChars].sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        const scoreA = (a.likesCount || 0) * 3 + (a.savesCount || 0) * 2 + (a.viewsCount || 0);
        const scoreB = (b.likesCount || 0) * 3 + (b.savesCount || 0) * 2 + (b.viewsCount || 0);
        return scoreB - scoreA;
      });
      setFeaturedCharacters(featChars.slice(0, 8));

      // New Characters: sorted by creation timestamp
      const newChars = [...rawChars].sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });
      setNewCharacters(newChars.slice(0, 8));

      // Extract Tags
      const tagsSet = new Set<string>();
      rawChars.forEach(c => c.tags?.forEach(t => tagsSet.add(t)));

      // 2. Fetch Prompts
      const promptsSnap = await getDocs(collection(db, 'prompts'));
      const rawPrompts: PromptItem[] = promptsSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as PromptItem))
        .filter(p => !p.deletedAt);

      rawPrompts.forEach(p => p.tags?.forEach(t => tagsSet.add(t)));
      setAllTags(Array.from(tagsSet).slice(0, 15));

      // Featured Prompts: sorted by copyCount or savesCount
      const featPrompts = [...rawPrompts].sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        const scoreA = (a.copyCount || 0) * 3 + (a.savesCount || 0) * 2 + (a.viewsCount || 0);
        const scoreB = (b.copyCount || 0) * 3 + (b.savesCount || 0) * 2 + (b.viewsCount || 0);
        return scoreB - scoreA;
      });
      setFeaturedPrompts(featPrompts.slice(0, 8));

      // New Prompts: sorted by creation timestamp
      const newPrs = [...rawPrompts].sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });
      setNewPrompts(newPrs.slice(0, 8));

      // 3. Fetch Creators
      const creatorsSnap = await getDocs(collection(db, 'users'));
      const rawCreators: CreatorItem[] = creatorsSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as CreatorItem))
        .filter(u => u.creatorStatus === true);

      // Featured Creators: sorted by followerCount or characterCount
      const featCreators = [...rawCreators].sort((a, b) => {
        const scoreA = (a.followerCount || 0) * 5 + (a.characterCount || 0) * 2;
        const scoreB = (b.followerCount || 0) * 5 + (b.characterCount || 0) * 2;
        return scoreB - scoreA;
      });
      setFeaturedCreators(featCreators.slice(0, 6));

      // New Creators: sorted by creation timestamp
      const newCr = [...rawCreators].sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });
      setNewCreators(newCr.slice(0, 6));

    } catch (err) {
      console.error("Explore load data error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleExploreSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const queryStr = searchQuery.trim();
    if (!queryStr) return;

    const idParse = parseIdQuery(queryStr);
    if (idParse.isIdQuery) {
      if (idParse.error) {
        toast.error(idParse.error);
        navigate(`/ai-search?q=${encodeURIComponent(queryStr)}`);
        return;
      }

      if (idParse.numericId) {
        try {
          const lookup = await lookupIdInFirebase(idParse.numericId, idParse.typeHint);
          if (lookup && lookup.found && lookup.path) {
            toast.success("Đã tìm thấy đối tượng chính xác theo ID!");
            navigate(lookup.path);
            return;
          } else {
            const errorMsg = lookup?.error || "ID không tồn tại trên hệ thống.";
            toast.error(errorMsg);
            navigate(`/ai-search?q=${encodeURIComponent(queryStr)}`);
            return;
          }
        } catch (err) {
          console.error("Exact lookup error in Explore page:", err);
        }
      }
    }
  };

  // Filter helper functions
  const filterBySearch = <T extends { name?: string; title?: string; displayName?: string; slogan?: string; purpose?: string; plot?: string; content?: string; authorName?: string; creatorName?: string; numericId?: string; id?: string; tags?: string[] }>(items: T[]): T[] => {
    return items.filter(item => {
      if (!searchQuery.trim() && !selectedTag) return true;
      const term = searchQuery.trim();
      const matchesSearch = !term ||
        matchesSearchText(item.name, term) ||
        matchesSearchText(item.title, term) ||
        matchesSearchText(item.displayName, term) ||
        matchesSearchText(item.slogan, term) ||
        matchesSearchText(item.purpose, term) ||
        matchesSearchText(item.plot, term) ||
        matchesSearchText(item.content, term) ||
        matchesSearchText(item.authorName, term) ||
        matchesSearchText(item.creatorName, term) ||
        matchesSearchText(item.numericId, term) ||
        matchesSearchText(item.id, term) ||
        (item.tags && item.tags.some(t => matchesSearchText(t, term)));

      const tagMatch = selectedTag ? item.tags?.includes(selectedTag) : true;
      return matchesSearch && tagMatch;
    });
  };

  const filteredFeaturedChars = filterBySearch<CharacterItem>(featuredCharacters);
  const filteredNewChars = filterBySearch<CharacterItem>(newCharacters);
  
  const filteredFeaturedPrompts = filterBySearch<PromptItem>(featuredPrompts);
  const filteredNewPrompts = filterBySearch<PromptItem>(newPrompts);

  const filteredFeaturedCreators = filterBySearch<CreatorItem>(featuredCreators);
  const filteredNewCreators = filterBySearch<CreatorItem>(newCreators);

  return (
    <div className="py-8 px-4 max-w-7xl mx-auto space-y-10">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-neutral-900 text-white p-8 md:p-12 border border-neutral-800 shadow-xl">
        <div className="absolute -right-10 -bottom-10 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 text-amber-400 text-xs font-semibold backdrop-blur-md mb-4 border border-white/10">
            <Compass className="w-4 h-4" />
            <span>Khám Phá Thế Giới Roleplay</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-4">
            Kho tài nguyên Roleplay & AI Studio hàng đầu
          </h1>
          <p className="text-neutral-300 text-sm md:text-base leading-relaxed mb-8">
            Tìm kiếm Character độc đáo, Prompt chất lượng cao và kết nối với những Creator xuất sắc nhất cộng đồng.
          </p>

          {/* Search & Tag Filter Bar */}
          <div className="space-y-4">
            <form onSubmit={handleExploreSearchSubmit} className="relative flex items-center">
              <Search className="absolute left-4 w-5 h-5 text-neutral-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm theo tên Character, Prompt, Creator hoặc nội dung..."
                className="w-full pl-12 pr-12 py-3.5 bg-neutral-800/80 backdrop-blur-md rounded-2xl border border-neutral-700 text-white placeholder-neutral-400 focus:outline-none focus:border-amber-500 transition-all text-sm"
              />
              {searchQuery && (
                <button 
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 text-neutral-400 hover:text-white text-xs font-bold bg-neutral-700 px-2 py-1 rounded-md"
                >
                  Xóa
                </button>
              )}
            </form>

            {/* Popular Tags */}
            {allTags.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs text-neutral-400">
                <span className="shrink-0 font-medium text-neutral-300 flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5" /> Thẻ hot:
                </span>
                <button
                  onClick={() => setSelectedTag(null)}
                  className={`shrink-0 px-2.5 py-1 rounded-full transition-colors ${
                    selectedTag === null ? 'bg-amber-500 text-black font-semibold' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                  }`}
                >
                  Tất cả
                </button>
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                    className={`shrink-0 px-2.5 py-1 rounded-full transition-colors ${
                      selectedTag === tag ? 'bg-amber-500 text-black font-semibold' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                    }`}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-neutral-200 dark:border-neutral-800">
        {[
          { id: 'all', label: 'Tất cả mục', icon: <Compass className="w-4 h-4" /> },
          { id: 'featured_characters', label: 'Character Nổi Bật', icon: <Flame className="w-4 h-4 text-amber-500" /> },
          { id: 'new_characters', label: 'Character Mới', icon: <Clock className="w-4 h-4 text-blue-500" /> },
          { id: 'featured_prompts', label: 'Prompt Nổi Bật', icon: <Sparkles className="w-4 h-4 text-emerald-500" /> },
          { id: 'new_prompts', label: 'Prompt Mới', icon: <PenTool className="w-4 h-4 text-purple-500" /> },
          { id: 'featured_creators', label: 'Creator Nổi Bật', icon: <Star className="w-4 h-4 text-amber-500" /> },
          { id: 'new_creators', label: 'Creator Mới', icon: <UserIcon className="w-4 h-4 text-pink-500" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as FilterTab)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-black dark:bg-white text-white dark:text-black shadow-sm'
                : 'bg-neutral-100 dark:bg-neutral-800/60 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Loading Skeleton */}
      {loading ? (
        <div className="space-y-12">
          {[1, 2, 3].map((s) => (
            <div key={s} className="space-y-4">
              <div className="h-8 w-48 bg-neutral-200 dark:bg-neutral-800 rounded-lg animate-pulse" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-48 bg-neutral-100 dark:bg-neutral-800/50 rounded-2xl animate-pulse" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-14">
          
          {/* SECTION 1: Character Nổi Bật */}
          {(activeTab === 'all' || activeTab === 'featured_characters') && (
            <section>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2 text-neutral-900 dark:text-neutral-100">
                    <Flame className="w-6 h-6 text-amber-500 fill-amber-500" />
                    <span>Character Nổi Bật</span>
                  </h2>
                  <p className="text-xs text-neutral-500 mt-1">Những Character nhận được nhiều lượt yêu thích và tương tác nhất</p>
                </div>
                {activeTab === 'all' && (
                  <button 
                    onClick={() => setActiveTab('featured_characters')}
                    className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white flex items-center gap-1"
                  >
                    <span>Xem tất cả</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {filteredFeaturedChars.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl text-neutral-500 text-sm">
                  Chưa có Character nổi bật nào khớp với tìm kiếm.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredFeaturedChars.map((char) => (
                    <CharacterCard key={char.id} character={char} onUpdate={loadData} />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* SECTION 2: Character Mới */}
          {(activeTab === 'all' || activeTab === 'new_characters') && (
            <section>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2 text-neutral-900 dark:text-neutral-100">
                    <Clock className="w-6 h-6 text-blue-500" />
                    <span>Character Mới Nhất</span>
                  </h2>
                  <p className="text-xs text-neutral-500 mt-1">Những nhân vật nhập vai mới được Creator chia sẻ</p>
                </div>
                {activeTab === 'all' && (
                  <button 
                    onClick={() => setActiveTab('new_characters')}
                    className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white flex items-center gap-1"
                  >
                    <span>Xem tất cả</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {filteredNewChars.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl text-neutral-500 text-sm">
                  Chưa có Character mới nào khớp với tìm kiếm.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredNewChars.map((char) => (
                    <CharacterCard key={char.id} character={char} onUpdate={loadData} />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* SECTION 3: Prompt Nổi Bật */}
          {(activeTab === 'all' || activeTab === 'featured_prompts') && (
            <section>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2 text-neutral-900 dark:text-neutral-100">
                    <Sparkles className="w-6 h-6 text-emerald-500 fill-emerald-500" />
                    <span>Prompt Nổi Bật</span>
                  </h2>
                  <p className="text-xs text-neutral-500 mt-1">Các câu lệnh Prompt được sao chép và lưu trữ nhiều nhất</p>
                </div>
                {activeTab === 'all' && (
                  <button 
                    onClick={() => setActiveTab('featured_prompts')}
                    className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white flex items-center gap-1"
                  >
                    <span>Xem tất cả</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {filteredFeaturedPrompts.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl text-neutral-500 text-sm">
                  Chưa có Prompt nổi bật nào khớp với tìm kiếm.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {filteredFeaturedPrompts.map((prompt) => (
                    <PromptCard 
                      key={prompt.id} 
                      prompt={prompt} 
                      isOwner={user?.id === prompt.authorId || user?.role === 'ADMIN'}
                      onDelete={(id) => setPromptToDelete(id)}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* SECTION 4: Prompt Mới */}
          {(activeTab === 'all' || activeTab === 'new_prompts') && (
            <section>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2 text-neutral-900 dark:text-neutral-100">
                    <PenTool className="w-6 h-6 text-purple-500" />
                    <span>Prompt Mới Nhất</span>
                  </h2>
                  <p className="text-xs text-neutral-500 mt-1">Các Prompt mới đăng từ các tác giả trong cộng đồng</p>
                </div>
                {activeTab === 'all' && (
                  <button 
                    onClick={() => setActiveTab('new_prompts')}
                    className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white flex items-center gap-1"
                  >
                    <span>Xem tất cả</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {filteredNewPrompts.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl text-neutral-500 text-sm">
                  Chưa có Prompt mới nào khớp với tìm kiếm.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {filteredNewPrompts.map((prompt) => (
                    <PromptCard 
                      key={prompt.id} 
                      prompt={prompt} 
                      isOwner={user?.id === prompt.authorId || user?.role === 'ADMIN'}
                      onDelete={(id) => setPromptToDelete(id)}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* SECTION 5: Creator Nổi Bật */}
          {(activeTab === 'all' || activeTab === 'featured_creators') && (
            <section>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2 text-neutral-900 dark:text-neutral-100">
                    <Star className="w-6 h-6 text-amber-500 fill-amber-500" />
                    <span>Creator Nổi Bật</span>
                  </h2>
                  <p className="text-xs text-neutral-500 mt-1">Các nhà sáng tạo nội dung tài năng nhận được sự ủng hộ cao</p>
                </div>
                {activeTab === 'all' && (
                  <button 
                    onClick={() => setActiveTab('featured_creators')}
                    className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white flex items-center gap-1"
                  >
                    <span>Xem tất cả</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {filteredFeaturedCreators.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl text-neutral-500 text-sm">
                  Chưa có Creator nổi bật nào khớp với tìm kiếm.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredFeaturedCreators.map((creator) => (
                    <CreatorCard key={creator.id} creator={creator} onUpdate={loadData} />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* SECTION 6: Creator Mới */}
          {(activeTab === 'all' || activeTab === 'new_creators') && (
            <section>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2 text-neutral-900 dark:text-neutral-100">
                    <UserIcon className="w-6 h-6 text-pink-500" />
                    <span>Creator Mới Tham Gia</span>
                  </h2>
                  <p className="text-xs text-neutral-500 mt-1">Những gương mặt Creator vừa được duyệt trong hệ thống</p>
                </div>
                {activeTab === 'all' && (
                  <button 
                    onClick={() => setActiveTab('new_creators')}
                    className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white flex items-center gap-1"
                  >
                    <span>Xem tất cả</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {filteredNewCreators.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl text-neutral-500 text-sm">
                  Chưa có Creator mới nào khớp với tìm kiếm.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredNewCreators.map((creator) => (
                    <CreatorCard key={creator.id} creator={creator} onUpdate={loadData} />
                  ))}
                </div>
              )}
            </section>
          )}

        </div>
      )}

      {/* Delete Prompt Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={promptToDelete !== null}
        onClose={() => setPromptToDelete(null)}
        onConfirm={async () => {
          if (!promptToDelete) return;
          try {
            await deleteDoc(doc(db, 'prompts', promptToDelete));
            toast.success("Đã xóa hoàn toàn Prompt khỏi hệ thống.");
            loadData();
          } catch (e) {
            toast.error("Không thể xóa Prompt.");
          }
        }}
      />
    </div>
  );
}
