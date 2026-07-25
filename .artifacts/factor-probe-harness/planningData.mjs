const CONFIG_ERROR_CODE = 'INVALID_FACTOR_PROBE_CONFIG';
const SAFE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;

export const failPlanningConfig = (message) => {
  const error = new Error(message);
  error.code = CONFIG_ERROR_CODE;
  throw error;
};

export const isPlainRecord = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

export const requireRecord = (value, path) => {
  if (!isPlainRecord(value)) failPlanningConfig(`${path} must be an object.`);
  return value;
};

export const requireText = (value, path) => {
  if (typeof value !== 'string' || !value.trim()) {
    failPlanningConfig(`${path} must be a non-empty string.`);
  }
  return value;
};

export const requireSafeId = (value, path) => {
  requireText(value, path);
  if (!SAFE_ID_RE.test(value)) {
    failPlanningConfig(`${path} must contain only safe receipt-id characters.`);
  }
  return value;
};

export const requireExactFields = (value, fields, path) => {
  requireRecord(value, path);
  const actual = Object.keys(value).sort();
  const expected = [...fields].sort();
  if (
    actual.length !== expected.length
    || actual.some((field, index) => field !== expected[index])
  ) {
    const missing = expected.filter((field) => !actual.includes(field));
    const extra = actual.filter((field) => !expected.includes(field));
    failPlanningConfig(
      `${path} fields must be exact; missing=[${missing.join(',')}], extra=[${extra.join(',')}].`
    );
  }
};

export const requireFiniteNumber = (value, path, { maximum, minimum } = {}) => {
  if (!Number.isFinite(value)) failPlanningConfig(`${path} must be a finite number.`);
  if (typeof minimum === 'number' && value < minimum) {
    failPlanningConfig(`${path} must be at least ${minimum}.`);
  }
  if (typeof maximum === 'number' && value > maximum) {
    failPlanningConfig(`${path} must be at most ${maximum}.`);
  }
  return value;
};

export const requireNonnegativeInteger = (value, path) => {
  if (!Number.isInteger(value) || value < 0) {
    failPlanningConfig(`${path} must be a nonnegative integer.`);
  }
  return value;
};

const assertJsonData = (value, path, ancestors) => {
  if (
    value === null
    || typeof value === 'string'
    || typeof value === 'boolean'
  ) {
    return;
  }
  if (typeof value === 'number') {
    requireFiniteNumber(value, path);
    return;
  }
  if (!value || typeof value !== 'object') {
    failPlanningConfig(`${path} must be JSON data.`);
  }
  if (ancestors.has(value)) failPlanningConfig(`${path} must not contain a cycle.`);
  ancestors.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertJsonData(item, `${path}[${index}]`, ancestors));
  } else {
    requireRecord(value, path);
    Object.entries(value).forEach(([key, item]) => (
      assertJsonData(item, `${path}.${key}`, ancestors)
    ));
  }
  ancestors.delete(value);
};

const deepFreeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
};

export const cloneFrozenJson = (value, path = '$') => {
  assertJsonData(value, path, new Set());
  return deepFreeze(structuredClone(value));
};
