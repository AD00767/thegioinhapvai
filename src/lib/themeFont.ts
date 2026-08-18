export type ThemeMode = 'LIGHT' | 'DARK' | 'SYSTEM';
export type FontSize = 'SMALL' | 'MEDIUM' | 'LARGE';

let mediaQueryListener: ((e: MediaQueryListEvent) => void) | null = null;
let currentMediaQuery: MediaQueryList | null = null;

export function getEffectiveTheme(mode: ThemeMode): 'LIGHT' | 'DARK' {
  if (mode === 'DARK') return 'DARK';
  if (mode === 'LIGHT') return 'LIGHT';
  const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  return isDark ? 'DARK' : 'LIGHT';
}

export function applyTheme(mode: ThemeMode) {
  localStorage.setItem('app_theme_mode', mode);
  window.dispatchEvent(new CustomEvent('app-theme-changed', { detail: mode }));

  // Clean up any previous media query listener
  if (currentMediaQuery && mediaQueryListener) {
    currentMediaQuery.removeEventListener('change', mediaQueryListener);
    mediaQueryListener = null;
    currentMediaQuery = null;
  }

  const updateDocumentTheme = (isDark: boolean) => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Update theme-color meta tag for mobile browsers (iOS Safari & Android Chrome)
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.setAttribute('name', 'theme-color');
      document.head.appendChild(metaThemeColor);
    }
    metaThemeColor.setAttribute('content', isDark ? '#0a0a0a' : '#ffffff');
  };

  let isDark = false;
  if (mode === 'DARK') {
    isDark = true;
  } else if (mode === 'LIGHT') {
    isDark = false;
  } else if (mode === 'SYSTEM') {
    if (window.matchMedia) {
      currentMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      isDark = currentMediaQuery.matches;

      mediaQueryListener = (e: MediaQueryListEvent) => {
        updateDocumentTheme(e.matches);
      };
      currentMediaQuery.addEventListener('change', mediaQueryListener);
    }
  }

  updateDocumentTheme(isDark);
}

export function applyFontSize(size: FontSize) {
  localStorage.setItem('app_font_size', size);

  if (size === 'SMALL') {
    document.documentElement.style.fontSize = '14px';
  } else if (size === 'LARGE') {
    document.documentElement.style.fontSize = '18px';
  } else {
    document.documentElement.style.fontSize = '16px';
  }
}

export function initThemeAndFont() {
  const savedTheme = (localStorage.getItem('app_theme_mode') as ThemeMode) || 'SYSTEM';
  const savedFont = (localStorage.getItem('app_font_size') as FontSize) || 'MEDIUM';

  applyTheme(savedTheme);
  applyFontSize(savedFont);
}

