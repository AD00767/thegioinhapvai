import React, { useState, useEffect } from 'react';
import AdminLayout from './AdminLayout';
import { 
  AlertTriangle, CheckCircle, XCircle, Clock, 
  ExternalLink, Trash2, Eye, Filter, MoreVertical,
  MessageSquare, User, ShieldAlert, FileText
} from 'lucide-react';
import { 
  collection, query, getDocs, doc, updateDoc, 
  orderBy, where, serverTimestamp, deleteDoc, getDoc, addDoc 
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/useAuthStore';
import toast from 'react-hot-toast';
import { ReportItem } from '../../types';
import { Link } from 'react-router-dom';
import DeleteConfirmModal from '../../components/DeleteConfirmModal';

export default function ReportQueue() {
  const { user: currentUser } = useAuthStore();
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'PENDING' | 'RESOLVED' | 'REJECTED' | 'DISMISSED'>('PENDING');
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);
  const [note, setNote] = useState('');
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  // Target content details state (for author info and parent links)
  const [targetContentData, setTargetContentData] = useState<{
    id?: string;
    authorId?: string;
    authorName?: string;
    content?: string;
    parentTargetId?: string;
    parentTargetType?: string;
    notFound?: boolean;
  } | null>(null);
  const [loadingTargetContent, setLoadingTargetContent] = useState<boolean>(false);

  useEffect(() => {
    fetchReports();
  }, [filter]);

  // Fetch target content details whenever selectedReport changes
  useEffect(() => {
    if (!selectedReport) {
      setTargetContentData(null);
      return;
    }

    const fetchTargetContent = async () => {
      setLoadingTargetContent(true);
      try {
        if (selectedReport.targetType === 'COMMENT') {
          const commentRef = doc(db, 'comments', selectedReport.targetId);
          const commentSnap = await getDoc(commentRef);
          if (commentSnap.exists()) {
            const cData = commentSnap.data();
            setTargetContentData({
              id: commentSnap.id,
              authorId: cData.authorId || cData.userId,
              authorName: cData.authorName || 'Người dùng',
              content: cData.content,
              parentTargetId: cData.targetId,
              parentTargetType: cData.targetType
            });
          } else {
            setTargetContentData({ notFound: true });
          }
        } else if (selectedReport.targetType === 'CHARACTER') {
          const charRef = doc(db, 'characters', selectedReport.targetId);
          const charSnap = await getDoc(charRef);
          if (charSnap.exists()) {
            const d = charSnap.data();
            setTargetContentData({
              id: charSnap.id,
              authorId: d.creatorId || d.userId,
              authorName: d.creatorName || d.name,
              content: d.slogan || d.name
            });
          }
        } else if (selectedReport.targetType === 'PROMPT') {
          const promptRef = doc(db, 'prompts', selectedReport.targetId);
          const promptSnap = await getDoc(promptRef);
          if (promptSnap.exists()) {
            const d = promptSnap.data();
            setTargetContentData({
              id: promptSnap.id,
              authorId: d.authorId || d.userId || d.creatorId,
              authorName: d.authorName || d.name,
              content: d.name
            });
          }
        } else if (selectedReport.targetType === 'FEEDBACK') {
          const fbRef = doc(db, 'feedbacks', selectedReport.targetId);
          const fbSnap = await getDoc(fbRef);
          if (fbSnap.exists()) {
            const d = fbSnap.data();
            setTargetContentData({
              id: fbSnap.id,
              authorId: d.senderId || d.authorId || d.userId,
              authorName: d.senderName || 'Người dùng',
              content: d.content || d.title
            });
          }
        } else if (selectedReport.targetType === 'CREATOR') {
          setTargetContentData({
            id: selectedReport.targetId,
            authorId: selectedReport.targetId,
            authorName: selectedReport.targetName || 'Creator',
            content: selectedReport.targetName
          });
        }
      } catch (e) {
        console.error("Error fetching target content:", e);
      } finally {
        setLoadingTargetContent(false);
      }
    };

    fetchTargetContent();
  }, [selectedReport?.id, selectedReport?.targetId, selectedReport?.targetType]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      let q;
      if (filter === 'PENDING') {
        q = query(
          collection(db, 'reports'), 
          where('status', 'in', ['PENDING', 'REVIEWING']),
          orderBy('createdAt', 'desc')
        );
      } else {
        q = query(
          collection(db, 'reports'), 
          where('status', '==', filter),
          orderBy('createdAt', 'desc')
        );
      }
      const snap = await getDocs(q);
      setReports(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }) as ReportItem));
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
        status: 'REVIEWING',
        claimedBy: currentUser.id,
        claimedByName: currentUser.displayName,
        claimedAt: new Date().toISOString()
      });

      toast.success("Đã nhận xử lý báo cáo này!");
      fetchReports();
      if (selectedReport && selectedReport.id === reportId) {
        setSelectedReport(prev => prev ? { 
          ...prev, 
          status: 'REVIEWING', 
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

  const handleResolve = async (status: 'RESOLVED' | 'REJECTED' | 'DISMISSED') => {
    if (!selectedReport) return;
    
    try {
      const reportRef = doc(db, 'reports', selectedReport.id);
      await updateDoc(reportRef, {
        status,
        moderatorId: currentUser.id,
        moderatorNote: note,
        resolvedAt: serverTimestamp()
      });

      // Audit Log
      await addDoc(collection(db, 'audit_logs'), {
        executorId: currentUser.id,
        executorName: currentUser.displayName,
        executorRole: currentUser.role,
        action: 'RESOLVE_REPORT',
        targetId: selectedReport.id,
        targetType: 'REPORT',
        details: `Xử lý báo cáo ${selectedReport.id} thành ${status}`,
        reason: note,
        createdAt: new Date().toISOString()
      });

      // Send notification to content owner if resolved
      if (status === 'RESOLVED' && targetContentData?.authorId) {
        try {
          await addDoc(collection(db, 'notifications'), {
            userId: targetContentData.authorId,
            recipientId: targetContentData.authorId,
            type: 'REPORT_RESOLVED',
            title: 'Xử lý báo cáo nội dung',
            message: `Báo cáo liên quan đến nội dung ${selectedReport.targetType} của bạn đã được Ban Quản Trị xem xét và xử lý.${note ? ` Ghi chú: ${note}` : ''}`,
            targetType: selectedReport.targetType,
            targetId: selectedReport.targetId,
            read: false,
            createdAt: new Date().toISOString()
          });
        } catch (e) {
          console.error("Failed to send notification to content owner:", e);
        }
      }

      toast.success(`Đã xử lý báo cáo: ${status}`);
      setSelectedReport(null);
      setNote('');
      fetchReports();
    } catch (err) {
      toast.error("Thao tác thất bại.");
    }
  };

  const handleDeleteContent = () => {
    if (!selectedReport) return;
    setIsDeleteConfirmOpen(true);
  };

  const executeDeleteContent = async (reason?: string, details?: string) => {
    if (!selectedReport || !currentUser) return;

    try {
      const collectionName = selectedReport.targetType === 'CHARACTER' ? 'characters' : 
                            selectedReport.targetType === 'PROMPT' ? 'prompts' : 
                            selectedReport.targetType === 'FEEDBACK' ? 'feedbacks' : 'comments';
      
      const targetRef = doc(db, collectionName, selectedReport.targetId);
      const targetSnap = await getDoc(targetRef);
      let ownerId = null;
      let targetName = selectedReport.targetName || 'Nội dung';
      
      if (targetSnap.exists()) {
        const d = targetSnap.data();
        ownerId = d.creatorId || d.userId || d.senderId || d.authorId;
        targetName = d.name || d.title || d.message || targetName;
      }

      const now = new Date().toISOString();
      const removalReasonText = reason || selectedReport.reason || note || "Vi phạm tiêu chuẩn cộng đồng";
      const removalDetailsText = details || note || selectedReport.description || "Nội dung vi phạm quy định cộng đồng nền tảng.";

      await updateDoc(targetRef, {
        isHidden: true,
        deletedAt: now,
        deletedBy: currentUser.id,
        removalReason: removalReasonText,
        removalDetails: removalDetailsText,
        removalTime: now,
        appealStatus: 'NONE'
      });

      // Send notification to owner
      if (ownerId) {
        await addDoc(collection(db, 'notifications'), {
          userId: ownerId,
          recipientId: ownerId,
          type: 'CONTENT_REMOVED',
          title: `Nội dung "${targetName}" đã bị gỡ/ẩn`,
          message: `Nội dung của bạn đã bị gỡ do: ${removalReasonText}. Nhấp vào để xem chi tiết và gửi kháng nghị.`,
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
      
      // Also resolve the report as RESOLVED
      await handleResolve('RESOLVED');
      
      // Audit Log for soft deletion
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

      toast.success("Đã gỡ bỏ nội dung bị báo cáo khỏi hệ thống!");
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
                className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Report List */}
          <div className="lg:col-span-2 space-y-4">
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
                    ${selectedReport?.id === r.id ? 'border-neutral-900 dark:border-white ring-1 ring-neutral-900 dark:ring-white' : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600'}
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
                        <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">ID: {r.id.substring(0, 8)}</p>
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
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-2 italic mb-4">"{r.description || 'Không có mô tả chi tiết.'}"</p>
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                    <span>Người báo cáo: {r.reporterName}</span>
                    <span className="group-hover:text-neutral-900 dark:group-hover:text-white transition-colors flex items-center gap-1">
                      Chi tiết <ExternalLink className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Details & Actions */}
          <div className="sticky top-8 space-y-6">
            {selectedReport ? (
              <div className="bg-neutral-900 dark:bg-white text-white dark:text-black p-8 rounded-[2.5rem] shadow-2xl space-y-8 animate-in slide-in-from-right-4 duration-300">
                <div className="space-y-1">
                  <h3 className="text-2xl font-black tracking-tighter uppercase">Chi Tiết Vi Phạm</h3>
                  <p className="text-[10px] opacity-50 font-black uppercase tracking-[0.2em]">Đang xem báo cáo {selectedReport.id.substring(0, 12)}</p>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <p className="text-[10px] opacity-50 font-black uppercase tracking-widest">Thông Tin Người Liên Quan</p>
                    <div className="p-4 bg-white/10 dark:bg-black/10 rounded-2xl text-xs space-y-2">
                      <div>
                        <span className="opacity-60 block font-bold">Người gửi báo cáo (Reporter ID):</span>
                        <span className="font-mono font-bold select-all text-amber-400 dark:text-amber-600">{selectedReport.reporterId}</span>
                        <span className="opacity-70 ml-2">({selectedReport.reporterName})</span>
                      </div>
                      <div className="pt-2 border-t border-white/10 dark:border-black/10">
                        <span className="opacity-60 block font-bold">Người tạo nội dung bị báo cáo (ID người gửi):</span>
                        {loadingTargetContent ? (
                          <span className="opacity-50 italic">Đang tải thông tin...</span>
                        ) : targetContentData?.authorId ? (
                          <div>
                            <span className="font-mono font-bold select-all text-emerald-400 dark:text-emerald-600">{targetContentData.authorId}</span>
                            {targetContentData.authorName && (
                              <span className="opacity-70 ml-2">({targetContentData.authorName})</span>
                            )}
                          </div>
                        ) : (
                          <span className="font-mono font-bold select-all opacity-80">{selectedReport.targetId}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] opacity-50 font-black uppercase tracking-widest">Loại Vi Phạm & Mô Tả</p>
                    <div className="p-4 bg-white/10 dark:bg-black/10 rounded-2xl text-xs space-y-2">
                      <p className="font-black text-sm text-red-400 dark:text-red-600 uppercase">{selectedReport.reason}</p>
                      <p className="italic leading-relaxed opacity-90">{selectedReport.description || "Không có mô tả chi tiết."}</p>
                    </div>
                  </div>

                  {selectedReport.targetType === 'COMMENT' && targetContentData?.content && (
                    <div className="space-y-2">
                      <p className="text-[10px] opacity-50 font-black uppercase tracking-widest">Nội Dung Bình Luận Bị Báo Cáo</p>
                      <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs italic font-medium leading-relaxed">
                        "{targetContentData.content}"
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <p className="text-[10px] opacity-50 font-black uppercase tracking-widest">Link Nội Dung Kháng Nghị / Xem Chi Tiết</p>
                    {(() => {
                      let targetUrl = '#';
                      let targetLabel = `Mở trang ${selectedReport.targetType}`;

                      if (selectedReport.targetType === 'COMMENT') {
                        if (targetContentData?.parentTargetType === 'CHARACTER') {
                          targetUrl = `/character/${targetContentData.parentTargetId}`;
                          targetLabel = 'Mở Character chứa Bình Luận này';
                        } else if (targetContentData?.parentTargetType === 'PROMPT') {
                          targetUrl = `/prompt/${targetContentData.parentTargetId}`;
                          targetLabel = 'Mở Prompt chứa Bình Luận này';
                        } else if (targetContentData?.parentTargetType === 'FEEDBACK') {
                          targetUrl = `/feedbacks`;
                          targetLabel = 'Mở Danh sách Feedback chứa Bình Luận này';
                        } else {
                          targetUrl = `/explore`;
                          targetLabel = 'Mở trang Khám Phá chứa Nội Dung này';
                        }
                      } else if (selectedReport.targetType === 'CHARACTER') {
                        targetUrl = `/character/${selectedReport.targetId}`;
                        targetLabel = 'Mở trang Character';
                      } else if (selectedReport.targetType === 'PROMPT') {
                        targetUrl = `/prompt/${selectedReport.targetId}`;
                        targetLabel = 'Mở trang Prompt';
                      } else if (selectedReport.targetType === 'FEEDBACK') {
                        targetUrl = `/feedbacks`;
                        targetLabel = 'Mở trang Feedback';
                      } else if (selectedReport.targetType === 'CREATOR') {
                        targetUrl = `/creator/${selectedReport.targetId}`;
                        targetLabel = 'Mở trang Hồ sơ Creator';
                      }

                      return (
                        <Link 
                          to={targetUrl} 
                          className="flex items-center justify-between p-4 bg-white/10 dark:bg-black/10 rounded-2xl hover:bg-white/20 dark:hover:bg-black/20 transition-all group"
                        >
                          <span className="text-xs font-bold truncate pr-4">{targetLabel}</span>
                          <ExternalLink className="w-4 h-4 group-hover:scale-110 transition-transform shrink-0" />
                        </Link>
                      );
                    })()}
                  </div>

                  {filter === 'PENDING' && (
                    <div className="space-y-4 pt-4">
                      {!selectedReport.claimedBy ? (
                        <div className="space-y-3">
                          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs text-amber-600 dark:text-amber-400 font-bold">
                            Báo cáo này chưa được nhận xử lý. Bạn cần nhận xử lý để thực hiện hành động.
                          </div>
                          <button
                            onClick={() => handleClaim(selectedReport.id)}
                            className="w-full px-4 py-4 bg-white dark:bg-black text-black dark:text-white hover:opacity-90 font-black text-xs uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2 shadow-xl"
                          >
                            <CheckCircle className="w-4 h-4 text-emerald-500" />
                            Nhận Xử Lý Báo Cáo
                          </button>
                        </div>
                      ) : selectedReport.claimedBy !== currentUser?.id && currentUser?.role !== 'ADMIN' ? (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-xs text-red-600 dark:text-red-400 font-bold space-y-2">
                          <p>⚠️ Báo cáo này đang được xử lý bởi một Moderator khác:</p>
                          <p className="font-extrabold text-sm">{selectedReport.claimedByName || selectedReport.claimedBy}</p>
                          <p className="text-[10px] opacity-70">Vui lòng chờ hoặc xử lý báo cáo khác trong hàng đợi.</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between p-4 bg-purple-500/15 border border-purple-500/20 rounded-2xl text-xs text-purple-600 dark:text-purple-400 font-bold">
                            <span>Bạn đang nhận xử lý báo cáo này</span>
                            <button
                              onClick={() => handleUnclaim(selectedReport.id)}
                              className="text-[10px] underline hover:opacity-80 uppercase tracking-widest font-black"
                            >
                              Hủy nhận
                            </button>
                          </div>

                          <p className="text-[10px] opacity-50 font-black uppercase tracking-widest">Ghi chú xử lý (Bắt buộc)</p>
                          <textarea 
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Lý do xử lý báo cáo này..."
                            className="w-full p-4 bg-white/10 dark:bg-black/10 border border-white/20 dark:border-black/20 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-white/50 resize-none h-24"
                          />
                          
                          <div className="grid grid-cols-2 gap-3">
                            <button 
                              onClick={() => handleResolve('REJECTED')}
                              className="px-4 py-4 bg-red-500/20 hover:bg-red-500/40 border border-red-500/50 text-white dark:text-black font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all"
                            >
                              Từ Chối
                            </button>
                            <button 
                              onClick={() => handleResolve('DISMISSED')}
                              className="px-4 py-4 bg-white/10 hover:bg-white/20 border border-white/20 text-white dark:text-black font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all"
                            >
                              Bỏ Qua
                            </button>
                          </div>
                          
                          <button 
                            onClick={handleDeleteContent}
                            className="w-full px-4 py-5 bg-white dark:bg-black text-black dark:text-white hover:opacity-90 font-black text-xs uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2 shadow-xl"
                          >
                            <Trash2 className="w-4 h-4" />
                            Xác Nhận Vi Phạm & Xóa
                          </button>
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
                      <p className="text-[9px] opacity-40 italic">Bởi Mod: {selectedReport.moderatorId}</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-neutral-900 p-12 rounded-[2.5rem] border-2 border-dashed border-neutral-200 dark:border-neutral-800 flex flex-col items-center justify-center text-center space-y-4">
                <Eye className="w-10 h-10 text-neutral-300 dark:text-neutral-700" />
                <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest leading-loose">Chọn một báo cáo để xem chi tiết<br />và thực hiện hành động.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <DeleteConfirmModal
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirmWithReason={(reason, details) => executeDeleteContent(reason, details)}
        requireReason={true}
        targetName={selectedReport?.targetName}
        title="Gỡ bỏ nội dung bị báo cáo"
        description="Nội dung sẽ được ẩn khỏi hệ thống và chuyển sang trạng thái xử lý. Tác giả sẽ nhận được thông báo kèm lý do vi phạm và có quyền gửi đơn kháng nghị."
        confirmText="Xác nhận gỡ bỏ"
        cancelText="Hủy bỏ"
      />
    </AdminLayout>
  );
}
