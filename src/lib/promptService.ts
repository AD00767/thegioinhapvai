import { doc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { PromptItem } from '../types';

export interface ExecuteDeletePromptParams {
  prompt: PromptItem;
  currentUser: any;
  reason?: string;
  details?: string;
}

export async function executeDeletePrompt({
  prompt,
  currentUser,
  reason,
  details
}: ExecuteDeletePromptParams) {
  if (!currentUser) {
    throw new Error("Bạn chưa đăng nhập.");
  }

  const isOwner = currentUser.id === prompt.authorId;
  const isAdmin = currentUser.role === 'ADMIN' || currentUser.role === 'MODERATOR';

  if (!isOwner && !isAdmin) {
    throw new Error("Bạn không có quyền xóa Prompt này.");
  }

  // If Admin/Mod is deleting (whether another user's prompt or their own)
  if (isAdmin) {
    const removalReason = reason?.trim() || "Vi phạm tiêu chuẩn cộng đồng";
    const removalDetails = details?.trim() || "";

    await updateDoc(doc(db, 'prompts', prompt.id), {
      isHidden: true,
      deletedAt: new Date().toISOString(),
      deletedBy: currentUser.id,
      removalReason,
      removalDetails,
      removalTime: new Date().toISOString(),
      appealStatus: 'NONE'
    });

    // Send notification to author if author is another user
    if (prompt.authorId && prompt.authorId !== currentUser.id) {
      await addDoc(collection(db, 'notifications'), {
        userId: prompt.authorId,
        type: 'CONTENT_REMOVED',
        title: 'Prompt của bạn đã bị gỡ bỏ',
        content: `Prompt "${prompt.name || prompt.title || 'Không tiêu đề'}" đã bị gỡ bỏ do: ${removalReason}.`,
        targetType: 'PROMPT',
        targetId: prompt.id,
        targetName: prompt.name || prompt.title || 'Prompt',
        removalReason,
        removalDetails,
        isRead: false,
        createdAt: serverTimestamp()
      });
    }

    // Add activity log / audit log
    await addDoc(collection(db, 'activity_logs'), {
      userId: currentUser.id,
      userName: currentUser.displayName || 'Admin/Mod',
      action: 'REMOVE_PROMPT',
      details: `Gỡ bỏ Prompt "${prompt.name || prompt.title || 'Prompt'}" (ID: ${prompt.id}) - Lý do: ${removalReason}`,
      timestamp: serverTimestamp()
    });
  } else {
    // Regular owner self-deletion
    await updateDoc(doc(db, 'prompts', prompt.id), {
      isHidden: true,
      deletedAt: new Date().toISOString(),
      deletedBy: currentUser.id
    });
  }
}
