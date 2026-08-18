import { 
  doc, 
  getDoc, 
  getDocs, 
  collection, 
  query, 
  where, 
  runTransaction, 
  addDoc, 
  updateDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from './firebase';

export interface FollowResult {
  success: boolean;
  following: boolean;
  followerCount: number;
  message?: string;
}

/**
 * Checks if a specific user follows a creator using deterministic ID first,
 * with fallback to query for legacy documents.
 */
export async function checkIsFollowing(followerId: string, creatorId: string): Promise<boolean> {
  if (!followerId || !creatorId || followerId === creatorId) return false;

  try {
    // 1. Check deterministic doc ID
    const followDocId = `${followerId}_${creatorId}`;
    const followRef = doc(db, 'follows', followDocId);
    const followSnap = await getDoc(followRef);

    if (followSnap.exists()) {
      return true;
    }

    // 2. Fallback check for any legacy un-keyed documents
    const q = query(
      collection(db, 'follows'),
      where('followerId', '==', followerId)
    );
    const querySnap = await getDocs(q);
    
    return querySnap.docs.some(d => {
      const data = d.data();
      return data.creatorId === creatorId || data.targetCreatorId === creatorId;
    });
  } catch (error) {
    console.error("Error checking follow status:", error);
    return false;
  }
}

/**
 * Reconciles and rebuilds the followerCount stored on the creator's user document
 * against actual active follow records in the database.
 */
export async function reconcileFollowerCount(creatorId: string): Promise<number> {
  if (!creatorId) return 0;

  try {
    // Query all follow documents targeting this creator
    const q1 = query(
      collection(db, 'follows'),
      where('targetCreatorId', '==', creatorId)
    );
    const snap1 = await getDocs(q1);
    
    const q2 = query(
      collection(db, 'follows'),
      where('creatorId', '==', creatorId)
    );
    const snap2 = await getDocs(q2);

    // Use a Set to ensure we only count unique follower IDs
    const uniqueFollowerIds = new Set<string>();
    
    snap1.docs.forEach(d => {
      const fId = d.data().followerId;
      if (fId && fId !== creatorId) uniqueFollowerIds.add(fId);
    });
    
    snap2.docs.forEach(d => {
      const fId = d.data().followerId;
      if (fId && fId !== creatorId) uniqueFollowerIds.add(fId);
    });

    const actualCount = uniqueFollowerIds.size;

    // Verify stored count on user doc
    const userRef = doc(db, 'users', creatorId);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const storedCount = userSnap.data().followerCount;
      if (storedCount !== actualCount) {
        console.log(`[FollowIntegrity] Reconciling follower count for creator ${creatorId}: stored ${storedCount} -> actual ${actualCount}`);
        await updateDoc(userRef, { followerCount: actualCount });
      }
    }

    return actualCount;
  } catch (error) {
    console.error("Error reconciling follower count:", error);
    return 0;
  }
}

/**
 * Gets exact follower count derived from database, with auto-reconciliation.
 */
export async function getFollowerCount(creatorId: string): Promise<number> {
  return reconcileFollowerCount(creatorId);
}

/**
 * Toggles follow/unfollow with full integrity guarantees:
 * - Deterministic follow document key prevents double-follow.
 * - Double click protection via atomic transaction.
 * - Cannot follow self.
 * - Counter update and return value derived directly from transaction.
 */
export async function toggleFollow(
  followerId: string, 
  creatorId: string, 
  followerInfo?: { displayName?: string; avatar?: string }
): Promise<FollowResult> {
  if (!followerId || !creatorId) {
    return { success: false, following: false, followerCount: 0, message: "Yêu cầu không hợp lệ." };
  }

  if (followerId === creatorId) {
    return { success: false, following: false, followerCount: 0, message: "Bạn không thể tự theo dõi chính mình!" };
  }

  const followDocId = `${followerId}_${creatorId}`;
  const followRef = doc(db, 'follows', followDocId);
  const creatorRef = doc(db, 'users', creatorId);

  try {
    // Execute atomic transaction
    const result = await runTransaction(db, async (transaction) => {
      const followSnap = await transaction.get(followRef);
      const creatorSnap = await transaction.get(creatorRef);

      const currentStoredCount = creatorSnap.exists() ? (creatorSnap.data().followerCount || 0) : 0;

      if (followSnap.exists()) {
        // UNFOLLOW FLOW
        transaction.delete(followRef);
        const newCount = Math.max(0, currentStoredCount - 1);
        if (creatorSnap.exists()) {
          transaction.update(creatorRef, { followerCount: newCount });
        }

        return {
          following: false,
          newCount
        };
      } else {
        // FOLLOW FLOW
        transaction.set(followRef, {
          followerId,
          creatorId,
          targetCreatorId: creatorId,
          followerName: followerInfo?.displayName || 'Người dùng',
          followerAvatar: followerInfo?.avatar || '',
          createdAt: serverTimestamp()
        });

        const newCount = currentStoredCount + 1;
        if (creatorSnap.exists()) {
          transaction.update(creatorRef, { followerCount: newCount });
        }

        return {
          following: true,
          newCount
        };
      }
    });

    // Create notification if newly followed
    if (result.following) {
      try {
        await addDoc(collection(db, 'notifications'), {
          userId: creatorId,
          type: 'FOLLOW',
          title: 'Người theo dõi mới',
          body: `${followerInfo?.displayName || "Một người dùng"} đã bắt đầu theo dõi bạn.`,
          read: false,
          createdAt: serverTimestamp()
        });
      } catch (notifErr) {
        console.error("Failed to trigger follow notification:", notifErr);
      }
    }

    // Run background reconciliation to ensure exact count match
    const reconciledCount = await reconcileFollowerCount(creatorId);

    return {
      success: true,
      following: result.following,
      followerCount: reconciledCount,
      message: result.following ? "Đã theo dõi Creator!" : "Đã hủy theo dõi Creator."
    };
  } catch (error) {
    console.error("Error toggling follow:", error);
    
    // Fallback reconciliation if transaction hits edge case
    const currentActualCount = await reconcileFollowerCount(creatorId);
    const currentlyFollowing = await checkIsFollowing(followerId, creatorId);

    return {
      success: false,
      following: currentlyFollowing,
      followerCount: currentActualCount,
      message: "Thao tác thất bại, vui lòng thử lại."
    };
  }
}
