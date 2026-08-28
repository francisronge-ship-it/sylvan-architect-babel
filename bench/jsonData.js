export const isPlainRecord = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
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
  let cloned;
  if (Array.isArray(value)) {
    cloned = value.map((item, index) => copyJsonData(item, `${path}[${index}]`, ancestors));
  } else {
    if (!isPlainRecord(value)) {
      throw new TypeError(`${path} must contain only plain JSON objects.`);
    }
    cloned = Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key,
      copyJsonData(item, `${path}.${key}`, ancestors)
    ]));
  }
  ancestors.delete(value);
  return cloned;
};

export const freezeJsonData = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freezeJsonData);
  return Object.freeze(value);
};

export const canonicalizeJsonData = (value) => {
  if (Array.isArray(value)) return value.map(canonicalizeJsonData);
  if (!isPlainRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, canonicalizeJsonData(value[key])])
  );
};
