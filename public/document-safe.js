// Plain customer values and administrator-authored formatting have separate render paths.
import DOMPurify from './document-purify.js';

export const escapeDocumentText = value => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

export function documentUrl(value, image = false) {
  const raw = String(value ?? '').trim();
  if (!raw || /[\u0000-\u001f\u007f\\]/.test(raw)) return '';
  // Photos may be existing uploaded raster data. SVG/HTML data and blob URLs are excluded.
  if (image && /^data:image\/(?:png|jpeg|jpg|webp|gif|avif);base64,[a-z\d+/=\s]+$/i.test(raw)) return raw;
  if (/^(?:data|blob|javascript|vbscript):/i.test(raw) || raw.startsWith('//')) return '';
  try {
    const parsed = new URL(raw, 'https://document.invalid/');
    if (!['http:', 'https:', ...(!image ? ['mailto:', 'tel:'] : [])].includes(parsed.protocol)) return '';
    return raw;
  } catch { return ''; }
}

export const documentImageAttribute = value => escapeDocumentText(documentUrl(value, true));

const safeStyle = style => String(style || '').split(';').flatMap(declaration => {
  const colon = declaration.indexOf(':');
  if (colon < 0) return [];
  const key = declaration.slice(0, colon).trim().toLowerCase();
  const value = declaration.slice(colon + 1).trim();
  if (!/^(?:color|background(?:-color)?|font-weight|font-style|font-size|font-family|text-decoration|text-align|line-height|letter-spacing|white-space|display|vertical-align|width|height|min-width|max-width|min-height|max-height|object-fit|margin(?:-(?:top|right|bottom|left))?|padding(?:-(?:top|right|bottom|left))?|border(?:-(?:color|width|style|radius))?)$/.test(key)) return [];
  if (!value || /(?:url\s*\(|expression\s*\(|@|[\\<>\u0000-\u001f\u007f])/i.test(value)) return [];
  return [`${key}:${value}`];
}).join(';');

if (typeof DOMPurify.addHook === 'function') {
  DOMPurify.addHook('afterSanitizeAttributes', node => {
    if (node.hasAttribute('style')) {
      const style = safeStyle(node.getAttribute('style'));
      if (style) node.setAttribute('style', style); else node.removeAttribute('style');
    }
    for (const name of ['href', 'src']) {
      if (!node.hasAttribute(name)) continue;
      const value = documentUrl(node.getAttribute(name), name === 'src');
      if (value) node.setAttribute(name, value); else node.removeAttribute(name);
    }
    if (node.tagName === 'A') {
      if (node.getAttribute('target') !== '_blank') node.removeAttribute('target');
      else node.setAttribute('rel', 'noopener noreferrer');
    }
  });
}

export function sanitizeDocumentHTML(value) {
  // A non-browser caller fails closed; the bundled purifier uses the real browser DOM.
  if (typeof DOMPurify.sanitize !== 'function') return escapeDocumentText(value);
  return DOMPurify.sanitize(String(value ?? ''), {
    ALLOWED_TAGS: ['b', 'strong', 'em', 'i', 'u', 's', 'span', 'br', 'p', 'div', 'ul', 'ol', 'li', 'a', 'img', 'small', 'sub', 'sup', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'table', 'thead', 'tbody', 'tr', 'td', 'th'],
    ALLOWED_ATTR: ['style', 'class', 'href', 'src', 'alt', 'title', 'target', 'rel', 'colspan', 'rowspan'],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
  });
}

export const documentTextWithoutBreaks = value => escapeDocumentText(String(value ?? '').replace(/<br\s*\/?>/gi, ' '));
