import React, { useState, useEffect } from 'react';
import AdminLayout from './admin/AdminLayout';
import { 
  Sparkles, FileText, MessageSquare, Trash2, Eye, EyeOff, Search, User, ExternalLink
} from 'lucide-react';
import { 
  collection, query, getDocs, doc, updateDoc,
  orderBy, addDoc, where, getDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getValidAvatar } from '../lib/avatar';
import { useAuthStore } from '../store/useAuthStore';
import { generateUniqueId } from '../lib/generateId';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import UserProfileModal from '../components/admin/UserProfileModal';
import DisplayId from '../components/DisplayId';
import toast from 'react-hot-toast';

interface ContentActionState {
  type: 'HIDE' | 'DELETE' | 'RESTORE';
  id: string;
  collectionName: string;
  name?: string;
  ownerId?: string;
}

export default function AdminDashboard() {
  const { user: currentUser } = useAuthStore();
  
  const [activeTab, setActiveTab] = useState<'characters' | 'prompts' | 'feedbacks'>('characters');
  
  const [characters, setCharacters] = useState<any[]>([]);
  const [prompts, setPrompts] = useState<any[]>([]);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  
  const [ownerUsers, setOwnerUsers] = useState<Record<string, any>>({});
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [actionItem, setActionItem] = useState<ContentActionState | null>(null);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchOwnerUsers = async (ownerIds: string[]) => {
    const uniqueIds = Array.from(new Set(ownerIds.filter(Boolean)));
    const missingIds = uniqueIds.filter(id => !ownerUsers[id]);
    if (missingIds.length === 0) return;

    const newMap: Record<string, any> = {};
    await Promise.all(missingIds.map(async (uid) => {
      try {
        const uSnap = await getDoc(doc(db, 'users', uid));
        if (uSnap.exists()) {
          newMap[uid] = { id: uSnap.id, ...uSnap.data() };
        }
      } catch (err) {
        console.warn(`Could not fetch user ${uid}:`, err);
      }
    }));

    if (Object.keys(newMap).length > 0) {
      setOwnerUsers(prev => ({ ...prev, ...newMap }));
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'characters') {
        const q = query(collection(db, 'characters'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        const list = await Promise.all(snap.docs.map(async (d) => {
          const data = d.data();
          let numericId = data.numericId;
          if (!numericId) {
            numericId = await generateUniqueId(db, 'character', d.id);
            try {
              await updateDoc(doc(db, 'characters', d.id), { numericId });
            } catch (e) {
              console.warn("Failed to backfill character numericId:", e);
            }
          }
          return { id: d.id, ...data, numericId };
        }));
        setCharacters(list);

        const ownerIds = list.map((c: any) => c.creatorId || c.userId || c.authorId);
        await fetchOwnerUsers(ownerIds);

      } else if (activeTab === 'prompts') {
        const q = query(collection(db, 'prompts'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        const list = await Promise.all(snap.docs.map(async (d) => {
          const data = d.data();
          let numericId = data.numericId;
          if (!numericId) {
            numericId = await generateUniqueId(db, 'prompt', d.id);
            try {
              await updateDoc(doc(db, 'prompts', d.id), { numericId });
            } catch (e) {
              console.warn("Failed to backfill prompt numericId:", e);
            }
          }
          return { id: d.id, ...data, numericId };
        }));
        setPrompts(list);

        const ownerIds = list.map((p: any) => p.authorId || p.userId || p.creatorId);
        await fetchOwnerUsers(ownerIds);

      } else if (activeTab === 'feedbacks') {
        const q = query(collection(db, 'feedbacks'), where('mode', '==', 'PUBLIC'));
        const snap = await getDocs(q);
        const list = await Promise.all(snap.docs.map(async (d) => {
          const data = d.data();
          let numericId = data.numericId;
          if (!numericId) {
            numericId = await generateUniqueId(db, 'feedback', d.id);
            try {
              await updateDoc(doc(db, 'feedbacks', d.id), { numericId });
            } catch (e) {
              console.warn("Failed to backfill feedback numericId:", e);
            }
          }
          return { id: d.id, ...data, numericId };
        }));
        
        list.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        setFeedbacks(list);

        const ownerIds = list.map((f: any) => f.senderId || f.userId);
        await fetchOwnerUsers(ownerIds);
      }
    } catch (err) {
      console.error("Fetch error:", err);
      toast.error("Không thể tải danh sách nội dung.");
    } finally {
      setLoading(false);
    }
  };

  const logAction = async (action: string, targetId: string, details: string) => {
    try {
      if (!currentUser) return;
      await addDoc(collection(db, 'audit_logs'), {
        executorId: currentUser.id,
        executorName: currentUser.displayName,
        executorRole: currentUser.role,
        action,
        targetId,
        targetType: 'CONTENT',
        details,
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Error logging action:", err);
    }
  };

  const handleOpenAction = (
    type: 'HIDE' | 'DELETE' | 'RESTORE',
    id: string,
    collectionName: string,
    name?: string,
    ownerId?: string
  ) => {
    setActionItem({ type, id, collectionName, name, ownerId });
  };

  const executeActionWithReason = async (reason: string, details: string) => {
    if (!actionItem) return;
    const { type, id, collectionName } = actionItem;

    try {
      const now = new Date().toISOString();
      const targetRef = doc(db, collectionName, id);

      let ownerId = actionItem.ownerId;
      let targetName = actionItem.name || 'Nội dung';

      if (!ownerId || !targetName) {
        const snap = await getDoc(targetRef);
        if (snap.exists()) {
          const d = snap.data();
          ownerId = ownerId || d.creatorId || d.userId || d.senderId || d.authorId;
          targetName = targetName || d.name || d.title || d.message || 'Nội dung';
        }
      }

      const typeMapping: Record<string, string> = {
        characters: 'CHARACTER',
        prompts: 'PROMPT',
        feedbacks: 'FEEDBACK',
        comments: 'COMMENT'
      };
      const targetType = typeMapping[collectionName] || 'CONTENT';

      if (type === 'DELETE' || type === 'HIDE') {
        const actionLabel = type === 'DELETE' ? 'gỡ bỏ' : 'tạm ẩn';

        await updateDoc(targetRef, {
          isHidden: true,
          deletedAt: now,
          deletedBy: currentUser?.id || 'admin',
          removalReason: reason,
          removalDetails: details || reason,
          removalTime: now,
          appealStatus: 'NONE'
        });

        if (ownerId && ownerId !== currentUser?.id) {
          await addDoc(collection(db, 'notifications'), {
            userId: ownerId,
            recipientId: ownerId,
            type: 'CONTENT_REMOVED',
            title: `Nội dung "${targetName}" đã bị ${actionLabel}`,
            message: `Nội dung "${targetName}" của bạn đã bị ${actionLabel} bởi Quản trị viên. Lý do: ${reason}. Nhấp vào để xem chi tiết và gửi kháng nghị.`,
            targetType,
            targetId: id,
            targetName,
            removalReason: reason,
            removalDetails: details || reason,
            removalTime: now,
            read: false,
            createdAt: now
          });
        }

        await logAction(
          type === 'DELETE' ? 'DELETE_CONTENT' : 'HIDE_CONTENT',
          id,
          `Đã ${actionLabel} nội dung "${targetName}" trong ${collectionName}. Lý do: ${reason}`
        );

        toast.success(`Đã ${actionLabel} nội dung thành công.`);

      } else if (type === 'RESTORE') {
        await updateDoc(targetRef, {
          isHidden: false,
          deletedAt: null,
          appealStatus: 'APPROVED'
        });

        if (ownerId && ownerId !== currentUser?.id) {
          await addDoc(collection(db, 'notifications'), {
            userId: ownerId,
            recipientId: ownerId,
            type: 'SYSTEM',
            title: `Nội dung "${targetName}" đã được khôi phục`,
            message: `Nội dung "${targetName}" của bạn đã được Quản trị viên khôi phục hiển thị trên cộng đồng.`,
            targetType,
            targetId: id,
            targetName,
            read: false,
            createdAt: now
          });
        }

        await logAction('RESTORE_CONTENT', id, `Đã khôi phục hiển thị nội dung "${targetName}" trong ${collectionName}`);
        toast.success("Đã khôi phục hiển thị nội dung thành công.");
      }

      setActionItem(null);
      fetchData();
    } catch (err) {
      console.error("Content action error:", err);
      toast.error("Thao tác thất bại.");
    }
  };

  const filteredCharacters = characters.filter(c => {
    const owner = ownerUsers[c.creatorId || c.userId || c.authorId];
    return !c.deletedAt && (
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.creatorName?.toLowerCase().includes(search.toLowerCase()) ||
      owner?.displayName?.toLowerCase().includes(search.toLowerCase()) ||
      c.numericId?.includes(search)
    );
  });

  const filteredPrompts = prompts.filter(p => {
    const owner = ownerUsers[p.authorId || p.userId || p.creatorId];
    return !p.deletedAt && (
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.authorName?.toLowerCase().includes(search.toLowerCase()) ||
      owner?.displayName?.toLowerCase().includes(search.toLowerCase()) ||
      p.numericId?.includes(search)
    );
  });

  const filteredFeedbacks = feedbacks.filter(f => {
    const owner = ownerUsers[f.senderId || f.userId];
    return !f.deletedAt && (
      f.message?.toLowerCase().includes(search.toLowerCase()) ||
      f.senderName?.toLowerCase().includes(search.toLowerCase()) ||
      owner?.displayName?.toLowerCase().includes(search.toLowerCase()) ||
      f.numericId?.includes(search)
    );
  });

  const renderOwnerCell = (ownerId: string, fallbackName: string, fallbackAvatar?: string) => {
    const owner = ownerUsers[ownerId];
    const displayName = owner?.displayName || fallbackName || 'Thành viên';
    const avatar = getValidAvatar(owner?.avatar || fallbackAvatar);
    const numericId = owner?.numericId;

    return (
      <div className="flex items-center gap-3 group">
        <img 
          src={avatar} 
          alt={displayName} 
          className="w-10 h-10 rounded-2xl object-cover shrink-0 border border-neutral-200 dark:border-neutral-800 shadow-xs"
        />
        <div className="min-w-0 space-y-0.5">
          <div className="font-bold text-xs text-neutral-900 dark:text-neutral-100 truncate">
            {displayName}
          </div>
          {numericId && (
            <div className="text-[10px] text-neutral-400 font-mono">
              ID: user/{numericId}
            </div>
          )}
          {ownerId && (
            <button
              onClick={() => setSelectedUserId(ownerId)}
              className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer pt-0.5"
            >
              <User className="w-3 h-3" />
              <span>Xem Profile</span>
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-black tracking-tight uppercase">Quản Lý Nội Dung</h1>
            <p className="text-sm text-neutral-500 font-medium">Kiểm duyệt, tạm ẩn hoặc gỡ bỏ các nội dung vi phạm.</p>
          </div>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input 
              type="text"
              placeholder="Tìm kiếm nội dung, tác giả, ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full md:w-80 pl-11 pr-4 py-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all shadow-xs"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-neutral-800 pb-px overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('characters')}
            className={`flex items-center gap-2 px-6 py-4 text-xs font-black uppercase tracking-widest transition-colors whitespace-nowrap border-b-2 cursor-pointer ${
              activeTab === 'characters' 
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' 
                : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-700'
            }`}
          >
            <Sparkles className="w-4 h-4" /> Characters
          </button>
          <button
            onClick={() => setActiveTab('prompts')}
            className={`flex items-center gap-2 px-6 py-4 text-xs font-black uppercase tracking-widest transition-colors whitespace-nowrap border-b-2 cursor-pointer ${
              activeTab === 'prompts' 
                ? 'border-purple-500 text-purple-600 dark:text-purple-400' 
                : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-700'
            }`}
          >
            <FileText className="w-4 h-4" /> Prompts
          </button>
          <button
            onClick={() => setActiveTab('feedbacks')}
            className={`flex items-center gap-2 px-6 py-4 text-xs font-black uppercase tracking-widest transition-colors whitespace-nowrap border-b-2 cursor-pointer ${
              activeTab === 'feedbacks' 
                ? 'border-blue-500 text-blue-600 dark:text-blue-400' 
                : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-700'
            }`}
          >
            <MessageSquare className="w-4 h-4" /> Feedbacks
          </button>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/20">
                  <th className="p-6 text-xs font-black uppercase tracking-widest text-neutral-400">
                    {activeTab === 'characters' ? 'Character' : activeTab === 'prompts' ? 'Tên Prompt' : 'Nội dung Feedback'}
                  </th>
                  <th className="p-6 text-xs font-black uppercase tracking-widest text-neutral-400">
                    Chủ sở hữu / Tác giả
                  </th>
                  <th className="p-6 text-xs font-black uppercase tracking-widest text-neutral-400">Trạng thái</th>
                  <th className="p-6 text-xs font-black uppercase tracking-widest text-neutral-400 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-neutral-500 font-medium animate-pulse">
                      Đang tải danh sách nội dung...
                    </td>
                  </tr>
                ) : (
                  <>
                    {/* CHARACTERS TAB */}
                    {activeTab === 'characters' && filteredCharacters.length === 0 && (
                      <tr><td colSpan={4} className="p-8 text-center text-neutral-500">Không tìm thấy Character.</td></tr>
                    )}
                    {activeTab === 'characters' && filteredCharacters.map(c => {
                      const ownerId = c.creatorId || c.userId || c.authorId;
                      return (
                        <tr key={c.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                          <td className="p-6">
                            <div className="font-bold text-sm text-neutral-900 dark:text-neutral-100 truncate max-w-xs">{c.name}</div>
                            <div className="mt-1">
                              <DisplayId type="character" numericId={c.numericId} />
                            </div>
                          </td>
                          <td className="p-6">
                            {renderOwnerCell(ownerId, c.creatorName, c.avatar)}
                          </td>
                          <td className="p-6">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${c.isHidden ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'}`}>
                              {c.isHidden ? 'Đã Ẩn' : 'Hiển thị'}
                            </span>
                          </td>
                          <td className="p-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {c.isHidden ? (
                                <button 
                                  onClick={() => handleOpenAction('RESTORE', c.id, 'characters', c.name, ownerId)}
                                  className="p-2 hover:bg-emerald-500/10 rounded-xl transition-colors text-emerald-600 dark:text-emerald-400 cursor-pointer"
                                  title="Khôi phục / Hiển thị"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              ) : (
                                <button 
                                  onClick={() => handleOpenAction('HIDE', c.id, 'characters', c.name, ownerId)}
                                  className="p-2 hover:bg-amber-500/10 rounded-xl transition-colors text-amber-600 dark:text-amber-400 cursor-pointer"
                                  title="Tạm ẩn"
                                >
                                  <EyeOff className="w-4 h-4" />
                                </button>
                              )}
                              <button 
                                onClick={() => handleOpenAction('DELETE', c.id, 'characters', c.name, ownerId)}
                                className="p-2 hover:bg-red-500/10 rounded-xl transition-colors text-red-500 cursor-pointer"
                                title="Gỡ bỏ / Xóa"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {/* PROMPTS TAB */}
                    {activeTab === 'prompts' && filteredPrompts.length === 0 && (
                      <tr><td colSpan={4} className="p-8 text-center text-neutral-500">Không tìm thấy Prompt.</td></tr>
                    )}
                    {activeTab === 'prompts' && filteredPrompts.map(p => {
                      const ownerId = p.authorId || p.userId || p.creatorId;
                      return (
                        <tr key={p.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                          <td className="p-6">
                            <div className="font-bold text-sm text-neutral-900 dark:text-neutral-100 truncate max-w-xs">{p.name}</div>
                            <div className="mt-1">
                              <DisplayId type="prompt" numericId={p.numericId} />
                            </div>
                          </td>
                          <td className="p-6">
                            {renderOwnerCell(ownerId, p.authorName)}
                          </td>
                          <td className="p-6">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${p.isHidden ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'}`}>
                              {p.isHidden ? 'Đã Ẩn' : 'Hiển thị'}
                            </span>
                          </td>
                          <td className="p-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {p.isHidden ? (
                                <button 
                                  onClick={() => handleOpenAction('RESTORE', p.id, 'prompts', p.name, ownerId)}
                                  className="p-2 hover:bg-emerald-500/10 rounded-xl transition-colors text-emerald-600 dark:text-emerald-400 cursor-pointer"
                                  title="Khôi phục / Hiển thị"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              ) : (
                                <button 
                                  onClick={() => handleOpenAction('HIDE', p.id, 'prompts', p.name, ownerId)}
                                  className="p-2 hover:bg-amber-500/10 rounded-xl transition-colors text-amber-600 dark:text-amber-400 cursor-pointer"
                                  title="Tạm ẩn"
                                >
                                  <EyeOff className="w-4 h-4" />
                                </button>
                              )}
                              <button 
                                onClick={() => handleOpenAction('DELETE', p.id, 'prompts', p.name, ownerId)}
                                className="p-2 hover:bg-red-500/10 rounded-xl transition-colors text-red-500 cursor-pointer"
                                title="Gỡ bỏ / Xóa"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {/* FEEDBACKS TAB */}
                    {activeTab === 'feedbacks' && filteredFeedbacks.length === 0 && (
                      <tr><td colSpan={4} className="p-8 text-center text-neutral-500">Không tìm thấy Feedback.</td></tr>
                    )}
                    {activeTab === 'feedbacks' && filteredFeedbacks.map(f => {
                      const ownerId = f.senderId || f.userId;
                      const displayTitle = f.title || f.message?.slice(0, 40) || 'Bài viết Feedback';
                      return (
                        <tr key={f.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                          <td className="p-6">
                            <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100 line-clamp-2 max-w-xs">{f.message}</div>
                            <div className="mt-1">
                              <DisplayId type="feedback" numericId={f.numericId} />
                            </div>
                          </td>
                          <td className="p-6">
                            {renderOwnerCell(ownerId, f.senderName, f.senderAvatar)}
                          </td>
                          <td className="p-6">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${f.isHidden ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'}`}>
                              {f.isHidden ? 'Đã Ẩn' : 'Hiển thị'}
                            </span>
                          </td>
                          <td className="p-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {f.isHidden ? (
                                <button 
                                  onClick={() => handleOpenAction('RESTORE', f.id, 'feedbacks', displayTitle, ownerId)}
                                  className="p-2 hover:bg-emerald-500/10 rounded-xl transition-colors text-emerald-600 dark:text-emerald-400 cursor-pointer"
                                  title="Khôi phục / Hiển thị"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              ) : (
                                <button 
                                  onClick={() => handleOpenAction('HIDE', f.id, 'feedbacks', displayTitle, ownerId)}
                                  className="p-2 hover:bg-amber-500/10 rounded-xl transition-colors text-amber-600 dark:text-amber-400 cursor-pointer"
                                  title="Tạm ẩn"
                                >
                                  <EyeOff className="w-4 h-4" />
                                </button>
                              )}
                              <button 
                                onClick={() => handleOpenAction('DELETE', f.id, 'feedbacks', displayTitle, ownerId)}
                                className="p-2 hover:bg-red-500/10 rounded-xl transition-colors text-red-500 cursor-pointer"
                                title="Gỡ bỏ / Xóa"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Confirmation & Reason Modal */}
      <DeleteConfirmModal
        isOpen={actionItem !== null}
        onClose={() => setActionItem(null)}
        onConfirmWithReason={executeActionWithReason}
        requireReason={actionItem?.type !== 'RESTORE'}
        targetName={actionItem?.name}
        title={
          actionItem?.type === 'DELETE'
            ? "Gỡ bỏ nội dung vi phạm"
            : actionItem?.type === 'HIDE'
            ? "Tạm ẩn nội dung vi phạm"
            : "Khôi phục / Hiển thị nội dung"
        }
        description={
          actionItem?.type === 'RESTORE'
            ? "Nội dung sẽ được khôi phục hiển thị trở lại công khai trên toàn hệ thống."
            : "Nội dung sẽ bị gỡ/ẩn khỏi cộng đồng. Tác giả sẽ nhận được thông báo kèm lý do cụ thể và nút gửi kháng nghị."
        }
        confirmText={
          actionItem?.type === 'DELETE'
            ? "Xác nhận gỡ bỏ"
            : actionItem?.type === 'HIDE'
            ? "Xác nhận tạm ẩn"
            : "Xác nhận khôi phục"
        }
        cancelText="Hủy bỏ"
      />

      {/* User Profile View Modal */}
      <UserProfileModal
        isOpen={selectedUserId !== null}
        userId={selectedUserId}
        onClose={() => setSelectedUserId(null)}
      />
    </AdminLayout>
  );
}
