import React, { useState, useEffect } from 'react';
import AdminLayout from './AdminLayout';
import { 
  Clock, Search, Filter, Shield, User, 
  Sparkles, FileText, AlertTriangle, ArrowRight,
  ChevronLeft, ChevronRight, Download
} from 'lucide-react';
import { 
  collection, query, getDocs, 
  orderBy, limit, startAfter, where 
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import toast from 'react-hot-toast';
import { AuditLogItem } from '../../types';

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('ALL');
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    fetchLogs(true);
  }, [filter]);

  const fetchLogs = async (isNew: boolean = false) => {
    setLoading(true);
    try {
      let q = query(
        collection(db, 'audit_logs'), 
        orderBy('createdAt', 'desc'),
        limit(20)
      );

      if (filter !== 'ALL') {
        q = query(q, where('action', '==', filter));
      }

      if (!isNew && lastDoc) {
        q = query(q, startAfter(lastDoc));
      }

      const snap = await getDocs(q);
      const newLogs = snap.docs.map(d => ({ id: d.id, ...d.data() }) as AuditLogItem);
      
      if (isNew) {
        setLogs(newLogs);
        setPage(1);
      } else {
        setLogs([...logs, ...newLogs]);
        setPage(page + 1);
      }

      setLastDoc(snap.docs[snap.docs.length - 1]);
      setHasMore(snap.docs.length === 20);
    } catch (err) {
      console.error("Error fetching logs:", err);
      toast.error("Không thể tải nhật ký hoạt động.");
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (action: string) => {
    if (action.includes('DELETE') || action.includes('BAN')) return 'text-red-500 bg-red-500/10 border-red-500/20';
    if (action.includes('LOCK') || action.includes('STRIKE')) return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
    if (action.includes('CREATE') || action.includes('ADD')) return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
    return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
  };

  return (
    <AdminLayout>
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-black tracking-tighter">Nhật Ký Hoạt Động (Audit Log)</h1>
            <p className="text-sm text-neutral-500 font-medium">Lịch sử không thể xóa về các hành động của Quản trị viên.</p>
          </div>
          <div className="flex items-center gap-3">
            <select 
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-4 py-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl text-xs font-black uppercase tracking-widest focus:outline-none"
            >
              <option value="ALL">Tất Cả Hành Động</option>
              <option value="DELETE_USER">Xóa Tài Khoản</option>
              <option value="SUSPEND_USER">Đình Chỉ Thành Viên</option>
              <option value="RESTRICT_USER">Giới Hạn Hoạt Động</option>
              <option value="REMOVE_CREATOR">Hủy Quyền Creator</option>
              <option value="APPROVE_CREATOR">Duyệt Creator</option>
              <option value="REJECT_CREATOR">Từ Chối Creator</option>
              <option value="PROMOTE_ADMIN">Thăng Cấp Admin</option>
              <option value="INVITE_MODERATOR">Mời Moderator</option>
              <option value="DEMOTE_STAFF">Hủy Quyền Quản Trị</option>
              <option value="UPDATE_STAFF_ROLE">Cập Nhật Vai Trò Staff</option>
              <option value="ADD_BADGE">Cấp Huy Hiệu</option>
              <option value="REMOVE_BADGE">Gỡ Huy Hiệu</option>
              <option value="HIDE_CHARACTER">Ẩn Character</option>
              <option value="HIDE_PROMPT">Ẩn Prompt</option>
              <option value="HIDE_COMMENT">Ẩn Bình Luận</option>
              <option value="HIDE_FEEDBACK">Ẩn Feedback</option>
              <option value="RESOLVE_REPORT">Xử Lý Báo Cáo</option>
              <option value="RESOLVE_SUPPORT">Xử Lý Hỗ Trợ</option>
            </select>
            <button className="p-3 bg-neutral-900 dark:bg-white text-white dark:text-black rounded-2xl shadow-lg hover:opacity-90 transition-opacity">
              <Download className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-[2rem] border border-neutral-200 dark:border-neutral-800 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-100 dark:border-neutral-800">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-500">Thời Gian</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-500">Quản Trị Viên</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-500">Hành Động</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-500">Đối Tượng</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-500">Chi Tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50 dark:divide-neutral-800/50">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/10 transition-colors">
                    <td className="px-6 py-5 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-[11px] font-bold">{new Date(log.createdAt).toLocaleDateString('vi-VN')}</span>
                        <span className="text-[10px] text-neutral-400 font-medium">{new Date(log.createdAt).toLocaleTimeString('vi-VN')}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                          <Shield className="w-4 h-4 text-neutral-400" />
                        </div>
                        <div>
                          <p className="text-xs font-bold">{log.executorName}</p>
                          <p className="text-[9px] text-neutral-500 font-black uppercase tracking-widest">{log.executorRole}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded text-neutral-500">{log.targetType}</span>
                        <span className="text-[10px] text-neutral-400 font-medium font-mono">{log.targetId.substring(0, 8)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 max-w-xs">
                      <div className="space-y-1">
                        <p className="text-xs font-bold truncate" title={log.details}>{log.details}</p>
                        {log.reason && (
                          <p className="text-[10px] text-neutral-500 italic line-clamp-1">Lý do: {log.reason}</p>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {hasMore && (
            <div className="p-6 text-center border-t border-neutral-100 dark:border-neutral-800">
              <button 
                onClick={() => fetchLogs()}
                disabled={loading}
                className="px-6 py-2 text-[10px] font-black uppercase tracking-widest text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors"
              >
                {loading ? 'Đang Tải...' : 'Xem Thêm Kết Quả'}
              </button>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
