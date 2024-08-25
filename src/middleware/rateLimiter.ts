import { NextFunction, Request, Response } from 'express';
import pino, { Logger } from 'pino';
import { RedisRateLimitService } from '../services';
import { CustomRequest, EvaluateRateLimitResult, RateLimit, RateLimitConfigInterface } from '../types';
import { OverriderEvent, RateLimitResult } from '../types/rateLimiterTypes';

export class RateLimiter {
  private redisClient: RedisRateLimitService;
  private config: RateLimitConfigInterface;
  private logger: Logger;

  constructor(redisClient: RedisRateLimitService, config: RateLimitConfigInterface) {
    this.redisClient = redisClient;
    this.config = config;
    this.logger = pino();
  }

  getOverrideEvent = (url: string): RateLimit | null => {
    const currentTime: Date = new Date();

    const event: OverriderEvent | undefined = this.config.override.find(
      (event: OverriderEvent) => event.url === url && currentTime >= event.startTime && currentTime <= event.endTime
    );

    return event ? event.rateLimit : null;
  };

  evaluateRateLimit = async (req: CustomRequest): Promise<EvaluateRateLimitResult> => {
    const ip: string | undefined = req.ip;
    const endpoint: string | undefined = req.path;
    // setting up local variable
    req.overrider = false;

    // basic auth check
    const isAuthenticated: boolean = req.headers['authorization'] !== undefined;

    let ratelimit: RateLimit = this.config.unauthLimit;
    // auth user
    if (isAuthenticated) ratelimit = this.config.authLimit;

    // change to override event
    const eventLimit: RateLimit | null = this.getOverrideEvent(endpoint);

    if (eventLimit) {
      req.overrider = true;
      ratelimit = eventLimit;
    }

    const key: string = `limit:${ip}:${endpoint}:${isAuthenticated}`;

    this.logger.info(`Unique key per IP: ${key}`);
    this.logger.info(`Limit for this IP: ${ratelimit.limit}`);

    const { isNotAllowed, requests, ttl }: RateLimitResult = await this.redisClient.incrExpireCalcSlidingLog(
      key,
      this.config.ttl,
      ratelimit
    );

    // boolean value to request not allowed
    // either by ratelimit or sliding log
    const tooManyRequests: boolean = isNotAllowed || requests > ratelimit.limit;

    // calculating remaining requests, which will be send back to the user
    const remainingRequests: number = Math.max(0, ratelimit.limit - requests);
    // calculate reset value, which will also be send back to the user
    const resetTime: number = Math.ceil(Date.now() / 1000 + ttl / 1000);

    this.logger.info(`Remaining requests for this IP: ${remainingRequests}`);

    return {
      tooManyRequests,
      retryAfter: Math.ceil(ttl / 1000),
      ratelimit: ratelimit.limit,
      remainingRequests,
      resetTime,
    };
  };

  middleware = async (req: Request, res: Response, next: NextFunction) => {
    this.logger.info(`Time:", ${new Date().toISOString()}`);

    try {
      // getting the key for redis and
      // limit allowed for the user
      const { tooManyRequests, retryAfter, ratelimit, remainingRequests, resetTime }: EvaluateRateLimitResult =
        await this.evaluateRateLimit(req);

      if (tooManyRequests) {
        return res.status(429).json({
          error: 'Too Many Requests',
          retryAfter: retryAfter,
        });
      }

      // adding required headers
      res.setHeader('X-RateLimit-Limit', ratelimit);
      res.setHeader('X-RateLimit-Remaining', remainingRequests);
      res.setHeader('X-RateLimit-Reset', resetTime);

      next();
    } catch (error) {
      this.logger.error('Rate limiter error:', error);
      next(error);
    }
  };
}
