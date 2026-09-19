const Redis = require('ioredis');
const env = require('./env');

class InMemoryRedisFallback {
  constructor() {
    this.store = new Map();
    this.expirations = new Map();
    this.isFallback = true;
    console.log('[Redis] Running in resilient in-memory fallback mode (external Redis server not connected).');
  }

  async get(key) {
    if (this._isExpired(key)) {
      this.del(key);
      return null;
    }
    return this.store.get(key) || null;
  }

  async set(key, value) {
    this.store.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
    return 'OK';
  }

  async setex(key, seconds, value) {
    await this.set(key, value);
    this.expirations.set(key, Date.now() + (seconds * 1000));
    return 'OK';
  }

  async del(key) {
    this.expirations.delete(key);
    return this.store.delete(key) ? 1 : 0;
  }

  async exists(key) {
    if (this._isExpired(key)) {
      this.del(key);
      return 0;
    }
    return this.store.has(key) ? 1 : 0;
  }

  async flushall() {
    this.store.clear();
    this.expirations.clear();
    return 'OK';
  }

  // Mutex lock acquisition helper
  async acquireLock(lockKey, ttlSeconds = 5) {
    if (await this.exists(lockKey)) {
      return false;
    }
    await this.setex(lockKey, ttlSeconds, 'LOCKED');
    return true;
  }

  async releaseLock(lockKey) {
    await this.del(lockKey);
    return true;
  }

  _isExpired(key) {
    const exp = this.expirations.get(key);
    if (!exp) return false;
    return Date.now() > exp;
  }
}

let redisClient = null;

/**
 * Augment an ioredis client instance with acquireLock and releaseLock helpers
 * Uses SET key value NX EX ttl for atomic distributed lock acquisition
 */
function augmentWithLockMethods(client) {
  client.acquireLock = async function(lockKey, ttlSeconds = 5) {
    // SET lockKey "LOCKED" NX EX ttlSeconds
    const result = await this.set(lockKey, 'LOCKED', 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  };
  client.releaseLock = async function(lockKey) {
    await this.del(lockKey);
    return true;
  };
  return client;
}

const getRedisClient = () => {
  if (redisClient) return redisClient;

  // Default: use in-memory fallback immediately (no blocking startup)
  redisClient = new InMemoryRedisFallback();

  if (env.REDIS_URL) {
    try {
      const client = new Redis(env.REDIS_URL, {
        maxRetriesPerRequest: 1,
        retryStrategy: () => null, // don't hang if offline
        lazyConnect: true
      });

      augmentWithLockMethods(client);

      client.on('error', (err) => {
        console.warn(`[Redis] Connection warning: ${err.message}. Falling back to in-memory store.`);
        if (!redisClient.isFallback) {
          redisClient = new InMemoryRedisFallback();
        }
      });

      client.connect().then(() => {
        console.log('[Redis] Connected to external Redis instance successfully.');
        redisClient = client;
      }).catch(() => {
        console.log('[Redis] External Redis offline; engaging in-memory fallback.');
        // Already set to in-memory, nothing to do
      });
    } catch (e) {
      // Already using in-memory fallback
    }
  }

  return redisClient;
};

module.exports = {
  getRedisClient,
  InMemoryRedisFallback
};
