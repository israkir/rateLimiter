import { Request } from 'express';

export type TTL_UNIT_TYPE = 'min' | 'hour';

export type EvaluateRateLimitResult = {
  tooManyRequests: boolean;
  retryAfter: number;
  ratelimit: number;
  remainingRequests: number;
  resetTime: number;
};

export interface CustomRequest extends Request {
  overrider?: boolean;
}