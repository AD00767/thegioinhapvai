import React, { useState, useEffect, useRef } from 'react';
import AdminLayout from './AdminLayout';
import { 
  Users, Search, ShieldCheck, ShieldAlert, Lock, Unlock, 
  Trash2, UserMinus, Shield, MoreVertical, X, AlertCircle, History, 
  User, Ban, AlertTriangle, EyeOff, BadgeMinus, ShieldPlus, BadgeCheck
} from 'lucide-react';
import { 
  collection, query, getDocs, doc, updateDoc, deleteDoc,
  orderBy, where, addDoc, limit 
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/useAuthStore';
import toast from 'react-hot-toast';
import { CreatorItem } from '../../types';
import { getValidAvatar } from '../../lib/avatar';
import { useNavigate } from 'react-router-dom';

type ActionType = 'DELETE' | 'RESTORE' | 'SUSPEND' | 'UNSUSPEND' | 'RESTRICT' | 'LIFT_RESTRICTION' | 'REMOVE_CREATOR' | 'PROMOTE_ADMIN' | 'PROMOTE_MOD' | 'DEMOTE' | 'HISTORY' | null;
type FilterTab = 'ALL' | 'ACTIVE' | 'SUSPENDED' | 'DELETED';

export default function UserManagement() {
  const { user: currentUser, firebaseUser } = useAuthStore();
  const [users, setUsers] = useState<CreatorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('ALL');
  
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  
  const [selectedUser, setSelectedUser] = useState<CreatorItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionType, setActionType] = useState<ActionType>(null);
  
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState('7'); // days
  const [restrictedActivities, setRestrictedActivities] = useState<string[]>([]);
  const [userHistory, setUserHistory] = useState<any[]>([]);
  const navigate = useNavigate();

  const isAdmin = currentUser?.role === 'ADMIN';

  useEffect(() => {
    fetchUsers();
    
    const handleClickOutside = () => setActiveMenuId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(100));
      const snap = await getDocs(q);
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() }) as CreatorItem));
    } catch (err) {
      console.error("Error fetching users:", err);
      toast.error("Không thể tải danh sách người dùng.");
    } finally {
      setLoading(false);
    }
  };

  const fetchUserHistory = async (userId: string) => {
    try {
      const q = query(
        collection(db, 'audit_logs'), 
        where('targetId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      const snap = await getDocs(q);
      setUserHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Error fetching history:", err);
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
        targetType: 'USER',
        details,
        reason,
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Error logging action:", err);
    }
  };

  const handleAction = async () => {
    if (!selectedUser || !actionType) return;
    if (!isAdmin && ['DELETE', 'PROMOTE_ADMIN', 'PROMOTE_MOD', 'DEMOTE'].includes(actionType)) {
      toast.error("Bạn không có quyền thực hiện thao tác này.");
      return;
    }
    if (actionType !== 'HISTORY' && !reason.trim() && !['DELETE', 'UNSUSPEND', 'LIFT_RESTRICTION'].includes(actionType)) {
      toast.error("Vui lòng nhập lý do.");
      return;
    }
    if (actionType === 'RESTRICT' && restrictedActivities.length === 0) {
      toast.error("Vui lòng chọn ít nhất một hoạt động để giới hạn.");
      return;
    }

    setLoading(true);
    try {
      const userRef = doc(db, 'users', selectedUser.id);
      
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + parseInt(duration));

      switch (actionType) {
        case 'DELETE': {
          const deleteReasonText = reason.trim() || 'Tài khoản đã bị xóa/vô hiệu hóa bởi Quản trị viên do vi phạm quy tắc cộng đồng.';
          const nowIso = new Date().toISOString();
          
          await updateDoc(userRef, {
            isDeleted: true,
            status: 'DELETED',
            deletedAt: nowIso,
            deletedBy: currentUser?.id || 'admin',
            deletedByName: currentUser?.displayName || 'Admin',
            deleteReason: deleteReasonText,
            isLocked: true,
            lockReason: deleteReasonText,
            lockExpiresAt: null
          });

          await addDoc(collection(db, 'notifications'), {
            userId: selectedUser.id,
            recipientId: selectedUser.id,
            type: 'ACCOUNT_DELETED',
            title: 'Tài khoản đã bị xóa/vô hiệu hóa',
            message: `Tài khoản của bạn đã bị vô hiệu hóa vĩnh viễn bởi Quản trị viên. Lý do: ${deleteReasonText}`,
            read: false,
            createdAt: nowIso
          });

          await logAction('DELETE_USER', selectedUser.id, `Vô hiệu hóa vĩnh viễn tài khoản: ${selectedUser.displayName} (${deleteReasonText})`);
          toast.success("Đã vô hiệu hóa và chuyển tài khoản sang trạng thái đã xóa.");
          break;
        }
        case 'RESTORE': {
          const nowIso = new Date().toISOString();
          const restoreReasonText = reason.trim() || 'Tài khoản đã được khôi phục hoạt động bởi Quản trị viên.';
          await updateDoc(userRef, {
            isDeleted: false,
            status: 'ACTIVE',
            deletedAt: null,
            deletedBy: null,
            deletedByName: null,
            deleteReason: null,
            isLocked: false,
            lockReason: null,
            lockExpiresAt: null,
            appealStatus: 'APPROVED'
          });

          await addDoc(collection(db, 'notifications'), {
            userId: selectedUser.id,
            recipientId: selectedUser.id,
            type: 'ACCOUNT_RESTORED',
            title: 'Tài khoản đã được khôi phục',
            message: `Tài khoản của bạn đã được Quản trị viên khôi phục hoạt động bình thường.${reason.trim() ? ` Lý do: ${reason.trim()}` : ''}`,
            read: false,
            createdAt: nowIso
          });

          await logAction('RESTORE_USER', selectedUser.id, `Khôi phục tài khoản hoạt động: ${selectedUser.displayName} (${restoreReasonText})`);
          toast.success("Đã khôi phục tài khoản thành công.");
          break;
        }
        case 'SUSPEND':
          await updateDoc(userRef, {
            isLocked: true,
            lockReason: reason,
            lockExpiresAt: expiresAt.toISOString()
          });
          await addDoc(collection(db, 'notifications'), {
            userId: selectedUser.id,
            recipientId: selectedUser.id,
            type: 'ACCOUNT_SUSPENDED',
            title: 'Tài khoản bị đình chỉ',
            message: `Tài khoản của bạn đã bị đình chỉ hoạt động. Lý do: ${reason}. Thời hạn: đến ${expiresAt.toLocaleDateString('vi-VN')}.`,
            read: false,
            createdAt: new Date().toISOString()
          });
          await logAction('SUSPEND_USER', selectedUser.id, `Đình chỉ tài khoản đến ${expiresAt.toLocaleDateString('vi-VN')}`);
          toast.success("Đã đình chỉ tài khoản.");
          break;
        case 'UNSUSPEND':
          await updateDoc(userRef, {
            isLocked: false,
            lockReason: null,
            lockExpiresAt: null
          });
          await addDoc(collection(db, 'notifications'), {
            userId: selectedUser.id,
            recipientId: selectedUser.id,
            type: 'ACCOUNT_UNLOCKED',
            title: 'Tài khoản đã được mở khóa',
            message: `Tài khoản của bạn đã được mở khóa bởi quản trị viên. ${reason ? `Ghi chú: ${reason}` : ''}`,
            read: false,
            createdAt: new Date().toISOString()
          });
          await logAction('UNSUSPEND_USER', selectedUser.id, `Mở khóa tài khoản`);
          toast.success("Đã mở khóa tài khoản.");
          break;
        case 'RESTRICT':
          await updateDoc(userRef, {
            restrictedActivities,
            restrictionExpiresAt: expiresAt.toISOString(),
            restrictionReason: reason
          });
          const actLabelsMap: Record<string, string> = {
            'POST_CHARACTER': 'Đăng Character',
            'POST_PROMPT': 'Đăng Prompt',
            'POST_FEEDBACK': 'Gửi Feedback',
            'POST_COMMENT': 'Bình luận'
          };
          const labelList = restrictedActivities.map(a => actLabelsMap[a] || a).join(', ');
          await addDoc(collection(db, 'notifications'), {
            userId: selectedUser.id,
            recipientId: selectedUser.id,
            type: 'ACTIVITY_RESTRICTED',
            title: 'Tài khoản bị giới hạn hoạt động',
            message: `Tài khoản của bạn đã bị giới hạn các hoạt động: ${labelList}. Lý do: ${reason}. Thời hạn: đến ${expiresAt.toLocaleDateString('vi-VN')}.`,
            read: false,
            createdAt: new Date().toISOString()
          });
          await logAction('RESTRICT_USER', selectedUser.id, `Giới hạn hoạt động (${labelList}) đến ${expiresAt.toLocaleDateString('vi-VN')}`);
          toast.success("Đã giới hạn hoạt động.");
          break;
        case 'LIFT_RESTRICTION':
          await updateDoc(userRef, {
            restrictedActivities: [],
            restrictionExpiresAt: null,
            restrictionReason: null
          });
          await addDoc(collection(db, 'notifications'), {
            userId: selectedUser.id,
            recipientId: selectedUser.id,
            type: 'RESTRICTION_LIFTED',
            title: 'Đã gỡ giới hạn hoạt động',
            message: `Quản trị viên đã gỡ bỏ các giới hạn hoạt động đối với tài khoản của bạn.`,
            read: false,
            createdAt: new Date().toISOString()
          });
          await logAction('LIFT_RESTRICTION', selectedUser.id, `Gỡ giới hạn hoạt động`);
          toast.success("Đã gỡ giới hạn hoạt động.");
          break;
        case 'REMOVE_CREATOR':
          if ((selectedUser.role === 'MODERATOR' || selectedUser.role === 'MOD') && !isAdmin) {
            toast.error("Chỉ Admin mới có quyền gỡ quyền Creator của Moderator.");
            return;
          }
          await updateDoc(userRef, {
            creatorStatus: false,
            role: (selectedUser.role === 'MODERATOR' || selectedUser.role === 'MOD') ? selectedUser.role : (selectedUser.role === 'ADMIN' ? 'ADMIN' : 'USER')
          });
          await logAction('REMOVE_CREATOR', selectedUser.id, `Hủy quyền Creator`);
          toast.success("Đã hủy quyền Creator.");
          break;
        case 'PROMOTE_ADMIN':
          await updateDoc(userRef, { role: 'ADMIN' });
          await logAction('PROMOTE_ADMIN', selectedUser.id, `Thăng cấp lên Admin`);
          toast.success("Đã thăng cấp Admin.");
          break;
        case 'PROMOTE_MOD':
          await updateDoc(userRef, {
            moderatorInviteStatus: 'PENDING',
            updatedAt: new Date().toISOString()
          });
          await addDoc(collection(db, 'notifications'), {
            userId: selectedUser.id,
            recipientId: selectedUser.id,
            type: 'MODERATOR_INVITE',
            title: 'Lời mời làm Moderator',
            message: `Quản trị viên ${currentUser?.displayName || 'Admin'} đã gửi lời mời bạn trở thành Moderator của hệ thống.`,
            read: false,
            createdAt: new Date().toISOString()
          });
          await logAction('INVITE_MODERATOR', selectedUser.id, `Gửi lời mời làm Moderator`);
          toast.success("Đã gửi lời mời làm Moderator!");
          break;
        case 'DEMOTE':
          await updateDoc(userRef, { role: selectedUser.creatorStatus ? 'CREATOR' : 'USER' });
          await logAction('DEMOTE_STAFF', selectedUser.id, `Hủy quyền quản trị/kiểm duyệt`);
          toast.success("Đã hủy quyền.");
          break;
      }
      
      setIsModalOpen(false);
      setReason('');
      setRestrictedActivities([]);
      fetchUsers();
    } catch (err) {
      console.error("Action error:", err);
      toast.error("Đã xảy ra lỗi.");
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      u.displayName?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.role?.toLowerCase().includes(search.toLowerCase()) ||
      (u.numericId && u.numericId.toString().includes(search));

    if (!matchesSearch) return false;

    if (filterTab === 'ACTIVE') {
      return !u.isDeleted && !u.isLocked && (!u.restrictedActivities || u.restrictedActivities.length === 0);
    }
    if (filterTab === 'SUSPENDED') {
      return !u.isDeleted && (u.isLocked || (u.restrictedActivities && u.restrictedActivities.length > 0));
    }
    if (filterTab === 'DELETED') {
      return u.isDeleted === true || u.status === 'DELETED';
    }

    return true;
  });

  const activeCount = users.filter(u => !u.isDeleted && !u.isLocked && (!u.restrictedActivities || u.restrictedActivities.length === 0)).length;
  const suspendedCount = users.filter(u => !u.isDeleted && (u.isLocked || (u.restrictedActivities && u.restrictedActivities.length > 0))).length;
  const deletedCount = users.filter(u => u.isDeleted === true || u.status === 'DELETED').length;

  const openModal = (user: CreatorItem, type: ActionType) => {
    setSelectedUser(user);
    setActionType(type);
    setIsModalOpen(true);
    setReason('');
    setDuration('7');
    setRestrictedActivities([]);
    if (type === 'HISTORY') {
      fetchUserHistory(user.id);
    }
  };

  const toggleActivity = (act: string) => {
    setRestrictedActivities(prev => 
      prev.includes(act) ? prev.filter(a => a !== act) : [...prev, act]
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-8 animate-in fade-in duration-500">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-black tracking-tight uppercase">Quản Lý Thành Viên</h1>
            <p className="text-sm text-neutral-500 font-medium">Danh sách toàn bộ người dùng, Creator, Admin, Moderator và tài khoản đã xóa.</p>
          </div>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input 
              type="text"
              placeholder="Tìm kiếm thành viên..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full md:w-80 pl-11 pr-4 py-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all shadow-sm"
            />
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 p-1.5 bg-neutral-100 dark:bg-neutral-800/50 rounded-2xl w-fit">
          <button
            onClick={() => setFilterTab('ALL')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
              filterTab === 'ALL'
                ? 'bg-white dark:bg-neutral-900 text-black dark:text-white shadow-sm'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            Tất cả ({users.length})
          </button>
          <button
            onClick={() => setFilterTab('ACTIVE')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
              filterTab === 'ACTIVE'
                ? 'bg-white dark:bg-neutral-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Hoạt động ({activeCount})
          </button>
          <button
            onClick={() => setFilterTab('SUSPENDED')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
              filterTab === 'SUSPENDED'
                ? 'bg-white dark:bg-neutral-900 text-amber-600 dark:text-amber-400 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            Đình chỉ / Giới hạn ({suspendedCount})
          </button>
          <button
            onClick={() => setFilterTab('DELETED')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
              filterTab === 'DELETED'
                ? 'bg-white dark:bg-neutral-900 text-red-600 dark:text-red-400 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            Đã xóa ({deletedCount})
          </button>
        </div>

        {/* User Table */}
        <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/20">
                  <th className="p-6 text-xs font-black uppercase tracking-widest text-neutral-400">Thành viên</th>
                  <th className="p-6 text-xs font-black uppercase tracking-widest text-neutral-400">Vai trò / Cấp bậc</th>
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
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-neutral-500 font-medium">
                      Không tìm thấy thành viên nào.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map(u => (
                    <tr key={u.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                      <td className="p-6">
                        <div className="flex items-center gap-4">
                          <img 
                            src={getValidAvatar(u.avatar)} 
                            alt={u.displayName}
                            className={`w-12 h-12 rounded-full object-cover border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 ${
                              u.isDeleted ? 'grayscale opacity-60' : ''
                            }`}
                          />
                          <div>
                            <div className="font-bold text-sm flex items-center gap-2">
                              <span className={u.isDeleted ? 'line-through text-neutral-400' : ''}>{u.displayName}</span>
                              {u.role === 'ADMIN' && <ShieldCheck className="w-3 h-3 text-red-500" />}
                              {(u.role === 'MODERATOR' || u.role === 'MOD') && !u.creatorStatus && <Shield className="w-3 h-3 text-amber-500" />}
                              {u.creatorStatus && <BadgeCheck className="w-3 h-3 text-blue-500" />}
                            </div>
                            <div className="text-xs text-neutral-500 font-mono">
                              {u.email ? u.email.replace(/(.{2})(.*)(@.*)/, '$1••••••$3') : `ID: ${u.numericId || u.id}`}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-6">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                          u.role === 'ADMIN' ? 'bg-red-500/10 text-red-500' :
                          u.creatorStatus ? 'bg-blue-500/10 text-blue-500' :
                          u.role === 'MODERATOR' ? 'bg-amber-500/10 text-amber-500' :
                          'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                        }`}>
                          {u.role === 'ADMIN' ? 'Admin' : u.creatorStatus ? 'Creator' : u.role === 'MODERATOR' ? 'Moderator' : 'User'}
                        </span>
                      </td>
                      <td className="p-6">
                        <div className="flex flex-col gap-1">
                          {u.isDeleted || u.status === 'DELETED' ? (
                            <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 px-2.5 py-1 rounded-lg border border-red-200 dark:border-red-500/20 w-fit">
                              <Trash2 className="w-3 h-3" /> Đã xóa / Vô hiệu
                            </span>
                          ) : u.isLocked ? (
                            <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10 px-2.5 py-1 rounded-lg border border-orange-200 dark:border-orange-500/20 w-fit">
                              <Lock className="w-3 h-3" /> Bị đình chỉ
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-500/20 w-fit">
                              <Unlock className="w-3 h-3" /> Hoạt động
                            </span>
                          )}
                          {!u.isDeleted && u.restrictedActivities && u.restrictedActivities.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-amber-500">
                              <AlertTriangle className="w-3 h-3" /> Bị giới hạn ({u.restrictedActivities.length})
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-6 text-right relative">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(activeMenuId === u.id ? null : u.id);
                          }}
                          className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors"
                        >
                          <MoreVertical className="w-5 h-5 text-neutral-500" />
                        </button>

                        {/* Dropdown Menu */}
                        {activeMenuId === u.id && (
                          <div className="absolute right-6 top-16 w-56 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl z-10 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
                               onClick={(e) => e.stopPropagation()}>
                            <div className="p-2 flex flex-col gap-1">
                              {/* If account is DELETED */}
                              {u.isDeleted ? (
                                <>
                                  <button 
                                    onClick={() => { openModal(u, 'RESTORE'); setActiveMenuId(null); }}
                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 rounded-xl text-xs font-bold transition-colors text-left"
                                  >
                                    <Unlock className="w-4 h-4" /> Khôi phục tài khoản
                                  </button>
                                  <button 
                                    onClick={() => { openModal(u, 'HISTORY'); setActiveMenuId(null); }}
                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-xl text-xs font-bold transition-colors text-left"
                                  >
                                    <History className="w-4 h-4" /> Lịch sử hoạt động
                                  </button>
                                </>
                              ) : (
                                <>
                                  {u.creatorStatus && (
                                    <button 
                                      onClick={() => { navigate(`/creator/${u.id}`); setActiveMenuId(null); }}
                                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-xl text-xs font-bold transition-colors text-left"
                                    >
                                      <User className="w-4 h-4" /> Xem Profile
                                    </button>
                                  )}
                                  
                                  <button 
                                    onClick={() => { openModal(u, 'HISTORY'); setActiveMenuId(null); }}
                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-xl text-xs font-bold transition-colors text-left"
                                  >
                                    <History className="w-4 h-4" /> Lịch sử hoạt động
                                  </button>
                                  
                                  <div className="h-px bg-neutral-100 dark:bg-neutral-800 my-1"></div>

                                  {!u.isLocked ? (
                                    <button 
                                      onClick={() => { openModal(u, 'SUSPEND'); setActiveMenuId(null); }}
                                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-orange-500/10 text-orange-600 dark:text-orange-500 rounded-xl text-xs font-bold transition-colors text-left"
                                    >
                                      <Ban className="w-4 h-4" /> Đình chỉ tài khoản
                                    </button>
                                  ) : (
                                    <button 
                                      onClick={() => { openModal(u, 'UNSUSPEND'); setActiveMenuId(null); }}
                                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 rounded-xl text-xs font-bold transition-colors text-left"
                                    >
                                      <Unlock className="w-4 h-4" /> Mở khóa tài khoản
                                    </button>
                                  )}
                                  
                                  {u.restrictedActivities && u.restrictedActivities.length > 0 ? (
                                    <button 
                                      onClick={() => { openModal(u, 'LIFT_RESTRICTION'); setActiveMenuId(null); }}
                                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 rounded-xl text-xs font-bold transition-colors text-left"
                                    >
                                      <ShieldCheck className="w-4 h-4" /> Gỡ giới hạn hoạt động
                                    </button>
                                  ) : (
                                    <button 
                                      onClick={() => { openModal(u, 'RESTRICT'); setActiveMenuId(null); }}
                                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-amber-500/10 text-amber-600 dark:text-amber-500 rounded-xl text-xs font-bold transition-colors text-left"
                                    >
                                      <EyeOff className="w-4 h-4" /> Giới hạn hoạt động
                                    </button>
                                  )}

                                  {u.creatorStatus && (
                                    <button 
                                      onClick={() => { openModal(u, 'REMOVE_CREATOR'); setActiveMenuId(null); }}
                                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 text-red-600 dark:text-red-500 rounded-xl text-xs font-bold transition-colors text-left"
                                    >
                                      <BadgeMinus className="w-4 h-4" /> Hủy quyền Creator
                                    </button>
                                  )}

                                  {isAdmin && (
                                    <>
                                      <div className="h-px bg-neutral-100 dark:bg-neutral-800 my-1"></div>

                                      <button 
                                        onClick={() => { openModal(u, 'DELETE'); setActiveMenuId(null); }}
                                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 text-red-600 dark:text-red-500 rounded-xl text-xs font-bold transition-colors text-left"
                                      >
                                        <Trash2 className="w-4 h-4" /> Xóa tài khoản
                                      </button>
                                      
                                      {u.role !== 'ADMIN' && (
                                        <button 
                                          onClick={() => { openModal(u, 'PROMOTE_ADMIN'); setActiveMenuId(null); }}
                                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 rounded-xl text-xs font-bold transition-colors text-left"
                                        >
                                          <ShieldAlert className="w-4 h-4" /> Chỉ định Admin
                                        </button>
                                      )}

                                      {u.role !== 'MODERATOR' && u.role !== 'ADMIN' && (
                                        <button 
                                          onClick={() => { openModal(u, 'PROMOTE_MOD'); setActiveMenuId(null); }}
                                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-500/10 text-blue-600 dark:text-blue-500 rounded-xl text-xs font-bold transition-colors text-left"
                                        >
                                          <ShieldPlus className="w-4 h-4" /> Chỉ định Moderator
                                        </button>
                                      )}

                                      {(u.role === 'ADMIN' || u.role === 'MODERATOR') && u.id !== currentUser?.id && (
                                        <button 
                                          onClick={() => { openModal(u, 'DEMOTE'); setActiveMenuId(null); }}
                                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 text-red-600 dark:text-red-500 rounded-xl text-xs font-bold transition-colors text-left"
                                        >
                                          <UserMinus className="w-4 h-4" /> Hủy quyền Quản trị
                                        </button>
                                      )}
                                    </>
                                  )}
                                </>
                              )}

                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal for Actions */}
        {isModalOpen && selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in zoom-in duration-300">
            <div className="bg-white dark:bg-neutral-900 rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl border border-neutral-200 dark:border-neutral-800 flex flex-col max-h-[90vh]">
              <div className="p-8 space-y-6 overflow-y-auto scrollbar-thin">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="text-xl font-black tracking-tight uppercase">
                      {actionType === 'DELETE' && 'Xóa Tài Khoản'}
                      {actionType === 'RESTORE' && 'Khôi Phục Tài Khoản'}
                      {actionType === 'SUSPEND' && 'Đình Chỉ Thành Viên'}
                      {actionType === 'UNSUSPEND' && 'Mở Khóa Tài Khoản'}
                      {actionType === 'RESTRICT' && 'Giới Hạn Hoạt Động'}
                      {actionType === 'LIFT_RESTRICTION' && 'Gỡ Giới Hạn Hoạt Động'}
                      {actionType === 'REMOVE_CREATOR' && 'Hủy Quyền Creator'}
                      {actionType === 'PROMOTE_ADMIN' && 'Chỉ Định Admin'}
                      {actionType === 'PROMOTE_MOD' && 'Chỉ Định Moderator'}
                      {actionType === 'DEMOTE' && 'Hủy Quyền Quản Trị'}
                      {actionType === 'HISTORY' && 'Lịch Sử Hoạt Động'}
                    </h3>
                    <p className="text-xs text-neutral-500 font-bold uppercase tracking-widest font-mono">
                      {selectedUser.displayName} ({selectedUser.email ? selectedUser.email.replace(/(.{2})(.*)(@.*)/, '$1••••••$3') : `ID: ${selectedUser.numericId || selectedUser.id}`})
                    </p>
                  </div>
                  <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {actionType === 'HISTORY' ? (
                  <div className="space-y-4">
                    {userHistory.length === 0 ? (
                      <p className="text-center py-8 text-neutral-500 font-medium">Chưa có lịch sử hoạt động.</p>
                    ) : (
                      userHistory.map((log, i) => (
                        <div key={i} className="p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl border border-neutral-100 dark:border-neutral-800 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{log.action}</span>
                            <span className="text-[10px] text-neutral-500">{new Date(log.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="text-xs font-bold">{log.details}</p>
                          {log.reason && <p className="text-[10px] text-neutral-500 bg-white dark:bg-neutral-900 p-2 rounded-lg border border-neutral-100 dark:border-neutral-800 italic">Lý do: {log.reason}</p>}
                          <p className="text-[10px] text-neutral-400">Thực hiện bởi: {log.executorName}</p>
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {(actionType === 'SUSPEND' || actionType === 'RESTRICT') && (
                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-neutral-500">Thời gian áp dụng</label>
                        <select 
                          value={duration} 
                          onChange={(e) => setDuration(e.target.value)}
                          className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-2xl text-sm focus:outline-none"
                        >
                          <option value="1">1 ngày</option>
                          <option value="3">3 ngày</option>
                          <option value="7">7 ngày</option>
                          <option value="14">14 ngày</option>
                          <option value="30">30 ngày</option>
                          <option value="365">1 năm</option>
                        </select>
                      </div>
                    )}

                    {actionType === 'RESTRICT' && (
                      <div className="space-y-3">
                        <label className="text-xs font-black uppercase tracking-widest text-neutral-500">Chọn hoạt động giới hạn</label>
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { id: 'POST_CHARACTER', label: 'Đăng Character' },
                            { id: 'POST_PROMPT', label: 'Đăng Prompt' },
                            { id: 'POST_FEEDBACK', label: 'Gửi Feedback' },
                            { id: 'POST_COMMENT', label: 'Bình luận' },
                          ].map(act => (
                            <label key={act.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                              restrictedActivities.includes(act.id) 
                                ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30' 
                                : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800'
                            }`}>
                              <input 
                                type="checkbox"
                                checked={restrictedActivities.includes(act.id)}
                                onChange={() => toggleActivity(act.id)}
                                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                              />
                              <span className="text-xs font-bold">{act.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-neutral-500">
                        {actionType === 'DELETE' 
                          ? 'Lý do xóa / vô hiệu hóa tài khoản' 
                          : actionType === 'RESTORE'
                          ? 'Lý do khôi phục tài khoản'
                          : 'Lý do cụ thể'}
                      </label>
                      <textarea 
                        rows={3}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder={
                          actionType === 'DELETE' 
                            ? 'Nhập lý do xóa/vô hiệu hóa tài khoản (sẽ hiển thị cho người dùng)...' 
                            : actionType === 'RESTORE'
                            ? 'Nhập lý do khôi phục tài khoản (sẽ gửi thông báo cho người dùng)...'
                            : 'Nhập lý do chi tiết...'
                        }
                        className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-2xl text-sm focus:outline-none resize-none"
                      />
                    </div>

                    {actionType === 'DELETE' && (
                      <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-2xl">
                        <p className="text-xs text-red-600 dark:text-red-400 font-medium leading-relaxed">
                          Hành động này sẽ <strong>vô hiệu hóa tài khoản vĩnh viễn</strong> và ngăn chặn mọi tương tác của người dùng. Tài khoản vẫn được lưu trữ an toàn trong hệ thống để người dùng có thể xem lý do xử lý và gửi Kháng nghị (Appeal) nếu cần.
                        </p>
                      </div>
                    )}

                    {actionType === 'RESTORE' && (
                      <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl">
                        <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium leading-relaxed">
                          Xác nhận khôi phục tài khoản này về trạng thái <strong>Hoạt động</strong> bình thường? Mọi giới hạn và trạng thái đã xóa sẽ được gỡ bỏ ngay lập tức.
                        </p>
                      </div>
                    )}

                    <div className="pt-4 flex gap-4">
                      <button 
                        onClick={() => setIsModalOpen(false)}
                        className="flex-1 px-6 py-4 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white font-black text-xs rounded-2xl transition-all uppercase tracking-widest"
                      >
                        Hủy
                      </button>
                      <button 
                        onClick={handleAction}
                        className={`flex-1 px-6 py-4 font-black text-xs rounded-2xl transition-all shadow-xl uppercase tracking-widest ${
                          ['DELETE', 'SUSPEND', 'REMOVE_CREATOR', 'DEMOTE'].includes(actionType) ? 'bg-red-600 text-white shadow-red-600/20 hover:bg-red-700' :
                          actionType === 'RESTRICT' ? 'bg-amber-500 text-white shadow-amber-500/20 hover:bg-amber-600' :
                          actionType === 'RESTORE' ? 'bg-emerald-600 text-white shadow-emerald-600/20 hover:bg-emerald-700' :
                          'bg-black dark:bg-white text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200'
                        }`}
                      >
                        Xác Nhận
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
