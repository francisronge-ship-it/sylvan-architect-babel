const normalizeParsedRoot = (value) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  return null;
};

const CLOSE_TO_OPEN = {
  '}': '{',
  ']': '['
};

const OPEN_TO_CLOSE = {
  '{': '}',
  '[': ']'
};

const repairDelimiterDamage = (candidate) => {
  let output = '';
  const stack = [];
  let inString = false;
  let escaped = false;
  let repaired = false;

  for (const char of candidate) {
    output += char;

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{' || char === '[') {
      stack.push(char);
      continue;
    }

    if (char !== '}' && char !== ']') continue;

    const expectedOpen = CLOSE_TO_OPEN[char];
    if (stack[stack.length - 1] === expectedOpen) {
      stack.pop();
      continue;
    }

    const matchingOpenIndex = stack.lastIndexOf(expectedOpen);
    if (matchingOpenIndex >= 0) {
      output = output.slice(0, -1);
      while (stack.length > 0 && stack[stack.length - 1] !== expectedOpen) {
        output += OPEN_TO_CLOSE[stack.pop()];
        repaired = true;
      }
      output += char;
      stack.pop();
      repaired = true;
      continue;
    }

    output = output.slice(0, -1);
    repaired = true;
  }

  while (stack.length > 0) {
    output += OPEN_TO_CLOSE[stack.pop()];
    repaired = true;
  }

  return repaired ? output : null;
};

const createBadJsonError = (createError) => {
  if (typeof createError === 'function') {
    return createError('BAD_MODEL_RESPONSE', 'Model returned malformed JSON.', 502);
  }
  return new Error('Model returned malformed JSON.');
};

const parseStrictJsonCandidate = (candidate, createError, integrityFlags = []) => {
  let parsed;
  try {
    parsed = JSON.parse(candidate);
  } catch (initialError) {
    const repairedCandidate = repairDelimiterDamage(candidate);
    if (!repairedCandidate) {
      throw createBadJsonError(createError);
    }
    try {
      parsed = JSON.parse(repairedCandidate);
      integrityFlags.push('json_delimiter_damage_repaired');
    } catch {
      throw createBadJsonError(createError);
    }
  }

  const normalized = normalizeParsedRoot(parsed);
  if (!normalized) {
    throw createBadJsonError(createError);
  }
  return normalized;
};

export const parseStrictModelJsonDetailed = (rawText, createError) => {
  const text = String(rawText || '')
    .replace(/^\uFEFF/, '')
    .trim();
  if (!text) {
    throw createBadJsonError(createError);
  }

  const integrityFlags = [];
  return {
    payload: parseStrictJsonCandidate(text, createError, integrityFlags),
    integrityFlags
  };
};

export const parseStrictModelJson = (rawText, createError) =>
  parseStrictModelJsonDetailed(rawText, createError).payload;
