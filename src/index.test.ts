import express from 'express';
import request from 'supertest';
import { RateLimiter } from './middleware';
import { RedisRateLimitService } from './services';
import { RateLimitConfigInterface } from './types';
import { convertToMs } from './utils';

jest.mock('./services/redisRateLimitService');
jest.mock('pino', ()=> {
  return () => {
    return {
      info: jest.fn(),
      error: jest.fn()
    }
  }
});

describe('RateLimiter Middleware', () => {
  let app: express.Application;
  let rateLimiter: RateLimiter;
  let mockRedisRateLimitService: jest.Mocked<RedisRateLimitService>;
  let mockConfig: RateLimitConfigInterface;

  beforeEach(() => {
    app = express();
    mockRedisRateLimitService = new RedisRateLimitService('') as jest.Mocked<RedisRateLimitService>;
    mockConfig = {
      ttl: 3000,
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
        {
          url: '/off-sale',
          startTime: new Date(Date.now() - 2 * 3600000), // 1 hour ago
          endTime: new Date(Date.now() - 3600000), // 1 hour from now
          rateLimit: {
            limit: 2,
            slidingLog: {
              windowSize: convertToMs(1, 'min'),
              maxRequests: 5,
            },
          },
        },
      ],
    };
    rateLimiter = new RateLimiter(mockRedisRateLimitService, mockConfig);

    app.use(rateLimiter.middleware);
    app.get('/test', (req, res) => res.sendStatus(200));
    app.get('/special', (req, res) => res.sendStatus(200));
    app.get('/off-sale', (req, res) => res.sendStatus(200));
  });

  test('Should allow requests within rate limit', async () => {
    mockRedisRateLimitService.incrExpireCalcSlidingLog.mockResolvedValue({
      isNotAllowed: false,
      requests: 5,
      ttl: 3000,
    });

    const response = await request(app).get('/test');

    expect(response.status).toBe(200);
    expect(response.headers['x-ratelimit-limit']).toBe('10');
    expect(response.headers['x-ratelimit-remaining']).toBe('5');
    expect(response.headers['x-ratelimit-reset']).toBeDefined();
  });

  test('Should block requests exceeding rate limit', async () => {
    mockRedisRateLimitService.incrExpireCalcSlidingLog.mockResolvedValue({
      isNotAllowed: true,
      requests: 11,
      ttl: 3000,
    });

    const response = await request(app).get('/test');

    expect(response.status).toBe(429);
    expect(response.body).toEqual({
      error: 'Too Many Requests',
      retryAfter: 3,
    });
  });

  test('Should apply different limit for authenticated requests', async () => {
    mockRedisRateLimitService.incrExpireCalcSlidingLog.mockResolvedValue({
      isNotAllowed: false,
      requests: 15,
      ttl: 3000,
    });

    const response = await request(app).get('/test').set('Authorization', 'Bearer token');

    expect(response.status).toBe(200);
    expect(response.headers['x-ratelimit-limit']).toBe('20');
    expect(response.headers['x-ratelimit-remaining']).toBe('5');
  });

  test('Should apply override limit for special route', async () => {
    mockRedisRateLimitService.incrExpireCalcSlidingLog.mockResolvedValue({
      isNotAllowed: false,
      requests: 3,
      ttl: 3000,
    });

    const response = await request(app).get('/special');

    expect(response.status).toBe(200);
    expect(response.headers['x-ratelimit-limit']).toBe('5');
    expect(response.headers['x-ratelimit-remaining']).toBe('2');
  });

  test('Should not apply override limit for special route, time is over', async () => {
    mockRedisRateLimitService.incrExpireCalcSlidingLog.mockResolvedValue({
      isNotAllowed: false,
      requests: 3,
      ttl: 3000,
    });

    const response = await request(app).get('/off-sale');

    expect(response.status).toBe(200);
    // off sale time period, so the unauth limit will be used
    expect(response.headers['x-ratelimit-limit']).toBe('10');
    expect(response.headers['x-ratelimit-remaining']).toBe('7');
  });

  test('Should handle errors gracefully', async () => {
    mockRedisRateLimitService.incrExpireCalcSlidingLog.mockRejectedValue(new Error('Redis error'));

    const response = await request(app).get('/test');

    expect(response.status).toBe(500);
  });
});
