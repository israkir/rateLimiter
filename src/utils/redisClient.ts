import Redis from 'ioredis';
import { RateLimit, RateLimitResult } from '../types';

export class RedisClient {
  private client: Redis;

  constructor(redisUrl: string) {
    this.client = new Redis(redisUrl);
  }

  // removing specific key from redis
  async removeKey(key: string) {
    await this.client.del(key);
  }

  async incrExpireCalcSlidingLog(key: string, configTtl: number, ratelimit: RateLimit): Promise<RateLimitResult> {
    // increment and retuen time to live
    const [requests, ttl] = await this.incrAndExpire(key, configTtl);

    // calculating slider log for a specific time frame
    // and now allowing user to go beyond that
    const isNotAllowed = await this.calcSliderLog(
      `${key}-slide`,
      ratelimit.slidingLog.windowSize,
      ratelimit.slidingLog.maxRequests
    );

    return { isNotAllowed, requests, ttl };
  }

  // incrementing the key and also adding and expire time to it
  // and returning back the total count of the key
  // and time to live and milliseconds
  async incrAndExpire(key: string, windowMs: number): Promise<[number, number]> {
    // this.removeKey(key)

    const multi = this.client.multi();
    multi.incr(key);
    multi.pttl(key);
    const result = await multi.exec();

    if (!result || result.length !== 2 || result[0][0] || result[1][0]) {
      throw new Error('Unexpected result from Redis');
    }

    const count = result[0][1] as number;
    const ttl = result[1][1] as number;

    if (ttl && ttl === -1) {
      await this.client.pexpire(key, windowMs);
      return [count, windowMs];
    }

    return [count, ttl];
  }

  // sliding log allowed or not
  async calcSliderLog(key: string, windowSizeMs: number, maxRequests: number): Promise<boolean> {
    // this.removeKey(key)

    const now = Date.now();

    const windowStart = now - windowSizeMs;

    // Start a Redis transaction
    const multi = this.client.multi();

    // Remove timestamps outside the current window
    multi.zremrangebyscore(key, 0, windowStart);

    // Count requests within the current window
    multi.zcard(key);

    // Add current timestamp to the sorted set
    multi.zadd(key, now.toString(), now.toString());

    // Set expiration for the key
    multi.pexpire(key, windowSizeMs);

    // Execute the transaction
    const results = await multi.exec();

    if (!results) {
      throw new Error('Redis transaction failed');
    }

    // The count is the second command's result (zcard)
    const count = results[1][1] as number;

    return count > maxRequests;
  }
}
