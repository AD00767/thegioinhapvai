import React, { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { Sparkles, Search, Copy, Check, ExternalLink, User, BookOpen, MessageSquare, Heart, Bookmark, Eye, Layers, Filter, ArrowUpDown } from 'lucide-react';
import { motion } from 'motion/react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useSeo } from '../hooks/useSeo';
import toast from 'react-hot-toast';
import { parseIdQuery, lookupIdInFirebase, searchAllCollections, ExactIdLookupResult, GroupedSearchResults } from '../lib/searchUtils';
import CharacterCard from '../components/CharacterCard';
import PromptCard from '../components/PromptCard';
import CreatorCard from '../components/CreatorCard';
import { CharacterItem, PromptItem, CreatorItem } from '../types';
import { getValidAvatar } from '../lib/avatar';

type SearchTab = 'all' | 'characters' | 'prompts' | 'creators';
type SortOption = 'relevance' | 'hot' | 'newest';

const aiCriteriaCache = new Map<string, any>();

export default function AISearch() {
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<SearchTab>('all');
  const [sortBy, setSortBy] = useState<SortOption>('relevance');
  const [results, setResults] = useState<GroupedSearchResults | null>(null);
  const [exactMatch, setExactMatch] = useState<ExactIdLookupResult | null>(null);
  const [criteria, setCriteria] = useState<any>(null);
  const [idError, setIdError] = useState<string | null>(null);
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const lastSearchRef = React.useRef<{ query: string; sort: string } | null>(null);

  useSeo({
    title: 'Tìm kiếm bằng AI',
    description: 'Sử dụng trí tuệ nhân tạo để tìm kiếm Character, Prompt và Creator phù hợp nhất qua ngôn ngữ tự nhiên.'
  });

  const performSearch = async (queryText: string, currentSort: SortOption = sortBy) => {
    const trimmed = queryText.trim();
    if (!trimmed) return;
    
    // Prevent redundant executions
    if (lastSearchRef.current?.query === trimmed && lastSearchRef.current?.sort === currentSort && results !== null) {
      return;
    }
    lastSearchRef.current = { query: trimmed, sort: currentSort };

    setLoading(true);
    setResults(null);
    setExactMatch(null);
    setCriteria(null);
    setIdError(null);

    try {
      // 1. Check if user typed an explicit ID query (e.g. character/123456789 or 9 digits)
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
            const missingMsg = lookup?.error || "Mã ID không tồn tại trên hệ thống.";
            setIdError(missingMsg);
            toast.error(missingMsg);
            setLoading(false);
            return;
          }
        }
      }

      // 2. Natural Language / AI Search Processing with Memory Cache
      let parsedCriteria: any = { keywords: [trimmed] };
      const cacheKey = trimmed.toLowerCase();
      if (aiCriteriaCache.has(cacheKey)) {
        parsedCriteria = aiCriteriaCache.get(cacheKey);
        setCriteria(parsedCriteria);
      } else {
        try {
          const res = await apiFetch("/api/ai-search", {
            method: "POST",
            body: JSON.stringify({ query: trimmed })
          });
          if (res && res.parsedCriteria) {
            parsedCriteria = res.parsedCriteria;
            aiCriteriaCache.set(cacheKey, parsedCriteria);
            setCriteria(parsedCriteria);
          }
        } catch (aiErr) {
          console.warn("AI parsing fallback to keyword matching:", aiErr);
        }
      }

      // 3. Search across all platform collections (Characters, Prompts, Creators)
      const searchOptions = {
        type: parsedCriteria.type === 'character' ? ('character' as const)
             : parsedCriteria.type === 'prompt' ? ('prompt' as const)
             : parsedCriteria.type === 'creator' ? ('creator' as const)
             : ('all' as const),
        gender: parsedCriteria.gender || undefined,
        tags: parsedCriteria.tags || undefined,
        keywords: parsedCriteria.keywords || undefined,
        sortBy: currentSort
      };

      const searchOutput = await searchAllCollections(trimmed, searchOptions);
      setResults(searchOutput);

      // Auto switch to relevant tab if AI specifically identified a single type
      if (parsedCriteria.type === 'character') {
        setActiveTab('characters');
      } else if (parsedCriteria.type === 'prompt') {
        setActiveTab('prompts');
      } else if (parsedCriteria.type === 'creator') {
        setActiveTab('creators');
      } else {
        setActiveTab('all');
      }

    } catch (err: any) {
      console.error("Search execution failed:", err);
      toast.error("Không thể hoàn tất tìm kiếm. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    if (searchParams.get('q') === trimmed) {
      performSearch(trimmed);
    } else {
      setSearchParams({ q: trimmed });
    }
  };

  const handleQuickSuggestion = (text: string) => {
    setSearchQuery(text);
    if (searchParams.get('q') === text) {
      performSearch(text);
    } else {
      setSearchParams({ q: text });
    }
  };

  const copyToClipboard = (text: string, promptId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPromptId(promptId);
    toast.success("Đã sao chép nội dung Prompt!");
    setTimeout(() => setCopiedPromptId(null), 2000);
  };

  const handleSortChange = (newSort: SortOption) => {
    setSortBy(newSort);
    if (searchQuery.trim()) {
      performSearch(searchQuery.trim(), newSort);
    }
  };

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      setSearchQuery(q);
      performSearch(q);
    }
  }, [searchParams]);

  const totalResultsCount = results ? results.totalCount : 0;
  const characterCount = results ? results.characters.length : 0;
  const promptCount = results ? results.prompts.length : 0;
  const creatorCount = results ? results.creators.length : 0;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 md:py-12">
      {/* Header Banner */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center p-3 bg-neutral-100 dark:bg-neutral-800 rounded-2xl mb-4 border border-neutral-200 dark:border-neutral-700">
          <Sparkles className="w-7 h-7 text-neutral-900 dark:text-neutral-100" />
        </div>
        <h1 className="text-2xl md:text-4xl font-bold tracking-tight mb-3">AI Search & Tra cứu thông minh</h1>
        <p className="text-sm md:text-base text-neutral-500 max-w-2xl mx-auto">
          Mô tả bằng ngôn ngữ tự nhiên (VD: <span className="italic text-neutral-800 dark:text-neutral-300">"Tìm nữ chính hiện đại lạnh lùng"</span>) hoặc tra cứu mã ID trực tiếp (VD: <span className="font-mono text-neutral-800 dark:text-neutral-300">character/123456789</span>).
        </p>
      </div>

      {/* Search Input Box */}
      <form onSubmit={handleSearch} className="relative max-w-3xl mx-auto mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
        <input 
          type="text" 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Nhập yêu cầu tự nhiên, từ khóa, tên tác giả hoặc mã ID..." 
          className="w-full pl-12 pr-32 py-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all text-base md:text-lg"
        />
        <button 
          type="submit" 
          disabled={loading || !searchQuery.trim()}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 px-5 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-xl font-semibold text-sm disabled:opacity-50 transition-all hover:opacity-90 flex items-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
              <span>Đang tìm...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Tìm kiếm</span>
            </>
          )}
        </button>
      </form>

      {/* Suggestion Chips */}
      <div className="flex items-center justify-center gap-2 flex-wrap max-w-3xl mx-auto mb-10 text-xs">
        <span className="text-neutral-400 font-medium mr-1">Gợi ý tìm kiếm:</span>
        {[
          "Nữ chính hiện đại",
          "Prompt viết RP học đường",
          "Tổng tài lạnh lùng",
          "Ma cà rồng Fantasy",
          "Creator chuyên Anime",
          "Prompt Roleplay"
        ].map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => handleQuickSuggestion(chip)}
            className="px-3 py-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800/80 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors border border-neutral-200/60 dark:border-neutral-700/60"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* ID Error State */}
      {idError && (
        <div className="text-center py-10 px-6 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/30 rounded-3xl mb-8">
          <p className="text-base font-bold mb-1">{idError}</p>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Vui lòng kiểm tra lại cấu trúc mã ID (gồm đúng 9 chữ số) hoặc chuyển sang tìm kiếm từ khóa.</p>
        </div>
      )}

      {/* Exact Match Resolution Card */}
      {!idError && exactMatch && exactMatch.result && (
        <div className="mb-10 space-y-4">
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
                    src={getValidAvatar(exactMatch.result.avatar)} 
                    alt={exactMatch.result.name}
                    className="w-20 h-20 rounded-2xl object-cover bg-neutral-100 dark:bg-neutral-800 shrink-0 border border-neutral-200 dark:border-neutral-700" 
                  />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">{exactMatch.result.name}</h2>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        character/{exactMatch.numericId}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500 mt-1 font-medium">Được tạo bởi: <span className="text-neutral-900 dark:text-neutral-200">{exactMatch.result.creatorName}</span></p>
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
                    <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">{exactMatch.result.title || exactMatch.result.name}</h2>
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      prompt/{exactMatch.numericId}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500">Tác giả: <span className="font-semibold text-neutral-800 dark:text-neutral-200">{exactMatch.result.authorName || exactMatch.result.author}</span></p>
                </div>

                <p className="text-sm text-neutral-600 dark:text-neutral-400">{exactMatch.result.purpose}</p>

                {exactMatch.result.content && (
                  <div className="p-4 bg-neutral-50 dark:bg-neutral-950 rounded-2xl border border-neutral-100 dark:border-neutral-800 font-mono text-xs max-h-40 overflow-y-auto whitespace-pre-wrap text-neutral-800 dark:text-neutral-300">
                    {exactMatch.result.content}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 flex-wrap gap-3">
                  <button
                    onClick={() => copyToClipboard(exactMatch.result.content || "", exactMatch.id)}
                    className="px-4 py-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors"
                  >
                    {copiedPromptId === exactMatch.id ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedPromptId === exactMatch.id ? "Đã sao chép!" : "Sao chép Prompt"}</span>
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
                    src={getValidAvatar(exactMatch.result.avatar)} 
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
                        <span>Character: <strong className="text-neutral-900 dark:text-neutral-100">{exactMatch.result.characterCount || 0}</strong></span>
                        <span>Prompt: <strong className="text-neutral-900 dark:text-neutral-100">{exactMatch.result.promptCount || 0}</strong></span>
                        <span>Người theo dõi: <strong className="text-neutral-900 dark:text-neutral-100">{exactMatch.result.followerCount || 0}</strong></span>
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

      {/* AI Understanding Badge */}
      {!idError && !exactMatch && criteria && (
        <div className="mb-8 p-4 bg-neutral-50 dark:bg-neutral-900/60 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 text-sm">
          <div className="flex items-center gap-2 font-medium text-xs text-neutral-500 uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5 text-neutral-700 dark:text-neutral-300" />
            <span>AI đã phân tích ngữ nghĩa truy vấn</span>
          </div>
          {criteria.summary && (
            <p className="text-neutral-800 dark:text-neutral-200 font-medium mb-3">{criteria.summary}</p>
          )}
          <div className="flex flex-wrap gap-2 text-xs">
            {criteria.type && criteria.type !== 'all' && (
              <span className="px-3 py-1 bg-white dark:bg-neutral-800 rounded-full border border-neutral-200 dark:border-neutral-700 font-medium text-neutral-700 dark:text-neutral-300">
                Phân loại: {criteria.type === 'character' ? 'Nhân vật' : criteria.type === 'prompt' ? 'Prompt' : 'Creator'}
              </span>
            )}
            {criteria.gender && (
              <span className="px-3 py-1 bg-white dark:bg-neutral-800 rounded-full border border-neutral-200 dark:border-neutral-700 font-medium text-neutral-700 dark:text-neutral-300">
                Giới tính: {criteria.gender}
              </span>
            )}
            {criteria.tags && criteria.tags.map((t: string) => (
              <span key={t} className="px-3 py-1 bg-white dark:bg-neutral-800 rounded-full border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400">
                #{t}
              </span>
            ))}
            {criteria.keywords && criteria.keywords.map((k: string) => (
              <span key={k} className="px-3 py-1 bg-neutral-200/70 dark:bg-neutral-800 rounded-full border border-neutral-300/50 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 font-medium">
                Từ khóa: {k}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Category Tabs & Sorting Bar (When Results Exist) */}
      {!idError && !exactMatch && results && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-4 mb-8">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 rounded-xl text-xs md:text-sm font-semibold transition-colors ${
                activeTab === 'all'
                  ? 'bg-black text-white dark:bg-white dark:text-black'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              }`}
            >
              Tất cả ({totalResultsCount})
            </button>
            <button
              onClick={() => setActiveTab('characters')}
              className={`px-4 py-2 rounded-xl text-xs md:text-sm font-semibold transition-colors ${
                activeTab === 'characters'
                  ? 'bg-black text-white dark:bg-white dark:text-black'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              }`}
            >
              Nhân vật ({characterCount})
            </button>
            <button
              onClick={() => setActiveTab('prompts')}
              className={`px-4 py-2 rounded-xl text-xs md:text-sm font-semibold transition-colors ${
                activeTab === 'prompts'
                  ? 'bg-black text-white dark:bg-white dark:text-black'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              }`}
            >
              Prompt ({promptCount})
            </button>
            <button
              onClick={() => setActiveTab('creators')}
              className={`px-4 py-2 rounded-xl text-xs md:text-sm font-semibold transition-colors ${
                activeTab === 'creators'
                  ? 'bg-black text-white dark:bg-white dark:text-black'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              }`}
            >
              Creator ({creatorCount})
            </button>
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <ArrowUpDown className="w-4 h-4 text-neutral-400" />
            <select
              value={sortBy}
              onChange={(e) => handleSortChange(e.target.value as SortOption)}
              aria-label="Sắp xếp kết quả tìm kiếm"
              className="px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-medium text-neutral-800 dark:text-neutral-200 focus:outline-none"
            >
              <option value="relevance">Độ liên quan</option>
              <option value="hot">Phổ biến nhất / Hot</option>
              <option value="newest">Mới nhất</option>
            </select>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-64 bg-neutral-100 dark:bg-neutral-800/60 rounded-3xl animate-pulse border border-neutral-200/50 dark:border-neutral-700/50"></div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!idError && !exactMatch && !loading && results && totalResultsCount === 0 && (
        <div className="text-center py-20 px-6 bg-neutral-50 dark:bg-neutral-900/30 border border-neutral-200 dark:border-neutral-800 rounded-3xl">
          <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-800 rounded-2xl flex items-center justify-center mx-auto mb-4 text-neutral-400">
            <Search className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold mb-2">Không tìm thấy kết quả phù hợp</h3>
          <p className="text-sm text-neutral-500 max-w-md mx-auto mb-6">
            Không tìm thấy Character, Prompt hoặc Creator nào khớp với <span className="font-semibold text-neutral-800 dark:text-neutral-200">"{searchQuery}"</span>.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => handleQuickSuggestion("Nữ chính")}
              className="px-4 py-2 bg-neutral-200/70 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 rounded-xl text-xs font-semibold"
            >
              Xem Nhân vật Nữ chính
            </button>
            <button
              onClick={() => handleQuickSuggestion("Prompt Roleplay")}
              className="px-4 py-2 bg-neutral-200/70 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 rounded-xl text-xs font-semibold"
            >
              Xem Prompt RP
            </button>
            <Link
              to="/explore"
              className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-semibold"
            >
              Khám phá trang cộng đồng
            </Link>
          </div>
        </div>
      )}

      {/* Results Content Display */}
      {!idError && !exactMatch && !loading && results && totalResultsCount > 0 && (
        <div className="space-y-12">
          {/* TAB: ALL */}
          {activeTab === 'all' && (
            <>
              {/* 1. Character Section */}
              {results.characters.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <User className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
                      <h2 className="text-xl font-bold tracking-tight">Nhân vật Roleplay ({results.characters.length})</h2>
                    </div>
                    {results.characters.length > 3 && (
                      <button
                        onClick={() => setActiveTab('characters')}
                        className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:underline"
                      >
                        Xem tất cả ({results.characters.length})
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {results.characters.slice(0, 6).map((character) => (
                      <CharacterCard key={character.id} character={character} />
                    ))}
                  </div>
                </section>
              )}

              {/* 2. Prompt Section */}
              {results.prompts.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
                      <h2 className="text-xl font-bold tracking-tight">Prompt AI ({results.prompts.length})</h2>
                    </div>
                    {results.prompts.length > 3 && (
                      <button
                        onClick={() => setActiveTab('prompts')}
                        className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:underline"
                      >
                        Xem tất cả ({results.prompts.length})
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {results.prompts.slice(0, 6).map((prompt) => (
                      <PromptCard key={prompt.id} prompt={prompt} />
                    ))}
                  </div>
                </section>
              )}

              {/* 3. Creator Section */}
              {results.creators.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
                      <h2 className="text-xl font-bold tracking-tight">Creator & Tác giả ({results.creators.length})</h2>
                    </div>
                    {results.creators.length > 3 && (
                      <button
                        onClick={() => setActiveTab('creators')}
                        className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:underline"
                      >
                        Xem tất cả ({results.creators.length})
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {results.creators.slice(0, 6).map((creator) => (
                      <CreatorCard key={creator.id} creator={creator} />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          {/* TAB: CHARACTERS ONLY */}
          {activeTab === 'characters' && (
            <div>
              {results.characters.length === 0 ? (
                <div className="text-center py-16 text-neutral-500">Không có Character nào phù hợp với tìm kiếm.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {results.characters.map((character) => (
                    <CharacterCard key={character.id} character={character} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: PROMPTS ONLY */}
          {activeTab === 'prompts' && (
            <div>
              {results.prompts.length === 0 ? (
                <div className="text-center py-16 text-neutral-500">Không có Prompt nào phù hợp với tìm kiếm.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {results.prompts.map((prompt) => (
                    <PromptCard key={prompt.id} prompt={prompt} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: CREATORS ONLY */}
          {activeTab === 'creators' && (
            <div>
              {results.creators.length === 0 ? (
                <div className="text-center py-16 text-neutral-500">Không có Creator nào phù hợp với tìm kiếm.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {results.creators.map((creator) => (
                    <CreatorCard key={creator.id} creator={creator} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
