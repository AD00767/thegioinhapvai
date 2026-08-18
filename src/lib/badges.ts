import React from 'react';
import { 
  Sparkles, 
  Award, 
  ShieldCheck, 
  Flame, 
  UserPlus, 
  Smile, 
  ShieldAlert,
  Medal,
  CheckCircle2,
  Crown
} from 'lucide-react';

export type BadgeId = 
  | 'new_creator'
  | 'positive_creator'
  | 'veteran_creator'
  | 'outstanding_creator'
  | 'new_user'
  | 'positive_user'
  | 'admin_badge';

export interface BadgeDefinition {
  id: BadgeId;
  name: string;
  shortDescription: string;
  category: 'CREATOR' | 'USER' | 'ADMIN';
  isInternalOnly: boolean; // If true, NEVER show in public UI!
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  iconColorClass: string;
}

export const BADGE_DEFINITIONS: Record<BadgeId, BadgeDefinition> = {
  new_creator: {
    id: 'new_creator',
    name: 'New Creator',
    shortDescription: 'Creator mới gia nhập cộng đồng Thế giới nhập vai_AD.',
    category: 'CREATOR',
    isInternalOnly: false,
    icon: Sparkles,
    colorClass: 'text-cyan-700 dark:text-cyan-300',
    bgClass: 'bg-cyan-50 dark:bg-cyan-950/40',
    borderClass: 'border-cyan-200 dark:border-cyan-800',
    iconColorClass: 'text-cyan-500 dark:text-cyan-400'
  },
  positive_creator: {
    id: 'positive_creator',
    name: 'Positive Creator',
    shortDescription: 'Creator tích cực chia sẻ nội dung sáng tạo và chất lượng.',
    category: 'CREATOR',
    isInternalOnly: false,
    icon: Award,
    colorClass: 'text-emerald-700 dark:text-emerald-300',
    bgClass: 'bg-emerald-50 dark:bg-emerald-950/40',
    borderClass: 'border-emerald-200 dark:border-emerald-800',
    iconColorClass: 'text-emerald-500 dark:text-emerald-400'
  },
  veteran_creator: {
    id: 'veteran_creator',
    name: 'Veteran Creator',
    shortDescription: 'Creator có thời gian hoạt động lâu dài và ổn định trên nền tảng.',
    category: 'CREATOR',
    isInternalOnly: false,
    icon: Medal,
    colorClass: 'text-purple-700 dark:text-purple-300',
    bgClass: 'bg-purple-50 dark:bg-purple-950/40',
    borderClass: 'border-purple-200 dark:border-purple-800',
    iconColorClass: 'text-purple-500 dark:text-purple-400'
  },
  outstanding_creator: {
    id: 'outstanding_creator',
    name: 'Outstanding Creator',
    shortDescription: 'Creator có nhiều đóng góp xuất sắc và được cộng đồng đánh giá cao.',
    category: 'CREATOR',
    isInternalOnly: false,
    icon: Flame,
    colorClass: 'text-amber-700 dark:text-amber-300',
    bgClass: 'bg-amber-50 dark:bg-amber-950/40',
    borderClass: 'border-amber-200 dark:border-amber-800',
    iconColorClass: 'text-amber-500 dark:text-amber-400'
  },
  new_user: {
    id: 'new_user',
    name: 'New User',
    shortDescription: 'Thành viên mới gia nhập cộng đồng Thế giới nhập vai_AD.',
    category: 'USER',
    isInternalOnly: false,
    icon: UserPlus,
    colorClass: 'text-blue-700 dark:text-blue-300',
    bgClass: 'bg-blue-50 dark:bg-blue-950/40',
    borderClass: 'border-blue-200 dark:border-blue-800',
    iconColorClass: 'text-blue-500 dark:text-blue-400'
  },
  positive_user: {
    id: 'positive_user',
    name: 'Positive User',
    shortDescription: 'Thành viên tích cực tương tác và xây dựng môi trường lành mạnh.',
    category: 'USER',
    isInternalOnly: false,
    icon: CheckCircle2,
    colorClass: 'text-indigo-700 dark:text-indigo-300',
    bgClass: 'bg-indigo-50 dark:bg-indigo-950/40',
    borderClass: 'border-indigo-200 dark:border-indigo-800',
    iconColorClass: 'text-indigo-500 dark:text-indigo-400'
  },
  admin_badge: {
    id: 'admin_badge',
    name: 'Admin Badge',
    shortDescription: 'Xác định quyền Quản trị viên hệ thống (Nội bộ - Không hiển thị công khai).',
    category: 'ADMIN',
    isInternalOnly: true, // STRICT REQUIREMENT: INTERNAL ONLY!
    icon: ShieldAlert,
    colorClass: 'text-red-700 dark:text-red-300',
    bgClass: 'bg-red-50 dark:bg-red-950/50',
    borderClass: 'border-red-300 dark:border-red-800',
    iconColorClass: 'text-red-600 dark:text-red-400'
  }
};

export interface EvaluationSubject {
  id?: string;
  role?: 'USER' | 'CREATOR' | 'ADMIN' | string;
  creatorStatus?: boolean;
  createdAt?: any;
  characterCount?: number;
  promptCount?: number;
  totalLikes?: number;
  totalSaves?: number;
  viewsCount?: number;
  commentCount?: number;
  feedbackCount?: number;
  badges?: string[]; // Stored explicit badges if any
}

/**
 * Evaluates the earned badges for a user/creator based on system Business Rules.
 */
export function evaluateUserBadges(subject?: EvaluationSubject | null): BadgeId[] {
  if (!subject) return [];

  const earnedBadges: Set<BadgeId> = new Set();

  // If explicit stored badges exist
  if (Array.isArray(subject.badges)) {
    subject.badges.forEach((b) => {
      if (BADGE_DEFINITIONS[b as BadgeId]) {
        earnedBadges.add(b as BadgeId);
      }
    });
  }

  const isCreator = subject.creatorStatus === true || subject.role === 'CREATOR';
  const isAdmin = subject.role === 'ADMIN';

  // Calculate account age in days
  let accountAgeDays = 0;
  if (subject.createdAt) {
    let createdDate: Date | null = null;
    if (typeof subject.createdAt === 'object' && subject.createdAt?.toDate) {
      createdDate = subject.createdAt.toDate();
    } else if (typeof subject.createdAt === 'number') {
      createdDate = new Date(subject.createdAt);
    } else if (typeof subject.createdAt === 'string') {
      createdDate = new Date(subject.createdAt);
    }
    if (createdDate && !isNaN(createdDate.getTime())) {
      const diffMs = Date.now() - createdDate.getTime();
      accountAgeDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    }
  }

  // 1. Admin Badge (Internal System role)
  if (isAdmin) {
    earnedBadges.add('admin_badge');
  }

  // 2. Creator Badges
  if (isCreator) {
    // New Creator: Become Creator recently (e.g. account age < 60 days or first step)
    if (accountAgeDays <= 60 || (subject.characterCount ?? 0) <= 1) {
      earnedBadges.add('new_creator');
    }

    // Positive Creator: Posted content (e.g. >= 1 character/prompt)
    const totalPosts = (subject.characterCount ?? 0) + (subject.promptCount ?? 0);
    if (totalPosts >= 1) {
      earnedBadges.add('positive_creator');
    }

    // Veteran Creator: Active account age >= 90 days or >= 3 posts
    if (accountAgeDays >= 90 || totalPosts >= 3) {
      earnedBadges.add('veteran_creator');
    }

    // Outstanding Creator: Engagement threshold
    const totalEngagements = (subject.totalLikes ?? 0) + (subject.totalSaves ?? 0) + (subject.viewsCount ?? 0);
    if (totalEngagements >= 10 || totalPosts >= 5) {
      earnedBadges.add('outstanding_creator');
    }
  } else {
    // 3. User Badges
    // New User: account created <= 30 days
    if (accountAgeDays <= 30) {
      earnedBadges.add('new_user');
    }

    // Positive User: User with active interaction or account age > 30 days
    if ((subject.commentCount ?? 0) > 0 || (subject.feedbackCount ?? 0) > 0 || accountAgeDays > 30) {
      earnedBadges.add('positive_user');
    }
  }

  return Array.from(earnedBadges);
}

/**
 * Returns public badges only, strictly filtering out admin_badge / internal badges.
 */
export function getPublicBadges(badgeIds: BadgeId[]): BadgeId[] {
  return badgeIds.filter((id) => {
    const def = BADGE_DEFINITIONS[id];
    return def && !def.isInternalOnly;
  });
}
