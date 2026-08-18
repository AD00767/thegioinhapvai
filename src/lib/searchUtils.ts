import { db } from './firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

export interface IdSearchResult {
  isIdQuery: boolean;
  numericId?: string;
  typeHint?: string;
  error?: string;
}

/**
 * Parses a query text to check if it's an ID-oriented search.
 * It identifies:
 * - Direct 9-digit queries: "123456789"
 * - Prefixed 9-digit queries: "character: 123456789", "id/123456789", "mã số 123456789"
 * - Incomplete ID inputs: "character/" or "id: 123" (returns error)
 */
export function parseIdQuery(queryText: string): IdSearchResult {
  const trimmed = queryText.trim();
  if (!trimmed) {
    return { isIdQuery: false };
  }

  // Common prefixes including Vietnamese ones
  const prefixes = [
    /^(character|prompt|creator|user|id|mã|mã số)s?[\/\s-:]+/i,
    /^(character|prompt|creator|user|id|mã|mã số)s?$/i
  ];

  let hasPrefix = false;
  let typeHint = '';

  for (const regex of prefixes) {
    const match = trimmed.match(regex);
    if (match) {
      hasPrefix = true;
      if (match[1]) {
        const word = match[1].toLowerCase();
        if (word === 'character') typeHint = 'character';
        else if (word === 'prompt') typeHint = 'prompt';
        else if (word === 'creator' || word === 'user') typeHint = 'creator';
        else typeHint = 'id';
      }
      break;
    }
  }

  // Check if there is exactly a 9-digit number anywhere in the query
  const exact9Digits = trimmed.match(/\b([0-9]{9})\b/);
  if (exact9Digits) {
    const numId = exact9Digits[1];
    let foundHint = typeHint;
    if (!foundHint) {
      if (/character/i.test(trimmed)) foundHint = 'character';
      else if (/prompt/i.test(trimmed)) foundHint = 'prompt';
      else if (/(creator|user|tác giả)/i.test(trimmed)) foundHint = 'creator';
    }
    return {
      isIdQuery: true,
      numericId: numId,
      typeHint: foundHint || undefined
    };
  }

  // Detect numeric input with incorrect digit count (e.g. "123", "1234567890")
  const anyDigitsMatch = trimmed.match(/\b([0-9]+)\b/);
  if (anyDigitsMatch) {
    const digits = anyDigitsMatch[1];
    if (digits.length !== 9 && (hasPrefix || /^[0-9]+$/.test(trimmed))) {
      return {
        isIdQuery: true,
        error: "Mã ID không đúng định dạng (ID phải có đúng 9 chữ số)."
      };
    }
  }

  // If a prefix exists but no digits at all (e.g., "character/", "id:")
  if (hasPrefix && !anyDigitsMatch) {
    return {
      isIdQuery: true,
      error: "Mã ID bị thiếu trong từ khóa tìm kiếm."
    };
  }

  // If search query is exactly "id", "mã", "mã số" or similar
  if (/^(id|mã|mã số)$/i.test(trimmed)) {
    return {
      isIdQuery: true,
      error: "Mã ID bị thiếu trong từ khóa tìm kiếm."
    };
  }

  return { isIdQuery: false };
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
 * Looks up a parsed ID in Firebase Firestore across all searchable collections
 * and resolves the actual public record object.
 */
export async function lookupIdInFirebase(numericId: string, typeHint?: string): Promise<ExactIdLookupResult | null> {
  const collectionsToCheck = [
    { name: 'characters', path: '/characters', label: 'Character', type: 'character' as const },
    { name: 'prompts', path: '/prompts', label: 'Prompt', type: 'prompt' as const },
    { name: 'users', path: '/creators', label: 'Creator', type: 'creator' as const }
  ];

  for (const col of collectionsToCheck) {
    if (typeHint) {
      if (typeHint === 'character' && col.name !== 'characters') continue;
      if (typeHint === 'prompt' && col.name !== 'prompts') continue;
      if ((typeHint === 'creator' || typeHint === 'user') && col.name !== 'users') continue;
    }

    const q = query(collection(db, col.name), where('numericId', '==', numericId));
    const snap = await getDocs(q);
    let docSnap: any = !snap.empty ? snap.docs[0] : null;

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
        if (docData.role === 'ADMIN' || docData.role === 'MODERATOR') {
          return {
            found: false,
            type: 'user',
            id: docSnap.id,
            numericId,
            path: '',
            error: "ID thuộc quyền quản trị viên hoặc đã bị ẩn."
          };
        }

        const isCreator = !!docData.creatorStatus;
        const targetType = isCreator ? 'creator' : 'user';
        const path = `/creator/${docSnap.id}`;

        const publicResult = {
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
        const publicResult = {
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
          createdAt: docData.createdAt,
          link: docData.link
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
        const publicResult = {
          id: docSnap.id,
          numericId: docData.numericId,
          title: docData.name || docData.title,
          purpose: docData.purpose || docData.description,
          content: docData.content,
          author: docData.author || docData.creatorName || "Cộng đồng",
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
