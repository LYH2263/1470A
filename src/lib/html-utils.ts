export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<\/div>/gi, ' ')
    .replace(/<\/li>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeChinese(text: string): string {
  const chars = text.split('');
  const tokens: string[] = [];
  let current = '';

  for (const ch of chars) {
    if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(ch)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      tokens.push(ch);
    } else if (/[\w]/.test(ch)) {
      current += ch;
    } else {
      if (current) {
        tokens.push(current);
        current = '';
      }
    }
  }
  if (current) {
    tokens.push(current);
  }

  return tokens.join(' ');
}

export function buildFtsQuery(keyword: string): string {
  const escaped = keyword.replace(/"/g, '""');
  const terms = escaped.split(/\s+/).filter(Boolean);
  if (terms.length === 0) return '';
  if (terms.length === 1) return `"${terms[0]}"*`;
  return terms.map((t) => `"${t}"*`).join(' AND ');
}
