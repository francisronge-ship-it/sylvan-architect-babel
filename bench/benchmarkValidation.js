import { copyJsonData, isPlainRecord } from './jsonData.js';

export const assertExactFields = (value, expectedFields, path) => {
  if (!isPlainRecord(value)) throw new TypeError(`${path} must be an object.`);
  const actualFields = Object.keys(value);
  const missing = expectedFields.filter((field) => !Object.hasOwn(value, field));
  const extra = actualFields.filter((field) => !expectedFields.includes(field));
  if (missing.length > 0 || extra.length > 0) {
    throw new TypeError(
      `${path} fields must be exact; missing=[${missing.join(',')}], extra=[${extra.join(',')}].`
    );
  }
};

export const assertNonemptyText = (value, path) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${path} must be a non-empty string.`);
  }
};

export const assertTextChoice = (value, choices, path) => {
  assertNonemptyText(value, path);
  if (!choices.includes(value)) {
    throw new TypeError(`${path} must be one of [${choices.join(',')}].`);
  }
};

export const assertUniqueTextArray = (value, path, { allowEmpty = false } = {}) => {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    throw new TypeError(`${path} must be ${allowEmpty ? 'an' : 'a non-empty'} array.`);
  }
  value.forEach((entry, index) => assertNonemptyText(entry, `${path}[${index}]`));
  if (new Set(value).size !== value.length) {
    throw new TypeError(`${path} must not contain duplicates.`);
  }
};

export const assertJsonRecord = (value, path) => {
  if (!isPlainRecord(value)) throw new TypeError(`${path} must be an object.`);
  copyJsonData(value, path);
};

export const sameTextSet = (left, right) => (
  left.length === right.length
  && left.every((entry) => right.includes(entry))
);
