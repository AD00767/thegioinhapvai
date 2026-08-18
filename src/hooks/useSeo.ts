import { useEffect } from 'react';
import { getCurrentCanonicalUrl } from '../lib/urls';

interface SeoProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article' | 'profile';
}

export function useSeo({ title, description, image, url, type = 'website' }: SeoProps) {
  useEffect(() => {
    // Title
    const fullTitle = title ? `${title} | Thế Giới Nhập vai AD` : 'Thế Giới Nhập vai AD';
    document.title = fullTitle;

    // Helper to update meta tag
    const updateMeta = (property: string, content: string, isName = false) => {
      let element = document.querySelector(`meta[${isName ? 'name' : 'property'}="${property}"]`);
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(isName ? 'name' : 'property', property);
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    // Helper to update link tag
    const updateLink = (rel: string, href: string) => {
      let element = document.querySelector(`link[rel="${rel}"]`);
      if (!element) {
        element = document.createElement('link');
        element.setAttribute('rel', rel);
        document.head.appendChild(element);
      }
      element.setAttribute('href', href);
    };

    // Standard Meta
    if (description) updateMeta('description', description, true);

    // Canonical
    const currentUrl = url || getCurrentCanonicalUrl();
    updateLink('canonical', currentUrl);

    // Open Graph
    updateMeta('og:title', fullTitle);
    if (description) updateMeta('og:description', description);
    if (image) updateMeta('og:image', image);
    updateMeta('og:url', currentUrl);
    updateMeta('og:type', type);

    // Twitter
    updateMeta('twitter:card', 'summary_large_image', true);
    updateMeta('twitter:title', fullTitle, true);
    if (description) updateMeta('twitter:description', description, true);
    if (image) updateMeta('twitter:image', image, true);

    return () => {
      // We don't necessarily want to remove them on unmount to keep the last state
      // but we could reset title
      document.title = 'Thế Giới Nhập vai AD';
    };
  }, [title, description, image, url, type]);
}
