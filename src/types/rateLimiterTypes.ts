export type RateLimit = {
  limit: number;
  slidingLog: {
    windowSize: number;
    maxRequests: number;
  };
};

export type OverriderEvent = {
  url: string;
  startTime: Date;
  endTime: Date;
  rateLimit: RateLimit;
};

export type RateLimitConfigInterface = {
  ttl: number;
  authLimit: RateLimit;
  unauthLimit: RateLimit;
  override: OverriderEvent[];
}

export type RateLimitResult = {
  isNotAllowed: boolean;
  requests: number;
  ttl: number;
};
