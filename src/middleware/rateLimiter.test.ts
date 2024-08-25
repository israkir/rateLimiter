import { Request } from 'express';
import { RateLimiter } from '.';
import { RedisRateLimitService } from '../services';
import { RateLimitConfigInterface } from '../types';
import { convertToMs } from '../utils';
import pino from 'pino';

// Mock RedisRateLimitService
jest.mock('../services/redisRateLimitService');
jest.mock('pino', ()=> {
  return () => {
    return {
      info: jest.fn()
    }
  }
});

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;
  let mockRedisRateLimitService: jest.Mocked<RedisRateLimitService>;
  let mockConfig: RateLimitConfigInterface;

  beforeEach(() => {
    mockRedisRateLimitService = new RedisRateLimitService('') as jest.Mocked<RedisRateLimitService>;
    mockConfig = {
      ttl: 3600,
      unauthLimit: {
        limit: 10,
        slidingLog: {
          windowSize: convertToMs(1, 'min'),
          maxRequests: 5,
        },
      },
      authLimit: {
        limit: 20,
        slidingLog: {
          windowSize: convertToMs(1, 'min'),
          maxRequests: 5,
        },
      },
      override: [
        {
          url: '/special',
          startTime: new Date(Date.now() - 3600000), // 1 hour ago
          endTime: new Date(Date.now() + 3600000), // 1 hour from now
          rateLimit: {
            limit: 5,
            slidingLog: {
              windowSize: convertToMs(1, 'min'),
              maxRequests: 5,
            },
          },
        },
      ],
    };
    rateLimiter = new RateLimiter(mockRedisRateLimitService, mockConfig);
  });

  const createMockRequest = (path: string, ip: string, isAuthenticated: boolean): Partial<Request> => ({
    path,
    ip,
    headers: isAuthenticated ? { authorization: 'Bearer token' } : {},
  });

  test('evaluateRateLimit for unauthenticated user', async () => {
    const mockRequest = createMockRequest('/api', '127.0.0.1', false);
    mockRedisRateLimitService.incrExpireCalcSlidingLog.mockResolvedValue({
      isNotAllowed: false,
      requests: 5,
      ttl: 3000,
    });

    const result = await rateLimiter.evaluateRateLimit(mockRequest as Request);

    expect(result).toEqual({
      tooManyRequests: false,
      retryAfter: 3,
      ratelimit: 10,
      remainingRequests: 5,
      resetTime: expect.any(Number),
    });
  });

  test('evaluateRateLimit for authenticated user', async () => {
    const mockRequest = createMockRequest('/api', '127.0.0.1', true);
    mockRedisRateLimitService.incrExpireCalcSlidingLog.mockResolvedValue({
      isNotAllowed: false,
      requests: 15,
      ttl: 3000,
    });

    const result = await rateLimiter.evaluateRateLimit(mockRequest as Request);

    expect(result).toEqual({
      tooManyRequests: false,
      retryAfter: 3,
      ratelimit: 20,
      remainingRequests: 5,
      resetTime: expect.any(Number),
    });
  });

  test('evaluateRateLimit for override event', async () => {
    const mockRequest = createMockRequest('/special', '127.0.0.1', false);
    mockRedisRateLimitService.incrExpireCalcSlidingLog.mockResolvedValue({
      isNotAllowed: false,
      requests: 3,
      ttl: 3000,
    });

    const result = await rateLimiter.evaluateRateLimit(mockRequest as Request);

    expect(result).toEqual({
      tooManyRequests: false,
      retryAfter: 3,
      ratelimit: 5,
      remainingRequests: 2,
      resetTime: expect.any(Number),
    });
  });

  test('evaluateRateLimit when too many requests', async () => {
    const mockRequest = createMockRequest('/api', '127.0.0.1', false);
    mockRedisRateLimitService.incrExpireCalcSlidingLog.mockResolvedValue({
      isNotAllowed: true,
      requests: 11,
      ttl: 3000,
    });

    const result = await rateLimiter.evaluateRateLimit(mockRequest as Request);

    expect(result).toEqual({
      tooManyRequests: true,
      retryAfter: 3,
      ratelimit: 10,
      remainingRequests: 0,
      resetTime: expect.any(Number),
    });
  });

  test('evaluateRateLimit when requests exceed limit', async () => {
    const mockRequest = createMockRequest('/api', '127.0.0.1', false);
    mockRedisRateLimitService.incrExpireCalcSlidingLog.mockResolvedValue({
      isNotAllowed: false,
      requests: 11,
      ttl: 3000,
    });

    const result = await rateLimiter.evaluateRateLimit(mockRequest as Request);

    expect(result).toEqual({
      tooManyRequests: true,
      retryAfter: 3,
      ratelimit: 10,
      remainingRequests: 0,
      resetTime: expect.any(Number),
    });
  });
});
