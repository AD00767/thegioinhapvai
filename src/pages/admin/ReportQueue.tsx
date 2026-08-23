import React, { useState, useEffect } from 'react';
import AdminLayout from './AdminLayout';
import { 
  AlertTriangle, CheckCircle, XCircle, Clock, 
  ExternalLink, Trash2, Eye, Filter, MoreVertical,
  MessageSquare, User, ShieldAlert, FileText, UserX,
  X, Mail, Calendar, BadgeCheck, Sparkles
} from 'lucide-react';
import { 
  collection, query, getDocs, doc, updateDoc, 
  orderBy, where, serverTimestamp, getDoc, addDoc 
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/useAuthStore';
import toast from 'react-hot-toast';
import { ReportItem } from '../../types';
import { Link } from 'react-router-dom';
import DeleteConfirmModal from '../../components/DeleteConfirmModal';
import { getValidAvatar, DEFAULT_AVATAR } from '../../lib/avatar';

interface UserDetail {
  id: string;
  numericId: string;
  displayName: string;
  avatar: string;
  email?: string;
  role?: string;
  creatorStatus?: boolean;
  bio?: string;
  createdAt?: string;
  status?: string;
  suspendedUntil?: string;
}

interface TargetContentInfo {
  id: string;
  numericId?: string;
  name?: string;
  slogan?: string;
  content?: string;
  parentTargetId?: string;
  parentTargetType?: string;
  authorId?: string;
}

async function fetchUserData(userId: string): Promise<UserDetail | null> {
  if (!userId) return null;
  try {
    // 1. Try fetching directly by doc ID
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const d = userSnap.data();
      const rawAvatar = d.avatar || d.photoURL || d.photoUrl || d.avatarUrl || '';
      return {
        id: userSnap.id,
        numericId: d.numericId || userSnap.id.substring(0, 9),
        displayName: d.displayName || d.name || 'Người dùng',
        avatar: getValidAvatar(rawAvatar),
        email: d.email || '',
        role: d.role || 'USER',
        creatorStatus: d.creatorStatus || false,
        bio: d.bio || '',
        createdAt: d.createdAt || '',
        status: d.status || 'ACTIVE',
        suspendedUntil: d.suspendedUntil || ''
      };
    }

    // 2. Try querying by numericId
    const q = query(collection(db, 'users'), where('numericId', '==', userId));
    const qSnap = await getDocs(q);
    if (!qSnap.empty) {
      const docItem = qSnap.docs[0];
      const d = docItem.data();
      const rawAvatar = d.avatar || d.photoURL || d.photoUrl || d.avatarUrl || '';
      return {
        id: docItem.id,
        numericId: d.numericId || docItem.id.substring(0, 9),
        displayName: d.displayName || d.name || 'Người dùng',
        avatar: getValidAvatar(rawAvatar),
        email: d.email || '',
        role: d.role || 'USER',
        creatorStatus: d.creatorStatus || false,
        bio: d.bio || '',
        createdAt: d.createdAt || '',
        status: d.status || 'ACTIVE',
        suspendedUntil: d.suspendedUntil || ''
      };
    }

    // 3. Try querying by uid
    const qUid = query(collection(db, 'users'), where('uid', '==', userId));
    const uidSnap = await getDocs(qUid);
    if (!uidSnap.empty) {
      const docItem = uidSnap.docs[0];
      const d = docItem.data();
      const rawAvatar = d.avatar || d.photoURL || d.photoUrl || d.avatarUrl || '';
      return {
        id: docItem.id,
        numericId: d.numericId || docItem.id.substring(0, 9),
        displayName: d.displayName || d.name || 'Người dùng',
        avatar: getValidAvatar(rawAvatar),
        email: d.email || '',
        role: d.role || 'USER',
        creatorStatus: d.creatorStatus || false,
        bio: d.bio || '',
        createdAt: d.createdAt || '',
        status: d.status || 'ACTIVE',
        suspendedUntil: d.suspendedUntil || ''
      };
    }
  } catch (e) {
    console.error("fetchUserData error:", e);
  }
  return null;
}

export default function ReportQueue() {
  const { user: currentUser } = useAuthStore();
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'PENDING' | 'RESOLVED' | 'REJECTED'>('PENDING');
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);
  const [note, setNote] = useState('');
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  // Target content & User details state
  const [reporterUser, setReporterUser] = useState<UserDetail | null>(null);
  const [reportedUser, setReportedUser] = useState<UserDetail | null>(null);
  const [targetContentInfo, setTargetContentInfo] = useState<TargetContentInfo | null>(null);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);

  // Viewing user profile modal inside Report Queue page
  const [viewingProfileUser, setViewingProfileUser] = useState<UserDetail | null>(null);

  useEffect(() => {
    fetchReports();
  }, [filter]);

  // Fetch target content details and real user documents whenever selectedReport changes
  useEffect(() => {
    if (!selectedReport) {
      setReporterUser(null);
      setReportedUser(null);
      setTargetContentInfo(null);
      return;
    }

    const loadReportDetails = async () => {
      setLoadingDetails(true);
      try {
        // 1. Fetch Reporter User
        let reporter: UserDetail | null = null;
        if (selectedReport.reporterId) {
          reporter = await fetchUserData(selectedReport.reporterId);
        }
        if (!reporter) {
          reporter = {
            id: selectedReport.reporterId || '',
            numericId: selectedReport.reporterId ? selectedReport.reporterId.substring(0, 9) : '000000000',
            displayName: selectedReport.reporterName || 'Người gửi báo cáo',
            avatar: ''
          };
        }
        setReporterUser(reporter);

        // 2. Fetch Target Content & determine reportedUserId (Owner)
        let contentInfo: TargetContentInfo | null = null;
        let reportedUserId: string | null = null;

        if (selectedReport.targetType === 'CREATOR') {
          reportedUserId = selectedReport.targetId;
          contentInfo = {
            id: selectedReport.targetId,
            name: selectedReport.targetName || 'Creator'
          };
        } else if (selectedReport.targetType === 'CHARACTER') {
          const charSnap = await getDoc(doc(db, 'characters', selectedReport.targetId));
          if (charSnap.exists()) {
            const d = charSnap.data();
            reportedUserId = d.creatorId || d.userId;
            contentInfo = {
              id: charSnap.id,
              numericId: d.numericId,
              name: d.name,
              slogan: d.slogan,
              authorId: reportedUserId || undefined
            };
          } else {
            contentInfo = { id: selectedReport.targetId, name: selectedReport.targetName || 'Character' };
          }
        } else if (selectedReport.targetType === 'PROMPT') {
          const promptSnap = await getDoc(doc(db, 'prompts', selectedReport.targetId));
          if (promptSnap.exists()) {
            const d = promptSnap.data();
            reportedUserId = d.authorId || d.userId || d.creatorId;
            contentInfo = {
              id: promptSnap.id,
              numericId: d.numericId,
              name: d.name,
              content: d.content || d.purpose,
              authorId: reportedUserId || undefined
            };
          } else {
            contentInfo = { id: selectedReport.targetId, name: selectedReport.targetName || 'Prompt' };
          }
        } else if (selectedReport.targetType === 'FEEDBACK') {
          const fbSnap = await getDoc(doc(db, 'feedbacks', selectedReport.targetId));
          if (fbSnap.exists()) {
            const d = fbSnap.data();
            reportedUserId = d.senderId || d.authorId || d.userId;
            contentInfo = {
              id: fbSnap.id,
              name: d.title || 'Feedback',
              content: d.content,
              authorId: reportedUserId || undefined
            };
          } else {
            contentInfo = { id: selectedReport.targetId, name: selectedReport.targetName || 'Feedback' };
          }
        } else if (selectedReport.targetType === 'COMMENT') {
          const commentSnap = await getDoc(doc(db, 'comments', selectedReport.targetId));
          if (commentSnap.exists()) {
            const d = commentSnap.data();
            reportedUserId = d.authorId || d.userId;
            contentInfo = {
              id: commentSnap.id,
              content: d.content,
              parentTargetId: d.targetId,
              parentTargetType: d.targetType,
              authorId: reportedUserId || undefined
            };
          } else {
            contentInfo = { id: selectedReport.targetId, content: selectedReport.targetName || 'Bình luận' };
          }
        }

        setTargetContentInfo(contentInfo);

        // 3. Fetch Reported User
        let reported: UserDetail | null = null;
        if (reportedUserId) {
          reported = await fetchUserData(reportedUserId);
        }
        if (!reported && reportedUserId) {
          reported = {
            id: reportedUserId,
            numericId: reportedUserId.substring(0, 9),
            displayName: contentInfo?.name || 'Tác giả nội dung',
            avatar: ''
          };
        }
        setReportedUser(reported);

      } catch (err) {
        console.error("Error loading report details:", err);
      } finally {
        setLoadingDetails(false);
      }
    };

    loadReportDetails();
  }, [selectedReport?.id, selectedReport?.targetId, selectedReport?.targetType]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'reports'));
      let list = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }) as ReportItem);
      
      // Client side sort
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

      if (filter === 'PENDING') {
        list = list.filter(r => (r.status as string) === 'PENDING' || (r.status as string) === 'REVIEWING' || (r.status as string) === 'PROCESSING' || (r.status as string) === 'IN_PROGRESS');
      } else if (filter === 'RESOLVED') {
        list = list.filter(r => r.status === 'RESOLVED');
      } else if (filter === 'REJECTED') {
        list = list.filter(r => r.status === 'REJECTED' || r.status === 'DISMISSED');
      }

      setReports(list);
    } catch (err) {
      console.error("Error fetching reports:", err);
      toast.error("Không thể tải danh sách báo cáo.");
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async (reportId: string) => {
    if (!currentUser) return;
    try {
      const reportRef = doc(db, 'reports', reportId);
      const docSnap = await getDoc(reportRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.claimedBy && data.claimedBy !== currentUser.id) {
          toast.error(`Báo cáo đã được nhận xử lý trước bởi ${data.claimedByName || data.claimedBy}`);
          fetchReports();
          return;
        }
      }

      await updateDoc(reportRef, {
        status: 'IN_PROGRESS',
        claimedBy: currentUser.id,
        claimedByName: currentUser.displayName,
        claimedAt: new Date().toISOString()
      });

      toast.success("Đã nhận xử lý báo cáo này!");
      fetchReports();
      if (selectedReport && selectedReport.id === reportId) {
        setSelectedReport(prev => prev ? { 
          ...prev, 
          status: 'IN_PROGRESS', 
          claimedBy: currentUser.id, 
          claimedByName: currentUser.displayName,
          claimedAt: new Date().toISOString()
        } as any : null);
      }
    } catch (err) {
      console.error("Claim report error:", err);
      toast.error("Không thể nhận xử lý báo cáo.");
    }
  };

  const handleUnclaim = async (reportId: string) => {
    try {
      const reportRef = doc(db, 'reports', reportId);
      await updateDoc(reportRef, {
        status: 'PENDING',
        claimedBy: null,
        claimedByName: null,
        claimedAt: null
      });

      toast.success("Đã hủy nhận xử lý báo cáo.");
      fetchReports();
      if (selectedReport && selectedReport.id === reportId) {
        setSelectedReport(prev => prev ? { 
          ...prev, 
          status: 'PENDING', 
          claimedBy: undefined, 
          claimedByName: undefined,
          claimedAt: undefined
        } as any : null);
      }
    } catch (err) {
      console.error("Unclaim report error:", err);
      toast.error("Không thể hủy nhận xử lý.");
    }
  };

  const handleDismiss = async () => {
    if (!selectedReport || !currentUser) return;

    const dismissNote = note.trim() || 'Nội dung không vi phạm tiêu chuẩn cộng đồng.';

    try {
      const reportRef = doc(db, 'reports', selectedReport.id);
      await updateDoc(reportRef, {
        status: 'REJECTED',
        moderatorId: currentUser.id,
        moderatorNote: dismissNote,
        resolvedAt: serverTimestamp()
      });

      // Audit Log
      await addDoc(collection(db, 'audit_logs'), {
        executorId: currentUser.id,
        executorName: currentUser.displayName,
        executorRole: currentUser.role,
        action: 'DISMISS_REPORT',
        targetId: selectedReport.id,
        targetType: 'REPORT',
        details: `Bỏ qua báo cáo vi phạm ${selectedReport.id}. Ghi chú: ${dismissNote}`,
        reason: dismissNote,
        createdAt: new Date().toISOString()
      });

      toast.success("Đã bỏ qua báo cáo!");
      setSelectedReport(null);
      setNote('');
      fetchReports();
    } catch (err) {
      console.error("Dismiss report error:", err);
      toast.error("Thao tác thất bại.");
    }
  };

  const handleDeleteContentClick = () => {
    if (!note.trim()) {
      toast.error("Vui lòng nhập lý do xử lý trước khi xóa!");
      return;
    }
    setIsDeleteConfirmOpen(true);
  };

  const executeDeleteContent = async (reasonFromModal?: string, detailsFromModal?: string) => {
    if (!selectedReport || !currentUser) return;

    const removalReasonText = reasonFromModal || note.trim();
    const removalDetailsText = detailsFromModal || note.trim() || selectedReport.description || "Nội dung vi phạm quy định cộng đồng.";

    if (!removalReasonText) {
      toast.error("Vui lòng nhập lý do xóa.");
      return;
    }

    try {
      const collectionName = 
        selectedReport.targetType === 'CHARACTER' ? 'characters' : 
        selectedReport.targetType === 'PROMPT' ? 'prompts' : 
        selectedReport.targetType === 'FEEDBACK' ? 'feedbacks' : 
        selectedReport.targetType === 'COMMENT' ? 'comments' : 'users';

      const targetRef = doc(db, collectionName, selectedReport.targetId);
      const targetSnap = await getDoc(targetRef);
      let ownerId = reportedUser?.id || null;
      let targetName = selectedReport.targetName || targetContentInfo?.name || 'Nội dung';

      if (targetSnap.exists()) {
        const d = targetSnap.data();
        ownerId = ownerId || d.creatorId || d.userId || d.senderId || d.authorId;
        targetName = d.name || d.title || d.message || targetName;
      }

      const now = new Date().toISOString();

      // 1. Soft Delete / Hide content
      await updateDoc(targetRef, {
        isHidden: true,
        deletedAt: now,
        deletedBy: currentUser.id,
        removalReason: removalReasonText,
        removalDetails: removalDetailsText,
        removalTime: now,
        appealStatus: 'NONE'
      });

      // 2. Audit Log
      await addDoc(collection(db, 'audit_logs'), {
        executorId: currentUser.id,
        executorName: currentUser.displayName,
        executorRole: currentUser.role,
        action: `HIDE_${selectedReport.targetType}`,
        targetId: selectedReport.targetId,
        targetType: selectedReport.targetType,
        details: `Gỡ bỏ nội dung bị báo cáo: ${selectedReport.targetId}. Lý do: ${removalReasonText}`,
        reason: removalReasonText,
        createdAt: now
      });

      // 3. Update Report Status
      await updateDoc(doc(db, 'reports', selectedReport.id), {
        status: 'RESOLVED',
        moderatorId: currentUser.id,
        moderatorNote: removalReasonText,
        resolvedAt: serverTimestamp()
      });

      // 4. Send Notification ONLY to Reported User (Owner)
      if (ownerId) {
        await addDoc(collection(db, 'notifications'), {
          userId: ownerId,
          recipientId: ownerId,
          type: 'CONTENT_REMOVED',
          title: `Nội dung "${targetName}" đã bị gỡ/ẩn`,
          message: `Nội dung của bạn đã bị gỡ do: ${removalReasonText}. Nhấp vào để xem chi tiết và gửi đơn kháng nghị.`,
          targetType: selectedReport.targetType,
          targetId: selectedReport.targetId,
          targetName,
          removalReason: removalReasonText,
          removalDetails: removalDetailsText,
          removalTime: now,
          read: false,
          createdAt: now
        });
      }

      toast.success("Đã gỡ bỏ nội dung bị báo cáo và gửi thông báo cho tác giả!");
      setSelectedReport(null);
      setNote('');
      fetchReports();
    } catch (err) {
      console.error("Delete content error:", err);
      toast.error("Thao tác gỡ bỏ nội dung thất bại.");
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-black tracking-tighter">Hàng Đợi Báo Cáo</h1>
            <p className="text-sm text-neutral-500 font-medium">Xử lý các báo cáo vi phạm nội dung từ người dùng.</p>
          </div>
          <div className="flex items-center p-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm">
            {(['PENDING', 'RESOLVED', 'REJECTED'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer ${
                  filter === s 
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-black shadow-lg' 
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                {s === 'PENDING' ? 'Chờ Xử Lý' : s === 'RESOLVED' ? 'Đã Giải Quyết' : 'Đã Từ Chối'}
              </button>
            ))}
          </div>
        </div>

        <div className="w-full space-y-4">
          {/* Report List */}
          <div className="w-full space-y-4">
            {loading ? (
              Array(3).fill(0).map((_, i) => (
                <div key={i} className="h-32 bg-neutral-100 dark:bg-neutral-800 animate-pulse rounded-3xl"></div>
              ))
            ) : reports.length === 0 ? (
              <div className="text-center py-20 bg-white dark:bg-neutral-900 rounded-[2.5rem] border border-neutral-200 dark:border-neutral-800">
                <CheckCircle className="w-12 h-12 text-emerald-500/20 mx-auto mb-4" />
                <p className="text-neutral-500 font-bold uppercase tracking-widest text-xs">Tuyệt vời! Không có báo cáo nào cần xử lý.</p>
              </div>
            ) : (
              reports.map((r) => (
                <div 
                  key={r.id} 
                  onClick={() => setSelectedReport(r)}
                  className={`
                    group p-6 bg-white dark:bg-neutral-900 rounded-3xl border transition-all cursor-pointer shadow-sm hover:shadow-md
                    ${selectedReport?.id === r.id ? 'border-neutral-900 dark:border-white ring-2 ring-neutral-900/10 dark:ring-white/10' : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600'}
                  `}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${
                        r.targetType === 'CHARACTER' ? 'bg-emerald-500/10 text-emerald-500' :
                        r.targetType === 'PROMPT' ? 'bg-blue-500/10 text-blue-500' :
                        'bg-amber-500/10 text-amber-500'
                      }`}>
                        {r.targetType === 'CHARACTER' ? <User className="w-5 h-5" /> :
                         r.targetType === 'PROMPT' ? <FileText className="w-5 h-5" /> :
                         <MessageSquare className="w-5 h-5" />}
                      </div>
                      <div>
                        <h3 className="font-black text-sm uppercase tracking-tight">Báo cáo {r.targetType}</h3>
                        <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest font-mono">ID: {r.id.substring(0, 8)}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-[9px] font-black uppercase tracking-tighter px-2 py-1 rounded-lg ${
                        r.reason === 'NSFW' || r.reason === 'Hate Speech' ? 'bg-red-500/10 text-red-500' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500'
                      }`}>
                        {r.reason}
                      </span>
                      {r.claimedBy && (
                        <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400">
                          {r.claimedBy === currentUser?.id ? 'Bạn đang xử lý' : `Mod: ${r.claimedByName || 'khác'}`}
                        </span>
                      )}
                      <span className="text-[9px] text-neutral-400 font-medium">
                        {new Date(r.createdAt).toLocaleString('vi-VN')}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-2 italic mb-4 leading-relaxed">"{r.description || 'Không có mô tả chi tiết.'}"</p>
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                    <span>Người báo cáo: {r.reporterName}</span>
                    <span className="group-hover:text-neutral-900 dark:group-hover:text-white transition-colors flex items-center gap-1 font-extrabold text-amber-600 dark:text-amber-400">
                      Xem chi tiết báo cáo <ExternalLink className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Modal Xem Chi Tiết Báo Cáo - Spacious Centered Modal */}
        {selectedReport && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
            onClick={() => setSelectedReport(null)}
          >
            <div 
              className="bg-neutral-900 dark:bg-white text-white dark:text-black rounded-[2.5rem] w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-6 shadow-2xl relative border border-neutral-800 dark:border-neutral-200 animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start justify-between border-b border-white/10 dark:border-black/10 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl sm:text-2xl font-black tracking-tighter uppercase">Chi Tiết Báo Cáo</h3>
                    <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                      selectedReport.targetType === 'CHARACTER' ? 'bg-emerald-500/20 text-emerald-400 dark:text-emerald-600' :
                      selectedReport.targetType === 'PROMPT' ? 'bg-blue-500/20 text-blue-400 dark:text-blue-600' :
                      'bg-amber-500/20 text-amber-400 dark:text-amber-600'
                    }`}>
                      {selectedReport.targetType}
                    </span>
                  </div>
                  <p className="text-[10px] opacity-50 font-black uppercase tracking-[0.2em] font-mono">Mã báo cáo: {selectedReport.id}</p>
                </div>

                <button 
                  type="button"
                  onClick={() => setSelectedReport(null)}
                  className="p-2 rounded-full text-white/70 dark:text-black/70 hover:text-white dark:hover:text-black hover:bg-white/10 dark:hover:bg-black/10 transition-colors cursor-pointer"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Grid 2 Cột cho Người Báo Cáo & Tác Giả */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Người gửi báo cáo (Reporter) */}
                <div className="space-y-2">
                  <p className="text-[10px] opacity-60 font-black uppercase tracking-widest text-amber-400 dark:text-amber-600">
                    1. Người Gửi Báo Cáo (Reporter)
                  </p>
                  {reporterUser ? (
                    <button 
                      type="button"
                      onClick={() => setViewingProfileUser(reporterUser)}
                      className="w-full flex items-center gap-3 p-3.5 bg-white/10 dark:bg-black/10 hover:bg-white/20 dark:hover:bg-black/20 rounded-2xl transition-all border border-white/10 dark:border-black/10 group cursor-pointer text-left"
                    >
                      <img 
                        src={getValidAvatar(reporterUser.avatar)} 
                        alt={reporterUser.displayName} 
                        className="w-10 h-10 rounded-full object-cover border border-white/20 dark:border-black/20 shrink-0" 
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm truncate group-hover:underline">
                            {reporterUser.displayName}
                          </span>
                          <Eye className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 shrink-0" />
                        </div>
                        <p className="text-xs font-mono opacity-70">
                          ID: {reporterUser.numericId}
                        </p>
                      </div>
                    </button>
                  ) : (
                    <div className="p-3.5 bg-white/10 dark:bg-black/10 rounded-2xl text-xs opacity-60">
                      ID: {selectedReport.reporterId} ({selectedReport.reporterName})
                    </div>
                  )}
                </div>

                {/* 2. Người bị báo cáo (Reported User / Content Owner) */}
                <div className="space-y-2">
                  <p className="text-[10px] opacity-60 font-black uppercase tracking-widest text-emerald-400 dark:text-emerald-600">
                    2. Người Bị Báo Cáo (Tác Giả Nội Dung)
                  </p>
                  {loadingDetails ? (
                    <div className="p-3.5 bg-white/10 dark:bg-black/10 rounded-2xl text-xs opacity-50 animate-pulse">
                      Đang tải thông tin người bị báo cáo...
                    </div>
                  ) : reportedUser ? (
                    <button 
                      type="button"
                      onClick={() => setViewingProfileUser(reportedUser)}
                      className="w-full flex items-center gap-3 p-3.5 bg-white/10 dark:bg-black/10 hover:bg-white/20 dark:hover:bg-black/20 rounded-2xl transition-all border border-white/10 dark:border-black/10 group cursor-pointer text-left"
                    >
                      <img 
                        src={getValidAvatar(reportedUser.avatar)} 
                        alt={reportedUser.displayName} 
                        className="w-10 h-10 rounded-full object-cover border border-white/20 dark:border-black/20 shrink-0" 
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm truncate group-hover:underline">
                            {reportedUser.displayName}
                          </span>
                          <Eye className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 shrink-0" />
                        </div>
                        <p className="text-xs font-mono opacity-70">
                          ID: {reportedUser.numericId}
                        </p>
                      </div>
                    </button>
                  ) : (
                    <div className="p-3.5 bg-white/10 dark:bg-black/10 rounded-2xl text-xs opacity-70 italic">
                      Không tìm thấy thông tin tài khoản bị báo cáo.
                    </div>
                  )}
                </div>
              </div>

              {/* 3. Lý do & mô tả */}
              <div className="space-y-2">
                <p className="text-[10px] opacity-60 font-black uppercase tracking-widest text-red-400 dark:text-red-600">
                  3. Lý Do & Mô Tả Vi Phạm
                </p>
                <div className="p-4 bg-white/10 dark:bg-black/10 rounded-2xl text-xs space-y-2 break-words max-w-full">
                  <p className="font-black text-sm text-red-400 dark:text-red-500 uppercase">{selectedReport.reason}</p>
                  <p className="italic leading-relaxed opacity-90 whitespace-pre-wrap">{selectedReport.description || "Không có mô tả chi tiết."}</p>
                </div>
              </div>

              {/* Nội dung bình luận nếu là COMMENT */}
              {selectedReport.targetType === 'COMMENT' && targetContentInfo?.content && (
                <div className="space-y-2">
                  <p className="text-[10px] opacity-60 font-black uppercase tracking-widest">
                    Nội Dung Bình Luận Bị Báo Cáo
                  </p>
                  <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs italic font-medium leading-relaxed break-words whitespace-pre-wrap">
                    "{targetContentInfo.content}"
                  </div>
                </div>
              )}

              {/* Link nội dung */}
              <div className="space-y-2">
                <p className="text-[10px] opacity-60 font-black uppercase tracking-widest">
                  Link Nội Dung Kháng Nghị / Xử Lý
                </p>
                {(() => {
                  let targetUrl = '#';
                  let targetLabel = `Mở trang ${selectedReport.targetType}`;

                  if (selectedReport.targetType === 'COMMENT') {
                    if (targetContentInfo?.parentTargetType === 'CHARACTER') {
                      targetUrl = `/character/${targetContentInfo.parentTargetId}`;
                      targetLabel = 'Mở Character chứa Bình Luận này';
                    } else if (targetContentInfo?.parentTargetType === 'PROMPT') {
                      targetUrl = `/prompt/${targetContentInfo.parentTargetId}`;
                      targetLabel = 'Mở Prompt chứa Bình Luận này';
                    } else if (targetContentInfo?.parentTargetType === 'FEEDBACK') {
                      targetUrl = `/feedbacks`;
                      targetLabel = 'Mở trang Feedback chứa Bình Luận này';
                    } else {
                      targetUrl = `/explore`;
                      targetLabel = 'Mở trang Khám Phá';
                    }
                  } else if (selectedReport.targetType === 'CHARACTER') {
                    targetUrl = `/character/${targetContentInfo?.numericId || selectedReport.targetId}`;
                    targetLabel = 'Mở trang Character';
                  } else if (selectedReport.targetType === 'PROMPT') {
                    targetUrl = `/prompt/${targetContentInfo?.numericId || selectedReport.targetId}`;
                    targetLabel = 'Mở trang Prompt';
                  } else if (selectedReport.targetType === 'FEEDBACK') {
                    targetUrl = `/feedbacks`;
                    targetLabel = 'Mở trang Feedback';
                  } else if (selectedReport.targetType === 'CREATOR') {
                    targetUrl = `/creator/${reportedUser?.numericId || selectedReport.targetId}`;
                    targetLabel = 'Mở trang Hồ sơ Creator';
                  }

                  return (
                    <Link 
                      to={targetUrl} 
                      className="flex items-center justify-between p-3.5 bg-white/10 dark:bg-black/10 rounded-2xl hover:bg-white/20 dark:hover:bg-black/20 transition-all group"
                    >
                      <span className="text-xs font-bold truncate pr-3">{targetLabel}</span>
                      <ExternalLink className="w-4 h-4 group-hover:scale-110 transition-transform shrink-0" />
                    </Link>
                  );
                })()}
              </div>

              {/* Controls */}
              {filter === 'PENDING' && (
                <div className="space-y-4 pt-4 border-t border-white/10 dark:border-black/10">
                  {!selectedReport.claimedBy ? (
                    <div className="space-y-3">
                      <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs text-amber-600 dark:text-amber-400 font-bold">
                        Báo cáo này chưa có ai xử lý. Hãy nhấn "Nhận Xử Lý" để mở các tùy chọn hành động.
                      </div>
                      <button
                        onClick={() => handleClaim(selectedReport.id)}
                        className="w-full px-4 py-3.5 bg-white dark:bg-black text-black dark:text-white hover:opacity-90 font-black text-xs uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2 shadow-xl cursor-pointer"
                      >
                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                        Nhận Xử Lý Báo Cáo
                      </button>
                    </div>
                  ) : selectedReport.claimedBy !== currentUser?.id && currentUser?.role !== 'ADMIN' ? (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-xs text-red-600 dark:text-red-400 font-bold space-y-1">
                      <p>⚠️ Báo cáo này đang được xử lý bởi Moderator khác:</p>
                      <p className="font-extrabold text-sm">{selectedReport.claimedByName || selectedReport.claimedBy}</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-purple-500/15 border border-purple-500/20 rounded-2xl text-xs text-purple-600 dark:text-purple-400 font-bold">
                        <span>Bạn đang nhận xử lý báo cáo này</span>
                        <button
                          onClick={() => handleUnclaim(selectedReport.id)}
                          className="text-[10px] underline hover:opacity-80 uppercase tracking-widest font-black cursor-pointer"
                        >
                          Hủy nhận
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        <p className="text-[10px] opacity-70 font-black uppercase tracking-widest">
                          Lý do xử lý báo cáo <span className="text-red-400">* (bắt buộc khi xóa)</span>
                        </p>
                        <textarea 
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Nhập lý do xử lý hoặc lý do vi phạm tại đây..."
                          className="w-full p-3.5 bg-white/10 dark:bg-black/10 border border-white/20 dark:border-black/20 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-white/50 resize-none h-24"
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <button 
                          onClick={handleDismiss}
                          className="px-4 py-3.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white dark:text-black font-black text-xs uppercase tracking-widest rounded-2xl transition-all cursor-pointer"
                        >
                          Bỏ Qua
                        </button>
                        <button 
                          onClick={handleDeleteContentClick}
                          className={`px-4 py-3.5 font-black text-xs uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg ${
                            !note.trim() 
                              ? 'bg-neutral-600/50 text-neutral-400 cursor-not-allowed opacity-60' 
                              : 'bg-red-600 hover:bg-red-500 text-white'
                          }`}
                        >
                          <Trash2 className="w-4 h-4" />
                          Gỡ Nội Dung
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {filter !== 'PENDING' && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Đã Xử Lý</span>
                  </div>
                  <p className="text-xs opacity-80">{selectedReport.moderatorNote || "Không có ghi chú."}</p>
                  <p className="text-[9px] opacity-40 italic">Bởi: {selectedReport.moderatorId}</p>
                </div>
              )}

              <div className="pt-2 text-right">
                <button
                  type="button"
                  onClick={() => setSelectedReport(null)}
                  className="px-6 py-2.5 bg-white/10 hover:bg-white/20 rounded-2xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <DeleteConfirmModal
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirmWithReason={(reason, details) => executeDeleteContent(reason, details)}
        requireReason={true}
        targetName={selectedReport?.targetName || targetContentInfo?.name}
        title="Gỡ bỏ nội dung bị báo cáo"
        description="Nội dung sẽ được ẩn khỏi hệ thống và chuyển sang trạng thái xử lý. Tác giả sẽ nhận được thông báo kèm lý do vi phạm và có quyền gửi đơn kháng nghị."
        confirmText="Xác nhận gỡ bỏ"
        cancelText="Hủy bỏ"
      />

      {/* Modal hiển thị Profile chi tiết người dùng ngay trong Report Queue */}
      {viewingProfileUser && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setViewingProfileUser(null)}
        >
          <div 
            className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-6 shadow-2xl relative animate-in zoom-in-95 duration-200 text-neutral-900 dark:text-white"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button 
              type="button"
              onClick={() => setViewingProfileUser(null)}
              className="absolute top-5 right-5 p-2 rounded-full text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Profile Header */}
            <div className="flex flex-col items-center text-center space-y-3 pt-2">
              <div className="relative">
                <img 
                  src={getValidAvatar(viewingProfileUser.avatar)} 
                  alt={viewingProfileUser.displayName} 
                  className="w-24 h-24 rounded-full object-cover border-4 border-neutral-100 dark:border-neutral-800 shadow-md"
                />
                {viewingProfileUser.creatorStatus && (
                  <span className="absolute bottom-0 right-0 p-1.5 bg-amber-500 text-black rounded-full shadow-lg" title="Creator">
                    <Sparkles className="w-4 h-4 fill-current" />
                  </span>
                )}
              </div>

              <div className="space-y-1">
                <h3 className="text-xl font-black text-neutral-900 dark:text-white tracking-tight flex items-center justify-center gap-2">
                  {viewingProfileUser.displayName}
                  {viewingProfileUser.creatorStatus && (
                    <BadgeCheck className="w-5 h-5 text-amber-500 shrink-0" />
                  )}
                </h3>
                <p className="text-xs font-mono text-neutral-400 font-bold uppercase tracking-widest">
                  ID: {viewingProfileUser.numericId}
                </p>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                  viewingProfileUser.role === 'ADMIN' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                  viewingProfileUser.role === 'MODERATOR' ? 'bg-purple-500/10 text-purple-500 border border-purple-500/20' :
                  viewingProfileUser.creatorStatus ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' :
                  'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                }`}>
                  {viewingProfileUser.role || (viewingProfileUser.creatorStatus ? 'CREATOR' : 'USER')}
                </span>
                {viewingProfileUser.status === 'SUSPENDED' && (
                  <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-red-500/10 text-red-500 border border-red-500/20">
                    Đã Khóa
                  </span>
                )}
              </div>
            </div>

            {/* Profile Details List */}
            <div className="space-y-3 bg-neutral-50 dark:bg-neutral-800/50 p-4 rounded-2xl text-xs border border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center justify-between py-1 border-b border-neutral-200/50 dark:border-neutral-700/50">
                <span className="text-neutral-500 font-bold flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5" /> Email:
                </span>
                <span className="font-medium text-neutral-800 dark:text-neutral-200 select-all">
                  {viewingProfileUser.email || 'Không công khai'}
                </span>
              </div>

              {viewingProfileUser.createdAt && (
                <div className="flex items-center justify-between py-1 border-b border-neutral-200/50 dark:border-neutral-700/50">
                  <span className="text-neutral-500 font-bold flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5" /> Tham gia:
                  </span>
                  <span className="font-medium text-neutral-800 dark:text-neutral-200">
                    {new Date(viewingProfileUser.createdAt).toLocaleDateString('vi-VN')}
                  </span>
                </div>
              )}

              <div className="space-y-1 pt-1">
                <span className="text-neutral-500 font-bold block">Tiểu sử (Bio):</span>
                <p className="italic text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap leading-relaxed">
                  {viewingProfileUser.bio || 'Chưa cập nhật tiểu sử.'}
                </p>
              </div>
            </div>

            {/* Action / Close */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setViewingProfileUser(null)}
                className="w-full py-3 bg-neutral-900 dark:bg-white text-white dark:text-black font-black text-xs uppercase tracking-widest rounded-2xl hover:opacity-90 transition-all cursor-pointer shadow-lg"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

