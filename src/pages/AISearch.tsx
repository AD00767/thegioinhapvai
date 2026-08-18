import React, { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '../lib/api';
import { 
  Sparkles, Search, Copy, Check, ExternalLink, User as UserIcon, 
  BookOpen, PenTool, Flame, ArrowUpDown, Tag, Users, AlertCircle, RefreshCw, ChevronRight, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useSeo } from '../hooks/useSeo';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { parseIdQuery, lookupIdInFirebase, ExactIdLookupResult } from '../lib/searchUtils';
import CharacterCard from '../components/CharacterCard';
import PromptCard from '../components/PromptCard';
import CreatorCard from '../components/CreatorCard';
import { CharacterItem, PromptItem, CreatorItem } from '../types';

type SearchScope = 'all' | 'character' | 'prompt' | 'creator';
type SortOption = 'relevance' | 'newest' | 'hot' | 'likes' | 'views' | 'copies';

const QUICK_PROMPTS = [
  "Nữ chính hiện đại lạnh lùng",
  "Prompt viết RP học đường",
  "Creator chuyên thể loại fantasy",
  "Nhân vật phản diện ma đạo cổ trang",
  "Prompt viết code AI Studio",
  "Thế giới cyberpunk viễn tưởng"
];

export default function AISearch() {
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorState, setErrorState] = useState<string | null>(null);
  
  // Entity results
  const [characterResults, setCharacterResults] = useState<CharacterItem[]>([]);
  const [promptResults, setPromptResults] = useState<PromptItem[]>([]);
  const [creatorResults, setCreatorResults] = useState<CreatorItem[]>([]);
  
  // Exact ID Match
  const [exactMatch, setExactMatch] = useState<ExactIdLookupResult | null>(null);
  const [idError, setIdError] = useState<string | null>(null);
  
  // Search meta & filters
  const [criteria, setCriteria] = useState<any>(null);
  const [activeScope, setActiveScope] = useState<SearchScope>('all');
  const [sortBy, setSortBy] = useState<SortOption>('relevance');
  const [hasSearched, setHasSearched] = useState(false);

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  useSeo({
    title: 'Tìm kiếm bằng AI',
    description: 'Sử dụng trí tuệ nhân tạo để tìm kiếm Character, Prompt và Creator phù hợp nhất qua ngôn ngữ tự nhiên.'
  });

  // Calculate relevance score based on AI criteria
  const calculateRelevance = (item: any, type: 'character' | 'prompt' | 'creator', searchKeywords: string[], searchTags: string[], searchGender?: string | null) => {
    let score = 0;
    const name = (item.name || item.title || item.displayName || '').toLowerCase();
    const desc = (item.slogan || item.plot || item.purpose || item.content || item.bio || '').toLowerCase();
    const tags = ((item.tags || []) as string[]).map(t => t.toLowerCase());

    // Gender match for characters
    if (type === 'character' && searchGender && item.gender) {
      if (item.gender.toLowerCase() === searchGender.toLowerCase()) {
        score += 30;
      }
    }

    // Tag matches
    if (searchTags && searchTags.length > 0) {
      for (const st of searchTags) {
        const stLower = st.toLowerCase();
        if (tags.some(t => t.includes(stLower) || stLower.includes(t))) {
          score += 25;
        }
      }
    }

    // Keyword matches
    if (searchKeywords && searchKeywords.length > 0) {
      for (const kw of searchKeywords) {
        const kwLower = kw.toLowerCase();
        if (name.includes(kwLower)) score += 20;
        if (tags.some(t => t.includes(kwLower))) score += 15;
        if (desc.includes(kwLower)) score += 10;
      }
    }

    // Secondary popularity factors for ties
    const views = item.viewsCount || item.viewCount || 0;
    const likes = item.likesCount || item.likeCount || 0;
    const saves = item.savesCount || item.saveCount || item.bookmarkCount || 0;
    const copies = item.copyCount || 0;
    const followers = item.followerCount || 0;

    score += Math.min(20, (views * 0.05 + likes * 0.5 + saves * 0.5 + copies * 0.5 + followers * 0.5));

    return score;
  };

  const performSearch = async (queryText: string) => {
    const trimmed = queryText.trim();
    if (!trimmed) return;

    setLoading(true);
    setErrorState(null);
    setCharacterResults([]);
    setPromptResults([]);
    setCreatorResults([]);
    setExactMatch(null);
    setCriteria(null);
    setIdError(null);
    setHasSearched(true);

    try {
      // 1. Direct ID Search Handling
      const idParse = parseIdQuery(trimmed);
      if (idParse.isIdQuery) {
        if (idParse.error) {
          setIdError(idParse.error);
          toast.error(idParse.error);
          setLoading(false);
          return;
        }

        if (idParse.numericId) {
          const lookup = await lookupIdInFirebase(idParse.numericId, idParse.typeHint);
          if (lookup && lookup.found && lookup.result) {
            setExactMatch(lookup);
            toast.success("Đã tìm thấy đối tượng chính xác theo ID!");
            setLoading(false);
            return;
          } else {
            const missingMsg = lookup?.error || "ID không tồn tại hoặc đã bị xóa khỏi hệ thống.";
            setIdError(missingMsg);
            toast.error(missingMsg);
            setLoading(false);
            return;
          }
        }
      }

      // 2. Call AI Search Backend to extract semantic criteria
      let parsedCriteria: any = {};
      try {
        const res = await apiFetch("/api/ai-search", {
          method: "POST",
          body: JSON.stringify({ query: trimmed })
        });
        parsedCriteria = res.parsedCriteria || {};
      } catch (e) {
        console.warn("AI parse endpoint fallback:", e);
        const fallbackWords = trimmed.split(/\s+/).filter(w => w.length > 1);
        parsedCriteria = {
          type: "all",
          summary: `Tìm kiếm theo từ khóa: "${trimmed}"`,
          keywords: fallbackWords,
          tags: fallbackWords,
          categories: []
        };
      }

      setCriteria(parsedCriteria);
      if (parsedCriteria.type && ['character', 'prompt', 'creator'].includes(parsedCriteria.type)) {
        setActiveScope(parsedCriteria.type as SearchScope);
      } else {
        setActiveScope('all');
      }

      const keywords = (parsedCriteria.keywords || []).concat(
        trimmed.split(/\s+/).filter(w => w.length > 2)
      );
      const searchTags = parsedCriteria.tags || [];
      const searchGender = parsedCriteria.gender || null;

      // 3. Fetch from Firebase concurrently
      const [charSnap, promptSnap, userSnap] = await Promise.all([
        getDocs(collection(db, "characters")),
        getDocs(collection(db, "prompts")),
        getDocs(collection(db, "users"))
      ]);

      // Process Characters
      const rawChars: (CharacterItem & { _score?: number })[] = charSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as any))
        .filter(c => !c.deletedAt && !c.isHidden);

      const filteredChars = rawChars.filter(char => {
        if (searchGender && char.gender && char.gender !== searchGender) {
          // Check if gender strictly differs
          if (["Nam", "Nữ"].includes(searchGender) && ["Nam", "Nữ"].includes(char.gender)) {
            return false;
          }
        }
        if (keywords.length === 0 && searchTags.length === 0) return true;

        const name = (char.name || '').toLowerCase();
        const slogan = (char.slogan || '').toLowerCase();
        const plot = (char.plot || '').toLowerCase();
        const tags = (char.tags || []).map((t: string) => t.toLowerCase());

        const hasKeywordMatch = keywords.some((kw: string) => {
          const k = kw.toLowerCase();
          return name.includes(k) || slogan.includes(k) || plot.includes(k) || tags.some((t: string) => t.includes(k));
        });

        const hasTagMatch = searchTags.some((st: string) => {
          const t = st.toLowerCase();
          return tags.some((ct: string) => ct.includes(t) || t.includes(ct));
        });

        return hasKeywordMatch || hasTagMatch;
      }).map(char => ({
        ...char,
        _score: calculateRelevance(char, 'character', keywords, searchTags, searchGender)
      }));

      // Process Prompts
      const rawPrompts: (PromptItem & { _score?: number })[] = promptSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as any))
        .filter(p => !p.deletedAt && !p.isHidden);

      const filteredPrompts = rawPrompts.filter(prompt => {
        if (keywords.length === 0 && searchTags.length === 0) return true;

        const name = (prompt.name || prompt.title || '').toLowerCase();
        const purpose = (prompt.purpose || '').toLowerCase();
        const content = (prompt.content || '').toLowerCase();
        const tags = (prompt.tags || []).map((t: string) => t.toLowerCase());

        const hasKeywordMatch = keywords.some((kw: string) => {
          const k = kw.toLowerCase();
          return name.includes(k) || purpose.includes(k) || content.includes(k) || tags.some((t: string) => t.includes(k));
        });

        const hasTagMatch = searchTags.some((st: string) => {
          const t = st.toLowerCase();
          return tags.some((ct: string) => ct.includes(t) || t.includes(ct));
        });

        return hasKeywordMatch || hasTagMatch;
      }).map(prompt => ({
        ...prompt,
        _score: calculateRelevance(prompt, 'prompt', keywords, searchTags)
      }));

      // Process Creators
      const rawCreators: (CreatorItem & { _score?: number })[] = userSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as any))
        .filter(u => u.creatorStatus === true && !u.deletedAt && !u.isLocked);

      const filteredCreators = rawCreators.filter(creator => {
        if (keywords.length === 0 && searchTags.length === 0) return true;

        const name = (creator.displayName || '').toLowerCase();
        const bio = (creator.bio || '').toLowerCase();

        return keywords.some((kw: string) => {
          const k = kw.toLowerCase();
          return name.includes(k) || bio.includes(k);
        });
      }).map(creator => ({
        ...creator,
        _score: calculateRelevance(creator, 'creator', keywords, searchTags)
      }));

      setCharacterResults(filteredChars);
      setPromptResults(filteredPrompts);
      setCreatorResults(filteredCreators);

    } catch (err: any) {
      console.error("AI Search execution failed:", err);
      setErrorState("Không thể tìm kiếm lúc này. Vui lòng kiểm tra lại kết nối và thử lại.");
      toast.error("Không thể tìm kiếm.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchParams({ q: searchQuery.trim() });
    performSearch(searchQuery);
  };

  const handleQuickPromptClick = (text: string) => {
    setSearchQuery(text);
    setSearchParams({ q: text });
    performSearch(text);
  };

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      setSearchQuery(q);
      performSearch(q);
    }
  }, [searchParams]);

  // Apply sorting to results
  const sortedCharacters = useMemo(() => {
    const list = [...characterResults];
    switch (sortBy) {
      case 'relevance':
        return list.sort((a: any, b: any) => (b._score || 0) - (a._score || 0));
      case 'newest':
        return list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      case 'hot':
        return list.sort((a, b) => ((b.likesCount || 0) * 3 + (b.savesCount || 0) * 2 + (b.viewsCount || 0)) - ((a.likesCount || 0) * 3 + (a.savesCount || 0) * 2 + (a.viewsCount || 0)));
      case 'likes':
        return list.sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0));
      case 'views':
        return list.sort((a, b) => (b.viewsCount || 0) - (a.viewsCount || 0));
      case 'copies':
        return list;
      default:
        return list;
    }
  }, [characterResults, sortBy]);

  const sortedPrompts = useMemo(() => {
    const list = [...promptResults];
    switch (sortBy) {
      case 'relevance':
        return list.sort((a: any, b: any) => (b._score || 0) - (a._score || 0));
      case 'newest':
        return list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      case 'hot':
        return list.sort((a, b) => ((b.copyCount || 0) * 3 + (b.savesCount || 0) * 2) - ((a.copyCount || 0) * 3 + (a.savesCount || 0) * 2));
      case 'copies':
        return list.sort((a, b) => (b.copyCount || 0) - (a.copyCount || 0));
      case 'likes':
      case 'views':
        return list.sort((a, b) => (b.savesCount || 0) - (a.savesCount || 0));
      default:
        return list;
    }
  }, [promptResults, sortBy]);

  const sortedCreators = useMemo(() => {
    const list = [...creatorResults];
    switch (sortBy) {
      case 'relevance':
        return list.sort((a: any, b: any) => (b._score || 0) - (a._score || 0));
      case 'newest':
        return list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      case 'hot':
      case 'likes':
      case 'views':
      case 'copies':
        return list.sort((a, b) => (b.followerCount || 0) - (a.followerCount || 0));
      default:
        return list;
    }
  }, [creatorResults, sortBy]);

  const totalResultsCount = characterResults.length + promptResults.length + creatorResults.length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 md:py-12">
      {/* Header Title and Description */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center p-3 bg-neutral-100 dark:bg-neutral-800 rounded-2xl mb-4 text-neutral-900 dark:text-neutral-100 shadow-sm">
          <Sparkles className="w-7 h-7 text-amber-500" />
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3">
          Tìm Kiếm Thông Minh Bằng AI
        </h1>
        <p className="text-neutral-500 dark:text-neutral-400 max-w-2xl mx-auto text-sm md:text-base leading-relaxed">
          Tìm kiếm ngữ nghĩa tự nhiên cho Character, Prompt, Creator và Tag. Hệ thống phân tích sâu ý định người dùng hoặc tra cứu trực tiếp theo ID 9 chữ số.
        </p>
      </div>

      {/* Main Search Input Box */}
      <form onSubmit={handleSearchSubmit} className="relative max-w-3xl mx-auto mb-4">
        <div className="relative flex items-center">
          <Search className="absolute left-4 w-5 h-5 text-neutral-400 pointer-events-none" />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="VD: Tìm nữ chính hiện đại lạnh lùng hoặc character/123456789..." 
            className="w-full pl-12 pr-28 py-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all text-base"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-24 p-1.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button 
            type="submit" 
            disabled={loading || !searchQuery.trim()}
            className="absolute right-2 px-5 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold text-sm disabled:opacity-50 transition-opacity hover:opacity-90 flex items-center gap-1.5 shadow-sm"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Đang tìm...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Tìm kiếm</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Quick Prompt Suggestions */}
      <div className="max-w-3xl mx-auto flex flex-wrap items-center justify-center gap-2 mb-10 text-xs">
        <span className="text-neutral-400 font-medium flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-amber-500" />
          Gợi ý nhanh:
        </span>
        {QUICK_PROMPTS.map((promptText) => (
          <button
            key={promptText}
            type="button"
            onClick={() => handleQuickPromptClick(promptText)}
            className="px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800/80 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-xl transition-all border border-neutral-200/60 dark:border-neutral-700/60"
          >
            {promptText}
          </button>
        ))}
      </div>

      {/* Error State Banner */}
      {idError && (
        <div className="max-w-3xl mx-auto mb-8 p-6 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/30 rounded-2xl text-center">
          <AlertCircle className="w-6 h-6 mx-auto mb-2 text-red-500" />
          <p className="text-base font-bold mb-1">{idError}</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">Vui lòng kiểm tra lại mã ID hoặc thử nhập từ khóa tự nhiên khác.</p>
        </div>
      )}

      {errorState && (
        <div className="max-w-3xl mx-auto mb-8 p-6 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/30 rounded-2xl text-center">
          <AlertCircle className="w-6 h-6 mx-auto mb-2 text-red-500" />
          <p className="text-base font-bold mb-2">{errorState}</p>
          <button
            onClick={() => performSearch(searchQuery)}
            className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-colors inline-flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Thử lại</span>
          </button>
        </div>
      )}

      {/* Exact Match Resolution Card for ID Queries */}
      {!idError && exactMatch && exactMatch.result && (
        <div className="max-w-3xl mx-auto mb-10 space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-2 rounded-xl border border-emerald-200 dark:border-emerald-800/40 w-fit">
            <Sparkles className="w-4 h-4" />
            <span>Kết Quả Tìm Kiếm Chính Xác ID: {exactMatch.type}/{exactMatch.numericId}</span>
          </div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-lg"
          >
            {/* Character Card */}
            {exactMatch.type === 'character' && (
              <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                <div className="flex gap-4 items-center">
                  <img 
                    src={exactMatch.result.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${exactMatch.result.name}`} 
                    alt={exactMatch.result.name}
                    className="w-20 h-20 rounded-2xl object-cover bg-neutral-100 dark:bg-neutral-800 shrink-0 border border-neutral-200 dark:border-neutral-700" 
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">{exactMatch.result.name}</h2>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        character/{exactMatch.numericId}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500 mt-1 font-medium">Tác giả: <span className="text-neutral-900 dark:text-neutral-200 font-semibold">{exactMatch.result.creatorName}</span></p>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2 mt-2">{exactMatch.result.slogan}</p>
                    
                    {exactMatch.result.tags && exactMatch.result.tags.length > 0 && (
                      <div className="flex gap-1.5 mt-3 flex-wrap">
                        {exactMatch.result.tags.map((t: string) => (
                          <span key={t} className="text-xs px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded-md text-neutral-600 dark:text-neutral-400">#{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <Link 
                  to={exactMatch.path}
                  className="w-full md:w-auto px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shrink-0"
                >
                  <span>Mở Character</span>
                  <ExternalLink className="w-4 h-4" />
                </Link>
              </div>
            )}

            {/* Prompt Card */}
            {exactMatch.type === 'prompt' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">{exactMatch.result.title}</h2>
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      prompt/{exactMatch.numericId}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500">Tác giả: <span className="font-semibold text-neutral-800 dark:text-neutral-200">{exactMatch.result.author}</span></p>
                </div>

                <p className="text-sm text-neutral-600 dark:text-neutral-400">{exactMatch.result.purpose}</p>

                {exactMatch.result.content && (
                  <div className="p-4 bg-neutral-50 dark:bg-neutral-950 rounded-2xl border border-neutral-100 dark:border-neutral-800 font-mono text-xs max-h-40 overflow-y-auto whitespace-pre-wrap text-neutral-800 dark:text-neutral-300">
                    {exactMatch.result.content}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 flex-wrap gap-3">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(exactMatch.result.content || "");
                      toast.success("Đã sao chép nội dung Prompt!");
                    }}
                    className="px-4 py-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                    <span>Sao chép Prompt</span>
                  </button>

                  <Link 
                    to={exactMatch.path}
                    className="px-6 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold text-xs flex items-center gap-2 hover:opacity-90 transition-opacity"
                  >
                    <span>Mở Prompt</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            )}

            {/* Creator / User Card */}
            {(exactMatch.type === 'creator' || exactMatch.type === 'user') && (
              <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                <div className="flex gap-4 items-center">
                  <img 
                    src={exactMatch.result.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${exactMatch.result.displayName}`} 
                    alt={exactMatch.result.displayName}
                    className="w-16 h-16 rounded-full object-cover bg-neutral-100 dark:bg-neutral-800 shrink-0 border border-neutral-200 dark:border-neutral-700" 
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">{exactMatch.result.displayName}</h2>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                        {exactMatch.type}/{exactMatch.numericId}
                      </span>
                    </div>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">{exactMatch.result.bio || "Chưa có tiểu sử"}</p>
                    {exactMatch.type === 'creator' && (
                      <div className="flex items-center gap-4 mt-2 text-xs text-neutral-500">
                        <span>Character: <strong className="text-neutral-900 dark:text-neutral-100">{exactMatch.result.characterCount}</strong></span>
                        <span>Prompt: <strong className="text-neutral-900 dark:text-neutral-100">{exactMatch.result.promptCount}</strong></span>
                        <span>Người theo dõi: <strong className="text-neutral-900 dark:text-neutral-100">{exactMatch.result.followerCount}</strong></span>
                      </div>
                    )}
                  </div>
                </div>

                <Link 
                  to={exactMatch.path}
                  className="w-full md:w-auto px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shrink-0"
                >
                  <span>{exactMatch.type === 'creator' ? "Xem Trang Creator" : "Xem Hồ Sơ"}</span>
                  <ExternalLink className="w-4 h-4" />
                </Link>
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* AI Semantic Understanding Banner */}
      {!idError && !exactMatch && criteria && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 p-5 bg-gradient-to-r from-neutral-50 to-neutral-100/60 dark:from-neutral-900 dark:to-neutral-900/60 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 text-sm shadow-sm"
        >
          <div className="flex items-center gap-2 font-bold text-neutral-900 dark:text-neutral-100 mb-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>AI đã phân tích ngữ nghĩa truy vấn:</span>
          </div>

          {criteria.summary && (
            <p className="text-neutral-700 dark:text-neutral-300 font-medium mb-3">
              "{criteria.summary}"
            </p>
          )}

          <div className="flex flex-wrap gap-2 items-center">
            {criteria.type && (
              <span className="px-3 py-1 bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-semibold">
                Phân loại: {criteria.type === 'character' ? 'Character' : criteria.type === 'prompt' ? 'Prompt' : criteria.type === 'creator' ? 'Creator' : 'Tất cả'}
              </span>
            )}
            {criteria.gender && (
              <span className="px-3 py-1 bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-semibold">
                Giới tính: {criteria.gender}
              </span>
            )}
            {criteria.tags && criteria.tags.map((t: string) => (
              <span key={t} className="px-3 py-1 bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-medium text-amber-600 dark:text-amber-400">
                #{t}
              </span>
            ))}
            {criteria.categories && criteria.categories.map((c: string) => (
              <span key={c} className="px-3 py-1 bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-medium text-blue-600 dark:text-blue-400">
                Thể loại: {c}
              </span>
            ))}
            {criteria.keywords && criteria.keywords.map((k: string) => (
              <span key={k} className="px-3 py-1 bg-neutral-200/70 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded-xl text-xs">
                Từ khóa: {k}
              </span>
            ))}
          </div>
        </motion.div>
      )}

      {/* Filter and Sorting Toolbar */}
      {!idError && !exactMatch && hasSearched && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 pb-4 border-b border-neutral-200 dark:border-neutral-800">
          {/* Scope Tabs */}
          <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800/80 p-1 rounded-2xl">
            <button
              onClick={() => setActiveScope('all')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeScope === 'all'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
              }`}
            >
              <span>Tất cả</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-neutral-200 dark:bg-neutral-700 rounded-full font-mono">
                {totalResultsCount}
              </span>
            </button>

            <button
              onClick={() => setActiveScope('character')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeScope === 'character'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
              }`}
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>Character</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-neutral-200 dark:bg-neutral-700 rounded-full font-mono">
                {characterResults.length}
              </span>
            </button>

            <button
              onClick={() => setActiveScope('prompt')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeScope === 'prompt'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
              }`}
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>Prompt</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-neutral-200 dark:bg-neutral-700 rounded-full font-mono">
                {promptResults.length}
              </span>
            </button>

            <button
              onClick={() => setActiveScope('creator')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeScope === 'creator'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Creator</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-neutral-200 dark:bg-neutral-700 rounded-full font-mono">
                {creatorResults.length}
              </span>
            </button>
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2 text-xs self-end sm:self-center">
            <ArrowUpDown className="w-3.5 h-3.5 text-neutral-400" />
            <span className="text-neutral-500 font-medium">Sắp xếp:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="px-3 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 font-semibold focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white text-xs cursor-pointer"
            >
              <option value="relevance">Độ liên quan (AI Match)</option>
              <option value="newest">Mới nhất</option>
              <option value="hot">Hot (Phổ biến nhất)</option>
              <option value="likes">Lượt thích</option>
              <option value="views">Lượt xem</option>
              <option value="copies">Lượt sao chép Prompt</option>
            </select>
          </div>
        </div>
      )}

      {/* Loading Skeleton State */}
      {loading && (
        <div className="space-y-8">
          <div>
            <div className="h-6 w-48 bg-neutral-200 dark:bg-neutral-800 rounded-lg animate-pulse mb-4"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-44 bg-neutral-100 dark:bg-neutral-800/60 rounded-2xl animate-pulse"></div>
              ))}
            </div>
          </div>
          <div>
            <div className="h-6 w-48 bg-neutral-200 dark:bg-neutral-800 rounded-lg animate-pulse mb-4"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {[1, 2].map(i => (
                <div key={i} className="h-40 bg-neutral-100 dark:bg-neutral-800/60 rounded-2xl animate-pulse"></div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Empty State with Suggestions (Module 12) */}
      {!idError && !exactMatch && !loading && hasSearched && totalResultsCount === 0 && (
        <div className="text-center py-16 px-4 max-w-xl mx-auto bg-neutral-50 dark:bg-neutral-900/40 rounded-3xl border border-neutral-200 dark:border-neutral-800">
          <div className="w-12 h-12 rounded-2xl bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-4 text-neutral-400">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
            Không tìm thấy kết quả phù hợp
          </h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6 leading-relaxed">
            Hệ thống AI không tìm thấy Character, Prompt hay Creator nào khớp với mô tả của bạn. Hãy thử thay đổi từ khóa hoặc khám phá nội dung nổi bật.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/characters"
              className="w-full sm:w-auto px-5 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold text-xs hover:opacity-90 transition-opacity"
            >
              Xem Character nổi bật
            </Link>
            <Link
              to="/prompts"
              className="w-full sm:w-auto px-5 py-2.5 bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded-xl font-bold text-xs hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-colors"
            >
              Xem Prompt nổi bật
            </Link>
            <Link
              to="/creators"
              className="w-full sm:w-auto px-5 py-2.5 bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded-xl font-bold text-xs hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-colors"
            >
              Xem Creator nổi bật
            </Link>
          </div>
        </div>
      )}

      {/* Main Results Display - Grouped By Module 12 Specs */}
      {!idError && !exactMatch && !loading && hasSearched && totalResultsCount > 0 && (
        <div className="space-y-12">
          {/* GROUP 1: CHARACTERS */}
          {(activeScope === 'all' || activeScope === 'character') && sortedCharacters.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <UserIcon className="w-5 h-5 text-amber-500" />
                  <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                    Character ({sortedCharacters.length})
                  </h2>
                </div>
                {activeScope === 'all' && (
                  <button
                    onClick={() => setActiveScope('character')}
                    className="text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white flex items-center gap-1 transition-colors"
                  >
                    <span>Xem tất cả ({sortedCharacters.length})</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {(activeScope === 'all' ? sortedCharacters.slice(0, 6) : sortedCharacters).map((char) => (
                  <CharacterCard 
                    key={char.id} 
                    character={char} 
                    onUpdate={() => performSearch(searchQuery)} 
                  />
                ))}
              </div>
            </div>
          )}

          {/* GROUP 2: PROMPTS */}
          {(activeScope === 'all' || activeScope === 'prompt') && sortedPrompts.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <PenTool className="w-5 h-5 text-blue-500" />
                  <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                    Prompt ({sortedPrompts.length})
                  </h2>
                </div>
                {activeScope === 'all' && (
                  <button
                    onClick={() => setActiveScope('prompt')}
                    className="text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white flex items-center gap-1 transition-colors"
                  >
                    <span>Xem tất cả ({sortedPrompts.length})</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {(activeScope === 'all' ? sortedPrompts.slice(0, 4) : sortedPrompts).map((prompt) => (
                  <PromptCard 
                    key={prompt.id} 
                    prompt={prompt} 
                  />
                ))}
              </div>
            </div>
          )}

          {/* GROUP 3: CREATORS */}
          {(activeScope === 'all' || activeScope === 'creator') && sortedCreators.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-500" />
                  <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                    Creator ({sortedCreators.length})
                  </h2>
                </div>
                {activeScope === 'all' && (
                  <button
                    onClick={() => setActiveScope('creator')}
                    className="text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white flex items-center gap-1 transition-colors"
                  >
                    <span>Xem tất cả ({sortedCreators.length})</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {(activeScope === 'all' ? sortedCreators.slice(0, 6) : sortedCreators).map((creator) => (
                  <CreatorCard 
                    key={creator.id} 
                    creator={creator} 
                    onUpdate={() => performSearch(searchQuery)} 
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
