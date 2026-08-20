import { CreatorItem } from '../types';
import toast from 'react-hot-toast';

export const ACTIVITY_LABELS: Record<string, string> = {
  'POST_CHARACTER': 'Tạo / Đăng Character',
  'POST_PROMPT': 'Tạo / Đăng Prompt',
  'POST_FEEDBACK': 'Gửi Feedback',
  'POST_COMMENT': 'Bình luận & Phản hồi',
};

export interface RestrictionStatus {
  restricted: boolean;
  reason?: string;
  expiresAt?: string;
}

/**
 * Checks if a user is currently restricted from performing a specific activity.
 */
export function isActivityRestricted(user: CreatorItem | null, activity: string): RestrictionStatus {
  if (!user) return { restricted: false };

  // 1. Account Lock Check
  if (user.isLocked) {
    const lockExpired = user.lockExpiresAt && new Date(user.lockExpiresAt).getTime() < Date.now();
    if (!lockExpired) {
      return {
        restricted: true,
        reason: user.lockReason || 'Tài khoản của bạn đang bị đình chỉ/khóa.',
        expiresAt: user.lockExpiresAt
      };
    }
  }

  // 2. Restricted Activities Check
  if (user.restrictedActivities && Array.isArray(user.restrictedActivities)) {
    const match = user.restrictedActivities.includes(activity) ||
      (activity === 'POST_CHARACTER' && user.restrictedActivities.includes('CREATE_CHARACTER')) ||
      (activity === 'POST_PROMPT' && user.restrictedActivities.includes('CREATE_PROMPT')) ||
      (activity === 'POST_COMMENT' && user.restrictedActivities.includes('COMMENT'));

    if (match) {
      const restrictionExpired = user.restrictionExpiresAt && new Date(user.restrictionExpiresAt).getTime() < Date.now();
      if (!restrictionExpired) {
        return {
          restricted: true,
          reason: user.restrictionReason || `Tài khoản của bạn đang bị giới hạn hoạt động: ${ACTIVITY_LABELS[activity] || activity}.`,
          expiresAt: user.restrictionExpiresAt
        };
      }
    }
  }

  return { restricted: false };
}

/**
 * Enforces restriction check before an operation.
 * Returns true if action is ALLOWED, false if RESTRICTED (and shows toast).
 */
export function enforceActivityCheck(user: CreatorItem | null, activity: string): boolean {
  const status = isActivityRestricted(user, activity);
  if (status.restricted) {
    const expireText = status.expiresAt 
      ? ` (Thời hạn đến: ${new Date(status.expiresAt).toLocaleDateString('vi-VN')})`
      : '';
    toast.error(`Thao tác bị chặn! ${status.reason}${expireText}`);
    return false;
  }
  return true;
}
