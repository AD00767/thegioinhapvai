/**
 * Centralized URL builder for sharing resources.
 * Ensures cross-device and cross-environment link consistency.
 * 
 * Uses the production canonical base URL from environment variables if available.
 * Prefix with VITE_ to expose to client-side code in Vite.
 */

/**
 * Validates if a string is a valid absolute HTTP or HTTPS URL.
 */
const isValidAbsoluteUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * Returns the canonical base URL for public share links.
 * This is strictly controlled by environment variables.
 * Returns null if not properly configured.
 */
export const getCanonicalBaseUrl = () => {
  const candidates = [
    import.meta.env.VITE_PUBLIC_APP_URL,
    import.meta.env.VITE_CANONICAL_BASE_URL
  ];

  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (trimmed !== '' && trimmed !== 'https://example.com' && trimmed !== '0509') {
        if (isValidAbsoluteUrl(trimmed)) {
          return trimmed.replace(/\/$/, '');
        }
      }
    }
  }

  return null;
};

/**
 * Required behavior for public Share Links.
 * Returns canonical URL if configured, or falls back safely to current origin.
 */
export const getBaseUrl = () => {
  const canonicalUrl = getCanonicalBaseUrl();

  if (canonicalUrl) {
    return canonicalUrl;
  }

  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    return window.location.origin.replace(/\/$/, '');
  }

  return 'http://localhost:3000';
};

export const buildCharacterUrl = (id: string, numericId?: string) => {
  const baseUrl = getBaseUrl();
  const finalId = numericId || id;
  return `${baseUrl}/character/${finalId}`;
};

export const buildPromptUrl = (id: string) => {
  const baseUrl = getBaseUrl();
  return `${baseUrl}/prompt/${id}`;
};

export const buildCreatorUrl = (id: string) => {
  const baseUrl = getBaseUrl();
  return `${baseUrl}/creator/${id}`;
};

export const buildUserUrl = (id: string) => {
  const baseUrl = getBaseUrl();
  return `${baseUrl}/user/${id}`;
};

/**
 * Returns a canonical URL for a given path, ensuring it starts with the production base URL.
 */
export const getCanonicalUrl = (path: string) => {
  // Ensure path starts with /
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  // Remove trailing / from base URL if present to avoid //
  const baseUrl = getBaseUrl().replace(/\/$/, '');
  return `${baseUrl}${cleanPath}`;
};

/**
 * Returns the current path's canonical version (ignoring dev/preview prefixes in origin)
 */
export const getCurrentCanonicalUrl = () => {
  if (typeof window !== 'undefined') {
    return getCanonicalUrl(window.location.pathname + window.location.search);
  }
  return getCanonicalUrl('/');
};
