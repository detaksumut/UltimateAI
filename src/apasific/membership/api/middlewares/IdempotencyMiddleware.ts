import { Request, Response, NextFunction } from 'express';

// Mock Redis Store for Idempotency
const idempotencyStore = new Map<string, any>();

/**
 * IdempotencyMiddleware
 * Guarantees that mutating Command APIs (POST/PUT) do not execute twice if retried.
 */
export const IdempotencyMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Only intercept mutating requests
  if (req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'PATCH') {
    return next();
  }

  const idempotencyKey = req.header('Idempotency-Key');
  if (!idempotencyKey) {
    return res.status(400).json({
      code: 'MEMBERSHIP_API_001',
      message: 'Idempotency-Key header is strictly required for mutating requests.'
    });
  }

  // Check if we already processed this key
  if (idempotencyStore.has(idempotencyKey)) {
    const cachedResponse = idempotencyStore.get(idempotencyKey);
    return res.status(cachedResponse.status).json(cachedResponse.body);
  }

  // Hook into response to cache it after execution
  const originalSend = res.send;
  res.send = function(body) {
    idempotencyStore.set(idempotencyKey, {
      status: res.statusCode,
      body: JSON.parse(body) // Simplified for demonstration
    });
    return originalSend.call(this, body);
  };

  next();
};
