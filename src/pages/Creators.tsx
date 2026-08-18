import React, { useState, useEffect } from 'react';
import { Sparkles, Search, UserCheck, Flame, Clock, Award, RefreshCw } from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useSeo } from '../hooks/useSeo';
import { CreatorItem } from '../types';
import CreatorCard from '../components/CreatorCard';
import toast from 'react-hot-toast';

import { useNavigate } from 'react-router-dom';
import { parseIdQuery, lookupIdInFirebase, matchesSearchText } from '../lib/searchUtils';

export type CreatorSortOption = 'FEATURED' | 'NEWEST' | 'MOST_CONTRIBUTING';

export default function Creators() {
  const navigate = useNavigate();
  const [creators, setCreators] = useState<CreatorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState<CreatorSortOption>('FEATURED');

  useSeo({
    title: 'Danh Sách Creator',
    description: 'Nơi tôn vinh các tác giả, người sáng tạo nhân vật Roleplay và Prompt xuất sắc nhất trên Google AI Studio cộng đồng.'
  });

  const fetchCreators = async () => {
    setLoading(true);
    try {
      // Query users who have creatorStatus = true OR role = 'CREATOR' / 'ADMIN'
      const q = query(
        collection(db, 'users'),
        where('creatorStatus', '==', true)
      );
      const snap = await getDocs(q);
      const list: CreatorItem[] = [];

      snap.docs.forEach(docSnap => {
        const data = docSnap.data();
        list.push({ id: docSnap.id, ...data } as CreatorItem);
      });

      setCreators(list);
    } catch (err) {
      console.error("Lỗi khi tải danh sách Creator:", err);
      toast.error("Không thể tải danh sách Creator.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCreators();
  }, []);

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const queryStr = searchTerm.trim();
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
          const lookup = await lookupIdInFirebase(idParse.numericId, idParse.typeHint || 'creator');
          if (lookup && lookup.found && lookup.path) {
            toast.success("Đã tìm thấy đối tượng chính xác theo ID!");
            navigate(lookup.path);
            return;
          } else {
            const errorMsg = lookup?.error || "Mã ID không tồn tại trên hệ thống.";
            toast.error(errorMsg);
            navigate(`/ai-search?q=${encodeURIComponent(queryStr)}`);
            return;
          }
        } catch (err) {
          console.error("Exact lookup error in Creators page:", err);
          navigate(`/ai-search?q=${encodeURIComponent(queryStr)}`);
          return;
        }
      }
    }
  };

  // Filter & Sort Logic
  const filteredCreators = creators
    .filter(c => {
      const term = searchTerm.trim();
      const matchesSearch = 
        !term ||
        matchesSearchText(c.displayName, term) ||
        matchesSearchText(c.bio, term) ||
        matchesSearchText(c.numericId, term) ||
        matchesSearchText(c.id, term);
      return matchesSearch;
    })
    .sort((a, b) => {
      if (sortOption === 'FEATURED') {
        // Score based on followers and characters
        const scoreA = (a.followerCount || 0) * 3 + (a.characterCount || 0) * 2 + (a.promptCount || 0);
        const scoreB = (b.followerCount || 0) * 3 + (b.characterCount || 0) * 2 + (b.promptCount || 0);
        return scoreB - scoreA;
      }

      if (sortOption === 'NEWEST') {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
      }

      if (sortOption === 'MOST_CONTRIBUTING') {
        // Primary sort: characterCount, secondary: promptCount
        if ((b.characterCount || 0) !== (a.characterCount || 0)) {
          return (b.characterCount || 0) - (a.characterCount || 0);
        }
        return (b.promptCount || 0) - (a.promptCount || 0);
      }

      return 0;
    });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-neutral-900 via-neutral-800 to-black text-white p-8 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-neutral-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Cộng Đồng Creator</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Danh Sách Creator
          </h1>
          <p className="text-neutral-400 text-sm leading-relaxed">
            Nơi tôn vinh các tác giả, người sáng tạo nhân vật Roleplay và Prompt xuất sắc nhất trên Google AI Studio. Theo dõi để không bỏ lỡ các nội dung sáng tạo mới nhất!
          </p>
        </div>
      </div>

      {/* Main Sort Tabs (Nổi bật - Mới - Đóng góp nhiều nhất) */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-4">
        <div className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-900 p-1.5 rounded-2xl border border-neutral-200/80 dark:border-neutral-800">
          <button
            onClick={() => setSortOption('FEATURED')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              sortOption === 'FEATURED'
                ? 'bg-white dark:bg-neutral-800 text-amber-600 dark:text-amber-400 shadow-sm'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white'
            }`}
          >
            <Flame className="w-4 h-4 fill-current" />
            <span>Creator Nổi Bật</span>
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
            <span>Creator Mới</span>
          </button>

          <button
            onClick={() => setSortOption('MOST_CONTRIBUTING')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              sortOption === 'MOST_CONTRIBUTING'
                ? 'bg-white dark:bg-neutral-800 text-emerald-600 dark:text-emerald-400 shadow-sm'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Đóng Góp Nhiều Nhất</span>
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs text-neutral-500 font-medium">
          <span>Tổng số Creator: <strong className="text-black dark:text-white font-bold">{filteredCreators.length}</strong></span>
          <button
            onClick={fetchCreators}
            className="p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:text-black dark:hover:text-white border border-neutral-200 dark:border-neutral-700"
            title="Làm mới danh sách"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 shadow-sm flex items-center gap-4">
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Tìm kiếm Creator theo tên, bio, ID (creator/123456789)..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs md:text-sm rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-transparent focus:border-black dark:focus:border-white focus:outline-none"
          />
        </form>
      </div>

      {/* Creators Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-60 bg-neutral-100 dark:bg-neutral-800 rounded-2xl animate-pulse"></div>
          ))}
        </div>
      ) : filteredCreators.length === 0 ? (
        <div className="py-20 text-center bg-white dark:bg-neutral-900 rounded-3xl border border-dashed border-neutral-200 dark:border-neutral-800 p-8 space-y-3">
          <Sparkles className="w-12 h-12 text-neutral-400 mx-auto opacity-40" />
          <h3 className="font-bold text-lg">Chưa có Creator nào</h3>
          <p className="text-neutral-500 text-xs max-w-sm mx-auto">
            Không tìm thấy Creator phù hợp với từ khóa đã chọn. Hãy gửi yêu cầu trở thành Creator trong trang Hồ sơ cá nhân!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCreators.map(creator => (
            <CreatorCard 
              key={creator.id} 
              creator={creator} 
              onUpdate={fetchCreators} 
            />
          ))}
        </div>
      )}
    </div>
  );
}
