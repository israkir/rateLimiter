import express, { Application } from 'express';
import pino, { Logger } from 'pino';
import { defaultConfig, PORT, REDIS_URI } from './config';
import { RateLimiter } from './middleware';
import router from './routers';
import { RedisRateLimitService } from './services';

const app: Application = express();
const logger: Logger = pino();
const port: number = PORT || 3002;

// getting Rate limiter
const rateLimiter: RateLimiter = new RateLimiter(new RedisRateLimitService(REDIS_URI), defaultConfig);

// middleware
app.use(rateLimiter.middleware);

// router
app.use(router);

app.listen(port, () => {
  logger.info(`Example app listening on port ${port}`);
});
