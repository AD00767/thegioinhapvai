export interface CustomSocialLink {
  id: string;
  title: string;
  url: string;
}

export interface CharacterItem {
  id: string;
  numericId?: string;
  name: string;
  avatar: string;
  gender: string;
  slogan: string;
  plot: string;
  creatorNote?: string;
  openingScene?: string;
  hasLink?: boolean;
  characterLink: string;
  link?: string;
  additionalLinks?: string[];
  creatorId: string;
  creatorName: string;
  creatorAvatar?: string;
  tags: string[];
  likesCount?: number;
  savesCount?: number;
  viewsCount?: number;
  sharesCount?: number;
  pinned?: boolean;
  isPinned?: boolean;
  createdAt?: any;
  updatedAt?: any;
  deletedAt?: string | null;
}

export interface PromptItem {
  id: string;
  numericId?: string;
  title?: string;
  name?: string;
  purpose: string;
  content: string;
  tags: string[];
  referenceLinks?: string[];
  images?: string[];
  notes?: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  copyCount?: number;
  savesCount?: number;
  viewsCount?: number;
  sharesCount?: number;
  pinned?: boolean;
  isPinned?: boolean;
  createdAt?: any;
  updatedAt?: any;
  deletedAt?: string | null;
}

export interface CreatorItem {
  id: string;
  numericId?: string;
  displayName: string;
  email?: string;
  avatar?: string;
  bio?: string;
  statusMessage?: string;
  creatorStatus: boolean;
  role?: 'USER' | 'CREATOR' | 'MODERATOR' | 'ADMIN';
  permissions?: string[];
  isLocked?: boolean;
  lockReason?: string;
  lockExpiresAt?: string;
  restrictedActivities?: string[];
  restrictionExpiresAt?: string;
  strikeCount?: number;
  badges?: string[];
  socialLinks?: {
    facebook?: string;
    instagram?: string;
    tiktok?: string;
    discord?: string;
  };
  customLinks?: Array<{ id: string; title: string; url: string }>;
  characterCount?: number;
  promptCount?: number;
  followerCount?: number;
  followingCount?: number;
  totalLikes?: number;
  totalSaves?: number;
  sharesCount?: number;
  createdAt?: any;
}

export interface ReportItem {
  id: string;
  targetId: string;
  targetType: 'CHARACTER' | 'PROMPT' | 'CREATOR' | 'USER' | 'COMMENT' | 'FEEDBACK';
  targetName: string;
  reason: string;
  description: string;
  attachmentUrl?: string;
  status: 'PENDING' | 'REVIEWING' | 'RESOLVED' | 'REJECTED' | 'DISMISSED';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reporterId: string;
  reporterName: string;
  adminResponse?: string;
  processedBy?: string;
  createdAt: any;
  updatedAt: any;
}

export interface AppealItem {
  id: string;
  decisionId: string;
  userId: string;
  userName: string;
  targetType: string;
  targetName: string;
  reason: string;
  description: string;
  proofImageUrl?: string;
  status: 'PENDING' | 'REVIEWING' | 'RESOLVED' | 'REJECTED';
  adminResponse?: string;
  processedBy?: string;
  createdAt: any;
  updatedAt: any;
}

export interface AuditLogItem {
  id: string;
  executorId: string;
  executorName: string;
  executorRole: string;
  action: string;
  targetId?: string;
  targetType?: string;
  statusBefore?: any;
  statusAfter?: any;
  reason?: string;
  details: string;
  createdAt: any;
}

export interface CreatorRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reason?: string;
  processedBy?: string;
  createdAt: any;
  updatedAt: any;
}
