import React, { useState, useEffect } from 'react';
import AdminLayout from './AdminLayout';
import { 
  Bell, Plus, Search, Send, User, CheckCircle2, ShieldCheck, 
  X, Eye, Edit3, Sparkles, Clock, AlertCircle, FileText, Check, Users
} from 'lucide-react';
import { 
  collection, query, getDocs, doc, addDoc, orderBy, where, serverTimestamp 
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/useAuthStore';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import { CreatorItem } from '../../types';
import { getValidAvatar } from '../../lib/avatar';

interface SystemNotifRecord {
  id: string;
  type: string;
  isSystem: boolean;
  isSystemBroadcast?: boolean;
  recipientId: string;
  recipientName?: string;
  recipientNumericId?: string;
  senderId: string;
  senderName: string;
  title: string;
  message: string;
  markdownContent?: string;
  createdAt: any;
}

export default function AdminSystemNotifications() {
  const { user: currentUser } = useAuthStore();
  const [notifList, setNotifList] = useState<SystemNotifRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Create Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [targetType, setTargetType] = useState<'ALL' | 'SPECIFIC'>('ALL');
  
  // Specific User Search State
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [allUsers, setAllUsers] = useState<CreatorItem[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedMember, setSelectedMember] = useState<CreatorItem | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [activeTab, setActiveTab] = useState<'WRITE' | 'PREVIEW'>('WRITE');
  const [submitting, setSubmitting] = useState(false);

  // Detail View Modal State
  const [viewingNotif, setViewingNotif] = useState<SystemNotifRecord | null>(null);

  useEffect(() => {
    fetchSystemNotifications();
  }, []);

  const fetchSystemNotifications = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'notifications'),
        where('isSystem', '==', true),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      const items = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as SystemNotifRecord[];
      setNotifList(items);
    } catch (err) {
      console.error("Error fetching system notifications:", err);
      // Fallback query if index or compound query is pending
      try {
        const qFallback = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'));
        const snapFB = await getDocs(qFallback);
        const filtered = snapFB.docs
          .map(d => ({ id: d.id, ...d.data() } as unknown as SystemNotifRecord))
          .filter(n => n.isSystem || n.type === 'SYSTEM' || n.type === 'SYSTEM_BROADCAST');
        setNotifList(filtered);
      } catch (fbErr) {
        console.error("Fallback fetch system notifications error:", fbErr);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setIsModalOpen(true);
    setTargetType('ALL');
    setUserSearchQuery('');
    setSelectedMember(null);
    setTitle('');
    setContent('');
    setActiveTab('WRITE');
    if (allUsers.length === 0) {
      fetchAllUsers();
    }
  };

  const fetchAllUsers = async () => {
    setLoadingUsers(true);
    try {
      const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setAllUsers(snap.docs.map(d => ({ id: d.id, ...d.data() }) as CreatorItem));
    } catch (err) {
      console.error("Error fetching users for target selection:", err);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Confirmation modal state for broadcast
  const [showConfirmBroadcastModal, setShowConfirmBroadcastModal] = useState(false);
  const [broadcastCount, setBroadcastCount] = useState(0);

  // Filter users based on Display Name or Numeric ID / ID
  const filteredUsers = userSearchQuery.trim() === '' ? [] : allUsers.filter(u => {
    const q = userSearchQuery.toLowerCase().trim();
    const nameMatch = u.displayName?.toLowerCase().includes(q);
    const numIdMatch = u.numericId ? u.numericId.toString().includes(q) : false;
    const docIdMatch = u.id.toLowerCase().includes(q);
    return nameMatch || numIdMatch || docIdMatch;
  });

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (!title.trim()) {
      toast.error("Vui lòng nhập tiêu đề thông báo.");
      return;
    }

    if (!content.trim()) {
      toast.error("Vui lòng nhập nội dung thông báo.");
      return;
    }

    if (targetType === 'SPECIFIC') {
      if (!selectedMember) {
        toast.error("Vui lòng chọn thành viên nhận thông báo.");
        return;
      }
      // PART F: User validation - check if member account is deleted or locked
      if ((selectedMember as any).isDeleted || (selectedMember as any).status === 'DELETED' || (selectedMember as any).isLocked) {
        toast.error("Tài khoản thành viên này đã bị khóa hoặc bị xóa, không thể gửi thông báo.");
        return;
      }
      // Send directly for specific valid member
      await executeSendNotification();
    } else {
      // PART E: Broadcast confirmation step
      // Count valid active members (excluding deleted or locked)
      const validActiveMembers = allUsers.filter(u => !(u as any).isDeleted && (u as any).status !== 'DELETED' && !(u as any).isLocked);
      const count = validActiveMembers.length > 0 ? validActiveMembers.length : allUsers.length;
      setBroadcastCount(count);
      setShowConfirmBroadcastModal(true);
    }
  };

  const executeSendNotification = async () => {
    if (!currentUser) return;

    setSubmitting(true);
    try {
      const isBroadcast = targetType === 'ALL';
      const recipientId = isBroadcast ? 'ALL' : selectedMember!.id;
      const recipientName = isBroadcast ? 'Toàn bộ thành viên' : selectedMember!.displayName;
      const recipientNumericId = isBroadcast ? '' : (selectedMember!.numericId || selectedMember!.id);

      const notifData = {
        type: isBroadcast ? 'SYSTEM_BROADCAST' : 'SYSTEM',
        isSystem: true,
        isSystemBroadcast: isBroadcast,
        recipientId,
        recipientName,
        recipientNumericId,
        senderId: currentUser.id,
        senderName: currentUser.displayName || 'Ban Quản Trị',
        senderAvatar: getValidAvatar(currentUser.avatar),
        title: title.trim(),
        message: content.trim(),
        markdownContent: content.trim(),
        read: false,
        readBy: [],
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'notifications'), notifData);

      // Audit Log
      await addDoc(collection(db, 'audit_logs'), {
        executorId: currentUser.id,
        executorName: currentUser.displayName || 'Admin',
        executorRole: currentUser.role || 'ADMIN',
        action: 'CREATE_SYSTEM_NOTIFICATION',
        targetId: recipientId,
        targetType: isBroadcast ? 'ALL_MEMBERS' : 'USER',
        details: `Đã phát thông báo hệ thống: "${title.trim()}" cho ${recipientName}`,
        createdAt: serverTimestamp()
      });

      toast.success("Đã gửi thông báo hệ thống thành công!");
      setShowConfirmBroadcastModal(false);
      setIsModalOpen(false);
      fetchSystemNotifications();
    } catch (err) {
      console.error("Error sending system notification:", err);
      toast.error("Không thể gửi thông báo hệ thống. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-8 pb-12">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl">
                <Bell className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-black tracking-tight uppercase">
                Quản Lý Thông Báo Hệ Thống
              </h1>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 font-bold uppercase tracking-wider">
              Tạo và gửi thông báo hệ thống chính thức từ Ban Quản Trị đến cộng đồng
            </p>
          </div>

          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 px-5 py-3 bg-neutral-900 dark:bg-white text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-100 rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-lg hover:scale-105 active:scale-95 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo thông báo</span>
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-2">
            <p className="text-[10px] text-neutral-400 font-extrabold uppercase tracking-widest">Tổng thông báo đã tạo</p>
            <p className="text-2xl font-black text-neutral-900 dark:text-white">{notifList.length}</p>
          </div>
          <div className="p-5 bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-2">
            <p className="text-[10px] text-neutral-400 font-extrabold uppercase tracking-widest">Thông báo toàn mạng (Broadcast)</p>
            <p className="text-2xl font-black text-amber-500">
              {notifList.filter(n => n.isSystemBroadcast || n.recipientId === 'ALL').length}
            </p>
          </div>
          <div className="p-5 bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-2">
            <p className="text-[10px] text-neutral-400 font-extrabold uppercase tracking-widest">Thông báo gửi cá nhân</p>
            <p className="text-2xl font-black text-blue-500">
              {notifList.filter(n => !n.isSystemBroadcast && n.recipientId !== 'ALL').length}
            </p>
          </div>
        </div>

        {/* Sent Notifications History Table */}
        <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
            <h2 className="font-extrabold text-sm uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              Lịch Sử Thông Báo Đã Gửi
            </h2>
            <span className="text-xs text-neutral-500 font-bold">
              {notifList.length} thông báo
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-neutral-400 text-xs font-bold animate-pulse">
              Đang tải danh sách thông báo hệ thống...
            </div>
          ) : notifList.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <Bell className="w-10 h-10 text-neutral-300 dark:text-neutral-700 mx-auto" />
              <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                Chưa có thông báo hệ thống nào được khởi tạo
              </p>
              <button
                onClick={handleOpenCreateModal}
                className="px-4 py-2 bg-amber-500 text-black font-extrabold text-xs rounded-xl uppercase hover:bg-amber-400 transition-colors cursor-pointer"
              >
                + Tạo thông báo đầu tiên
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-neutral-500 font-extrabold uppercase tracking-wider border-b border-neutral-200 dark:border-neutral-800">
                  <tr>
                    <th className="px-6 py-4">Tiêu đề thông báo</th>
                    <th className="px-6 py-4">Đối tượng nhận</th>
                    <th className="px-6 py-4">Người phát hành</th>
                    <th className="px-6 py-4">Thời gian</th>
                    <th className="px-6 py-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 font-medium">
                  {notifList.map((notif) => {
                    const isBroadcast = notif.isSystemBroadcast || notif.recipientId === 'ALL';
                    const createdAtFormatted = notif.createdAt?.toDate 
                      ? notif.createdAt.toDate().toLocaleString('vi-VN') 
                      : new Date(notif.createdAt || 0).toLocaleString('vi-VN');

                    return (
                      <tr key={notif.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30 transition-colors">
                        <td className="px-6 py-4 font-bold text-neutral-900 dark:text-neutral-100 max-w-xs truncate">
                          {notif.title}
                        </td>
                        <td className="px-6 py-4">
                          {isBroadcast ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                              <Users className="w-3 h-3" />
                              Toàn bộ thành viên
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                              <User className="w-3 h-3" />
                              {notif.recipientName || 'Thành viên cụ thể'}
                              {notif.recipientNumericId && ` (#${notif.recipientNumericId})`}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 font-semibold text-neutral-600 dark:text-neutral-400">
                          {notif.senderName || 'Admin'}
                        </td>
                        <td className="px-6 py-4 text-neutral-400 text-[11px]">
                          {createdAtFormatted}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => setViewingNotif(notif)}
                            className="px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-xl font-bold text-[11px] transition-colors cursor-pointer inline-flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Xem nội dung</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* CREATE SYSTEM NOTIFICATION MODAL */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 rounded-[2.5rem] w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-6 shadow-2xl relative border border-neutral-200 dark:border-neutral-800 animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black tracking-tight uppercase">Tạo Thông Báo Hệ Thống</h2>
                  <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest font-mono">
                    Gửi thông báo chính thức bằng định dạng Markdown
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendNotification} className="space-y-6">
              {/* 1. Target Recipient Selection */}
              <div className="space-y-3">
                <label className="text-xs font-black uppercase tracking-wider text-neutral-700 dark:text-neutral-300 block">
                  1. Đối tượng nhận thông báo <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setTargetType('ALL');
                      setSelectedMember(null);
                    }}
                    className={`p-4 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                      targetType === 'ALL'
                        ? 'border-amber-500 bg-amber-500/10 dark:bg-amber-500/15 text-neutral-900 dark:text-white shadow-sm ring-1 ring-amber-500'
                        : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/40 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <div className={`p-2 rounded-xl shrink-0 ${targetType === 'ALL' ? 'bg-amber-500 text-black' : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300'}`}>
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-extrabold text-xs">Toàn bộ thành viên</p>
                      <p className="text-[10px] text-neutral-400 font-medium">Phát thông báo cho tất cả người dùng</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTargetType('SPECIFIC');
                      if (allUsers.length === 0) fetchAllUsers();
                    }}
                    className={`p-4 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                      targetType === 'SPECIFIC'
                        ? 'border-amber-500 bg-amber-500/10 dark:bg-amber-500/15 text-neutral-900 dark:text-white shadow-sm ring-1 ring-amber-500'
                        : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/40 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <div className={`p-2 rounded-xl shrink-0 ${targetType === 'SPECIFIC' ? 'bg-amber-500 text-black' : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300'}`}>
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-extrabold text-xs">Một thành viên cụ thể</p>
                      <p className="text-[10px] text-neutral-400 font-medium">Tìm theo Tên hoặc Numeric ID</p>
                    </div>
                  </button>
                </div>

                {/* Specific User Search & Selection */}
                {targetType === 'SPECIFIC' && (
                  <div className="space-y-3 pt-2">
                    {!selectedMember ? (
                      <div className="space-y-2">
                        <div className="relative">
                          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                          <input
                            type="text"
                            value={userSearchQuery}
                            onChange={e => setUserSearchQuery(e.target.value)}
                            placeholder="Nhập Display Name hoặc Numeric ID để tìm kiếm..."
                            className="w-full pl-10 pr-4 py-2.5 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        </div>

                        {loadingUsers && (
                          <p className="text-[11px] text-neutral-400 font-medium px-1 animate-pulse">
                            Đang tải dữ liệu thành viên...
                          </p>
                        )}

                        {userSearchQuery.trim() !== '' && (
                          <div className="max-h-48 overflow-y-auto border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/80 rounded-2xl divide-y divide-neutral-200 dark:divide-neutral-700/50 shadow-lg">
                            {filteredUsers.length === 0 ? (
                              <div className="p-4 text-center text-xs text-neutral-400 font-medium">
                                Không tìm thấy thành viên khớp với từ khóa "{userSearchQuery}"
                              </div>
                            ) : (
                              filteredUsers.map(u => (
                                <button
                                  key={u.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedMember(u);
                                    setUserSearchQuery('');
                                  }}
                                  className="w-full p-3 flex items-center justify-between hover:bg-neutral-200/60 dark:hover:bg-neutral-700/60 transition-colors text-left cursor-pointer"
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <img
                                      src={getValidAvatar(u.avatar)}
                                      alt={u.displayName}
                                      className="w-8 h-8 rounded-full object-cover shrink-0 border border-neutral-200 dark:border-neutral-700"
                                    />
                                    <div className="min-w-0">
                                      <p className="text-xs font-bold text-neutral-900 dark:text-white truncate">
                                        {u.displayName}
                                      </p>
                                      <p className="text-[10px] text-neutral-400 font-mono">
                                        ID: #{u.numericId || u.id}
                                      </p>
                                    </div>
                                  </div>
                                  <span className="text-[10px] font-extrabold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-md uppercase">
                                    Chọn
                                  </span>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Confirm Selected Member Box (REQUIRED: Avatar + Display Name + Numeric ID) */
                      <div className="p-4 bg-amber-500/10 border border-amber-500/40 rounded-2xl flex items-center justify-between gap-4 animate-in fade-in duration-200">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <img
                            src={getValidAvatar(selectedMember.avatar)}
                            alt={selectedMember.displayName}
                            className="w-12 h-12 rounded-2xl object-cover shrink-0 border-2 border-amber-500 shadow-sm"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-md">
                                Thành viên đã chọn
                              </span>
                            </div>
                            <h4 className="text-sm font-extrabold text-neutral-900 dark:text-white truncate pt-0.5">
                              {selectedMember.displayName}
                            </h4>
                            <p className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
                              Numeric ID: #{selectedMember.numericId || selectedMember.id}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedMember(null)}
                          className="px-3 py-1.5 bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-700 rounded-xl text-xs font-bold transition-colors shrink-0 cursor-pointer"
                        >
                          Thay đổi
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 2. Notification Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-neutral-700 dark:text-neutral-300 block">
                  2. Tiêu đề thông báo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Ví dụ: Thông báo bảo trì hệ thống định kỳ..."
                  className="w-full px-4 py-3 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl text-xs font-bold text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* 3. Notification Content (Markdown) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wider text-neutral-700 dark:text-neutral-300 block">
                    3. Nội dung thông báo (Hỗ trợ Markdown) <span className="text-red-500">*</span>
                  </label>
                  
                  {/* Editor / Preview Tabs */}
                  <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setActiveTab('WRITE')}
                      className={`flex items-center gap-1 px-3 py-1 rounded-lg text-[10px] font-extrabold uppercase transition-colors cursor-pointer ${
                        activeTab === 'WRITE'
                          ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-sm'
                          : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                      }`}
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Soạn thảo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('PREVIEW')}
                      className={`flex items-center gap-1 px-3 py-1 rounded-lg text-[10px] font-extrabold uppercase transition-colors cursor-pointer ${
                        activeTab === 'PREVIEW'
                          ? 'bg-amber-500 text-black shadow-sm'
                          : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                      }`}
                    >
                      <Eye className="w-3 h-3" />
                      <span>Xem trước Markdown</span>
                    </button>
                  </div>
                </div>

                {activeTab === 'WRITE' ? (
                  <textarea
                    required
                    rows={6}
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    placeholder="Nhập nội dung thông báo bằng Markdown...
Ví dụ:
# Thông Báo Mới
Chào bạn, **Thế giới nhập vai_AD** vừa cập nhật tính năng mới:
- *Tính năng AI Search*
- *Phản hồi yêu cầu hỗ trợ*

Xem thêm chi tiết tại [Trang chủ](/home)."
                    className="w-full p-4 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl text-xs font-mono font-medium text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 leading-relaxed"
                  />
                ) : (
                  <div className="p-5 bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 rounded-2xl min-h-[160px] max-h-72 overflow-y-auto">
                    {content.trim() === '' ? (
                      <p className="text-xs text-neutral-400 italic">Chưa có nội dung để xem trước.</p>
                    ) : (
                      <div className="prose dark:prose-invert max-w-none text-xs md:text-sm text-neutral-800 dark:text-neutral-200 leading-relaxed space-y-2">
                        <ReactMarkdown
                          components={{
                            p: ({node, ...props}) => <p className="mb-2 leading-relaxed" {...props} />,
                            h1: ({node, ...props}) => <h1 className="text-base font-black text-amber-600 dark:text-amber-400 my-2 uppercase tracking-wide border-b border-amber-500/20 pb-1" {...props} />,
                            h2: ({node, ...props}) => <h2 className="text-sm font-extrabold my-2 text-neutral-900 dark:text-white" {...props} />,
                            h3: ({node, ...props}) => <h3 className="text-xs font-bold my-1 text-neutral-900 dark:text-white" {...props} />,
                            strong: ({node, ...props}) => <strong className="font-extrabold text-neutral-900 dark:text-white" {...props} />,
                            em: ({node, ...props}) => <em className="italic text-amber-600 dark:text-amber-400" {...props} />,
                            ul: ({node, ...props}) => <ul className="list-disc pl-5 my-2 space-y-1" {...props} />,
                            ol: ({node, ...props}) => <ol className="list-decimal pl-5 my-2 space-y-1" {...props} />,
                            li: ({node, ...props}) => <li className="my-0.5" {...props} />,
                            a: ({node, ...props}) => <a className="text-amber-600 dark:text-amber-400 font-bold underline hover:opacity-80" target="_blank" rel="noopener noreferrer" {...props} />,
                            code: ({node, ...props}) => <code className="bg-neutral-200 dark:bg-neutral-700 px-1.5 py-0.5 rounded text-[11px] font-mono text-amber-600 dark:text-amber-300" {...props} />
                          }}
                        >
                          {content}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-2xl text-xs font-bold uppercase transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-50 rounded-2xl text-xs font-black uppercase tracking-wider transition-colors shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>{submitting ? 'Đang gửi...' : 'Gửi thông báo'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW SYSTEM NOTIFICATION DETAIL MODAL (ADMIN REVIEW) */}
      {viewingNotif && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setViewingNotif(null)}
        >
          <div 
            className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 rounded-[2.5rem] w-full max-w-xl max-h-[85vh] overflow-y-auto p-6 sm:p-8 space-y-6 shadow-2xl relative border border-neutral-200 dark:border-neutral-800 animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black tracking-tight uppercase">Chi Tiết Thông Báo Hệ Thống</h2>
                  <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest font-mono">
                    {viewingNotif.isSystemBroadcast || viewingNotif.recipientId === 'ALL' ? 'Thông báo toàn hệ thống' : `Gửi riêng cho ${viewingNotif.recipientName || 'Thành viên'}`}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setViewingNotif(null)}
                className="p-2 text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl border border-neutral-200 dark:border-neutral-700/60 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Tiêu đề</p>
                <h3 className="text-sm font-extrabold text-neutral-900 dark:text-white">{viewingNotif.title}</h3>
              </div>

              <div className="p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl border border-neutral-200 dark:border-neutral-700/60 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Nội dung đã Render (Markdown)</p>
                <div className="prose dark:prose-invert max-w-none text-xs md:text-sm text-neutral-800 dark:text-neutral-200 leading-relaxed">
                  <ReactMarkdown
                    components={{
                      p: ({node, ...props}) => <p className="mb-2 leading-relaxed" {...props} />,
                      h1: ({node, ...props}) => <h1 className="text-sm font-black text-amber-600 dark:text-amber-400 my-2 uppercase tracking-wide border-b border-amber-500/20 pb-1" {...props} />,
                      h2: ({node, ...props}) => <h2 className="text-xs font-extrabold my-2 text-neutral-900 dark:text-white" {...props} />,
                      strong: ({node, ...props}) => <strong className="font-extrabold text-neutral-900 dark:text-white" {...props} />,
                      em: ({node, ...props}) => <em className="italic text-amber-600 dark:text-amber-400" {...props} />,
                      ul: ({node, ...props}) => <ul className="list-disc pl-5 my-2 space-y-1" {...props} />,
                      ol: ({node, ...props}) => <ol className="list-decimal pl-5 my-2 space-y-1" {...props} />,
                      li: ({node, ...props}) => <li className="my-0.5" {...props} />,
                      a: ({node, ...props}) => <a className="text-amber-600 dark:text-amber-400 font-bold underline" target="_blank" rel="noopener noreferrer" {...props} />,
                      code: ({node, ...props}) => <code className="bg-neutral-200 dark:bg-neutral-700 px-1.5 py-0.5 rounded text-[11px] font-mono text-amber-600 dark:text-amber-300" {...props} />
                    }}
                  >
                    {viewingNotif.markdownContent || viewingNotif.message || ''}
                  </ReactMarkdown>
                </div>
              </div>
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setViewingNotif(null)}
                className="px-6 py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-100 rounded-2xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM BROADCAST NOTIFICATION MODAL */}
      {showConfirmBroadcastModal && (
        <div 
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setShowConfirmBroadcastModal(false)}
        >
          <div 
            className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 rounded-[2.5rem] w-full max-w-md p-6 sm:p-8 space-y-6 shadow-2xl relative border border-amber-500/30 animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-neutral-200 dark:border-neutral-800 pb-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                <Bell className="w-6 h-6 animate-bounce" />
              </div>
              <div>
                <h3 className="text-base font-black tracking-tight uppercase text-amber-600 dark:text-amber-400">
                  Xác Nhận Phát Thông Báo
                </h3>
                <p className="text-xs text-neutral-500 font-bold">Toàn bộ thành viên hệ thống</p>
              </div>
            </div>

            <div className="p-4 bg-amber-500/10 rounded-2xl border border-amber-500/20 text-neutral-800 dark:text-neutral-200 text-sm leading-relaxed">
              Bạn sắp gửi thông báo đến <strong className="text-amber-600 dark:text-amber-400 font-black text-base">{broadcastCount}</strong> thành viên.
            </div>

            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Hành động này sẽ gửi thông báo hệ thống đến tất cả tài khoản thành viên đang hoạt động. Bạn có chắc chắn muốn tiếp tục?
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmBroadcastModal(false)}
                className="px-5 py-2.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-2xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={executeSendNotification}
                disabled={submitting}
                className="px-6 py-2.5 bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-50 rounded-2xl text-xs font-black uppercase tracking-wider transition-colors shadow-md flex items-center gap-2 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>{submitting ? 'Đang gửi...' : 'Xác nhận gửi'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
