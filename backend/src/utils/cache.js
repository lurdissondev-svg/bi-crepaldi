import NodeCache from 'node-cache';
import config from '../config/index.js';

const cache = new NodeCache({
  stdTTL: config.cache.ttl,
  checkperiod: 120,
  useClones: false,
});

export const cacheMiddleware = (keyGenerator) => {
  return (req, res, next) => {
    const key = typeof keyGenerator === 'function'
      ? keyGenerator(req)
      : `${req.method}-${req.originalUrl}`;

    const cachedData = cache.get(key);

    if (cachedData) {
      return res.json(cachedData);
    }

    res.sendResponse = res.json;
    res.json = (body) => {
      cache.set(key, body);
      res.sendResponse(body);
    };

    next();
  };
};

export const clearCache = (pattern) => {
  if (pattern) {
    const keys = cache.keys().filter(key => key.includes(pattern));
    keys.forEach(key => cache.del(key));
  } else {
    cache.flushAll();
  }
};

export default cache;
