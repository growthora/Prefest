import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitizes HTML string using DOMPurify to prevent XSS attacks.
 * Removes dangerous tags (script, iframe, object, etc.) and attributes (onclick, onerror, etc.).
 * 
 * @param html The potentially unsafe HTML string
 * @returns Sanitized HTML string safe for dangerouslySetInnerHTML
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  
  // Configure DOMPurify to allow specific tags/attributes if needed, 
  // or use default safe list. Default is usually good for basic rich text.
  // We can strict it further if needed.
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true }, // Only HTML, no SVG/MathML if not needed
    ADD_ATTR: ['target'], // Allow target="_blank" for links
  });
}
