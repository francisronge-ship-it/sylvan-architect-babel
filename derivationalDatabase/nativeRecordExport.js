import { createHash } from 'node:crypto';

import {
  parseDurableRecord,
  serializeDurableRecord
} from './durableRecord.js';
import {
  freezeJsonData,
  requireExactFields,
  requireSha256
} from './jsonData.js';
import {
  validateEvidenceBoundDurableRecord
} from './recordEnvelopeAdapter.js';

export const NATIVE_RECORD_EXPORT_SCHEMA_IDENTITY =
  'babel-native-record-export-v1';

const EXPORT_FIELDS = Object.freeze([
  'schemaVersion',
  'schemaIdentity',
  'mediaType',
  'encoding',
  'recordSha256',
  'bodySha256',
  'body'
]);

const hashUtf8 = (value) => createHash('sha256')
  .update(value, 'utf8')
  .digest('hex');

const buildExport = (record, body) => freezeJsonData({
  schemaVersion: 1,
  schemaIdentity: NATIVE_RECORD_EXPORT_SCHEMA_IDENTITY,
  mediaType: 'application/json',
  encoding: 'utf-8',
  recordSha256: record.recordSha256,
  bodySha256: hashUtf8(body),
  body
});

export const createNativeRecordExport = (input) => {
  const record = validateEvidenceBoundDurableRecord(input);
  return buildExport(record, serializeDurableRecord(record));
};

export const validateNativeRecordExport = (value) => {
  requireExactFields(value, EXPORT_FIELDS, 'nativeRecordExport');
  if (value.schemaVersion !== 1) {
    throw new TypeError('nativeRecordExport.schemaVersion must equal 1.');
  }
  if (value.schemaIdentity !== NATIVE_RECORD_EXPORT_SCHEMA_IDENTITY) {
    throw new TypeError(
      `nativeRecordExport.schemaIdentity must equal ${
        NATIVE_RECORD_EXPORT_SCHEMA_IDENTITY
      }.`
    );
  }
  if (value.mediaType !== 'application/json') {
    throw new TypeError(
      'nativeRecordExport.mediaType must equal application/json.'
    );
  }
  if (value.encoding !== 'utf-8') {
    throw new TypeError('nativeRecordExport.encoding must equal utf-8.');
  }
  requireSha256(value.recordSha256, 'nativeRecordExport.recordSha256');
  requireSha256(value.bodySha256, 'nativeRecordExport.bodySha256');
  if (typeof value.body !== 'string') {
    throw new TypeError('nativeRecordExport.body must be a string.');
  }
  if (hashUtf8(value.body) !== value.bodySha256) {
    throw new TypeError(
      'nativeRecordExport.bodySha256 does not match the exported bytes.'
    );
  }
  const record = validateEvidenceBoundDurableRecord(
    parseDurableRecord(value.body)
  );
  if (record.recordSha256 !== value.recordSha256) {
    throw new TypeError(
      'nativeRecordExport.recordSha256 does not match the exported record.'
    );
  }
  return buildExport(record, value.body);
};
