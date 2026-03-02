import React from 'react';
import { sanitizeHtml } from '@/lib/sanitize';
import { cn } from '@/lib/utils';

interface SafeHtmlProps extends React.HTMLAttributes<HTMLDivElement> {
  content: string;
  as?: React.ElementType;
}

/**
 * SafeHtml component for rendering sanitized HTML content.
 * Uses DOMPurify to prevent XSS attacks.
 * 
 * Usage:
 * <SafeHtml content={htmlString} className="prose" />
 */
export function SafeHtml({ content, className, as: Component = 'div', ...props }: SafeHtmlProps) {
  const sanitizedContent = sanitizeHtml(content);

  return (
    <Component
      className={cn('break-words', className)}
      dangerouslySetInnerHTML={{ __html: sanitizedContent }}
      {...props}
    />
  );
}
