import React, { useState, useEffect } from 'react';
import { 
  Users, Search, Plus, Sparkles, Filter, RefreshCw, Flame, Clock, Calendar, ArrowUpDown
} from 'lucide-react';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { useSeo } from '../hooks/useSeo';
import { CharacterItem } from '../types';
import CharacterCard from '../components/CharacterCard';
import CreateCharacterModal from '../components/profile/CreateCharacterModal';
import toast from 'react-hot-toast';

import { useNavigate, useSearchParams } from 'react-router-dom';
import { parseIdQuery, lookupIdInFirebase, matchesSearchText, matchesItemFields } from '../lib/searchUtils';

export type CharacterSortOption = 'FEATURED' | 'NEWEST' | 'OLDEST';

export default function Characters() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();

  const [characters, setCharacters] = useState<CharacterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || searchParams.get('search') || '');
  const [selectedTag, setSelectedTag] = useState<string | null>(searchParams.get('tag') || null);
  const [selectedGender, setSelectedGender] = useState<string>('ALL');
  const [sortOption, setSortOption] = useState<CharacterSortOption>('FEATURED');

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [characterToEdit, setCharacterToEdit] = useState<CharacterItem | null>(null);

  useSeo({
    title: 'Danh Sách Character',
    description: 'Khám phá thư viện Character Roleplay độc đáo từ cộng đồng Creator Google AI Studio. Tìm kiếm nhân vật theo sở thích và cốt truyện.'
  });

  useEffect(() => {
    const qParam = searchParams.get('q') || searchParams.get('search');
    const tagParam = searchParams.get('tag');
    if (qParam !== null && qParam !== undefined) {
      setSearchTerm(qParam);
    }
    if (tagParam !== null && tagParam !== undefined) {
      setSelectedTag(tagParam);
    }
  }, [searchParams]);

  const fetchCharacters = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'characters'));
      const list: CharacterItem[] = [];

      snap.docs.forEach(docSnap => {
        const data = docSnap.data();
        if (!data.deletedAt && !data.isHidden) {
          list.push({ id: docSnap.id, ...data } as CharacterItem);
        }
      });

      setCharacters(list);
    } catch (err) {
      console.error("Lỗi khi tải danh sách Character:", err);
      toast.error("Không thể tải danh sách Character.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCharacters();
  }, []);

  // Collect all unique tags
  const allTags = Array.from(
    new Set(characters.flatMap(c => c.tags || []))
  ).filter(Boolean);

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const queryStr = searchTerm.trim();
    if (!queryStr) return;

    const idParse = parseIdQuery(queryStr);
    if (idParse.isIdQuery) {
      if (idParse.error) {
        toast.error(idParse.error);
        return;
      }

      if (idParse.numericId) {
        try {
          const lookup = await lookupIdInFirebase(idParse.numericId, idParse.typeHint || 'character');
          if (lookup && lookup.found && lookup.path) {
            toast.success("Đã tìm thấy đối tượng chính xác theo ID!");
            navigate(lookup.path);
            return;
          } else {
            toast.error(lookup?.error || "Mã ID không tồn tại trên hệ thống.");
            return;
          }
        } catch (err) {
          console.error("Exact lookup error in Characters page:", err);
          return;
        }
      }
    }
  };

  // Filter & Sort Logic
  const filteredCharacters = characters
    .filter(c => {
      const term = searchTerm.trim();
      const matchesSearch = !term || matchesItemFields(
        [c.name, c.slogan, c.plot, c.tags, c.creatorName, c.gender, c.characterLink, c.numericId, c.id],
        term
      );

      const matchesTag = selectedTag ? c.tags?.some(t => matchesSearchText(t, selectedTag)) : true;
      const matchesGender = selectedGender === 'ALL' ? true : c.gender === selectedGender;

      return matchesSearch && matchesTag && matchesGender;
    })
    .sort((a, b) => {
      if (sortOption === 'FEATURED') {
        // Feature score based on Likes, Saves, and Views according to specification
        const scoreA = (a.likesCount || 0) * 3 + (a.savesCount || 0) * 2 + (a.viewsCount || 0);
        const scoreB = (b.likesCount || 0) * 3 + (b.savesCount || 0) * 2 + (b.viewsCount || 0);
        return scoreB - scoreA;
      }
      
      if (sortOption === 'NEWEST') {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
      }

      if (sortOption === 'OLDEST') {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateA - dateB;
      }

      return 0;
    });

  // Calculate stats for header
  const totalCharacters = characters.length;
  const featuredCount = characters.filter(c => ((c.likesCount || 0) > 0 || (c.savesCount || 0) > 0)).length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Header & Hero Section */}
      <div className="bg-gradient-to-r from-neutral-900 via-neutral-800 to-black text-white p-8 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-neutral-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full text-xs font-bold">
            <Users className="w-3.5 h-3.5" />
            <span>Thư Viện Character Roleplay</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Danh Sách Character
          </h1>
          <p className="text-neutral-400 text-sm leading-relaxed">
            Khám phá hàng ngàn nhân vật Roleplay độc đáo từ cộng đồng Creator Google AI Studio. Tùy chọn xem theo lượt yêu thích, mới nhất hoặc các nhân vật cũ kỉ niệm.
          </p>
        </div>

        {/* Nút Đăng/Tạo Character */}
        <div className="relative z-10 shrink-0">
          {user ? (
            user.creatorStatus || user.role === 'ADMIN' ? (
              <button
                onClick={() => {
                  setCharacterToEdit(null);
                  setIsCreateModalOpen(true);
                }}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-amber-500 text-black font-extrabold text-sm hover:bg-amber-400 transition-transform active:scale-95 shadow-lg"
              >
                <Plus className="w-5 h-5" />
                <span>Tạo Character Mới</span>
              </button>
            ) : (
              <div className="text-right">
                <button
                  onClick={() => toast.error("Bạn cần đăng ký trở thành Creator để có quyền đăng Character!")}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-neutral-800 border border-neutral-700 text-neutral-300 text-sm font-bold opacity-80 cursor-not-allowed"
                >
                  <Plus className="w-5 h-5" />
                  <span>Dành riêng cho Creator</span>
                </button>
                <p className="text-[11px] text-neutral-400 mt-1">Gửi yêu cầu Creator trong Hồ sơ cá nhân</p>
              </div>
            )
          ) : (
            <button
              onClick={() => toast.error("Vui lòng đăng nhập bằng Google để đăng Character!")}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-neutral-800 border border-neutral-700 text-white text-sm font-bold opacity-80"
            >
              <Plus className="w-5 h-5" />
              <span>Đăng nhập để tạo Character</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Sort Tabs (Nổi bật - Mới - Cũ) */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-4">
        <div className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-900 p-1.5 rounded-2xl border border-neutral-200/80 dark:border-neutral-800">
          <button
            onClick={() => setSortOption('FEATURED')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              sortOption === 'FEATURED'
                ? 'bg-white dark:bg-neutral-800 text-red-600 dark:text-red-400 shadow-sm'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white'
            }`}
          >
            <Flame className="w-4 h-4 fill-current" />
            <span>Character Nổi Bật</span>
          </button>

          <button
            onClick={() => setSortOption('NEWEST')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              sortOption === 'NEWEST'
                ? 'bg-white dark:bg-neutral-800 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Character Mới</span>
          </button>

          <button
            onClick={() => setSortOption('OLDEST')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              sortOption === 'OLDEST'
                ? 'bg-white dark:bg-neutral-800 text-amber-600 dark:text-amber-400 shadow-sm'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Character Cũ</span>
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs text-neutral-500 font-medium">
          <span>Tổng cộng: <strong className="text-black dark:text-white font-bold">{filteredCharacters.length}</strong> Character</span>
          <button
            onClick={fetchCharacters}
            className="p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:text-black dark:hover:text-white border border-neutral-200 dark:border-neutral-700"
            title="Làm mới danh sách"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search & Sub-Filter Bar */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search input */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Tìm kiếm theo tên Character, slogan, ID (character/123456789)..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs md:text-sm rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-transparent focus:border-black dark:focus:border-white focus:outline-none"
          />
        </form>

        {/* Gender filter */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-neutral-400 font-medium">Giới tính:</span>
          <select
            value={selectedGender}
            onChange={e => setSelectedGender(e.target.value)}
            className="px-3 py-2 text-xs font-semibold rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none"
          >
            <option value="ALL">Tất cả giới tính</option>
            <option value="Nữ">Nữ</option>
            <option value="Nam">Nam</option>
            <option value="Phi giới tính">Phi giới tính / Khác</option>
          </select>
        </div>
      </div>

      {/* Tags Quick Filter */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Lọc theo Tag:
          </span>
          <button
            onClick={() => setSelectedTag(null)}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${
              selectedTag === null
                ? 'bg-black dark:bg-white text-white dark:text-black'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white'
            }`}
          >
            Tất cả ({characters.length})
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                selectedTag === tag
                  ? 'bg-black dark:bg-white text-white dark:text-black'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white'
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {/* Character Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div key={i} className="h-64 bg-neutral-100 dark:bg-neutral-800 rounded-2xl animate-pulse"></div>
          ))}
        </div>
      ) : filteredCharacters.length === 0 ? (
        <div className="py-20 text-center bg-white dark:bg-neutral-900 rounded-3xl border border-dashed border-neutral-200 dark:border-neutral-800 p-8 space-y-3">
          <Users className="w-12 h-12 text-neutral-400 mx-auto opacity-40" />
          <h3 className="font-bold text-lg">Chưa có Character phù hợp</h3>
          <p className="text-neutral-500 text-xs max-w-sm mx-auto">
            Không tìm thấy nhân vật nào phù hợp với từ khóa hoặc bộ lọc đã chọn. Hãy thử tìm từ khóa khác!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredCharacters.map(char => (
            <CharacterCard 
              key={char.id} 
              character={char} 
              onUpdate={fetchCharacters} 
            />
          ))}
        </div>
      )}

      {/* Modal tạo Character mới cho Creator */}
      <CreateCharacterModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={fetchCharacters}
        characterToEdit={characterToEdit}
      />
    </div>
  );
}
