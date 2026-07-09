export const stringifyDerivationAtom = (value) => String(value || '').trim();

const unwrapCategoryWrapper = (value) => {
  const raw = stringifyDerivationAtom(value);
  if (!raw) return null;
  const match = raw.match(/^([A-Za-z][A-Za-z0-9'_-]*)\s*\((.+)\)$/);
  if (!match) return null;
  const category = stringifyDerivationAtom(match[1]);
  const inner = stringifyDerivationAtom(match[2]);
  return category && inner ? { category, inner } : null;
};

export const normalizeDerivationDisplay = (
  value,
  { categoryHint = '', preferInner = false } = {}
) => {
  const raw = stringifyDerivationAtom(value);
  if (!raw) return '';
  const wrapper = unwrapCategoryWrapper(raw);
  if (!wrapper) return raw;
  if (/^(?:∅|null(?:\s+[A-Za-z]+)*)$/i.test(wrapper.inner)) return wrapper.category;
  const hinted = stringifyDerivationAtom(categoryHint);
  if (hinted && wrapper.category.toLowerCase() === hinted.toLowerCase()) return wrapper.inner;
  return preferInner ? wrapper.inner : raw;
};

export const humanizeDerivationId = (value) => {
  const raw = stringifyDerivationAtom(value);
  if (!raw) return '';
  const wrapper = unwrapCategoryWrapper(raw);
  if (wrapper) return wrapper.inner;
  const indexedShellMatch = raw.match(/^([A-Za-z][A-Za-z0-9']*)(\d+)$/);
  if (indexedShellMatch) return indexedShellMatch[1];
  return raw
    .replace(/[_-]+/g, ' ')
    .replace(/\b(mat|matrix|emb|embedded|subj|obj|arg|comp)\b/gi, (token) => token.toLowerCase())
    .replace(/\s+/g, ' ')
    .trim();
};
