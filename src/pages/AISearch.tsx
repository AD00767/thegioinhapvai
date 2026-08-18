import React, { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { Sparkles, Search, Copy, Check, ExternalLink, User, BookOpen, PenTool, Flame } from 'lucide-react';
import { motion } from 'motion/react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useSeo } from '../hooks/useSeo';
import { db } from '../lib/firebase';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { parseIdQuery, lookupIdInFirebase, ExactIdLookupResult } from '../lib/searchUtils';

export default function AISearch() {
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);
  const [exactMatch, setExactMatch] = useState<ExactIdLookupResult | null>(null);
  const [criteria, setCriteria] = useState<any>(null);
  const [idError, setIdError] = useState<string | null>(null);
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useSeo({
    title: 'Tìm kiếm bằng AI',
    description: 'Sử dụng trí tuệ nhân tạo để tìm kiếm Character, Prompt và Creator phù hợp nhất qua ngôn ngữ tự nhiên.'
  });

  const performSearch = async (queryText: string) => {
    if (!queryText.trim()) return;
    
    setLoading(true);
    setResults(null);
    setExactMatch(null);
    setCriteria(null);
    setIdError(null);
    try {
      // Robust ID search handling
      const idParse = parseIdQuery(queryText);
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
            const missingMsg = lookup?.error || "ID không tồn tại trên hệ thống.";
            setIdError(missingMsg);
            toast.error(missingMsg);
            setLoading(false);
            return;
          }
        }
      }

      // Normal Natural Language Search
      const res = await apiFetch("/api/ai-search", {
        method: "POST",
        body: JSON.stringify({ query: queryText })
      });
      
      const parsedCriteria = res.parsedCriteria || {};
      setCriteria(parsedCriteria);

      let q = query(collection(db, "characters"), where("deletedAt", "==", null));
      if (parsedCriteria.gender) {
        q = query(q, where("gender", "==", parsedCriteria.gender));
      }

      const snapshot = await getDocs(query(q, limit(50)));
      let fetchedResults = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      if (parsedCriteria.keywords && parsedCriteria.keywords.length > 0) {
        fetchedResults = fetchedResults.filter((char: any) => 
          parsedCriteria.keywords.some((kw: string) => 
            (char.name || "").toLowerCase().includes(kw.toLowerCase()) || 
            (char.slogan || "").toLowerCase().includes(kw.toLowerCase()) ||
            (char.tags || []).some((t: string) => t.toLowerCase().includes(kw.toLowerCase()))
          )
        );
      }

      setResults(fetchedResults);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(searchQuery);
  };

  const copyToClipboard = (text: string, promptId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPromptId(promptId);
    toast.success("Đã sao chép nội dung Prompt!");
    setTimeout(() => setCopiedPromptId(null), 2000);
  };

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      setSearchQuery(q);
      performSearch(q);
    }
  }, [searchParams]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center p-3 bg-neutral-100 dark:bg-neutral-800 rounded-full mb-6">
          <Sparkles className="w-8 h-8 text-neutral-900 dark:text-neutral-100" />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Tìm kiếm bằng AI</h1>
        <p className="text-neutral-500 max-w-xl mx-auto">
          Mô tả bằng ngôn ngữ tự nhiên hoặc nhập mã ID trực tiếp (VD: character/123456789), hệ thống sẽ truy xuất chính xác dữ liệu từ cơ sở dữ liệu.
        </p>
      </div>

      <form onSubmit={handleSearch} className="relative max-w-2xl mx-auto mb-12">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
        <input 
          type="text" 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="VD: Tìm nữ chính hiện đại hoặc character/123456789..." 
          className="w-full pl-12 pr-32 py-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-shadow text-lg"
        />
        <button 
          type="submit" 
          disabled={loading || !searchQuery.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2 bg-black dark:bg-white text-white dark:text-black rounded-xl font-medium disabled:opacity-50 transition-opacity"
        >
          {loading ? "Đang tìm..." : "Tìm kiếm"}
        </button>
      </form>

      {/* Error state */}
      {idError && (
        <div className="text-center py-12 px-6 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/30 rounded-3xl mt-6">
          <p className="text-lg font-bold mb-2">{idError}</p>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Vui lòng kiểm tra lại mã ID hoặc từ khóa tìm kiếm của bạn.</p>
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

      {/* Natural language query parsing indicator */}
      {!idError && !exactMatch && criteria && (
        <div className="mb-8 p-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-2xl border border-neutral-100 dark:border-neutral-800 text-sm">
          <div className="font-medium mb-2">AI đã hiểu yêu cầu của bạn:</div>
          <div className="flex flex-wrap gap-2">
            {criteria.type && <span className="px-3 py-1 bg-white dark:bg-neutral-800 rounded-full border border-neutral-200 dark:border-neutral-700">Loại: {criteria.type}</span>}
            {criteria.gender && <span className="px-3 py-1 bg-white dark:bg-neutral-800 rounded-full border border-neutral-200 dark:border-neutral-700">Giới tính: {criteria.gender}</span>}
            {criteria.tags && criteria.tags.map((t: string) => <span key={t} className="px-3 py-1 bg-white dark:bg-neutral-800 rounded-full border border-neutral-200 dark:border-neutral-700">Tag: {t}</span>)}
            {criteria.keywords && criteria.keywords.map((k: string) => <span key={k} className="px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full border border-blue-100 dark:border-blue-800">Từ khóa: {k}</span>)}
          </div>
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-32 bg-neutral-100 dark:bg-neutral-800 rounded-2xl animate-pulse"></div>)}
        </div>
      )}

      {!idError && !exactMatch && !loading && results && results.length === 0 && (
        <div className="text-center py-20 text-neutral-500 border border-neutral-100 dark:border-neutral-800 rounded-3xl border-dashed">
          Không tìm thấy kết quả phù hợp.
        </div>
      )}

      {!idError && !exactMatch && !loading && results && results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {results.map((item, i) => (
             <motion.div 
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: i * 0.05 }}
               key={item.id}
             >
               <Link to={`/characters/${item.id}`} className="group p-4 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-100 dark:border-neutral-800 shadow-sm hover:shadow-md transition-all flex gap-4 h-full">
                 <img src={item.avatar || "https://api.dicebear.com/7.x/bottts/svg?seed="+item.name} className="w-20 h-20 rounded-xl object-cover bg-neutral-100 dark:bg-neutral-800 shrink-0" />
                 <div className="flex-1 min-w-0">
                   <h3 className="font-bold text-lg group-hover:text-blue-500 transition-colors truncate">{item.name}</h3>
                   <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2 mt-1">{item.slogan}</p>
                   {item.tags && (
                     <div className="flex gap-1 mt-2 flex-wrap">
                       {item.tags.slice(0,2).map((t: string) => <span key={t} className="text-xs px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded-md text-neutral-600 dark:text-neutral-400">{t}</span>)}
                     </div>
                   )}
                 </div>
               </Link>
             </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
