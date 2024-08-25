import moment from 'moment';
import { RateLimitConfigInterface } from '../types';
import { convertToMs } from '../utils';

export const defaultConfig: RateLimitConfigInterface = {
  ttl: convertToMs(1, 'hour'), // time to live for the request this is set to 1 hour
  unauthLimit: {
    limit: 100, // request allow with respect to ttl, here is 100 request in an hour
    slidingLog: {
      // Sliding window 10 request in 1 minute
      windowSize: convertToMs(1, 'min'),
      maxRequests: 10,
    },
  },
  authLimit: {
    limit: 200,
    slidingLog: {
      windowSize: convertToMs(1, 'min'),
      maxRequests: 5,
    },
  },
  override: [
    {
      url: '/sale', // special event path
      startTime: moment('25/08/2024, 17:05', 'DD/MM/YYYY, HH:mm').toDate(), // when the event starts
      endTime: moment('25/08/2024, 17:35', 'DD/MM/YYYY, HH:mm').toDate(), // when the event ends
      rateLimit: {
        // rate limit for the sale event
        limit: 400, // Increased limit during the sale
        slidingLog: {
          windowSize: convertToMs(1, 'min'),
          maxRequests: 20,
        },
      },
    },
  ],
};
