import { useMemo } from 'preact/hooks';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Notes-style links should never navigate the SPA away in-place.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener');
  }
});

// Renders user-authored markdown (bold, italic, headers, lists, links —
// bare URLs autolink via GFM). Sanitized with DOMPurify, so raw HTML in
// the source is stripped rather than rendered.
export function Markdown({ text, class: className = '' }) {
  const html = useMemo(
    () => DOMPurify.sanitize(marked.parse(text || '', { gfm: true, breaks: true, async: false })),
    [text]
  );
  return (
    <div
      class={`markdown-body text-sm text-gray-600 ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
