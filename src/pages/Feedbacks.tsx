import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, Plus, Search, Filter, Globe, Lock, Mail, Inbox, Send, RefreshCw, Sparkles 
} from 'lucide-react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { useSeo } from '../hooks/useSeo';
import CreateFeedbackModal from '../components/feedback/CreateFeedbackModal';
import PublicFeedbackCard, { FeedbackItem } from '../components/feedback/PublicFeedbackCard';
import PrivateFeedbackCard from '../components/feedback/PrivateFeedbackCard';
import toast from 'react-hot-toast';

type TabType = 'ALL_PUBLIC' | 'RECEIVED' | 'SENT' | 'PRIVATE';

export default function Feedbacks() {
  const { user } = useAuthStore();

  const [activeTab, setActiveTab] = useState<TabType>('ALL_PUBLIC');
  const [searchTerm, setSearchTerm] = useState('');
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);

  useSeo({
    title: 'Thế Giới Feedback',
    description: 'Nơi bạn có thể gửi góp ý công khai hoặc nhắn gửi thư riêng tư kín đáo tới Creator và các thành viên trong cộng đồng Google AI Studio.'
  });

  // Fetch Feedbacks
  const fetchFeedbacks = async () => {
    setLoading(true);
    try {
      let list: FeedbackItem[] = [];

      if (activeTab === 'ALL_PUBLIC') {
        const q = query(
          collection(db, 'feedbacks'),
          where('mode', '==', 'PUBLIC')
        );
        const snap = await getDocs(q);
        snap.docs.forEach(docSnap => {
          const d = docSnap.data();
          if (!d.deletedAt) {
            list.push({ id: docSnap.id, ...d } as FeedbackItem);
          }
        });
      } else if (user) {
        if (activeTab === 'RECEIVED') {
          const q = query(
            collection(db, 'feedbacks'),
            where('recipientId', '==', user.id)
          );
          const snap = await getDocs(q);
          snap.docs.forEach(docSnap => {
            const d = docSnap.data();
            if (!d.deletedAt) {
              list.push({ id: docSnap.id, ...d } as FeedbackItem);
            }
          });
        } else if (activeTab === 'SENT') {
          const q = query(
            collection(db, 'feedbacks'),
            where('senderId', '==', user.id)
          );
          const snap = await getDocs(q);
          snap.docs.forEach(docSnap => {
            const d = docSnap.data();
            if (!d.deletedAt) {
              list.push({ id: docSnap.id, ...d } as FeedbackItem);
            }
          });
        } else if (activeTab === 'PRIVATE') {
          const qSent = query(
            collection(db, 'feedbacks'),
            where('mode', '==', 'PRIVATE'),
            where('senderId', '==', user.id)
          );
          const qReceived = query(
            collection(db, 'feedbacks'),
            where('mode', '==', 'PRIVATE'),
            where('recipientId', '==', user.id)
          );

          const [snapSent, snapReceived] = await Promise.all([
            getDocs(qSent),
            getDocs(qReceived)
          ]);

          const seenIds = new Set<string>();
          const addDoc = (docSnap: any) => {
            if (seenIds.has(docSnap.id)) return;
            seenIds.add(docSnap.id);
            const d = docSnap.data();
            if (!d.deletedAt) {
              list.push({ id: docSnap.id, ...d } as FeedbackItem);
            }
          };

          snapSent.docs.forEach(addDoc);
          snapReceived.docs.forEach(addDoc);
        }
      }

      // Sort client-side by createdAt desc
      list.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (new Date(a.createdAt || 0).getTime());
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (new Date(b.createdAt || 0).getTime());
        return timeB - timeA;
      });

      setFeedbacks(list);
    } catch (err) {
      console.error("Lỗi khi tải danh sách Feedback:", err);
      toast.error("Không thể tải danh sách Feedback.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedbacks();
  }, [activeTab, user?.id]);

  // Filter Logic
  const filteredFeedbacks = feedbacks.filter(fb => {
    // Search Term match
    const search = searchTerm.toLowerCase();
    const matchSearch = 
      (fb.title?.toLowerCase().includes(search)) ||
      (fb.content.toLowerCase().includes(search)) ||
      (fb.senderName.toLowerCase().includes(search)) ||
      (fb.recipientName.toLowerCase().includes(search));

    if (!matchSearch) return false;

    // Tab filtering
    if (activeTab === 'ALL_PUBLIC') {
      return fb.mode === 'PUBLIC';
    }

    if (activeTab === 'RECEIVED') {
      if (!user) return false;
      return fb.recipientId === user.id && (fb.mode === 'PUBLIC' || fb.mode === 'PRIVATE');
    }

    if (activeTab === 'SENT') {
      if (!user) return false;
      return fb.senderId === user.id;
    }

    if (activeTab === 'PRIVATE') {
      if (!user) return false;
      return fb.mode === 'PRIVATE' && (fb.senderId === user.id || fb.recipientId === user.id);
    }

    return true;
  });

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-neutral-900 via-neutral-800 to-black text-white p-8 rounded-3xl shadow-lg border border-neutral-800 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/20 border border-amber-500/30 rounded-full text-xs font-bold text-amber-300">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Gửi lời nhắn & Đánh giá cộng đồng</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">
            Thế Giới Feedback
          </h1>
          <p className="text-xs md:text-sm text-neutral-400 max-w-xl leading-relaxed">
            Nơi bạn có thể gửi góp ý công khai hoặc nhắn gửi thư riêng tư kín đáo tới Creator và các thành viên trong cộng đồng.
          </p>
        </div>

        <button
          onClick={() => {
            if (!user) {
              toast.error("Vui lòng đăng nhập để gửi Feedback!");
              return;
            }
            setIsModalOpen(true);
          }}
          className="relative z-10 inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-white text-black dark:bg-white dark:text-black font-black text-xs rounded-2xl hover:scale-105 transition-all shadow-xl shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Tạo Feedback Mới</span>
        </button>
      </div>

      {/* Control Bar: Search & Tabs */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-neutral-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm kiếm nội dung, người gửi, người nhận..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 text-xs rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 focus:outline-none focus:border-black dark:focus:border-white shadow-sm"
          />
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-1.5 p-1 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-x-auto shrink-0">
          <button
            onClick={() => setActiveTab('ALL_PUBLIC')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-colors ${
              activeTab === 'ALL_PUBLIC'
                ? 'bg-white dark:bg-neutral-800 text-black dark:text-white shadow-sm'
                : 'text-neutral-500 hover:text-black dark:hover:text-white'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Công Khai</span>
          </button>

          {user && (
            <>
              <button
                onClick={() => setActiveTab('RECEIVED')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-colors ${
                  activeTab === 'RECEIVED'
                    ? 'bg-white dark:bg-neutral-800 text-black dark:text-white shadow-sm'
                    : 'text-neutral-500 hover:text-black dark:hover:text-white'
                }`}
              >
                <Inbox className="w-3.5 h-3.5" />
                <span>Đã Nhận</span>
              </button>

              <button
                onClick={() => setActiveTab('SENT')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-colors ${
                  activeTab === 'SENT'
                    ? 'bg-white dark:bg-neutral-800 text-black dark:text-white shadow-sm'
                    : 'text-neutral-500 hover:text-black dark:hover:text-white'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                <span>Đã Gửi</span>
              </button>

              <button
                onClick={() => setActiveTab('PRIVATE')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-colors ${
                  activeTab === 'PRIVATE'
                    ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30'
                    : 'text-neutral-500 hover:text-amber-500'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Thư Riêng Tư</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Feedbacks Stream List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-44 bg-neutral-100 dark:bg-neutral-900 rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : filteredFeedbacks.length === 0 ? (
        /* Empty State */
        <div className="text-center py-16 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-8 space-y-4">
          <div className="w-16 h-16 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto text-neutral-400">
            <MessageSquare className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="font-extrabold text-base text-neutral-900 dark:text-neutral-100">
              {activeTab === 'PRIVATE' 
                ? 'Không có thư riêng tư nào' 
                : activeTab === 'RECEIVED' 
                ? 'Bạn chưa nhận được Feedback nào'
                : activeTab === 'SENT'
                ? 'Bạn chưa gửi Feedback nào'
                : 'Chưa có Feedback công khai nào'}
            </h3>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto">
              Hãy tạo Feedback đầu tiên để trao đổi và truyền cảm hứng cho cộng đồng Roleplay!
            </p>
          </div>
          <button
            onClick={() => {
              if (!user) {
                toast.error("Vui lòng đăng nhập để gửi Feedback!");
                return;
              }
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-black dark:bg-white text-white dark:text-black font-extrabold text-xs rounded-xl shadow-md hover:scale-105 transition-transform"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo Feedback Mới</span>
          </button>
        </div>
      ) : (
        /* Feedback Items */
        <div className="space-y-6">
          {filteredFeedbacks.map(fb => (
            fb.mode === 'PRIVATE' ? (
              <PrivateFeedbackCard
                key={fb.id}
                feedback={fb}
                onUpdate={fetchFeedbacks}
                onDelete={(id) => {
                  setFeedbacks(prev => prev.filter(item => item.id !== id));
                  fetchFeedbacks();
                }}
              />
            ) : (
              <PublicFeedbackCard
                key={fb.id}
                feedback={fb}
                onUpdate={fetchFeedbacks}
                onDelete={(id) => {
                  setFeedbacks(prev => prev.filter(item => item.id !== id));
                  fetchFeedbacks();
                }}
              />
            )
          ))}
        </div>
      )}

      {/* Modal for Creating Feedback */}
      <CreateFeedbackModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          fetchFeedbacks();
        }}
      />
    </div>
  );
}
