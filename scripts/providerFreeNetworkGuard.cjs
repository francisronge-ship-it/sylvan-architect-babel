'use strict';

const dgram = require('node:dgram');
const dns = require('node:dns');
const http = require('node:http');
const https = require('node:https');
const net = require('node:net');
const tls = require('node:tls');

const FAILURE_CODE = 'BABEL_PROVIDER_FREE_NETWORK_DENIED';
const GUARDED_SURFACES = Object.freeze([
  'dgram.createSocket',
  'dns.lookup',
  'dns.resolve',
  'dns.promises.lookup',
  'dns.promises.resolve',
  'fetch',
  'http.get',
  'http.request',
  'https.get',
  'https.request',
  'net.connect',
  'net.createConnection',
  'tls.connect'
]);
const attempts = [];
const makeNetworkError = (surface) => {
  attempts.push(surface);
  const error = new Error(
    `Provider-free baseline denied network access through ${surface}.`
  );
  error.code = FAILURE_CODE;
  return error;
};
const denySync = (surface) => () => {
  throw makeNetworkError(surface);
};
const denyAsync = (surface) => async () => {
  throw makeNetworkError(surface);
};

dgram.createSocket = denySync('dgram.createSocket');
dns.lookup = denySync('dns.lookup');
dns.resolve = denySync('dns.resolve');
dns.promises.lookup = denyAsync('dns.promises.lookup');
dns.promises.resolve = denyAsync('dns.promises.resolve');
http.request = denySync('http.request');
http.get = denySync('http.get');
https.request = denySync('https.request');
https.get = denySync('https.get');
net.connect = denySync('net.connect');
net.createConnection = denySync('net.createConnection');
tls.connect = denySync('tls.connect');
globalThis.fetch = denyAsync('fetch');

Object.defineProperty(globalThis, '__BABEL_PROVIDER_FREE_NETWORK_GUARD__', {
  configurable: false,
  enumerable: false,
  value: Object.freeze({
    active: true,
    failureCode: FAILURE_CODE,
    guardedSurfaces: GUARDED_SURFACES,
    getAttempts: () => attempts.slice(),
    resetAttempts: () => {
      attempts.length = 0;
    },
    version: 1
  }),
  writable: false
});

process.once('beforeExit', () => {
  if (attempts.length === 0) return;
  process.exitCode = 86;
  process.stderr.write(
    `Provider-free network guard observed denied runtime attempts: ${attempts.join(', ')}\n`
  );
});
