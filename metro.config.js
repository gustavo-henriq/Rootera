/**
 * Development only: the Metro dev server also forwards /rootera-api/* to the local
 * API (port 8000). With a tunnel (`expo start --tunnel`) the phone then needs a single
 * public address for both the app bundle and the API, and nothing on the LAN.
 * Set EXPO_PUBLIC_API_URL=metro to use it (see src/api.ts).
 */
const http = require('http');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const PREFIX = '/rootera-api';
const target = { host: '127.0.0.1', port: Number(process.env.ROOTERA_API_PORT || 8000) };

config.server = config.server || {};
const previous = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, server) => {
  const base = previous ? previous(middleware, server) : middleware;
  return (req, res, next) => {
    if (!req.url || !req.url.startsWith(PREFIX + '/')) return base(req, res, next);
    const upstream = http.request({ ...target, method: req.method, path: req.url.slice(PREFIX.length), headers: { ...req.headers, host: `${target.host}:${target.port}` } }, r => {
      res.writeHead(r.statusCode || 502, r.headers);
      r.pipe(res);
    });
    upstream.on('error', () => { res.writeHead(502, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ detail: 'The Rootera API is not running on this computer.' })); });
    req.pipe(upstream);
  };
};

module.exports = config;
