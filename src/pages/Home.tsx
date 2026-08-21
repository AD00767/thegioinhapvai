import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { 
  Flame, Sparkles, Users, Tag as TagIcon, MessageSquare, 
  Search as SearchIcon, ArrowRight, TrendingUp, Compass, Clock, Star
} from "lucide-react";
import { db } from "../lib/firebase";
import { collection, query, getDocs, where, limit, doc, deleteDoc } from "firebase/firestore";
import PublicFeedbackCard from "../components/feedback/PublicFeedbackCard";
import CharacterCard from "../components/CharacterCard";
import PromptCard from "../components/PromptCard";
import CreatorCard from "../components/CreatorCard";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import { CharacterItem, PromptItem, CreatorItem } from "../types";
import { useAuthStore } from "../store/useAuthStore";
import { useSeo } from "../hooks/useSeo";
import toast from "react-hot-toast";

import { parseIdQuery, lookupIdInFirebase, matchesSearchText, matchesItemFields } from "../lib/searchUtils";

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);

  const initialQuery = searchParams.get("q") || "";
  const initialTag = searchParams.get("tag") || null;
  const initialTab = searchParams.get("tab") || "all";

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedTag, setSelectedTag] = useState<string | null>(initialTag);
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  const [hotCharacters, setHotCharacters] = useState<CharacterItem[]>([]);
  const [hotPrompts, setHotPrompts] = useState<PromptItem[]>([]);
  const [topCreators, setTopCreators] = useState<CreatorItem[]>([]);
  const [trendingTags, setTrendingTags] = useState<{ tag: string; count: number }[]>([]);
  const [publicFeedbacks, setPublicFeedbacks] = useState<any[]>([]);
  const [promptToDelete, setPromptToDelete] = useState<string | null>(null);

  useSeo({
    title: 'Trang Chủ',
    description: 'Thế Giới Nhập vai AD - Nền tảng cộng đồng dành cho Google AI Studio, nơi bạn có thể khám phá, chia sẻ Character, Prompt và các tài nguyên hữu ích cho Roleplay.'
  });

  useEffect(() => {
    setSearchQuery(searchParams.get("q") || "");
    setSelectedTag(searchParams.get("tag") || null);
    setActiveTab(searchParams.get("tab") || "all");
  }, [searchParams]);

  const loadHomeData = async () => {
    setLoading(true);
    let loadedChars: CharacterItem[] = [];
    let loadedPrompts: PromptItem[] = [];

    try {
      // 1. Fetch Characters (limit to 30 for Home)
      try {
        const charQuery = query(collection(db, "characters"), limit(30));
        const charSnap = await getDocs(charQuery);
        loadedChars = charSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as CharacterItem))
          .filter((c: any) => !c.deletedAt && !c.isHidden);

        const sortedChars = [...loadedChars].sort((a, b) => {
          const scoreA = (a.likesCount || 0) * 3 + (a.savesCount || 0) * 2 + (a.viewsCount || 0);
          const scoreB = (b.likesCount || 0) * 3 + (b.savesCount || 0) * 2 + (b.viewsCount || 0);
          return scoreB - scoreA;
        });
        setHotCharacters(sortedChars);
      } catch (e) {
        console.error("Error fetching characters:", e);
      }

      // 2. Fetch Prompts (limit to 30 for Home)
      try {
        const promptQuery = query(collection(db, "prompts"), limit(30));
        const promptSnap = await getDocs(promptQuery);
        loadedPrompts = promptSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as PromptItem))
          .filter((p: any) => !p.deletedAt && !p.isHidden);

        const sortedPrompts = [...loadedPrompts].sort((a, b) => {
          const scoreA = (a.copyCount || 0) * 3 + (a.savesCount || 0) * 2 + (a.viewsCount || 0);
          const scoreB = (b.copyCount || 0) * 3 + (b.savesCount || 0) * 2 + (b.viewsCount || 0);
          return scoreB - scoreA;
        });
        setHotPrompts(sortedPrompts);
      } catch (e) {
        console.error("Error fetching prompts:", e);
      }

      // 3. Fetch Top Creators (limit to 30 creators for Home)
      try {
        const creatorQuery = query(collection(db, "users"), where("creatorStatus", "==", true), limit(30));
        const userSnap = await getDocs(creatorQuery);
        const rawCreators: CreatorItem[] = userSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as CreatorItem))
          .filter((u: any) => !u.deletedAt && !u.isHidden && !u.isLocked);

        const sortedCreators = [...rawCreators].sort((a, b) => {
          const scoreA = (a.followerCount || 0) * 5 + (a.characterCount || 0);
          const scoreB = (b.followerCount || 0) * 5 + (b.characterCount || 0);
          return scoreB - scoreA;
        });
        setTopCreators(sortedCreators);
      } catch (e) {
        console.error("Error fetching creators:", e);
      }

      // 4. Calculate Trending Tags
      const tagMap: Record<string, number> = {};
      loadedChars.forEach(c => c.tags?.forEach(t => { tagMap[t] = (tagMap[t] || 0) + 1; }));
      loadedPrompts.forEach(p => p.tags?.forEach(t => { tagMap[t] = (tagMap[t] || 0) + 1; }));

      const sortedTags = Object.entries(tagMap)
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count);

      const defaultTags = ["Roleplay", "Anime", "Họcđường", "Fantasy", "Cổđại", "Kinhdị", "Trinhthám", "AIStudio"];
      const finalTags = sortedTags.length > 0 
        ? sortedTags.slice(0, 10) 
        : defaultTags.map(tag => ({ tag, count: 1 }));

      setTrendingTags(finalTags);

      // 5. Fetch Public Feedback
      try {
        const fbQuery = query(
          collection(db, "feedbacks"),
          where("mode", "==", "PUBLIC"),
          limit(4)
        );
        const fbSnap = await getDocs(fbQuery);
        const fbList = fbSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter((f: any) => !f.deletedAt && !f.isHidden);
        setPublicFeedbacks(fbList);
      } catch (e) {
        console.error("Error fetching public feedbacks:", e);
      }

    } catch (e) {
      console.error("Home load data error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHomeData();
  }, []);

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const queryStr = searchQuery.trim();
    if (!queryStr) return;

    const idParse = parseIdQuery(queryStr);
    if (idParse.isIdQuery) {
      if (idParse.error) {
        toast.error(idParse.error);
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
            toast.error(lookup?.error || "Mã ID không tồn tại trên hệ thống.");
            return;
          }
        } catch (err) {
          console.error("Exact lookup error in Home page:", err);
          return;
        }
      }
    }

    const params: Record<string, string> = {};
    if (queryStr) params.q = queryStr;
    if (selectedTag) params.tag = selectedTag;
    if (activeTab && activeTab !== "all") params.tab = activeTab;
    setSearchParams(params);
  };

  const handleTagClick = (tag: string | null) => {
    setSelectedTag(tag);
    const params: Record<string, string> = {};
    if (searchQuery.trim()) params.q = searchQuery.trim();
    if (tag) params.tag = tag;
    if (activeTab && activeTab !== "all") params.tab = activeTab;
    setSearchParams(params);
  };

  // Filter items based on searchQuery & selectedTag
  const filteredCharacters = hotCharacters.filter(item => {
    const term = searchQuery.trim();
    const matchesSearch = !term || matchesItemFields(
      [item.name, item.slogan, item.plot, item.creatorName, item.tags, item.numericId, item.id],
      term
    );
    const tagMatch = selectedTag ? item.tags?.some(t => matchesSearchText(t, selectedTag)) : true;
    return matchesSearch && tagMatch;
  });

  const filteredPrompts = hotPrompts.filter(item => {
    const term = searchQuery.trim();
    const matchesSearch = !term || matchesItemFields(
      [item.name, item.title, item.purpose, item.content, item.authorName, item.tags, item.numericId, item.id],
      term
    );
    const tagMatch = selectedTag ? item.tags?.some(t => matchesSearchText(t, selectedTag)) : true;
    return matchesSearch && tagMatch;
  });

  const filteredCreators = topCreators.filter(item => {
    const term = searchQuery.trim();
    return !term || matchesItemFields(
      [item.displayName, item.bio, item.numericId, item.id],
      term
    );
  });

  return (
    <div className="w-full flex flex-col items-center pb-12">
      
      {/* Hero Banner Section */}
      <section className="w-full bg-gradient-to-b from-neutral-900 to-neutral-950 text-white py-16 px-6 rounded-3xl mt-4 mb-12 text-center max-w-6xl mx-auto border border-neutral-800 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 text-amber-400 text-xs font-semibold mb-6 border border-amber-500/20">
            <Compass className="w-4 h-4" />
            <span>Trang Chủ & Khám Phá — Thế Giới Nhập Vai AD</span>
          </div>

          <h1 className="text-2xl xs:text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-4 leading-tight">
            Khởi đầu cho mọi hành trình Roleplay
          </h1>
          <p className="text-neutral-400 mb-6 sm:mb-8 max-w-2xl mx-auto text-xs xs:text-sm md:text-base leading-relaxed">
            Nền tảng cộng đồng dành cho Google AI Studio — Nơi tự do khám phá, sáng tạo Character, Prompt và kết nối với các Creator hàng đầu.
          </p>

          {/* Quick Search */}
          <form onSubmit={handleSearchSubmit} className="max-w-2xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 xs:w-5 h-5 text-neutral-400" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm Character, Prompt, Creator..." 
                className="w-full pl-10 xs:pl-12 pr-12 py-3 xs:py-3.5 rounded-2xl bg-neutral-800/90 border border-neutral-700 text-white placeholder-neutral-400 shadow-sm focus:outline-none focus:border-amber-500 transition-all text-xs xs:text-sm md:text-base"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    handleTagClick(selectedTag);
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] xs:text-xs text-neutral-400 hover:text-white bg-neutral-700 px-1.5 py-0.5 xs:px-2 xs:py-1 rounded"
                >
                  Xóa
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
              <button 
                type="submit"
                className="flex-1 sm:flex-initial px-5 py-3 xs:py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs xs:text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shrink-0"
              >
                <span>Tìm kiếm</span>
              </button>
              <Link 
                to="/ai-search" 
                className="p-3 xs:p-3.5 rounded-2xl bg-neutral-800 hover:bg-neutral-700 text-amber-400 border border-neutral-700 transition-colors shrink-0 flex items-center justify-center"
                title="AI Search Ngữ Nghĩa"
              >
                <Sparkles className="w-4 h-4 xs:w-5 h-5" />
              </Link>
            </div>
          </form>
        </div>
      </section>

      <div className="w-full max-w-6xl mx-auto px-4 space-y-16">
        
        {/* SECTION 1: TAG ĐANG PHỔ BIẾN */}
        <section className="bg-white dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 p-6 rounded-3xl shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-start md:items-center justify-between gap-3 mb-5 border-b border-neutral-100 dark:border-neutral-800 pb-4">
            <div className="flex items-center gap-2">
              <TagIcon className="w-5 h-5 text-amber-500" />
              <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">Tag Đang Phổ Biến</h2>
            </div>
            {selectedTag && (
              <button
                onClick={() => handleTagClick(null)}
                className="text-xs text-amber-600 dark:text-amber-400 font-bold hover:underline self-start sm:self-auto px-3 py-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 sm:bg-transparent sm:p-0"
              >
                Xóa bộ lọc thẻ (#{selectedTag})
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleTagClick(null)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all ${
                selectedTag === null
                  ? "bg-amber-500 text-black border-amber-500 font-bold"
                  : "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200/60 dark:border-neutral-700/60 hover:bg-amber-500/10"
              }`}
            >
              Tất cả thẻ
            </button>
            {trendingTags.map((item, idx) => (
              <button
                key={idx}
                onClick={() => handleTagClick(selectedTag === item.tag ? null : item.tag)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all flex items-center gap-1.5 max-w-full truncate ${
                  selectedTag === item.tag
                    ? "bg-amber-500 text-black border-amber-500 font-bold"
                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200/60 dark:border-neutral-700/60 hover:bg-amber-500/10"
                }`}
              >
                <span className="truncate">#{item.tag}</span>
                <span className="text-[10px] opacity-60 bg-neutral-200 dark:bg-neutral-700 px-1.5 py-0.2 rounded-full shrink-0">
                  {item.count}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* SECTION 2: CHARACTER HOT / TẤT CẢ */}
        <section>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 sm:w-6 sm:h-6 text-red-500 fill-red-500" />
                <h2 className="text-xl md:text-2xl font-bold text-neutral-900 dark:text-neutral-100">Character Nổi Bật</h2>
              </div>
              <p className="text-xs text-neutral-500">Các nhân vật có nhiều lượt lưu và yêu thích nhất</p>
            </div>
            <Link to="/characters" className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 flex items-center justify-center gap-1 self-start sm:self-auto shrink-0 bg-neutral-100 dark:bg-neutral-800/60 sm:bg-transparent px-3 py-2 sm:p-0 rounded-full sm:rounded-none border border-neutral-200/60 dark:border-neutral-700/60 sm:border-none w-full sm:w-auto transition-colors">
              <span>Xem tất cả Character</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-64 bg-neutral-100 dark:bg-neutral-800 rounded-2xl animate-pulse" />)}
            </div>
          ) : filteredCharacters.length === 0 ? (
            <div className="py-12 text-center text-neutral-500 border border-neutral-200 dark:border-neutral-800 rounded-2xl border-dashed text-sm">
              Không tìm thấy Character nào phù hợp với bộ lọc.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {filteredCharacters.slice(0, 8).map(char => (
                <CharacterCard key={char.id} character={char} onUpdate={loadHomeData} />
              ))}
            </div>
          )}
        </section>

        {/* SECTION 3: PROMPT HOT */}
        <section>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500 fill-emerald-500" />
                <h2 className="text-xl md:text-2xl font-bold text-neutral-900 dark:text-neutral-100">Prompt Nổi Bật</h2>
              </div>
              <p className="text-xs text-neutral-500">Các câu lệnh Prompt có lượt copy và lưu cao nhất từ cộng đồng</p>
            </div>
            <Link to="/prompts" className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 flex items-center justify-center gap-1 self-start sm:self-auto shrink-0 bg-neutral-100 dark:bg-neutral-800/60 sm:bg-transparent px-3 py-2 sm:p-0 rounded-full sm:rounded-none border border-neutral-200/60 dark:border-neutral-700/60 sm:border-none w-full sm:w-auto transition-colors">
              <span>Xem tất cả Prompt</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2].map(i => <div key={i} className="h-48 bg-neutral-100 dark:bg-neutral-800 rounded-2xl animate-pulse" />)}
            </div>
          ) : filteredPrompts.length === 0 ? (
            <div className="py-12 text-center text-neutral-500 border border-neutral-200 dark:border-neutral-800 rounded-2xl border-dashed text-sm">
              Không tìm thấy Prompt nào phù hợp với bộ lọc.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredPrompts.slice(0, 6).map(prompt => (
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

        {/* SECTION 4: CREATOR NỔI BẬT */}
        <section>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500" />
                <h2 className="text-xl md:text-2xl font-bold text-neutral-900 dark:text-neutral-100">Creator Nổi Bật</h2>
              </div>
              <p className="text-xs text-neutral-500">Những tác giả Roleplay xuất sắc được đông đảo người dùng theo dõi</p>
            </div>
            <Link to="/creators" className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 flex items-center justify-center gap-1 self-start sm:self-auto shrink-0 bg-neutral-100 dark:bg-neutral-800/60 sm:bg-transparent px-3 py-2 sm:p-0 rounded-full sm:rounded-none border border-neutral-200/60 dark:border-neutral-700/60 sm:border-none w-full sm:w-auto transition-colors">
              <span>Xem danh sách Creator</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => <div key={i} className="h-48 bg-neutral-100 dark:bg-neutral-800 rounded-2xl animate-pulse" />)}
            </div>
          ) : filteredCreators.length === 0 ? (
            <div className="py-12 text-center text-neutral-500 border border-neutral-200 dark:border-neutral-800 rounded-2xl border-dashed text-sm">
              Không tìm thấy Creator nào phù hợp.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {filteredCreators.slice(0, 6).map(creator => (
                <CreatorCard key={creator.id} creator={creator} onUpdate={loadHomeData} />
              ))}
            </div>
          )}
        </section>

        {/* SECTION 5: PUBLIC FEEDBACK */}
        <section>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500" />
                <h2 className="text-xl md:text-2xl font-bold text-neutral-900 dark:text-neutral-100">Feedback Công Khai Mới</h2>
              </div>
              <p className="text-xs text-neutral-500">Các ý kiến đóng góp và trao đổi nổi bật từ các thành viên</p>
            </div>
            <Link to="/feedbacks" className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 flex items-center justify-center gap-1 self-start sm:self-auto shrink-0 bg-neutral-100 dark:bg-neutral-800/60 sm:bg-transparent px-3 py-2 sm:p-0 rounded-full sm:rounded-none border border-neutral-200/60 dark:border-neutral-700/60 sm:border-none w-full sm:w-auto transition-colors">
              <span>Xem tất cả Feedback</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2].map(i => <div key={i} className="h-32 bg-neutral-100 dark:bg-neutral-800 rounded-2xl animate-pulse" />)}
            </div>
          ) : publicFeedbacks.length === 0 ? (
            <div className="py-12 text-center text-neutral-500 border border-neutral-200 dark:border-neutral-800 rounded-2xl border-dashed text-sm">
              Chưa có Feedback công khai nào.
              <div className="mt-4">
                <Link
                  to="/feedbacks"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-black dark:bg-white text-white dark:text-black text-xs font-medium rounded-xl hover:opacity-90 transition-opacity"
                >
                  <MessageSquare className="w-4 h-4" />
                  Gửi Feedback đầu tiên
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {publicFeedbacks.map(fb => (
                <PublicFeedbackCard
                  key={fb.id}
                  feedback={fb}
                  onDelete={(id) => setPublicFeedbacks(prev => prev.filter(f => f.id !== id))}
                />
              ))}
            </div>
          )}
        </section>

      </div>

      {/* Delete Prompt Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={promptToDelete !== null}
        onClose={() => setPromptToDelete(null)}
        onConfirm={async () => {
          if (!promptToDelete) return;
          try {
            await deleteDoc(doc(db, 'prompts', promptToDelete));
            toast.success("Đã xóa hoàn toàn Prompt khỏi hệ thống.");
            loadHomeData();
          } catch (e) {
            toast.error("Không thể xóa Prompt.");
          }
        }}
      />
    </div>
  );
}


