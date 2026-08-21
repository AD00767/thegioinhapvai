import React, { useState, useEffect } from 'react';
import { 
  PenTool, Search, Plus, Sparkles, Filter, RefreshCw
} from 'lucide-react';
import { collection, query, getDocs, orderBy, where, doc, deleteDoc, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { useSeo } from '../hooks/useSeo';
import { PromptItem } from '../types';
import PromptCard from '../components/PromptCard';
import CreatePromptModal from '../components/profile/CreatePromptModal';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import toast from 'react-hot-toast';

import { useNavigate, useSearchParams } from 'react-router-dom';
import { parseIdQuery, lookupIdInFirebase, matchesSearchText, matchesItemFields } from '../lib/searchUtils';

export default function Prompts() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();

  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || searchParams.get('search') || '');
  const [selectedTag, setSelectedTag] = useState<string | null>(searchParams.get('tag') || null);
  const [sortBy, setSortBy] = useState<'NEWEST' | 'COPY_COUNT' | 'SAVES_COUNT'>('NEWEST');

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [promptToEdit, setPromptToEdit] = useState<PromptItem | null>(null);
  const [promptToDelete, setPromptToDelete] = useState<string | null>(null);

  useSeo({
    title: 'Thư Viện Prompt',
    description: 'Hàng trăm System Instructions, Prompt Roleplay và World Building được tối ưu sẵn cho Google AI Studio từ cộng đồng.'
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

  const fetchPrompts = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'prompts'), orderBy('createdAt', 'desc'), limit(60));
      const snap = await getDocs(q);
      const list: PromptItem[] = [];

      snap.docs.forEach(docSnap => {
        const data = docSnap.data();
        if (!data.deletedAt && !data.isHidden) {
          list.push({ id: docSnap.id, ...data } as PromptItem);
        }
      });

      setPrompts(list);
    } catch (err) {
      console.error("Lỗi khi tải danh sách Prompt:", err);
      toast.error("Không thể tải danh sách Prompt.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrompts();
  }, []);

  // Collect all unique tags
  const allTags = Array.from(
    new Set(prompts.flatMap(p => p.tags || []))
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
          const lookup = await lookupIdInFirebase(idParse.numericId, idParse.typeHint || 'prompt');
          if (lookup && lookup.found && lookup.path) {
            toast.success("Đã tìm thấy đối tượng chính xác theo ID!");
            navigate(lookup.path);
            return;
          } else {
            toast.error(lookup?.error || "Mã ID không tồn tại trên hệ thống.");
            return;
          }
        } catch (err) {
          console.error("Exact lookup error in Prompts page:", err);
          return;
        }
      }
    }
  };

  // Filter & Sort
  const filteredPrompts = prompts.filter(p => {
    const term = searchTerm.trim();
    const matchesSearch = !term || matchesItemFields(
      [p.name, p.title, p.purpose, p.content, p.authorName, p.tags, p.numericId, p.id],
      term
    );

    const matchesTag = selectedTag ? p.tags?.some(t => matchesSearchText(t, selectedTag)) : true;

    return matchesSearch && matchesTag;
  }).sort((a, b) => {
    if (sortBy === 'COPY_COUNT') return (b.copyCount || 0) - (a.copyCount || 0);
    if (sortBy === 'SAVES_COUNT') return (b.savesCount || 0) - (a.savesCount || 0);
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Header & Hero Section */}
      <div className="bg-gradient-to-r from-neutral-900 via-neutral-800 to-black text-white p-8 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-neutral-800">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-full text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Thư Viện Prompt Google AI Studio</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Khám Phá & Chia Sẻ Prompt
          </h1>
          <p className="text-neutral-400 text-sm leading-relaxed">
            Hàng trăm System Instructions, Prompt Roleplay, World Building và Jailbreak được tối ưu sẵn từ cộng đồng. Sao chép nhanh chỉ với 1-click!
          </p>
        </div>

        {/* Nút tạo bài viết (Tạo Prompt) */}
        <div>
          {user ? (
            <button
              onClick={() => {
                setPromptToEdit(null);
                setIsCreateModalOpen(true);
              }}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white text-black font-extrabold text-sm hover:bg-neutral-200 transition-transform active:scale-95 shadow-lg shrink-0"
            >
              <Plus className="w-5 h-5" />
              <span>Đăng Prompt Mới</span>
            </button>
          ) : (
            <button
              onClick={() => toast.error("Vui lòng đăng nhập bằng Google để đăng Prompt!")}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-neutral-800 border border-neutral-700 text-white text-sm font-bold opacity-80"
            >
              <Plus className="w-5 h-5" />
              <span>Đăng nhập để tạo Prompt</span>
            </button>
          )}
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Tìm theo tên Prompt, mục đích, ID (prompt/123456789)..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs md:text-sm rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-transparent focus:border-black dark:focus:border-white focus:outline-none"
          />
        </form>

        {/* Sort selector */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-neutral-400 font-medium hidden sm:inline">Sắp xếp:</span>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="px-3 py-2 text-xs font-semibold rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none"
          >
            <option value="NEWEST">Mới nhất</option>
            <option value="COPY_COUNT">Nhiều sao chép nhất</option>
            <option value="SAVES_COUNT">Nhiều lượt lưu nhất</option>
          </select>

          <button
            onClick={fetchPrompts}
            title="Làm mới"
            className="p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:text-black dark:hover:text-white"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tags Quick Filter */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Tags:
          </span>
          <button
            onClick={() => setSelectedTag(null)}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${
              selectedTag === null
                ? 'bg-black dark:bg-white text-white dark:text-black'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white'
            }`}
          >
            Tất cả ({prompts.length})
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

      {/* Prompts Grid Display */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-48 bg-neutral-100 dark:bg-neutral-800 rounded-2xl animate-pulse"></div>
          ))}
        </div>
      ) : filteredPrompts.length === 0 ? (
        <div className="py-20 text-center bg-white dark:bg-neutral-900 rounded-3xl border border-dashed border-neutral-200 dark:border-neutral-800 p-8 space-y-3">
          <PenTool className="w-12 h-12 text-neutral-400 mx-auto opacity-40" />
          <h3 className="font-bold text-lg">Chưa tìm thấy Prompt phù hợp</h3>
          <p className="text-neutral-500 text-xs max-w-sm mx-auto">
            Thử thay đổi từ khóa tìm kiếm hoặc bấm nút bên dưới để tạo Prompt mới đầu tiên.
          </p>
          {user && (
            <button
              onClick={() => {
                setPromptToEdit(null);
                setIsCreateModalOpen(true);
              }}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-black dark:bg-white text-white dark:text-black font-bold text-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Đăng Prompt Ngay</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredPrompts.map(p => (
            <PromptCard
              key={p.id}
              prompt={p}
              isOwner={user?.id === p.authorId || user?.role === 'ADMIN'}
              onEdit={(item) => {
                setPromptToEdit(item);
                setIsCreateModalOpen(true);
              }}
              onDelete={(id) => setPromptToDelete(id)}
            />
          ))}
        </div>
      )}

      {/* Create / Edit Prompt Modal */}
      <CreatePromptModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={fetchPrompts}
        promptToEdit={promptToEdit}
      />

      {/* Delete Prompt Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={promptToDelete !== null}
        onClose={() => setPromptToDelete(null)}
        onConfirm={async () => {
          if (!promptToDelete) return;
          try {
            await deleteDoc(doc(db, 'prompts', promptToDelete));
            toast.success("Đã xóa hoàn toàn Prompt khỏi hệ thống.");
            fetchPrompts();
          } catch (e) {
            toast.error("Không thể xóa Prompt.");
          }
        }}
      />
    </div>
  );
}
