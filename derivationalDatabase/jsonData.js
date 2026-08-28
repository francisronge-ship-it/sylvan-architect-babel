export const isPlainRecord = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

export const requirePlainRecord = (value, path) => {
  if (!isPlainRecord(value)) throw new TypeError(`${path} must be a plain object.`);
};

export const requireExactFields = (value, fields, path) => {
  requirePlainRecord(value, path);
  const actual = Object.keys(value).sort();
  const expected = [...fields].sort();
  if (
    actual.length !== expected.length
    || actual.some((field, index) => field !== expected[index])
  ) {
    throw new TypeError(`${path} must contain exactly: ${fields.join(', ')}.`);
  }
};

export const requireNonemptyString = (value, path) => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${path} must be a nonempty string.`);
  }
};

export const requireSha256 = (value, path) => {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/u.test(value)) {
    throw new TypeError(`${path} must be a lowercase SHA-256 digest.`);
  }
};

export const copyJsonData = (value, path = '$', ancestors = new Set()) => {
  if (
    value === null
    || typeof value === 'string'
    || typeof value === 'boolean'
  ) {
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`${path} must be finite JSON data.`);
    return value;
  }
  if (!value || typeof value !== 'object') {
    throw new TypeError(`${path} must be JSON data.`);
  }
  if (ancestors.has(value)) throw new TypeError(`${path} must not contain a cycle.`);
  ancestors.add(value);
  let copy;
  if (Array.isArray(value)) {
    copy = value.map((item, index) => copyJsonData(item, `${path}[${index}]`, ancestors));
  } else {
    requirePlainRecord(value, path);
    copy = Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key,
      copyJsonData(item, `${path}.${key}`, ancestors)
    ]));
  }
  ancestors.delete(value);
  return copy;
};

export const freezeJsonData = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freezeJsonData);
  return Object.freeze(value);
};

const canonicalizeJsonData = (value) => {
  if (Array.isArray(value)) return value.map(canonicalizeJsonData);
  if (!isPlainRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, canonicalizeJsonData(value[key])])
  );
};

const serializeCanonicalJson = (value) => {
  if (value === null || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') return Object.is(value, -0) ? '-0' : String(value);
  if (Array.isArray(value)) {
    return `[${value.map(serializeCanonicalJson).join(',')}]`;
  }
  return `{${Object.entries(value).map(([key, item]) =>
    `${JSON.stringify(key)}:${serializeCanonicalJson(item)}`).join(',')}}`;
};

export const canonicalJson = (value) =>
  serializeCanonicalJson(canonicalizeJsonData(value));
