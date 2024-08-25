# API Rate Limiter

## Objective
Expressjs poject written in Typescipt, which adds rate limiter to an api (middleware), while using using Redis to keep track of api counts.

**Note**
- redis client should be installed on the system

## Run the code
```sh
npm start
```

### Curl command to call the api and a unauthenticated user
```sh
curl --location 'localhost:3002'
```

### Curl command to call the api and a authenticated user
```sh
curl --location 'localhost:3002' \
--header 'Authorization: Bearer customToken'
```

### Customise rate limiter
- to customise rate limiter please navigate to `/src/config/rateLimiterConfig.ts` file

```typescript
export const defaultConfig: RateLimitConfigInterface = {
  ttl: convertToMs(1, 'hour'), // time to live for the request this is set to 1 hour
  unauthLimit: {
    limit: 100, // request allow with respect to ttl, here is 100 request in an hour
    slidingLog: { // Sliding window 10 request in 1 minute
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
      startTime: moment('23/08/2024, 17:05', 'DD/MM/YYYY, HH:mm').toDate(), // when the event starts
      endTime: moment('23/08/2024, 17:35', 'DD/MM/YYYY, HH:mm').toDate(), // when the event ends
      rateLimit: { // rate limit for the sale event
        limit: 400, // Increased limit during the sale
        slidingLog: {
          windowSize: convertToMs(1, 'min'),
          maxRequests: 20,
        },
      },
    },
  ],
};
```

### Calling Special event
Change the `startTime` and `endTime` in the config file  `/src/config/rateLimiterConfig.ts`

```typescript
{
...
override: [
    {
      url: '/sale', // special event path
      startTime: moment('23/08/2024, 17:05', 'DD/MM/YYYY, HH:mm').toDate(), // when the event starts
      endTime: moment('23/08/2024, 17:35', 'DD/MM/YYYY, HH:mm').toDate(), // when the event ends
      ...
    },
...
}

```

Call the endpoint for special event
```sh
curl --location 'localhost:3002/sale'
```

### Adding multiple special events
Add below object to `override` object in config file located here `/src/config/rateLimiterConfig.ts`

```typescript
{
...
override: [
    {
      ...
    },
    {
      url: '/presale', // special event path
      startTime: moment('25/08/2024, 17:05', 'DD/MM/YYYY, HH:mm').toDate(), // when the event starts
      endTime: moment('25/08/2024, 17:35', 'DD/MM/YYYY, HH:mm').toDate(), // when the event ends
      rateLimit: { // rate limit for the sale event
        limit: 500, // Increased limit during the presale
        slidingLog: {
          windowSize: convertToMs(1, 'min'),
          maxRequests: 50, // allowing 50 requests per min
        },
      },
    },
...
}

```

Call the endpoint for special event
```sh
curl --location 'localhost:3002/presale'
```

## Run test
```sh
npm test
```

## Running in production
```sh
npm run build-run
```