const FRAGMENT_REPLACEMENTS = new Map([
  ['deng', 'dengan'],
  ['sebaga', 'sebagai'],
  ['dala', 'dalam'],
  ['untu', 'untuk'],
  ['kepad', 'kepada'],
  ['daripad', 'daripada'],
  ['bahaw', 'bahawa'],
  ['adal', 'adalah'],
  ['tida', 'tidak'],
  ['bole', 'boleh'],
  ['sert', 'serta'],
  ['anta', 'antara'],
  ['iait', 'iaitu'],
]);

function preserveCase(source, replacement) {
  if (!source) return replacement;
  if (source === source.toUpperCase()) return replacement.toUpperCase();
  if (source[0] === source[0].toUpperCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

function capitalizeSentenceStarts(text) {
  if (!text) return '';
  let out = '';
  let needCap = true;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (needCap && /[a-zA-Z]/.test(c)) {
      out += c.toUpperCase();
      needCap = false;
    } else {
      out += c;
      if (/[.!?]/.test(c)) needCap = true;
    }
  }
  return out;
}

function dropTrailingIncompleteSentence(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) return '';

  if (/[.!?]["')\]]*\s*$/.test(trimmed)) return trimmed;

  const lastTerminal = Math.max(
    trimmed.lastIndexOf('.'),
    trimmed.lastIndexOf('!'),
    trimmed.lastIndexOf('?')
  );

  if (lastTerminal === -1) return trimmed;

  return trimmed.slice(0, lastTerminal + 1).trim();
}

export function cleanDisplayExcerpt(text) {
  if (!text || typeof text !== 'string') return '';

  let out = text
    .replace(/[{}@$%#^*_=|~`\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  out = out.replace(/\b([A-Za-z]+)\b/g, (match) => {
    const replacement = FRAGMENT_REPLACEMENTS.get(match.toLowerCase());
    return replacement ? preserveCase(match, replacement) : match;
  });

  out = out
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/\[\s+/g, '[')
    .replace(/\s+\]/g, ']')
    .replace(/\s{2,}/g, ' ')
    .trim();

  out = dropTrailingIncompleteSentence(out);
  return capitalizeSentenceStarts(out);
}

export function getExcerptPreview(text, maxLength = 220) {
  const cleaned = cleanDisplayExcerpt(text);
  if (!cleaned) return '';
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength).trim()}…`;
}
