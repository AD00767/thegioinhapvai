export interface CustomSocialLink {
  id: string;
  title: string;
  url: string;
}

export interface UserProfile {
  id: string;
  displayName: string;
  email?: string;
  avatar?: string;
  bio?: string;
  statusMessage?: string;
  featuredBadge?: string;
  badges?: string[];
  socialLinks?: {
    facebook?: string;
    instagram?: string;
    tiktok?: string;
    discord?: string;
  };
  customLinks?: CustomSocialLink[];
  role: 'USER' | 'ADMIN';
  creatorStatus: boolean;
  creatorRequestStatus?: 'IDLE' | 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt?: any;
  updatedAt?: any;
}

export interface CharacterItem {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorAvatar?: string;
  name: string;
  avatar: string;
  gender: string;
  slogan: string;
  plot: string;
  link: string;
  tags: string[];
  pinned?: boolean;
  isPinned?: boolean;
  likesCount?: number;
  savesCount?: number;
  viewsCount?: number;
  createdAt?: any;
  deletedAt?: any;
}

export interface PromptItem {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  name: string;
  purpose: string;
  content: string;
  tags: string[];
  pinned?: boolean;
  isPinned?: boolean;
  copyCount?: number;
  savesCount?: number;
  viewsCount?: number;
  createdAt?: any;
  deletedAt?: any;
}

export interface FollowRecord {
  id: string;
  followerId: string;
  followerName: string;
  followerAvatar?: string;
  targetCreatorId: string;
  targetCreatorName?: string;
  targetCreatorAvatar?: string;
  createdAt?: any;
}

export interface LikeRecord {
  id: string;
  userId: string;
  characterId: string;
  createdAt?: any;
}

export interface BookmarkRecord {
  id: string;
  userId: string;
  targetId: string;
  targetType: 'CHARACTER' | 'PROMPT';
  createdAt?: any;
}
