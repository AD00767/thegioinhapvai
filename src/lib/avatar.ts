/**
 * Standard Default Avatar for "Thế giới nhập vai_AD"
 * Specification:
 * - Canvas 1:1
 * - Charcoal/Dark Gray background (#27272a)
 * - Light gray circle for head (#9ca3af)
 * - Light gray dome shape for body (#9ca3af)
 * - Symmetrical, cropped at bottom edge, minimalist, no facial features, no gradients, no shadows
 */
export const DEFAULT_AVATAR = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%2327272a"/><circle cx="50" cy="35" r="18" fill="%239ca3af"/><path d="M 18 100 C 18 68, 32 58, 50 58 C 68 58, 82 68, 82 100 Z" fill="%239ca3af"/></svg>`;

/**
 * Returns a valid avatar URL string or the standardized default avatar.
 */
export function getValidAvatar(avatarUrl?: string | null): string {
  if (!avatarUrl || typeof avatarUrl !== 'string') {
    return DEFAULT_AVATAR;
  }
  const trimmed = avatarUrl.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') {
    return DEFAULT_AVATAR;
  }
  // Replace obsolete dicebear placeholders with standard default avatar
  if (trimmed.includes('api.dicebear.com')) {
    return DEFAULT_AVATAR;
  }
  return trimmed;
}
