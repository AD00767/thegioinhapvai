import React, { useState, useEffect } from 'react';
import AdminLayout from './admin/AdminLayout';
import { 
  Sparkles, FileText, MessageSquare, Trash2, Eye, EyeOff, Search
} from 'lucide-react';
import { 
  collection, query, getDocs, doc, updateDoc, deleteDoc,
  orderBy, addDoc, where
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/useAuthStore';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import toast from 'react-hot-toast';

export default function AdminDashboard() {
  const { user: currentUser } = useAuthStore();
  
  const [activeTab, setActiveTab] = useState<'characters' | 'prompts' | 'feedbacks'>('characters');
  
  const [characters, setCharacters] = useState<any[]>([]);
  const [prompts, setPrompts] = useState<any[]>([]);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [itemToDelete, setItemToDelete] = useState<{ id: string; collectionName: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'characters') {
        const q = query(collection(db, 'characters'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        setCharacters(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else if (activeTab === 'prompts') {
        const q = query(collection(db, 'prompts'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        setPrompts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else if (activeTab === 'feedbacks') {
        const q = query(collection(db, 'feedbacks'), where('mode', '==', 'PUBLIC'));
        const snap = await getDocs(q);
        const fbList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        fbList.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        setFeedbacks(fbList);
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

  const handleToggleHide = async (id: string, currentStatus: boolean, collectionName: string) => {
    try {
      await updateDoc(doc(db, collectionName, id), {
        isHidden: !currentStatus
      });
      await logAction('TOGGLE_VISIBILITY', id, `${currentStatus ? 'Hiển thị' : 'Ẩn'} nội dung trong ${collectionName}`);
      toast.success(`Đã ${currentStatus ? 'hiển thị' : 'ẩn'} nội dung.`);
      fetchData();
    } catch (err) {
      toast.error("Thao tác thất bại.");
    }
  };

  const handleDelete = (id: string, collectionName: string) => {
    setItemToDelete({ id, collectionName });
  };

  const executeDelete = async () => {
    if (!itemToDelete) return;
    try {
      await deleteDoc(doc(db, itemToDelete.collectionName, itemToDelete.id));
      await logAction('DELETE_CONTENT', itemToDelete.id, `Xóa vĩnh viễn nội dung trong ${itemToDelete.collectionName}`);
      toast.success("Đã xóa hoàn toàn nội dung khỏi hệ thống.");
      setItemToDelete(null);
      fetchData();
    } catch (err) {
      console.error("Delete content error:", err);
      toast.error("Thao tác xóa thất bại.");
    }
  };

  const filteredCharacters = characters.filter(c => 
    !c.deletedAt && (c.name?.toLowerCase().includes(search.toLowerCase()) || c.creatorName?.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredPrompts = prompts.filter(p => 
    !p.deletedAt && (p.name?.toLowerCase().includes(search.toLowerCase()) || p.authorName?.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredFeedbacks = feedbacks.filter(f => 
    !f.deletedAt && (f.message?.toLowerCase().includes(search.toLowerCase()) || f.senderName?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <AdminLayout>
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-black tracking-tight uppercase">Quản Lý Nội Dung</h1>
            <p className="text-sm text-neutral-500 font-medium">Kiểm duyệt, ẩn hoặc xóa các nội dung vi phạm.</p>
          </div>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input 
              type="text"
              placeholder="Tìm kiếm nội dung..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full md:w-80 pl-11 pr-4 py-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all shadow-sm"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-neutral-800 pb-px overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('characters')}
            className={`flex items-center gap-2 px-6 py-4 text-xs font-black uppercase tracking-widest transition-colors whitespace-nowrap border-b-2 ${
              activeTab === 'characters' 
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' 
                : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-700'
            }`}
          >
            <Sparkles className="w-4 h-4" /> Characters
          </button>
          <button
            onClick={() => setActiveTab('prompts')}
            className={`flex items-center gap-2 px-6 py-4 text-xs font-black uppercase tracking-widest transition-colors whitespace-nowrap border-b-2 ${
              activeTab === 'prompts' 
                ? 'border-purple-500 text-purple-600 dark:text-purple-400' 
                : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-700'
            }`}
          >
            <FileText className="w-4 h-4" /> Prompts
          </button>
          <button
            onClick={() => setActiveTab('feedbacks')}
            className={`flex items-center gap-2 px-6 py-4 text-xs font-black uppercase tracking-widest transition-colors whitespace-nowrap border-b-2 ${
              activeTab === 'feedbacks' 
                ? 'border-blue-500 text-blue-600 dark:text-blue-400' 
                : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-700'
            }`}
          >
            <MessageSquare className="w-4 h-4" /> Feedbacks
          </button>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/20">
                  <th className="p-6 text-xs font-black uppercase tracking-widest text-neutral-400">
                    {activeTab === 'characters' ? 'Character' : activeTab === 'prompts' ? 'Tên Prompt' : 'Nội dung'}
                  </th>
                  <th className="p-6 text-xs font-black uppercase tracking-widest text-neutral-400">
                    {activeTab === 'characters' ? 'Người tạo' : activeTab === 'prompts' ? 'Tác giả' : 'Người gửi'}
                  </th>
                  <th className="p-6 text-xs font-black uppercase tracking-widest text-neutral-400">Trạng thái</th>
                  <th className="p-6 text-xs font-black uppercase tracking-widest text-neutral-400 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-neutral-500 font-medium animate-pulse">
                      Đang tải danh sách...
                    </td>
                  </tr>
                ) : (
                  <>
                    {activeTab === 'characters' && filteredCharacters.length === 0 && (
                      <tr><td colSpan={4} className="p-8 text-center text-neutral-500">Không tìm thấy Character.</td></tr>
                    )}
                    {activeTab === 'characters' && filteredCharacters.map(c => (
                      <tr key={c.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                        <td className="p-6">
                          <div className="font-bold text-sm truncate max-w-xs">{c.name}</div>
                          <div className="text-[10px] text-neutral-500 font-mono mt-1">ID: {c.id}</div>
                        </td>
                        <td className="p-6">
                          <div className="text-sm font-medium">{c.creatorName}</div>
                        </td>
                        <td className="p-6">
                          <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${c.isHidden ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                            {c.isHidden ? 'Đã Ẩn' : 'Hiển thị'}
                          </span>
                        </td>
                        <td className="p-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => handleToggleHide(c.id, !!c.isHidden, 'characters')}
                              className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors text-neutral-500"
                              title={c.isHidden ? "Hiện" : "Ẩn"}
                            >
                              {c.isHidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                            </button>
                            <button 
                              onClick={() => handleDelete(c.id, 'characters')}
                              className="p-2 hover:bg-red-500/10 rounded-lg transition-colors text-red-500"
                              title="Xóa"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {activeTab === 'prompts' && filteredPrompts.length === 0 && (
                      <tr><td colSpan={4} className="p-8 text-center text-neutral-500">Không tìm thấy Prompt.</td></tr>
                    )}
                    {activeTab === 'prompts' && filteredPrompts.map(p => (
                      <tr key={p.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                        <td className="p-6">
                          <div className="font-bold text-sm truncate max-w-xs">{p.name}</div>
                          <div className="text-[10px] text-neutral-500 font-mono mt-1">ID: {p.id}</div>
                        </td>
                        <td className="p-6">
                          <div className="text-sm font-medium">{p.authorName}</div>
                        </td>
                        <td className="p-6">
                          <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${p.isHidden ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                            {p.isHidden ? 'Đã Ẩn' : 'Hiển thị'}
                          </span>
                        </td>
                        <td className="p-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => handleToggleHide(p.id, !!p.isHidden, 'prompts')}
                              className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors text-neutral-500"
                              title={p.isHidden ? "Hiện" : "Ẩn"}
                            >
                              {p.isHidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                            </button>
                            <button 
                              onClick={() => handleDelete(p.id, 'prompts')}
                              className="p-2 hover:bg-red-500/10 rounded-lg transition-colors text-red-500"
                              title="Xóa"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {activeTab === 'feedbacks' && filteredFeedbacks.length === 0 && (
                      <tr><td colSpan={4} className="p-8 text-center text-neutral-500">Không tìm thấy Feedback.</td></tr>
                    )}
                    {activeTab === 'feedbacks' && filteredFeedbacks.map(f => (
                      <tr key={f.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                        <td className="p-6">
                          <div className="text-sm line-clamp-2 max-w-xs">{f.message}</div>
                          <div className="text-[10px] text-neutral-500 font-mono mt-1">ID: {f.id}</div>
                        </td>
                        <td className="p-6">
                          <div className="text-sm font-medium">{f.senderName}</div>
                        </td>
                        <td className="p-6">
                          <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${f.isHidden ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                            {f.isHidden ? 'Đã Ẩn' : 'Hiển thị'}
                          </span>
                        </td>
                        <td className="p-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => handleToggleHide(f.id, !!f.isHidden, 'feedbacks')}
                              className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors text-neutral-500"
                              title={f.isHidden ? "Hiện" : "Ẩn"}
                            >
                              {f.isHidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                            </button>
                            <button 
                              onClick={() => handleDelete(f.id, 'feedbacks')}
                              className="p-2 hover:bg-red-500/10 rounded-lg transition-colors text-red-500"
                              title="Xóa"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <DeleteConfirmModal
        isOpen={itemToDelete !== null}
        onClose={() => setItemToDelete(null)}
        onConfirm={executeDelete}
        title="Xóa hoàn toàn nội dung?"
        description="Bạn có chắc chắn muốn xóa vĩnh viễn nội dung này khỏi hệ thống không? Hành động này không thể hoàn tác."
        confirmText="Xác nhận xóa"
        cancelText="Hủy bỏ"
      />
    </AdminLayout>
  );
}
