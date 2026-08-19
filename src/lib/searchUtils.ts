import { db } from './firebase';
import { collection, query, where, getDocs, doc, getDoc, limit } from 'firebase/firestore';
import { CharacterItem, PromptItem, CreatorItem } from '../types';

export interface IdSearchResult {
  isIdQuery: boolean;
  numericId?: string;
  typeHint?: string;
  error?: string;
}

export interface ExactIdLookupResult {
  found: boolean;
  type: 'character' | 'prompt' | 'creator' | 'user';
  id: string;
  numericId: string;
  path: string;
  error?: string;
  result?: any;
}

/**
 * Removes Vietnamese tones/diacritics for flexible fuzzy searching
 */
export function removeVietnameseTones(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

/**
 * Normalizes text: trims whitespace, lowercases, and reduces multiple spaces
 */
export function normalizeSearchText(str: string | undefined | null): string {
  if (!str) return '';
  return str.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Checks if target string matches query text (supports accented, unaccented, and multi-word token matching)
 */
export function matchesSearchText(target: string | undefined | null, queryText: string): boolean {
  if (!target || !queryText) return false;
  const normTarget = normalizeSearchText(target);
  const normQuery = normalizeSearchText(queryText);
  if (!normQuery || !normTarget) return false;

  // 1. Direct lowercase substring match (handles Vietnamese with accents e.g. "Kỷ Ngôn" in "Đại thần Kỷ Ngôn")
  if (normTarget.includes(normQuery)) return true;

  // 2. Unaccented substring match (handles "ky ngon" in "Kỷ Ngôn" and vice versa)
  const strippedTarget = removeVietnameseTones(normTarget);
  const strippedQuery = removeVietnameseTones(normQuery);
  if (!strippedQuery) return false;
  if (strippedTarget.includes(strippedQuery)) return true;

  // 3. Multi-token match: if query has multiple words, check if all tokens appear in target
  const queryTokens = strippedQuery.split(/\s+/).filter(t => t.length > 0);
  if (queryTokens.length > 1) {
    const allTokensMatch = queryTokens.every(token => strippedTarget.includes(token));
    if (allTokensMatch) return true;
  }

  return false;
}

/**
 * Checks if an item matches the query across all its searchable fields
 */
export function matchesItemFields(fields: (string | undefined | null | string[])[], queryText: string): boolean {
  if (!queryText || !queryText.trim()) return true;
  const normQuery = normalizeSearchText(queryText);
  if (!normQuery) return true;

  const flattenedStrings: string[] = [];
  for (const f of fields) {
    if (!f) continue;
    if (Array.isArray(f)) {
      for (const item of f) {
        if (item) flattenedStrings.push(String(item));
      }
    } else {
      flattenedStrings.push(String(f));
    }
  }

  // 1. Check if any single field matches
  for (const str of flattenedStrings) {
    if (matchesSearchText(str, queryText)) return true;
  }

  // 2. Check across combined string for multi-token cross-field queries (e.g. keyword 1 in name, keyword 2 in tags)
  const combined = flattenedStrings.join(' ');
  if (matchesSearchText(combined, queryText)) return true;

  return false;
}

/**
 * Parses a query text to check if it's an explicit ID-oriented search.
 */
export function parseIdQuery(queryText: string): IdSearchResult {
  const trimmed = queryText.trim();
  if (!trimmed) {
    return { isIdQuery: false };
  }

  // 1. Direct 9-digit sequence as the entire query (e.g. "123456789")
  const pureDigitsMatch = trimmed.match(/^([0-9]{9})$/);
  if (pureDigitsMatch) {
    return {
      isIdQuery: true,
      numericId: pureDigitsMatch[1]
    };
  }

  // 2. Explicit ID format with slash/colon/dash/hash (e.g. "character/123456789", "id:123456789", "prompt-123456789")
  const explicitPrefixMatch = trimmed.match(/^(character|prompt|creator|user|id|mã|mã số)s?[\/:\-#]\s*(.*)$/i);
  if (explicitPrefixMatch) {
    const rawType = explicitPrefixMatch[1].toLowerCase();
    const rest = explicitPrefixMatch[2].trim();
    let typeHint = 'id';
    if (rawType.startsWith('char')) typeHint = 'character';
    else if (rawType.startsWith('prom')) typeHint = 'prompt';
    else if (rawType.startsWith('creat') || rawType.startsWith('user')) typeHint = 'creator';

    if (!rest) {
      return {
        isIdQuery: true,
        error: "Mã ID bị thiếu trong từ khóa tìm kiếm."
      };
    }

    const digitMatch = rest.match(/^([0-9]+)$/);
    if (digitMatch) {
      if (digitMatch[1].length === 9) {
        return {
          isIdQuery: true,
          numericId: digitMatch[1],
          typeHint
        };
      } else {
        return {
          isIdQuery: true,
          error: "Mã ID không đúng định dạng (ID phải có đúng 9 chữ số)."
        };
      }
    } else {
      return {
        isIdQuery: true,
        error: "Mã ID không đúng định dạng (ID phải có đúng 9 chữ số)."
      };
    }
  }

  // 3. Prefix with space + strictly digits (e.g. "character 123456789", "id 123456789", "mã số 123456789")
  const prefixSpaceDigitsMatch = trimmed.match(/^(character|prompt|creator|user|id|mã|mã số)s?\s+([0-9]+)$/i);
  if (prefixSpaceDigitsMatch) {
    const rawType = prefixSpaceDigitsMatch[1].toLowerCase();
    const digits = prefixSpaceDigitsMatch[2];
    let typeHint = 'id';
    if (rawType.startsWith('char')) typeHint = 'character';
    else if (rawType.startsWith('prom')) typeHint = 'prompt';
    else if (rawType.startsWith('creat') || rawType.startsWith('user')) typeHint = 'creator';

    if (digits.length === 9) {
      return {
        isIdQuery: true,
        numericId: digits,
        typeHint
      };
    } else {
      return {
        isIdQuery: true,
        error: "Mã ID không đúng định dạng (ID phải có đúng 9 chữ số)."
      };
    }
  }

  // 4. Standalone ID keyword without ID numbers (e.g. "id", "mã số", "mã id")
  if (/^(id|mã|mã số|mã id)$/i.test(trimmed)) {
    return {
      isIdQuery: true,
      error: "Mã ID bị thiếu trong từ khóa tìm kiếm."
    };
  }

  // 5. Query contains an isolated 9-digit number
  const isolated9Digits = trimmed.match(/\b([0-9]{9})\b/);
  if (isolated9Digits && /^[0-9\s]+$/.test(trimmed)) {
    return {
      isIdQuery: true,
      numericId: isolated9Digits[1]
    };
  }

  // 6. Query is purely numeric with wrong digit count (e.g. "123", "12345678")
  if (/^[0-9]+$/.test(trimmed)) {
    return {
      isIdQuery: true,
      error: "Mã ID không đúng định dạng (ID phải có đúng 9 chữ số)."
    };
  }

  return { isIdQuery: false };
}

/**
 * Looks up a parsed ID in Firebase Firestore across all searchable collections
 * and resolves the actual public record object.
 */
export async function lookupIdInFirebase(numericId: string, typeHint?: string): Promise<ExactIdLookupResult | null> {
  const collectionsToCheck = [
    { name: 'characters', path: '/character', label: 'Character', type: 'character' as const },
    { name: 'prompts', path: '/prompt', label: 'Prompt', type: 'prompt' as const },
    { name: 'users', path: '/creator', label: 'Creator', type: 'creator' as const }
  ];

  for (const col of collectionsToCheck) {
    if (typeHint && typeHint !== 'id') {
      if (typeHint === 'character' && col.name !== 'characters') continue;
      if (typeHint === 'prompt' && col.name !== 'prompts') continue;
      if ((typeHint === 'creator' || typeHint === 'user') && col.name !== 'users') continue;
    }

    // Try query by numericId
    const q = query(collection(db, col.name), where('numericId', '==', numericId), limit(1));
    const snap = await getDocs(q);
    let docSnap: any = !snap.empty ? snap.docs[0] : null;

    // Fallback: direct doc id lookup if numericId query returned empty
    if (!docSnap) {
      try {
        const directRef = doc(db, col.name, numericId);
        const directSnap = await getDoc(directRef);
        if (directSnap.exists()) {
          docSnap = directSnap;
        }
      } catch (err) {
        // ignore direct doc id error
      }
    }

    if (docSnap) {
      const docData = docSnap.data();

      // Check if soft deleted
      if (docData.deletedAt) {
        return {
          found: false,
          type: col.type,
          id: docSnap.id,
          numericId,
          path: '',
          error: "ID không tồn tại hoặc đã bị xóa khỏi hệ thống."
        };
      }

      if (col.name === 'users') {
        const isCreator = !!docData.creatorStatus;
        const targetType = isCreator ? 'creator' : 'user';
        const path = `/creator/${docSnap.id}`;

        const publicResult: CreatorItem = {
          id: docSnap.id,
          numericId: docData.numericId,
          displayName: docData.displayName || "Người dùng",
          avatar: docData.avatar,
          bio: docData.bio || "",
          role: docData.role || "USER",
          creatorStatus: isCreator,
          characterCount: docData.characterCount || 0,
          promptCount: docData.promptCount || 0,
          followerCount: docData.followerCount || 0,
          createdAt: docData.createdAt
        };

        return {
          found: true,
          type: targetType,
          id: docSnap.id,
          numericId,
          path,
          result: publicResult
        };
      } else if (col.name === 'characters') {
        const publicResult: CharacterItem = {
          id: docSnap.id,
          numericId: docData.numericId,
          name: docData.name,
          avatar: docData.avatar,
          slogan: docData.slogan,
          plot: docData.plot,
          gender: docData.gender,
          creatorId: docData.creatorId,
          creatorName: docData.creatorName || docData.creator || "Creator",
          tags: docData.tags || [],
          viewsCount: docData.viewCount || docData.viewsCount || 0,
          likesCount: docData.likeCount || docData.likesCount || 0,
          savesCount: docData.saveCount || docData.savesCount || 0,
          characterLink: docData.link || docData.characterLink || "",
          link: docData.link || docData.characterLink || "",
          createdAt: docData.createdAt
        };

        return {
          found: true,
          type: 'character',
          id: docSnap.id,
          numericId,
          path: `/character/${docSnap.id}`,
          result: publicResult
        };
      } else if (col.name === 'prompts') {
        const publicResult: PromptItem = {
          id: docSnap.id,
          numericId: docData.numericId,
          title: docData.name || docData.title,
          name: docData.name || docData.title,
          purpose: docData.purpose || docData.description,
          content: docData.content,
          authorName: docData.author || docData.authorName || docData.creatorName || "Cộng đồng",
          authorId: docData.authorId || docData.creatorId,
          tags: docData.tags || [],
          copyCount: docData.copyCount || 0,
          savesCount: docData.saveCount || docData.savesCount || docData.bookmarkCount || 0,
          createdAt: docData.createdAt
        };

        return {
          found: true,
          type: 'prompt',
          id: docSnap.id,
          numericId,
          path: `/prompt/${docSnap.id}`,
          result: publicResult
        };
      }
    }
  }

  return null;
}

export interface SearchOptions {
  type?: 'all' | 'character' | 'prompt' | 'creator';
  gender?: string;
  strictGender?: boolean;
  tags?: string[];
  strictTags?: boolean;
  keywords?: string[];
  sortBy?: 'relevance' | 'hot' | 'newest' | 'likes' | 'views' | 'copies';
}

export interface GroupedSearchResults {
  characters: CharacterItem[];
  prompts: PromptItem[];
  creators: CreatorItem[];
  exactMatch?: ExactIdLookupResult | null;
  totalCount: number;
}

/**
 * Standard Search (Search Thường):
 * Performs a comprehensive search directly across real Firestore collections (Characters, Prompts, Creators).
 * Matches across all searchable fields:
 * - Character: Name, Slogan, Plot, Tags, Gender, Creator Name, Link, NumericId, ID
 * - Prompt: Title/Name, Purpose, Content, Tags, Author Name, NumericId, ID
 * - Creator: Display Name, Bio, Role, NumericId, ID
 * 
 * Returns ALL matching results without arbitrary truncation.
 */
export async function searchAllCollections(
  queryText: string,
  options: SearchOptions = {}
): Promise<GroupedSearchResults> {
  const trimmed = queryText.trim();
  const searchType = options.type || 'all';
  const keywords = options.keywords && options.keywords.length > 0
    ? options.keywords.map(k => normalizeSearchText(k)).filter(Boolean)
    : trimmed.split(/\s+/).map(k => normalizeSearchText(k)).filter(k => k.length > 0);

  const matchedCharacters: { item: CharacterItem; score: number }[] = [];
  const matchedPrompts: { item: PromptItem; score: number }[] = [];
  const matchedCreators: { item: CreatorItem; score: number }[] = [];

  // Helper score calculator
  const calculateScore = (
    primaryText: string,
    secondaryText: string,
    extraTexts: string[],
    tags: string[] = []
  ): number => {
    let score = 0;
    const normPrimary = normalizeSearchText(primaryText);
    const normSecondary = normalizeSearchText(secondaryText);
    const normQuery = normalizeSearchText(trimmed);

    // Exact full query match in primary name/title
    if (normPrimary === normQuery) score += 150;
    else if (matchesSearchText(primaryText, trimmed)) score += 100;
    else if (matchesSearchText(secondaryText, trimmed)) score += 60;

    // Check tags
    if (tags.some(t => matchesSearchText(t, trimmed))) {
      score += 70;
    }

    // Check extra fields (plot, content, author, numericId, id)
    if (extraTexts.some(et => matchesSearchText(et, trimmed))) {
      score += 50;
    }

    // Check individual keywords
    for (const kw of keywords) {
      if (matchesSearchText(primaryText, kw)) score += 40;
      else if (matchesSearchText(secondaryText, kw)) score += 25;
      else if (tags.some(t => matchesSearchText(t, kw))) score += 30;
      else if (extraTexts.some(et => matchesSearchText(et, kw))) score += 20;
    }

    return score;
  };

  // 1. Search Characters
  if (searchType === 'all' || searchType === 'character') {
    try {
      const snap = await getDocs(collection(db, 'characters'));
      snap.docs.forEach(docSnap => {
        const data = docSnap.data();
        if (data.deletedAt) return;

        const charItem: CharacterItem = {
          id: docSnap.id,
          numericId: data.numericId,
          name: data.name || '',
          avatar: data.avatar || '',
          gender: data.gender || '',
          slogan: data.slogan || '',
          plot: data.plot || '',
          characterLink: data.link || data.characterLink || '',
          link: data.link || data.characterLink || '',
          creatorId: data.creatorId || '',
          creatorName: data.creatorName || data.creator || 'Creator',
          tags: data.tags || [],
          viewsCount: data.viewCount || data.viewsCount || 0,
          likesCount: data.likeCount || data.likesCount || 0,
          savesCount: data.saveCount || data.savesCount || 0,
          pinned: data.pinned || data.isPinned || false,
          createdAt: data.createdAt
        };

        // Strict Gender filter if explicitly requested via UI filter
        if (options.strictGender && options.gender && options.gender !== 'ALL' && charItem.gender !== options.gender) {
          return;
        }

        // Strict Tags filter if explicitly requested via UI filter
        if (options.strictTags && options.tags && options.tags.length > 0) {
          const hasTag = options.tags.some(t => charItem.tags.some(ct => matchesSearchText(ct, t)));
          if (!hasTag) return;
        }

        // Check if character matches query across all searchable fields
        const isMatched = !trimmed || matchesItemFields(
          [
            charItem.name,
            charItem.slogan,
            charItem.plot,
            charItem.tags,
            charItem.gender,
            charItem.creatorName,
            charItem.characterLink,
            charItem.numericId,
            charItem.id
          ],
          trimmed
        );

        if (isMatched) {
          let score = calculateScore(
            charItem.name,
            charItem.slogan,
            [charItem.plot, charItem.creatorName, charItem.gender, charItem.numericId || '', charItem.id],
            charItem.tags
          );

          if (charItem.pinned) score += 20;

          // Score bonus for matching UI filters
          if (options.gender && options.gender !== 'ALL' && charItem.gender === options.gender) {
            score += 30;
          }
          if (options.tags && options.tags.length > 0) {
            for (const optTag of options.tags) {
              if (charItem.tags.some(ct => matchesSearchText(ct, optTag))) {
                score += 40;
              }
            }
          }

          if (!trimmed) score = Math.max(score, 10);

          matchedCharacters.push({ item: charItem, score });
        }
      });
    } catch (e) {
      console.error("Error searching characters:", e);
    }
  }

  // 2. Search Prompts
  if (searchType === 'all' || searchType === 'prompt') {
    try {
      const snap = await getDocs(collection(db, 'prompts'));
      snap.docs.forEach(docSnap => {
        const data = docSnap.data();
        if (data.deletedAt) return;

        const promptItem: PromptItem = {
          id: docSnap.id,
          numericId: data.numericId,
          title: data.name || data.title || '',
          name: data.name || data.title || '',
          purpose: data.purpose || data.description || '',
          content: data.content || '',
          authorName: data.author || data.authorName || data.creatorName || 'Cộng đồng',
          authorId: data.authorId || data.creatorId || '',
          tags: data.tags || [],
          copyCount: data.copyCount || 0,
          savesCount: data.saveCount || data.savesCount || data.bookmarkCount || 0,
          viewsCount: data.viewCount || data.viewsCount || 0,
          pinned: data.pinned || data.isPinned || false,
          createdAt: data.createdAt
        };

        // Strict Tags filter if requested
        if (options.strictTags && options.tags && options.tags.length > 0) {
          const hasTag = options.tags.some(t => promptItem.tags.some(pt => matchesSearchText(pt, t)));
          if (!hasTag) return;
        }

        // Check if prompt matches query across all searchable fields
        const isMatched = !trimmed || matchesItemFields(
          [
            promptItem.name,
            promptItem.title,
            promptItem.purpose,
            promptItem.content,
            promptItem.tags,
            promptItem.authorName,
            promptItem.numericId,
            promptItem.id
          ],
          trimmed
        );

        if (isMatched) {
          let score = calculateScore(
            promptItem.name || promptItem.title || '',
            promptItem.purpose,
            [promptItem.content, promptItem.authorName, promptItem.numericId || '', promptItem.id],
            promptItem.tags
          );

          if (promptItem.pinned) score += 20;

          if (options.tags && options.tags.length > 0) {
            for (const optTag of options.tags) {
              if (promptItem.tags.some(pt => matchesSearchText(pt, optTag))) {
                score += 40;
              }
            }
          }

          if (!trimmed) score = Math.max(score, 10);

          matchedPrompts.push({ item: promptItem, score });
        }
      });
    } catch (e) {
      console.error("Error searching prompts:", e);
    }
  }

  // 3. Search Creators & Users
  if (searchType === 'all' || searchType === 'creator') {
    try {
      const snap = await getDocs(collection(db, 'users'));
      snap.docs.forEach(docSnap => {
        const data = docSnap.data();
        if (data.deletedAt || data.isLocked) return;

        const creatorItem: CreatorItem = {
          id: docSnap.id,
          numericId: data.numericId,
          displayName: data.displayName || 'Người dùng',
          avatar: data.avatar || '',
          bio: data.bio || '',
          role: data.role || 'USER',
          creatorStatus: !!data.creatorStatus,
          characterCount: data.characterCount || 0,
          promptCount: data.promptCount || 0,
          followerCount: data.followerCount || 0,
          createdAt: data.createdAt
        };

        // Check if creator matches query across all searchable fields
        const isMatched = !trimmed || matchesItemFields(
          [
            creatorItem.displayName,
            creatorItem.bio,
            creatorItem.role,
            creatorItem.numericId,
            creatorItem.id
          ],
          trimmed
        );

        if (isMatched) {
          let score = calculateScore(
            creatorItem.displayName,
            creatorItem.bio || '',
            [creatorItem.numericId || '', creatorItem.id, creatorItem.role || '']
          );

          if (creatorItem.creatorStatus) {
            score += 25;
          }

          if (!trimmed) score = Math.max(score, 10);

          matchedCreators.push({ item: creatorItem, score });
        }
      });
    } catch (e) {
      console.error("Error searching creators:", e);
    }
  }

  // Sorting
  const sortBy = options.sortBy || 'relevance';

  const sortItems = <T extends { score: number; item: any }>(
    list: T[],
    getPopularScore: (item: any) => number
  ): any[] => {
    return list
      .sort((a, b) => {
        if (sortBy === 'relevance') {
          return b.score - a.score;
        }
        if (sortBy === 'hot' || sortBy === 'likes' || sortBy === 'views' || sortBy === 'copies') {
          return getPopularScore(b.item) - getPopularScore(a.item);
        }
        if (sortBy === 'newest') {
          const timeA = a.item.createdAt?.seconds || 0;
          const timeB = b.item.createdAt?.seconds || 0;
          return timeB - timeA;
        }
        return b.score - a.score;
      })
      .map(entry => entry.item);
  };

  const finalCharacters = sortItems(
    matchedCharacters,
    c => (c.likesCount || 0) * 3 + (c.savesCount || 0) * 2 + (c.viewsCount || 0)
  );

  const finalPrompts = sortItems(
    matchedPrompts,
    p => (p.copyCount || 0) * 3 + (p.savesCount || 0) * 2 + (p.viewsCount || 0)
  );

  const finalCreators = sortItems(
    matchedCreators,
    cr => (cr.followerCount || 0) * 5 + (cr.characterCount || 0) * 2 + (cr.promptCount || 0)
  );

  const totalCount = finalCharacters.length + finalPrompts.length + finalCreators.length;

  return {
    characters: finalCharacters,
    prompts: finalPrompts,
    creators: finalCreators,
    totalCount
  };
}
