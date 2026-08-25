import React, { useState, useEffect, useMemo } from 'react';
import { 
  Compass, Sparkles, User as UserIcon, PenTool, BookOpen, 
  Search, Filter, Flame, Clock, Star, ArrowRight, Tag as TagIcon, RefreshCw, X, SlidersHorizontal
} from 'lucide-react';
import { collection, getDocs, doc, deleteDoc, query, where, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { CharacterItem, PromptItem, CreatorItem } from '../types';
import CharacterCard from '../components/CharacterCard';
import PromptCard from '../components/PromptCard';
import CreatorCard from '../components/CreatorCard';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import { executeDeletePrompt } from '../lib/promptService';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { useSeo } from '../hooks/useSeo';
import toast from 'react-hot-toast';
import { parseIdQuery, lookupIdInFirebase, matchesSearchText, matchesItemFields } from '../lib/searchUtils';

type ExploreBrowseTab = 'all' | 'featured_characters' | 'new_characters' | 'featured_prompts' | 'new_prompts' | 'featured_creators' | 'new_creators';
type SearchCategoryTab = 'ALL' | 'CHARACTERS' | 'PROMPTS' | 'CREATORS';
type SearchSortOption = 'RELEVANCE' | 'NEWEST' | 'POPULAR';

export default function Explore() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [browseTab, setBrowseTab] = useState<ExploreBrowseTab>('all');
  const [searchCategoryTab, setSearchCategoryTab] = useState<SearchCategoryTab>('ALL');
  const [searchSort, setSearchSort] = useState<SearchSortOption>('RELEVANCE');

  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || searchParams.get('search') || '');
  const [selectedTag, setSelectedTag] = useState<string | null>(searchParams.get('tag') || null);

  const [loading, setLoading] = useState(true);
  const [promptToDeleteItem, setPromptToDeleteItem] = useState<PromptItem | null>(null);

  const [allCharacters, setAllCharacters] = useState<CharacterItem[]>([]);
  const [allPrompts, setAllPrompts] = useState<PromptItem[]>([]);
  const [allCreators, setAllCreators] = useState<CreatorItem[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);

  useSeo({
    title: searchQuery ? `Tìm kiếm: ${searchQuery} — Khám Phá` : 'Khám Phá',
    description: 'Khám phá thế giới Roleplay và Prompt AI chất lượng nhất từ cộng đồng Google AI Studio.'
  });

  // Sync state with URL params
  useEffect(() => {
    const qParam = searchParams.get('q') || searchParams.get('search') || '';
    const tagParam = searchParams.get('tag');
    setSearchQuery(qParam);
    setSelectedTag(tagParam);
  }, [searchParams]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Characters (limit 50)
      const charsQuery = query(collection(db, 'characters'), limit(50));
      const charsSnap = await getDocs(charsQuery);
      const rawChars: CharacterItem[] = charsSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as CharacterItem))
        .filter((c: any) => !c.deletedAt && !c.isHidden);
      setAllCharacters(rawChars);

      // Extract unique tags
      const tagsSet = new Set<string>();
      rawChars.forEach(c => c.tags?.forEach(t => tagsSet.add(t)));

      // 2. Fetch Prompts (limit 50)
      const promptsQuery = query(collection(db, 'prompts'), limit(50));
      const promptsSnap = await getDocs(promptsQuery);
      const rawPrompts: PromptItem[] = promptsSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as PromptItem))
        .filter((p: any) => !p.deletedAt && !p.isHidden);
      setAllPrompts(rawPrompts);

      rawPrompts.forEach(p => p.tags?.forEach(t => tagsSet.add(t)));
      setAllTags(Array.from(tagsSet).slice(0, 15));

      // 3. Fetch Creators (limit 50 creators)
      const creatorsQuery = query(collection(db, 'users'), where('creatorStatus', '==', true), limit(50));
      const creatorsSnap = await getDocs(creatorsQuery);
      const rawCreators: CreatorItem[] = creatorsSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as CreatorItem))
        .filter((u: any) => !u.deletedAt && !u.isHidden && !u.isLocked);
      setAllCreators(rawCreators);

    } catch (err) {
      console.error("Explore load data error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const queryStr = searchQuery.trim();

    // Check if user entered an ID-specific query
    if (queryStr) {
      const idParse = parseIdQuery(queryStr);
      if (idParse.isIdQuery) {
        if (idParse.error) {
          toast.error(idParse.error);
        } else if (idParse.numericId) {
          try {
            const lookup = await lookupIdInFirebase(idParse.numericId, idParse.typeHint);
            if (lookup && lookup.found && lookup.path) {
              toast.success("Đã tìm thấy đối tượng chính xác theo ID!");
              navigate(lookup.path);
              return;
            } else {
              toast.error(lookup?.error || "Mã ID không tồn tại trên hệ thống.");
            }
          } catch (err) {
            console.error("Lookup error:", err);
          }
        }
      }
    }

    const params: Record<string, string> = {};
    if (queryStr) params.q = queryStr;
    if (selectedTag) params.tag = selectedTag;
    setSearchParams(params);
  };

  const handleTagToggle = (tag: string) => {
    const nextTag = selectedTag === tag ? null : tag;
    setSelectedTag(nextTag);
    const params: Record<string, string> = {};
    if (searchQuery.trim()) params.q = searchQuery.trim();
    if (nextTag) params.tag = nextTag;
    setSearchParams(params);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedTag(null);
    setSearchParams({});
  };

  const isSearchActive = searchQuery.trim().length > 0 || selectedTag !== null;

  // ==========================================
  // REAL SEARCH FILTERING LOGIC
  // Matches all fields: Name, Slogan, Plot, Purpose, Content, Tags, Creator, ID, NumericID
  // ==========================================
  const filteredCharacters = useMemo(() => {
    const term = searchQuery.trim();
    return allCharacters.filter(c => {
      const matchesSearch = !term || matchesItemFields(
        [c.name, c.slogan, c.plot, c.tags, c.creatorName, c.gender, c.characterLink, c.numericId, c.id],
        term
      );
      const matchesTag = selectedTag ? c.tags?.some(t => matchesSearchText(t, selectedTag)) : true;
      return matchesSearch && matchesTag;
    }).sort((a, b) => {
      if (searchSort === 'POPULAR') {
        const scoreA = (a.likesCount || 0) * 3 + (a.savesCount || 0) * 2 + (a.viewsCount || 0);
        const scoreB = (b.likesCount || 0) * 3 + (b.savesCount || 0) * 2 + (b.viewsCount || 0);
        return scoreB - scoreA;
      }
      if (searchSort === 'NEWEST') {
        const timeA = new Date(a.createdAt || 0).getTime();
        const timeB = new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      }
      // Relevance (pinned first, then popular score)
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      const scoreA = (a.likesCount || 0) * 3 + (a.savesCount || 0) * 2 + (a.viewsCount || 0);
      const scoreB = (b.likesCount || 0) * 3 + (b.savesCount || 0) * 2 + (b.viewsCount || 0);
      return scoreB - scoreA;
    });
  }, [allCharacters, searchQuery, selectedTag, searchSort]);

  const filteredPrompts = useMemo(() => {
    const term = searchQuery.trim();
    return allPrompts.filter(p => {
      const matchesSearch = !term || matchesItemFields(
        [p.name, p.title, p.purpose, p.content, p.tags, p.authorName, p.numericId, p.id],
        term
      );
      const matchesTag = selectedTag ? p.tags?.some(t => matchesSearchText(t, selectedTag)) : true;
      return matchesSearch && matchesTag;
    }).sort((a, b) => {
      if (searchSort === 'POPULAR') {
        const scoreA = (a.copyCount || 0) * 3 + (a.savesCount || 0) * 2 + (a.viewsCount || 0);
        const scoreB = (b.copyCount || 0) * 3 + (b.savesCount || 0) * 2 + (b.viewsCount || 0);
        return scoreB - scoreA;
      }
      if (searchSort === 'NEWEST') {
        const timeA = new Date(a.createdAt || 0).getTime();
        const timeB = new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      }
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      const scoreA = (a.copyCount || 0) * 3 + (a.savesCount || 0) * 2 + (a.viewsCount || 0);
      const scoreB = (b.copyCount || 0) * 3 + (b.savesCount || 0) * 2 + (b.viewsCount || 0);
      return scoreB - scoreA;
    });
  }, [allPrompts, searchQuery, selectedTag, searchSort]);

  const filteredCreators = useMemo(() => {
    const term = searchQuery.trim();
    return allCreators.filter(cr => {
      const matchesSearch = !term || matchesItemFields(
        [cr.displayName, cr.bio, cr.role, cr.numericId, cr.id],
        term
      );
      return matchesSearch;
    }).sort((a, b) => {
      if (searchSort === 'POPULAR') {
        const scoreA = (a.followerCount || 0) * 5 + (a.characterCount || 0) * 2 + (a.promptCount || 0);
        const scoreB = (b.followerCount || 0) * 5 + (b.characterCount || 0) * 2 + (b.promptCount || 0);
        return scoreB - scoreA;
      }
      if (searchSort === 'NEWEST') {
        const timeA = new Date(a.createdAt || 0).getTime();
        const timeB = new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      }
      const scoreA = (a.followerCount || 0) * 5 + (a.characterCount || 0) * 2 + (a.promptCount || 0);
      const scoreB = (b.followerCount || 0) * 5 + (b.characterCount || 0) * 2 + (b.promptCount || 0);
      return scoreB - scoreA;
    });
  }, [allCreators, searchQuery, searchSort]);

  const totalMatches = filteredCharacters.length + filteredPrompts.length + filteredCreators.length;

  // Browse mode subsets
  const featuredCharacters = useMemo(() => {
    return [...allCharacters]
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        const scoreA = (a.likesCount || 0) * 3 + (a.savesCount || 0) * 2 + (a.viewsCount || 0);
        const scoreB = (b.likesCount || 0) * 3 + (b.savesCount || 0) * 2 + (b.viewsCount || 0);
        return scoreB - scoreA;
      });
  }, [allCharacters]);

  const newCharacters = useMemo(() => {
    return [...allCharacters].sort((a, b) => {
      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      return timeB - timeA;
    });
  }, [allCharacters]);

  const featuredPrompts = useMemo(() => {
    return [...allPrompts].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      const scoreA = (a.copyCount || 0) * 3 + (a.savesCount || 0) * 2 + (a.viewsCount || 0);
      const scoreB = (b.copyCount || 0) * 3 + (b.savesCount || 0) * 2 + (b.viewsCount || 0);
      return scoreB - scoreA;
    });
  }, [allPrompts]);

  const newPrompts = useMemo(() => {
    return [...allPrompts].sort((a, b) => {
      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      return timeB - timeA;
    });
  }, [allPrompts]);

  const featuredCreators = useMemo(() => {
    return [...allCreators].sort((a, b) => {
      const scoreA = (a.followerCount || 0) * 5 + (a.characterCount || 0) * 2;
      const scoreB = (b.followerCount || 0) * 5 + (b.characterCount || 0) * 2;
      return scoreB - scoreA;
    });
  }, [allCreators]);

  const newCreators = useMemo(() => {
    return [...allCreators].sort((a, b) => {
      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      return timeB - timeA;
    });
  }, [allCreators]);

  return (
    <div className="py-8 px-4 max-w-7xl mx-auto space-y-8">
      {/* Hero Search & Filter Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-neutral-900 text-white p-6 md:p-10 border border-neutral-800 shadow-xl">
        <div className="absolute -right-10 -bottom-10 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 text-amber-400 text-xs font-semibold backdrop-blur-md mb-4 border border-white/10">
            <Compass className="w-4 h-4" />
            <span>Khám Phá Thế Giới Roleplay & Prompt</span>
          </div>
          <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight mb-3">
            Kho tài nguyên Roleplay cho Google AI Studio
          </h1>
          <p className="text-neutral-300 text-sm leading-relaxed mb-6">
            Tìm kiếm Character độc đáo, Prompt chất lượng cao và kết nối với những Creator xuất sắc nhất cộng đồng.
          </p>

          {/* Search Form */}
          <div className="space-y-4">
            <form onSubmit={handleSearchSubmit} className="relative flex items-center">
              <Search className="absolute left-4 w-5 h-5 text-neutral-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nhập tên Character, Prompt, Creator hoặc mã số ID 9 chữ số..."
                className="w-full pl-12 pr-28 py-3.5 bg-neutral-800/90 backdrop-blur-md rounded-2xl border border-neutral-700 text-white placeholder-neutral-400 focus:outline-none focus:border-amber-500 transition-all text-sm"
              />
              <div className="absolute right-2 flex items-center gap-1.5">
                {searchQuery && (
                  <button 
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      const params: Record<string, string> = {};
                      if (selectedTag) params.tag = selectedTag;
                      setSearchParams(params);
                    }}
                    className="text-neutral-400 hover:text-white p-1 rounded-md transition-colors"
                    title="Xóa tìm kiếm"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs rounded-xl transition-colors shadow"
                >
                  Tìm kiếm
                </button>
              </div>
            </form>

            {/* Popular Tags */}
            {allTags.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs text-neutral-400">
                <span className="shrink-0 font-medium text-neutral-300 flex items-center gap-1">
                  <TagIcon className="w-3.5 h-3.5" /> Thẻ hot:
                </span>
                <button
                  onClick={() => {
                    setSelectedTag(null);
                    const params: Record<string, string> = {};
                    if (searchQuery.trim()) params.q = searchQuery.trim();
                    setSearchParams(params);
                  }}
                  className={`shrink-0 px-2.5 py-1 rounded-full transition-colors ${
                    selectedTag === null ? 'bg-amber-500 text-black font-semibold' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                  }`}
                >
                  Tất cả
                </button>
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => handleTagToggle(tag)}
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
      ) : isSearchActive ? (
        // ====================================================================
        // SEARCH RESULTS MODE (HIỂN THỊ KẾT QUẢ TÌM KIẾM THỰC TẾ TRÊN TẤT CẢ DỮ LIỆU)
        // ====================================================================
        <div className="space-y-6">
          {/* Header Bar for Search Results */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
            <div>
              <div className="flex items-center gap-2">
                <Search className="w-5 h-5 text-amber-500" />
                <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  {searchQuery.trim() ? (
                    <>Kết quả tìm kiếm cho: <span className="text-amber-600 dark:text-amber-400">"{searchQuery.trim()}"</span></>
                  ) : (
                    <>Lọc theo thẻ: <span className="text-amber-600 dark:text-amber-400">#{selectedTag}</span></>
                  )}
                </h2>
              </div>
              <p className="text-xs text-neutral-500 mt-1">
                Tìm thấy tổng cộng <strong>{totalMatches}</strong> kết quả ({filteredCharacters.length} Character, {filteredPrompts.length} Prompt, {filteredCreators.length} Creator).
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Sort Selector */}
              <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <select
                  value={searchSort}
                  onChange={(e) => setSearchSort(e.target.value as SearchSortOption)}
                  className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs font-medium text-neutral-800 dark:text-neutral-200 focus:outline-none"
                >
                  <option value="RELEVANCE">Độ liên quan</option>
                  <option value="NEWEST">Mới nhất</option>
                  <option value="POPULAR">Phổ biến nhất</option>
                </select>
              </div>

              <button
                onClick={handleClearFilters}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-xs font-medium text-neutral-700 dark:text-neutral-300 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                <span>Xóa bộ lọc</span>
              </button>
            </div>
          </div>

          {/* Category Tabs: Tất cả | Character | Prompt | Creator */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-neutral-200 dark:border-neutral-800">
            <button
              onClick={() => setSearchCategoryTab('ALL')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                searchCategoryTab === 'ALL'
                  ? 'bg-neutral-900 dark:bg-white text-white dark:text-black shadow-sm'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              }`}
            >
              Tất cả ({totalMatches})
            </button>
            <button
              onClick={() => setSearchCategoryTab('CHARACTERS')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                searchCategoryTab === 'CHARACTERS'
                  ? 'bg-neutral-900 dark:bg-white text-white dark:text-black shadow-sm'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              <span>Character ({filteredCharacters.length})</span>
            </button>
            <button
              onClick={() => setSearchCategoryTab('PROMPTS')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                searchCategoryTab === 'PROMPTS'
                  ? 'bg-neutral-900 dark:bg-white text-white dark:text-black shadow-sm'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
              <span>Prompt ({filteredPrompts.length})</span>
            </button>
            <button
              onClick={() => setSearchCategoryTab('CREATORS')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                searchCategoryTab === 'CREATORS'
                  ? 'bg-neutral-900 dark:bg-white text-white dark:text-black shadow-sm'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              }`}
            >
              <UserIcon className="w-3.5 h-3.5 text-pink-500" />
              <span>Creator ({filteredCreators.length})</span>
            </button>
          </div>

          {/* EMPTY STATE: KHÔNG TÌM THẤY KẾT QUẢ PHÙ HỢP */}
          {totalMatches === 0 ? (
            <div className="py-16 px-6 text-center rounded-3xl border border-dashed border-neutral-300 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 max-w-xl mx-auto space-y-4">
              <div className="w-16 h-16 rounded-full bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center mx-auto text-neutral-500">
                <Search className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                Không tìm thấy kết quả phù hợp.
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                Không có Character, Prompt hoặc Creator nào chứa từ khóa "{searchQuery}". Bạn có thể thử kiểm tra lại chính tả hoặc chuyển sang sử dụng AI Search để tìm kiếm theo ngữ nghĩa.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  onClick={handleClearFilters}
                  className="px-4 py-2 bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-xs font-semibold rounded-xl text-neutral-800 dark:text-neutral-200 transition-colors"
                >
                  Xóa từ khóa tìm kiếm
                </button>
                <Link
                  to={`/ai-search?q=${encodeURIComponent(searchQuery)}`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold rounded-xl transition-colors shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Tìm bằng AI Search</span>
                </Link>
              </div>
            </div>
          ) : (
            // DISPLAY ALL RESULTS (NO SLICE!)
            <div className="space-y-12">
              {/* 1. Characters Section */}
              {(searchCategoryTab === 'ALL' || searchCategoryTab === 'CHARACTERS') && filteredCharacters.length > 0 && (
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                      <Flame className="w-5 h-5 text-amber-500 fill-amber-500" />
                      <span>Character ({filteredCharacters.length})</span>
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredCharacters.map((char) => (
                      <CharacterCard key={char.id} character={char} onUpdate={loadData} />
                    ))}
                  </div>
                </section>
              )}

              {/* 2. Prompts Section */}
              {(searchCategoryTab === 'ALL' || searchCategoryTab === 'PROMPTS') && filteredPrompts.length > 0 && (
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-emerald-500 fill-emerald-500" />
                      <span>Prompt ({filteredPrompts.length})</span>
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {filteredPrompts.map((prompt) => (
                      <PromptCard 
                        key={prompt.id} 
                        prompt={prompt} 
                        isOwner={user?.id === prompt.authorId || user?.role === 'ADMIN'}
                        onDelete={() => setPromptToDeleteItem(prompt)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* 3. Creators Section */}
              {(searchCategoryTab === 'ALL' || searchCategoryTab === 'CREATORS') && filteredCreators.length > 0 && (
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                      <UserIcon className="w-5 h-5 text-pink-500" />
                      <span>Creator ({filteredCreators.length})</span>
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredCreators.map((creator) => (
                      <CreatorCard key={creator.id} creator={creator} onUpdate={loadData} />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      ) : (
        // ====================================================================
        // STANDARD EXPLORE BROWSE MODE (KHI KHÔNG TÌM KIẾM)
        // ====================================================================
        <div className="space-y-10">
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
                onClick={() => setBrowseTab(tab.id as ExploreBrowseTab)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  browseTab === tab.id
                    ? 'bg-black dark:bg-white text-white dark:text-black shadow-sm'
                    : 'bg-neutral-100 dark:bg-neutral-800/60 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="space-y-14">
            {/* SECTION 1: Character Nổi Bật */}
            {(browseTab === 'all' || browseTab === 'featured_characters') && (
              <section>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2 text-neutral-900 dark:text-neutral-100">
                      <Flame className="w-6 h-6 text-amber-500 fill-amber-500" />
                      <span>Character Nổi Bật</span>
                    </h2>
                    <p className="text-xs text-neutral-500 mt-1">Những Character nhận được nhiều lượt yêu thích và tương tác nhất</p>
                  </div>
                  {browseTab === 'all' && (
                    <button 
                      onClick={() => setBrowseTab('featured_characters')}
                      className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white flex items-center gap-1"
                    >
                      <span>Xem tất cả ({featuredCharacters.length})</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {featuredCharacters.length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl text-neutral-500 text-sm">
                    Chưa có Character nổi bật nào.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {(browseTab === 'all' ? featuredCharacters.slice(0, 6) : featuredCharacters).map((char) => (
                      <CharacterCard key={char.id} character={char} onUpdate={loadData} />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* SECTION 2: Character Mới */}
            {(browseTab === 'all' || browseTab === 'new_characters') && (
              <section>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2 text-neutral-900 dark:text-neutral-100">
                      <Clock className="w-6 h-6 text-blue-500" />
                      <span>Character Mới Nhất</span>
                    </h2>
                    <p className="text-xs text-neutral-500 mt-1">Những nhân vật nhập vai mới được Creator chia sẻ</p>
                  </div>
                  {browseTab === 'all' && (
                    <button 
                      onClick={() => setBrowseTab('new_characters')}
                      className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white flex items-center gap-1"
                    >
                      <span>Xem tất cả ({newCharacters.length})</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {newCharacters.length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl text-neutral-500 text-sm">
                    Chưa có Character mới nào.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {(browseTab === 'all' ? newCharacters.slice(0, 6) : newCharacters).map((char) => (
                      <CharacterCard key={char.id} character={char} onUpdate={loadData} />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* SECTION 3: Prompt Nổi Bật */}
            {(browseTab === 'all' || browseTab === 'featured_prompts') && (
              <section>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2 text-neutral-900 dark:text-neutral-100">
                      <Sparkles className="w-6 h-6 text-emerald-500 fill-emerald-500" />
                      <span>Prompt Nổi Bật</span>
                    </h2>
                    <p className="text-xs text-neutral-500 mt-1">Các câu lệnh Prompt được sao chép và lưu trữ nhiều nhất</p>
                  </div>
                  {browseTab === 'all' && (
                    <button 
                      onClick={() => setBrowseTab('featured_prompts')}
                      className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white flex items-center gap-1"
                    >
                      <span>Xem tất cả ({featuredPrompts.length})</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {featuredPrompts.length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl text-neutral-500 text-sm">
                    Chưa có Prompt nổi bật nào.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {(browseTab === 'all' ? featuredPrompts.slice(0, 8) : featuredPrompts).map((prompt) => (
                      <PromptCard 
                        key={prompt.id} 
                        prompt={prompt} 
                        isOwner={user?.id === prompt.authorId || user?.role === 'ADMIN'}
                        onDelete={() => setPromptToDeleteItem(prompt)}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* SECTION 4: Prompt Mới */}
            {(browseTab === 'all' || browseTab === 'new_prompts') && (
              <section>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2 text-neutral-900 dark:text-neutral-100">
                      <PenTool className="w-6 h-6 text-purple-500" />
                      <span>Prompt Mới Nhất</span>
                    </h2>
                    <p className="text-xs text-neutral-500 mt-1">Các Prompt mới đăng từ các tác giả trong cộng đồng</p>
                  </div>
                  {browseTab === 'all' && (
                    <button 
                      onClick={() => setBrowseTab('new_prompts')}
                      className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white flex items-center gap-1"
                    >
                      <span>Xem tất cả ({newPrompts.length})</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {newPrompts.length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl text-neutral-500 text-sm">
                    Chưa có Prompt mới nào.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {(browseTab === 'all' ? newPrompts.slice(0, 8) : newPrompts).map((prompt) => (
                      <PromptCard 
                        key={prompt.id} 
                        prompt={prompt} 
                        isOwner={user?.id === prompt.authorId || user?.role === 'ADMIN'}
                        onDelete={() => setPromptToDeleteItem(prompt)}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* SECTION 5: Creator Nổi Bật */}
            {(browseTab === 'all' || browseTab === 'featured_creators') && (
              <section>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2 text-neutral-900 dark:text-neutral-100">
                      <Star className="w-6 h-6 text-amber-500 fill-amber-500" />
                      <span>Creator Nổi Bật</span>
                    </h2>
                    <p className="text-xs text-neutral-500 mt-1">Các nhà sáng tạo nội dung tài năng nhận được sự ủng hộ cao</p>
                  </div>
                  {browseTab === 'all' && (
                    <button 
                      onClick={() => setBrowseTab('featured_creators')}
                      className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white flex items-center gap-1"
                    >
                      <span>Xem tất cả ({featuredCreators.length})</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {featuredCreators.length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl text-neutral-500 text-sm">
                    Chưa có Creator nổi bật nào.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {(browseTab === 'all' ? featuredCreators.slice(0, 6) : featuredCreators).map((creator) => (
                      <CreatorCard key={creator.id} creator={creator} onUpdate={loadData} />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* SECTION 6: Creator Mới */}
            {(browseTab === 'all' || browseTab === 'new_creators') && (
              <section>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2 text-neutral-900 dark:text-neutral-100">
                      <UserIcon className="w-6 h-6 text-pink-500" />
                      <span>Creator Mới Tham Gia</span>
                    </h2>
                    <p className="text-xs text-neutral-500 mt-1">Những gương mặt Creator vừa được duyệt trong hệ thống</p>
                  </div>
                  {browseTab === 'all' && (
                    <button 
                      onClick={() => setBrowseTab('new_creators')}
                      className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white flex items-center gap-1"
                    >
                      <span>Xem tất cả ({newCreators.length})</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {newCreators.length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl text-neutral-500 text-sm">
                    Chưa có Creator mới nào.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {(browseTab === 'all' ? newCreators.slice(0, 6) : newCreators).map((creator) => (
                      <CreatorCard key={creator.id} creator={creator} onUpdate={loadData} />
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        </div>
      )}

      {/* Delete Prompt Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={promptToDeleteItem !== null}
        onClose={() => setPromptToDeleteItem(null)}
        title="Xác nhận xóa Prompt"
        description={
          user?.role === 'ADMIN' && promptToDeleteItem && user.id !== promptToDeleteItem.authorId
            ? `Bạn đang xóa Prompt "${promptToDeleteItem.title || promptToDeleteItem.name || ''}" với tư cách Quản trị viên. Vui lòng nhập lý do xóa để gửi thông báo cho tác giả.`
            : `Bạn có chắc chắn muốn xóa Prompt "${promptToDeleteItem?.title || promptToDeleteItem?.name || ''}" không? Hành động này không thể hoàn tác.`
        }
        requireReason={user?.role === 'ADMIN' && promptToDeleteItem !== null && user.id !== promptToDeleteItem.authorId}
        onConfirm={async () => {
          if (!promptToDeleteItem) return;
          try {
            await executeDeletePrompt({
              prompt: promptToDeleteItem,
              currentUser: user
            });
            toast.success("Đã xóa Prompt thành công.");
            loadData();
          } catch (e: any) {
            toast.error(e?.message || "Không thể xóa Prompt.");
          }
        }}
        onConfirmWithReason={async (reason, details) => {
          if (!promptToDeleteItem) return;
          try {
            await executeDeletePrompt({
              prompt: promptToDeleteItem,
              currentUser: user,
              reason,
              details
            });
            toast.success("Đã xóa Prompt và ghi log lý do thành công.");
            loadData();
          } catch (e: any) {
            toast.error(e?.message || "Không thể xóa Prompt.");
          }
        }}
      />
    </div>
  );
}
