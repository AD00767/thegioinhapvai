import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/useAuthStore';

interface UserInteractionsContextType {
  likedCharacterIds: Set<string>;
  bookmarkedCharacterIds: Set<string>;
  bookmarkedPromptIds: Set<string>;
  isCharacterLiked: (characterId: string) => boolean;
  isCharacterBookmarked: (characterId: string) => boolean;
  isPromptBookmarked: (promptId: string) => boolean;
  setLikedState: (characterId: string, isLiked: boolean) => void;
  setBookmarkState: (targetId: string, targetType: 'CHARACTER' | 'PROMPT', isBookmarked: boolean) => void;
  refreshInteractions: () => Promise<void>;
}

const UserInteractionsContext = createContext<UserInteractionsContextType>({
  likedCharacterIds: new Set(),
  bookmarkedCharacterIds: new Set(),
  bookmarkedPromptIds: new Set(),
  isCharacterLiked: () => false,
  isCharacterBookmarked: () => false,
  isPromptBookmarked: () => false,
  setLikedState: () => {},
  setBookmarkState: () => {},
  refreshInteractions: async () => {},
});

export const UserInteractionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuthStore();
  const [likedCharacterIds, setLikedCharacterIds] = useState<Set<string>>(new Set());
  const [bookmarkedCharacterIds, setBookmarkedCharacterIds] = useState<Set<string>>(new Set());
  const [bookmarkedPromptIds, setBookmarkedPromptIds] = useState<Set<string>>(new Set());

  const fetchInteractions = async () => {
    if (!user?.id) {
      setLikedCharacterIds(new Set());
      setBookmarkedCharacterIds(new Set());
      setBookmarkedPromptIds(new Set());
      return;
    }

    try {
      // 1. Fetch character likes for current user
      const qLike = query(collection(db, 'character_likes'), where('userId', '==', user.id));
      const snapLike = await getDocs(qLike);
      const likesSet = new Set<string>();
      snapLike.docs.forEach(docSnap => {
        const charId = docSnap.data().characterId;
        if (charId) likesSet.add(charId);
      });
      setLikedCharacterIds(likesSet);

      // 2. Fetch bookmarks for current user
      const qBook = query(collection(db, 'bookmarks'), where('userId', '==', user.id));
      const snapBook = await getDocs(qBook);
      const charBooksSet = new Set<string>();
      const promptBooksSet = new Set<string>();
      snapBook.docs.forEach(docSnap => {
        const data = docSnap.data();
        if (data.targetType === 'CHARACTER' && data.targetId) {
          charBooksSet.add(data.targetId);
        } else if (data.targetType === 'PROMPT' && data.targetId) {
          promptBooksSet.add(data.targetId);
        }
      });
      setBookmarkedCharacterIds(charBooksSet);
      setBookmarkedPromptIds(promptBooksSet);
    } catch (err) {
      console.error("Error fetching user interactions:", err);
    }
  };

  useEffect(() => {
    fetchInteractions();
  }, [user?.id]);

  const isCharacterLiked = (characterId: string) => likedCharacterIds.has(characterId);
  const isCharacterBookmarked = (characterId: string) => bookmarkedCharacterIds.has(characterId);
  const isPromptBookmarked = (promptId: string) => bookmarkedPromptIds.has(promptId);

  const setLikedState = (characterId: string, isLiked: boolean) => {
    setLikedCharacterIds(prev => {
      const next = new Set(prev);
      if (isLiked) next.add(characterId);
      else next.delete(characterId);
      return next;
    });
  };

  const setBookmarkState = (targetId: string, targetType: 'CHARACTER' | 'PROMPT', isBookmarked: boolean) => {
    if (targetType === 'CHARACTER') {
      setBookmarkedCharacterIds(prev => {
        const next = new Set(prev);
        if (isBookmarked) next.add(targetId);
        else next.delete(targetId);
        return next;
      });
    } else {
      setBookmarkedPromptIds(prev => {
        const next = new Set(prev);
        if (isBookmarked) next.add(targetId);
        else next.delete(targetId);
        return next;
      });
    }
  };

  return (
    <UserInteractionsContext.Provider
      value={{
        likedCharacterIds,
        bookmarkedCharacterIds,
        bookmarkedPromptIds,
        isCharacterLiked,
        isCharacterBookmarked,
        isPromptBookmarked,
        setLikedState,
        setBookmarkState,
        refreshInteractions: fetchInteractions,
      }}
    >
      {children}
    </UserInteractionsContext.Provider>
  );
};

export const useUserInteractions = () => useContext(UserInteractionsContext);
